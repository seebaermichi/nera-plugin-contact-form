import { getConfig } from '@nera-static/plugin-utils'
import path from 'path'

// Defaults live here — in the plugin's config layer — never in the shipped
// browser script. Every user-facing value below is treated as a translation
// KEY: the template resolves it through the generator's `t()` helper for the
// page's language (falling back to the key itself), so a single-language site
// sees these literals and a multilingual site translates them from
// config/app.yaml. See the README's "Translations" section.
const DEFAULT_SUBJECT = 'Contact form message'
const DEFAULT_HONEYPOT = 'website'
const DEFAULT_SUBMIT_LABEL = 'Send message'
const DEFAULT_ERROR_REQUIRED = 'Please fill in all required fields.'
const DEFAULT_ERROR_EMAIL = 'Please enter a valid email address.'
const DEFAULT_CHECKBOX_CHECKED = 'Yes'
const DEFAULT_CHECKBOX_UNCHECKED = 'No'
// The class the client toggles on an invalid field. Part of the BEM contract,
// carried in config too so the browser script hard-codes nothing. Not a
// translation key — a CSS class is the same in every language.
const DEFAULT_ERROR_CLASS = 'contact-form__input--error'

// The controls the client script and template both know how to render. An
// unknown `type:` in the YAML falls back to `text` with a warning rather than
// taking the whole render down.
const SUPPORTED_TYPES = [
    'text',
    'email',
    'tel',
    'textarea',
    'select',
    'checkbox',
    'radio',
]

/**
 * Resolved per call rather than at module scope, so edits to
 * config/contact-form.yaml are picked up without restarting `npm run dev`, and
 * so the tests can point `process.cwd()` at a temp project. Mirrors
 * nera-plugin-social-media-links.
 */
function getHostConfig() {
    return (
        getConfig(path.resolve(process.cwd(), 'config/contact-form.yaml')) || {}
    )
}

// Every character becomes an HTML numeric entity, so the address never appears
// as readable text in the page source. The browser decodes the attribute back
// to the plain address for the client script. This is the default, low-effort
// obfuscation — it deters naïve address scrapers, not determined ones (see the
// README's data-protection notes).
function encodeEntities(value) {
    return value
        .split('')
        .map((char) => `&#${char.charCodeAt(0)};`)
        .join('')
}

// The address as a list of char codes. In `jsassembly` mode this is all the
// page carries — the raw address is never present in the source at all; the
// client rebuilds it with String.fromCharCode at submit time.
function toCharCodes(value) {
    return value.split('').map((char) => char.charCodeAt(0))
}

function nonEmptyString(value, fallback) {
    return typeof value === 'string' && value.trim() ? value : fallback
}

/**
 * Normalizes the `options` of a select/radio field into `{ value, label }`
 * pairs. Accepts a bare scalar (used for both value and label) or a mapping.
 * `label` is a translation key resolved in the template; `value` is the raw
 * data sent in the email and is never translated.
 */
function normalizeOptions(options) {
    if (!Array.isArray(options)) {
        return []
    }

    return options
        .map((option) => {
            if (option === null || option === undefined) {
                return null
            }

            if (typeof option === 'object' && !Array.isArray(option)) {
                const rawValue =
                    option.value !== undefined ? option.value : option.label
                const value = rawValue !== undefined ? String(rawValue) : ''
                const label =
                    option.label !== undefined ? String(option.label) : value

                if (value === '' && label === '') {
                    return null
                }

                return { value, label }
            }

            const scalar = String(option)

            return { value: scalar, label: scalar }
        })
        .filter(Boolean)
}

/**
 * Turns whatever the `fields:` key yielded into a clean list of field
 * definitions. A malformed entry (a dangling `-`, a scalar, a nameless
 * mapping) is dropped with a warning rather than reaching the template and
 * failing the whole site build — the same guard nera-plugin-social-media-links
 * uses for its link list. `label` and `placeholder` are kept verbatim as
 * translation keys.
 */
function normalizeFields(fields) {
    if (!Array.isArray(fields)) {
        return []
    }

    return fields
        .map((field) => {
            if (
                field === null ||
                typeof field !== 'object' ||
                Array.isArray(field)
            ) {
                console.warn(
                    '⚠️ plugin-contact-form: ignoring a field that is not a mapping.'
                )
                return null
            }

            const name = typeof field.name === 'string' ? field.name.trim() : ''

            if (!name) {
                console.warn(
                    '⚠️ plugin-contact-form: ignoring a field with no `name`.'
                )
                return null
            }

            let type =
                typeof field.type === 'string'
                    ? field.type.trim().toLowerCase()
                    : 'text'

            if (!SUPPORTED_TYPES.includes(type)) {
                console.warn(
                    `⚠️ plugin-contact-form: unknown field type "${type}" for "${name}", falling back to "text".`
                )
                type = 'text'
            }

            const label =
                typeof field.label === 'string' && field.label.trim()
                    ? field.label
                    : name
            const placeholder =
                typeof field.placeholder === 'string' ? field.placeholder : ''
            const options =
                type === 'select' || type === 'radio'
                    ? normalizeOptions(field.options)
                    : []

            if (
                (type === 'select' || type === 'radio') &&
                options.length === 0
            ) {
                console.warn(
                    `⚠️ plugin-contact-form: field "${name}" is a ${type} with no valid options.`
                )
            }

            return {
                name,
                label,
                type,
                required: field.required === true,
                placeholder,
                options,
            }
        })
        .filter(Boolean)
}

/**
 * Exposes the form as `app.contactForm`. Synchronous by contract: an async hook
 * silently replaces `app` with a Promise and wipes every `app.*` value from
 * every page (generator D2). Returns `app` untouched when the form cannot work,
 * so the template's guard hides it.
 *
 * The user-facing values here (subject, submit label, messages, checkbox
 * labels, field labels/placeholders) are translation KEYS. The plugin does not
 * resolve them — it has no page-language context. The template resolves each
 * through the generator's `t()` at render time, so one field definition serves
 * every language. See the README's "Translations" section.
 */
export function getAppData(data) {
    const app = data?.app ?? {}
    const config = getHostConfig()

    const recipient =
        typeof config.recipient === 'string' ? config.recipient.trim() : ''

    if (!recipient) {
        console.warn(
            '⚠️ plugin-contact-form: no `recipient` configured — the contact form will not render.'
        )
        return app
    }

    const fields = normalizeFields(config.fields)

    if (fields.length === 0) {
        console.warn(
            '⚠️ plugin-contact-form: no valid `fields` configured — the contact form will not render.'
        )
        return app
    }

    const recipientMode =
        config.obfuscation === 'jsassembly' ? 'jsassembly' : 'entities'

    const honeypot = nonEmptyString(config.honeypot, DEFAULT_HONEYPOT).trim()

    // A real field sharing the honeypot's name (easy with the default
    // `website`) renders two elements with the same `id="contact-<name>"`.
    // The form still works — the client tells them apart by the
    // `data-contact-field` marker — but the HTML is invalid, so say so rather
    // than fail silently. Output is unchanged.
    if (fields.some((field) => field.name === honeypot)) {
        console.warn(
            `⚠️ plugin-contact-form: field "${honeypot}" has the same name as the honeypot — set \`honeypot:\` to a name no field uses.`
        )
    }

    const contactForm = {
        recipientMode,
        // Rendered as the honeypot input's `name` only. Nothing in the page —
        // no attribute, no config key — labels it as a trap; the client
        // identifies it structurally, as the one named control without a
        // `data-contact-field` marker.
        honeypot,
        errorClass: DEFAULT_ERROR_CLASS,
        // Translation keys — resolved in the template via `t()`.
        submitLabel: nonEmptyString(config.submit_label, DEFAULT_SUBMIT_LABEL),
        subject: nonEmptyString(config.subject, DEFAULT_SUBJECT),
        messages: {
            required: nonEmptyString(
                config.error_required,
                DEFAULT_ERROR_REQUIRED
            ),
            email: nonEmptyString(config.error_email, DEFAULT_ERROR_EMAIL),
        },
        booleanLabels: {
            checked: nonEmptyString(
                config.checkbox_checked_label,
                DEFAULT_CHECKBOX_CHECKED
            ),
            unchecked: nonEmptyString(
                config.checkbox_unchecked_label,
                DEFAULT_CHECKBOX_UNCHECKED
            ),
        },
        fields,
    }

    // Injected as HTML (see the template) so a privacy-policy link works. Also
    // translation keys — a site can resolve them to per-language HTML.
    if (nonEmptyString(config.intro_text, '')) {
        contactForm.introText = config.intro_text
    }
    if (nonEmptyString(config.consent_text, '')) {
        contactForm.consentText = config.consent_text
    }

    if (recipientMode === 'jsassembly') {
        contactForm.recipientCodes = JSON.stringify(toCharCodes(recipient))
    } else {
        contactForm.recipient = encodeEntities(recipient)
    }

    return { ...app, contactForm }
}

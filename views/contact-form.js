// Client script for plugin-contact-form. Published to assets/js/contact-form.js
// and loaded by the contact-form template. It is pure behavior: it contains no
// user-facing text and no configuration. Everything it needs — messages,
// checkbox labels, the subject, the honeypot field name, the error class — is
// read at runtime from the inert JSON block the template renders
// (`[data-contact-config]`), so all of it stays configurable and translatable
// from YAML. On submit it builds a `mailto:` link and hands it to the mail
// client; it makes no network request.
//
// The only literals here are the structural selectors that form the documented
// contract with the template (`data-contact-*`) and the email-shape regex —
// none of them is text a site owner or translator would change.
//
// `document` and `window` are referenced as free variables so the test suite
// can run the script with its own stubs (`new Function('document', 'window', …)`)
// — in the browser they resolve to the real globals.

// Deliberately permissive — the goal is to catch obvious typos, not to be an
// authority on RFC 5322. The mail client is the real validator.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-contact-form]').forEach(setupForm)
})

function setupForm(form) {
    const config = readConfig(form)
    const status = form.querySelector('[data-contact-status]')

    form.addEventListener('submit', (event) => {
        event.preventDefault()

        // Honeypot: a real visitor never sees or fills this field. A value here
        // means a bot, so drop the submission silently — no error, no mailto —
        // to give the bot no signal that it was caught. Nothing labels the trap
        // in the page; it is identified structurally, as the one named control
        // that carries no `data-contact-field` marker (real fields all do) and
        // is not a button.
        const trap = Array.from(form.elements).find(
            (element) =>
                element.name &&
                !element.hasAttribute('data-contact-field') &&
                element.type !== 'submit' &&
                element.type !== 'button'
        )
        if (trap && trap.value.trim() !== '') {
            return
        }

        clearErrors(form, status, config.errorClass)

        const fields = Array.from(form.querySelectorAll('[data-contact-field]'))
        const messages = config.messages || {}

        const missing = findMissingRequired(fields)
        if (missing.length > 0) {
            showError(status, messages.required, missing, config.errorClass)
            return
        }

        const invalidEmail = fields.find(isInvalidEmail)
        if (invalidEmail) {
            showError(status, messages.email, [invalidEmail], config.errorClass)
            return
        }

        const recipient = readRecipient(form)
        if (!recipient) {
            return
        }

        const body = fields
            .map((field) => collectValue(field, config.booleanLabels || {}))
            .filter((entry) => entry !== null)
            .map((entry) => `${entry.label}: ${entry.value}`)
            .join('\r\n')

        const mailto =
            'mailto:' +
            recipient +
            '?subject=' +
            encodeURIComponent(config.subject || '') +
            '&body=' +
            encodeURIComponent(body)

        // mailto: URLs are capped in practice (~2000 chars) by the OS/mail
        // client; a very long message may be truncated on the way in.
        window.location.href = mailto
    })
}

// The config the template rendered. An absent or malformed block yields an
// empty object rather than an exception, so a broken custom template degrades
// instead of throwing.
function readConfig(form) {
    const element = form.querySelector('[data-contact-config]')
    if (!element) {
        return {}
    }
    try {
        return JSON.parse(element.textContent) || {}
    } catch {
        return {}
    }
}

// The address, reassembled from whichever obfuscated form the template emitted.
function readRecipient(form) {
    const codesEl = form.querySelector('[data-contact-recipient-codes]')
    if (codesEl) {
        try {
            const codes = JSON.parse(
                codesEl.getAttribute('data-contact-recipient-codes')
            )
            if (Array.isArray(codes)) {
                return String.fromCharCode.apply(null, codes)
            }
        } catch {
            return ''
        }
        return ''
    }

    const entitiesEl = form.querySelector('[data-contact-recipient]')
    if (entitiesEl) {
        // The HTML parser already decoded the numeric entities in the
        // attribute, so this is the plain address.
        return entitiesEl.getAttribute('data-contact-recipient') || ''
    }

    return ''
}

function fieldType(field) {
    return (field.getAttribute('type') || field.tagName || '').toLowerCase()
}

// Returns `{ label, value }` for the email body, or null for a control that
// contributes nothing (an unchecked radio in a group).
function collectValue(field, booleanLabels) {
    const label = field.getAttribute('data-contact-label') || field.name || ''
    const type = fieldType(field)

    if (type === 'checkbox') {
        const value = field.checked
            ? booleanLabels.checked
            : booleanLabels.unchecked
        return { label, value: value || '' }
    }

    if (type === 'radio') {
        if (!field.checked) {
            return null
        }
        return { label, value: field.value }
    }

    return { label, value: field.value }
}

function findMissingRequired(fields) {
    const missing = []
    const seenRadioGroups = {}

    fields.forEach((field) => {
        if (!field.hasAttribute('required')) {
            return
        }

        const type = fieldType(field)

        if (type === 'radio') {
            const name = field.name
            if (name in seenRadioGroups) {
                return
            }
            const checked = fields.some(
                (other) => other.name === name && other.checked
            )
            seenRadioGroups[name] = checked
            if (!checked) {
                missing.push(field)
            }
            return
        }

        if (type === 'checkbox') {
            if (!field.checked) {
                missing.push(field)
            }
            return
        }

        if (field.value.trim() === '') {
            missing.push(field)
        }
    })

    return missing
}

function isInvalidEmail(field) {
    if (fieldType(field) !== 'email') {
        return false
    }
    const value = field.value.trim()
    // Emptiness is the required check's job — an optional empty email is fine.
    if (value === '') {
        return false
    }
    return !EMAIL_PATTERN.test(value)
}

function showError(status, message, fields, errorClass) {
    if (status) {
        status.textContent = message || ''
    }
    fields.forEach((field) => {
        if (errorClass) {
            field.classList.add(errorClass)
        }
        field.setAttribute('aria-invalid', 'true')
    })
    const first = fields[0]
    if (first && typeof first.focus === 'function') {
        first.focus()
    }
}

function clearErrors(form, status, errorClass) {
    if (status) {
        status.textContent = ''
    }
    if (!errorClass) {
        return
    }
    form.querySelectorAll('.' + errorClass).forEach((field) => {
        field.classList.remove(errorClass)
        field.removeAttribute('aria-invalid')
    })
}

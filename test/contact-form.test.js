import fs from 'fs'
import os from 'os'
import path from 'path'
import pug from 'pug'
import { fileURLToPath } from 'url'
import {
    describe,
    it,
    expect,
    beforeAll,
    afterAll,
    beforeEach,
    vi,
} from 'vitest'
import { getAppData } from '../index.js'

const REPO_ROOT = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '..'
)
const TEMPLATE = path.join(REPO_ROOT, 'views/contact-form.pug')

// The suite runs in a temp cwd and writes its own config, the same way the
// generator hands the plugin a host project's config/contact-form.yaml.
let tmpDir
let originalCwd

const CONFIG = `
recipient: hello@example.com
subject: Contact form message
fields:
    - name: name
      label: Your name
      type: text
      required: true
    - name: email
      label: Your email
      type: email
      required: true
    - name: message
      label: Message
      type: textarea
      required: true
`

const configPath = () => path.join(tmpDir, 'config/contact-form.yaml')
const writeConfig = (yaml) => fs.writeFileSync(configPath(), yaml)
const removeConfig = () => fs.rmSync(configPath(), { force: true })

// Render the template the way the generator does: with a `t` translation
// helper. `t` defaults to identity (a key with no translation renders
// literally), matching a single-language site.
const render = (locals, translations) => {
    const t = translations
        ? (key) => (key in translations ? translations[key] : key)
        : undefined
    return pug.renderFile(TEMPLATE, { ...locals, t })
}

const parseConfigBlock = (html) => {
    const match = html.match(
        /<script type="application\/json" data-contact-config[^>]*>(.*?)<\/script>/
    )
    return match ? JSON.parse(match[1]) : null
}

beforeAll(() => {
    originalCwd = process.cwd()
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nera-contact-'))
    fs.mkdirSync(path.join(tmpDir, 'config'), { recursive: true })
    process.chdir(tmpDir)
})

afterAll(() => {
    process.chdir(originalCwd)
    fs.rmSync(tmpDir, { recursive: true, force: true })
})

beforeEach(() => {
    writeConfig(CONFIG)
})

const appData = (app = { title: 'Test Site' }) => ({ app })

describe('getAppData', () => {
    it('exposes a contactForm with the configured fields', () => {
        const { contactForm } = getAppData(appData())

        expect(contactForm.fields).toHaveLength(3)
        expect(contactForm.fields.map((f) => f.name)).toEqual([
            'name',
            'email',
            'message',
        ])
    })

    it('preserves existing app data', () => {
        expect(getAppData(appData()).title).toBe('Test Site')
    })

    it('renders untouched when the config is missing', () => {
        removeConfig()

        const result = getAppData(appData())

        expect(result).toEqual({ title: 'Test Site' })
        expect(result).not.toHaveProperty('contactForm')
    })

    it('does not render without a recipient', () => {
        writeConfig('fields:\n  - name: name\n    label: Name\n')

        expect(getAppData(appData())).not.toHaveProperty('contactForm')
    })

    it('does not render without any valid fields', () => {
        writeConfig('recipient: hello@example.com\n')

        expect(getAppData(appData())).not.toHaveProperty('contactForm')
    })

    it('carries user-facing strings as keys and defaults the unset ones', () => {
        const { contactForm } = getAppData(appData())

        expect(contactForm.subject).toBe('Contact form message')
        expect(contactForm.submitLabel).toBe('Send message')
        expect(contactForm.messages).toEqual({
            required: 'Please fill in all required fields.',
            email: 'Please enter a valid email address.',
        })
        expect(contactForm.booleanLabels).toEqual({
            checked: 'Yes',
            unchecked: 'No',
        })
        expect(contactForm.errorClass).toBe('contact-form__input--error')
    })

    it('tolerates being called without app data', () => {
        expect(() => getAppData({})).not.toThrow()
        expect(() => getAppData()).not.toThrow()
    })
})

describe('field normalization', () => {
    it('defaults an unknown type to text', () => {
        writeConfig(
            'recipient: a@b.com\nfields:\n  - name: n\n    label: N\n    type: color\n'
        )

        expect(getAppData(appData()).contactForm.fields[0].type).toBe('text')
    })

    it('drops a malformed field instead of failing the render', () => {
        writeConfig(
            [
                'recipient: a@b.com',
                'fields:',
                '  - name: keep',
                '    label: Keep',
                '  -',
                '  - just-a-string',
                '  - label: no-name',
            ].join('\n')
        )

        const { contactForm } = getAppData(appData())

        expect(contactForm.fields).toHaveLength(1)
        expect(contactForm.fields[0].name).toBe('keep')
        expect(() => render({ app: { contactForm } })).not.toThrow()
    })

    it('normalizes select options given as scalars and as mappings', () => {
        writeConfig(
            [
                'recipient: a@b.com',
                'fields:',
                '  - name: topic',
                '    label: Topic',
                '    type: select',
                '    options:',
                '      - general',
                '      - { value: sup, label: Support }',
            ].join('\n')
        )

        const [field] = getAppData(appData()).contactForm.fields

        expect(field.options).toEqual([
            { value: 'general', label: 'general' },
            { value: 'sup', label: 'Support' },
        ])
    })

    it('warns when a field shares the honeypot name, without changing output', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
        writeConfig(
            'recipient: a@b.com\nfields:\n  - name: website\n    label: Website\n'
        )

        const { contactForm } = getAppData(appData())

        expect(warn).toHaveBeenCalledWith(
            expect.stringContaining('same name as the honeypot')
        )
        expect(contactForm.honeypot).toBe('website')
        expect(contactForm.fields.map((field) => field.name)).toEqual([
            'website',
        ])
        warn.mockRestore()
    })

    it('does not warn when the honeypot name is free', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

        getAppData(appData())

        expect(warn).not.toHaveBeenCalled()
        warn.mockRestore()
    })
})

describe('recipient obfuscation', () => {
    it('entity-encodes the recipient by default and never emits it plainly', () => {
        const { contactForm } = getAppData(appData())

        expect(contactForm.recipientMode).toBe('entities')
        expect(contactForm.recipient).not.toContain('hello@example.com')
        expect(contactForm.recipient).toContain('&#')
        expect(contactForm).not.toHaveProperty('recipientCodes')
    })

    it('emits only char codes in jsassembly mode', () => {
        writeConfig(`obfuscation: jsassembly\n${CONFIG}`)

        const { contactForm } = getAppData(appData())

        expect(contactForm.recipientMode).toBe('jsassembly')
        expect(contactForm).not.toHaveProperty('recipient')
        expect(
            String.fromCharCode(...JSON.parse(contactForm.recipientCodes))
        ).toBe('hello@example.com')
    })

    it('keeps the plain address out of the rendered HTML (entities)', () => {
        const html = render({ app: getAppData(appData()) })

        expect(html).not.toContain('hello@example.com')
        expect(html).toContain('data-contact-recipient="&#')
    })
})

describe('translation via t()', () => {
    const KEYED = `
recipient: hello@example.com
subject: contact_subject
submit_label: contact_submit
error_required: contact_req
checkbox_checked_label: contact_yes
checkbox_unchecked_label: contact_no
fields:
    - name: name
      label: contact_name
      type: text
      required: true
    - name: news
      label: contact_news
      type: checkbox
`
    const DE = {
        contact_subject: 'Kontakt',
        contact_submit: 'Senden',
        contact_req: 'Bitte ausfüllen',
        contact_yes: 'Ja',
        contact_no: 'Nein',
        contact_name: 'Ihr Name',
        contact_news: 'Newsletter',
    }

    beforeEach(() => writeConfig(KEYED))

    it('resolves labels for the page language', () => {
        const html = render({ app: getAppData(appData()) }, DE)

        expect(html).toContain('>Ihr Name<')
        expect(html).toContain('>Newsletter<')
        expect(html).toContain('>Senden<')
    })

    it('resolves the client-config strings for the page language', () => {
        const config = parseConfigBlock(render({ app: getAppData(appData()) }, DE))

        expect(config.subject).toBe('Kontakt')
        expect(config.messages.required).toBe('Bitte ausfüllen')
        expect(config.booleanLabels).toEqual({ checked: 'Ja', unchecked: 'Nein' })
    })

    it('resolves the email-body label the client reads (data-contact-label)', () => {
        const html = render({ app: getAppData(appData()) }, DE)

        expect(html).toMatch(/name="news"[^>]*data-contact-label="Newsletter"/)
    })

    it('renders keys literally when no translation exists (single language)', () => {
        // Identity `t`: a site that just writes final text as the label.
        const html = render({ app: getAppData(appData()) })

        expect(html).toContain('>contact_name<')
    })
})

describe('template rendering', () => {
    it('renders the inert JSON config block and the field markup', () => {
        const html = render({ app: getAppData(appData()) })

        expect(html).toContain('type="application/json"')
        expect(html).toContain('data-contact-config')
        expect(html).toContain('contact-form__field--text')
        expect(html).toContain('src="/js/contact-form.js"')
    })

    it('escapes a "<" so a stray </script> in a value cannot break the block', () => {
        writeConfig(
            'recipient: a@b.com\nsubject: "a </script> b"\n' +
                'fields:\n  - name: x\n    label: X\n'
        )

        const html = render({ app: getAppData(appData()) })

        expect(html).not.toContain('a </script> b')
        expect(html).toContain('\\u003c')
        expect(parseConfigBlock(html).subject).toBe('a </script> b')
    })

    it('emits no honeypot-specific attribute on the decoy field', () => {
        const html = render({ app: getAppData(appData()) })

        expect(html).not.toMatch(/honeypot/i)
        expect(html).toMatch(/contact-form__decoy[^>]*left:-9999px/)
    })

    it('escapes field labels that contain markup', () => {
        writeConfig(
            'recipient: a@b.com\nfields:\n  - name: x\n    label: "<b>hi</b>"\n'
        )

        const html = render({ app: getAppData(appData()) })

        expect(html).not.toContain('<b>hi</b>')
        expect(html).toContain('&lt;b&gt;hi&lt;/b&gt;')
    })

    it('renders nothing when the form is not configured', () => {
        removeConfig()

        expect(render({ app: getAppData(appData()) })).toBe('')
    })
})

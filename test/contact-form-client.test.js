import fs from 'fs'
import os from 'os'
import path from 'path'
import pug from 'pug'
import { fileURLToPath } from 'url'
import { Window } from 'happy-dom'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { getAppData } from '../index.js'

const REPO_ROOT = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '..'
)
const TEMPLATE = path.join(REPO_ROOT, 'views/contact-form.pug')

// The shipped client is a plain browser script, not a module. It is run with
// `document` and `window` passed in (via `new Function`) so each test gets its
// own document and a `window` whose `location.href` we can inspect instead of
// triggering a real navigation. The config it reads comes entirely from the
// JSON block the template renders — so these tests drive the real chain:
// YAML -> getAppData -> template -> client.
const clientSource = fs.readFileSync(
    path.join(REPO_ROOT, 'views/contact-form.js'),
    'utf-8'
)

let tmpDir
let originalCwd

const BASE_FIELDS = `
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

const baseConfig = (extra = '') => `
recipient: hi@x.com
subject: Hello there
honeypot: website
error_required: REQUIRED
error_email: BAD EMAIL
${extra}
fields:${BASE_FIELDS}
`

// Write a config, build the form through the real hook, render the template
// (with an optional `t` translation map, exactly as the generator supplies one)
// and run the client against it.
const boot = (configYaml, translations) => {
    fs.writeFileSync(
        path.join(tmpDir, 'config/contact-form.yaml'),
        configYaml
    )
    const app = getAppData({ app: {} })
    const t = translations
        ? (key) => (key in translations ? translations[key] : key)
        : undefined
    const html = pug.renderFile(TEMPLATE, { app, t })

    const window = new Window({ url: 'https://site.test/' })
    const { document } = window
    document.body.innerHTML = html

    const location = { href: null }
    new Function('document', 'window', clientSource)(document, { location })
    document.dispatchEvent(new window.Event('DOMContentLoaded'))

    const submit = () =>
        document
            .querySelector('[data-contact-form]')
            .dispatchEvent(
                new window.Event('submit', { cancelable: true, bubbles: true })
            )

    const set = (name, value) => {
        document.querySelector(`[name="${name}"]`).value = value
    }

    return { window, document, location, submit, set }
}

const fillValid = ({ set }) => {
    set('name', 'Jane')
    set('email', 'jane@example.com')
    set('message', 'Hello there')
}

beforeAll(() => {
    originalCwd = process.cwd()
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nera-contact-client-'))
    fs.mkdirSync(path.join(tmpDir, 'config'), { recursive: true })
    process.chdir(tmpDir)
})

afterAll(() => {
    process.chdir(originalCwd)
    fs.rmSync(tmpDir, { recursive: true, force: true })
})

describe('honeypot', () => {
    it('silently drops a submission that fills the decoy field', () => {
        const ctx = boot(baseConfig())
        fillValid(ctx)
        ctx.set('website', 'i am a bot')

        ctx.submit()

        expect(ctx.location.href).toBe(null)
        expect(
            ctx.document.querySelector('[data-contact-status]').textContent
        ).toBe('')
    })

    it('builds the mailto when the decoy is empty', () => {
        const ctx = boot(baseConfig())
        fillValid(ctx)

        ctx.submit()

        expect(ctx.location.href).toContain('mailto:hi@x.com')
    })
})

describe('mailto construction', () => {
    it('encodes the subject and the field body', () => {
        const ctx = boot(baseConfig())
        fillValid(ctx)

        ctx.submit()

        const url = ctx.location.href
        expect(url).toContain('subject=Hello%20there')
        expect(url).toContain('Your%20name%3A%20Jane')
        expect(url).toContain('%0D%0A')
        expect(url).toContain('jane%40example.com')
    })

    it('rebuilds the recipient from char codes in jsassembly mode', () => {
        const ctx = boot(baseConfig('obfuscation: jsassembly'))
        fillValid(ctx)

        ctx.submit()

        expect(ctx.location.href).toContain('mailto:hi@x.com')
    })
})

describe('required-field validation', () => {
    it('shows the configured required message and no mailto', () => {
        const ctx = boot(baseConfig())
        ctx.set('name', 'Jane')

        ctx.submit()

        expect(ctx.location.href).toBe(null)
        expect(
            ctx.document.querySelector('[data-contact-status]').textContent
        ).toBe('REQUIRED')
        expect(
            ctx.document.querySelectorAll('.contact-form__input--error').length
        ).toBeGreaterThan(0)
    })

    it('clears previous errors on the next submit', () => {
        const ctx = boot(baseConfig())

        ctx.submit()
        expect(
            ctx.document.querySelectorAll('.contact-form__input--error').length
        ).toBeGreaterThan(0)

        fillValid(ctx)
        ctx.submit()

        expect(ctx.location.href).toContain('mailto:')
        expect(
            ctx.document.querySelectorAll('.contact-form__input--error').length
        ).toBe(0)
        expect(
            ctx.document.querySelector('[data-contact-status]').textContent
        ).toBe('')
    })
})

describe('email validation', () => {
    it('rejects a malformed email with the configured email message', () => {
        const ctx = boot(baseConfig())
        ctx.set('name', 'Jane')
        ctx.set('email', 'not-an-email')
        ctx.set('message', 'Hi')

        ctx.submit()

        expect(ctx.location.href).toBe(null)
        expect(
            ctx.document.querySelector('[data-contact-status]').textContent
        ).toBe('BAD EMAIL')
    })

    it('accepts a well-formed email', () => {
        const ctx = boot(baseConfig())
        fillValid(ctx)

        ctx.submit()

        expect(ctx.location.href).toContain('mailto:')
    })
})

describe('translatable checkbox labels', () => {
    const withCheckbox = (extra) => `
recipient: hi@x.com
subject: Betreff
honeypot: website
${extra}
fields:
    - name: name
      label: Name
      type: text
      required: true
    - name: news
      label: Newsletter
      type: checkbox
`

    it('writes the configured checked label into the body', () => {
        const ctx = boot(
            withCheckbox(
                'checkbox_checked_label: Ja\ncheckbox_unchecked_label: Nein'
            )
        )
        ctx.set('name', 'Hans')
        ctx.document.querySelector('[name="news"]').checked = true

        ctx.submit()

        const body = decodeURIComponent(ctx.location.href.split('&body=')[1])
        expect(body).toContain('Newsletter: Ja')
    })

    it('writes the configured unchecked label when left empty', () => {
        const ctx = boot(
            withCheckbox(
                'checkbox_checked_label: Ja\ncheckbox_unchecked_label: Nein'
            )
        )
        ctx.set('name', 'Hans')

        ctx.submit()

        const body = decodeURIComponent(ctx.location.href.split('&body=')[1])
        expect(body).toContain('Newsletter: Nein')
    })
})

describe('translation flows into the mailto and validation', () => {
    const KEYED = `
recipient: hi@x.com
subject: contact_subject
honeypot: website
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
        contact_req: 'Bitte ausfüllen',
        contact_yes: 'Ja',
        contact_no: 'Nein',
        contact_name: 'Ihr Name',
        contact_news: 'Newsletter',
    }

    it('uses the translated subject, labels and checkbox label in the email', () => {
        const ctx = boot(KEYED, DE)
        ctx.set('name', 'Hans')
        ctx.document.querySelector('[name="news"]').checked = true

        ctx.submit()

        const url = ctx.location.href
        expect(url).toContain('subject=Kontakt')
        const body = decodeURIComponent(url.split('&body=')[1])
        expect(body).toContain('Ihr Name: Hans')
        expect(body).toContain('Newsletter: Ja')
    })

    it('shows the translated required message', () => {
        const ctx = boot(KEYED, DE)

        ctx.submit()

        expect(
            ctx.document.querySelector('[data-contact-status]').textContent
        ).toBe('Bitte ausfüllen')
    })
})

describe('choice fields', () => {
    const withRadio = (required) => `
recipient: hi@x.com
subject: S
honeypot: website
fields:
    - name: pref
      label: Preference
      type: radio
      required: ${required}
      options:
          - { value: a, label: A }
          - { value: b, label: B }
`

    it('includes only the checked radio in the body', () => {
        const ctx = boot(withRadio(false))
        ctx.document.querySelector('#contact-pref-1').checked = true

        ctx.submit()

        const body = decodeURIComponent(ctx.location.href.split('&body=')[1])
        expect(body).toContain('Preference: b')
        expect(body).not.toContain('Preference: a')
    })

    it('requires at least one radio when the group is required', () => {
        const ctx = boot(withRadio(true))

        ctx.submit()
        expect(ctx.location.href).toBe(null)

        ctx.document.querySelector('#contact-pref-0').checked = true
        ctx.submit()
        expect(ctx.location.href).toContain('mailto:')
    })
})

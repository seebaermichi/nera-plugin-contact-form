# @nera-static/plugin-contact-form

[![Test](https://github.com/seebaermichi/nera-plugin-contact-form/actions/workflows/test.yml/badge.svg)](https://github.com/seebaermichi/nera-plugin-contact-form/actions/workflows/test.yml)
[![npm version](https://img.shields.io/npm/v/@nera-static/plugin-contact-form)](https://www.npmjs.com/package/@nera-static/plugin-contact-form)

A plugin for the [Nera](https://github.com/seebaermichi/nera) static site
generator that renders a **contact form without a backend**. You declare the
fields in YAML; on submit a small client-side script assembles a `mailto:` link
and opens the visitor's own email client with the subject and message
pre-filled. Nothing is stored, and nothing is sent over the network by your
site — which makes it about as privacy-friendly as a contact form gets (see
[Data protection & GDPR](#-data-protection--gdpr)).

📖 **Documentation:** [nera.js.org](https://nera.js.org)

## ✨ Features

- Fully client-side — no backend, no framework, no third-party service
- Fields declared in `config/contact-form.yaml`: `text`, `email`, `tel`,
  `textarea`, `select`, `checkbox`, `radio`
- Builds a `mailto:` link from the fields and opens the mail client
- **Translatable** via Nera's own `t()` helper — fields declared once, labels
  and messages resolved per page language from `config/app.yaml`
- All user-facing text is configurable and translatable — the shipped client
  script contains no strings of its own
- Recipient address kept out of readable page source (HTML entities by default,
  or JS char-code assembly)
- Built-in **honeypot** that silently drops bot submissions; no attribute or
  config value marks it as a trap — the client script finds it structurally
- Client-side required-field and email validation with your own messages
- Ships a Pug template with BEM-compatible markup and a client script, both
  published on request
- Exposes the form data as `app.contactForm` for custom markup
- Synchronous `getAppData` hook — works on Nera v4.1.0+ (see
  [Compatibility](#-compatibility))

## 🚀 Installation

```bash
npm install @nera-static/plugin-contact-form
```

The plugin is automatically detected and run during the render process.

## ⚙️ Configuration

Configure the plugin via **your site's** `config/contact-form.yaml` (the file
shipped inside the package is documentation only — there is no merge between the
two). A `recipient` and at least one valid field are required; without them the
plugin logs a warning, `app.contactForm` is not set, and the form does not
render. The build still succeeds.

```yaml
# ── Recipient & spam protection ──
recipient: hello@example.com          # required
obfuscation: entities                 # entities (default) | jsassembly
honeypot: website                     # name of the decoy field

# ── Form content (each value is a translation key — see Translations) ──
subject: Contact form message
submit_label: Send message
error_required: Please fill in all required fields.
error_email: Please enter a valid email address.
checkbox_checked_label: Yes
checkbox_unchecked_label: No

# Optional HTML shown above the fields / above the submit button:
# intro_text: We usually reply within two working days.
# consent_text: >
#   See our <a href="/privacy.html">privacy policy</a>.

fields:
    - name: name
      label: Your name
      type: text
      required: true
      placeholder: Jane Doe

    - name: email
      label: Your email
      type: email
      required: true

    - name: topic
      label: Topic
      type: select
      required: true
      options:
          - { value: general, label: General enquiry }
          - { value: support, label: Support }

    - name: message
      label: Message
      type: textarea
      required: true

    - name: newsletter
      label: Add me to the newsletter
      type: checkbox
```

Every key except `recipient` and `fields` is optional; the values shown are the
defaults. Configuration is read fresh on every build.

### Field notes

- **`name`** is required per field and becomes the field's form `name` (and its
  `id`, as `contact-<name>`). An entry that is not a mapping, or has no `name`,
  is skipped with a console warning rather than breaking the build.
- **`type`** defaults to `text`. An unknown type falls back to `text` with a
  warning rather than breaking the build.
- **`label`** defaults to `name`; it is used in the form and as the prefix for
  that field's line in the email body.
- **`required: true`** is validated in the browser before the `mailto:` link is
  built. Only the literal `true` counts. For a `radio` group it means at least
  one option must be chosen; for a `checkbox` it means the box must be **ticked**
  — the way to build a consent checkbox.
- **`options`** (for `select` and `radio`) accept either a scalar (used as both
  value and label) or a `{ value, label }` mapping. A `select` or `radio` with no
  valid options still renders, empty, and logs a warning.
- A **required `select`** gets an empty, disabled `…` first option, so nothing
  is pre-selected and the visitor must choose. An optional `select` starts on
  its first real option.
- **`checkbox_checked_label` / `checkbox_unchecked_label`** are how a checkbox is
  written into the email body (e.g. `Ja` / `Nein`).
- **`intro_text` / `consent_text`** are injected as **HTML** so a privacy-policy
  link works. Author them yourself — never fill them from user input.
- **Don't give a field the honeypot's name** (default `website`). Both would
  render as `id="contact-website"`, which is invalid HTML; the plugin warns. If
  you want a real "website" field, set `honeypot:` to another name.
- Every user-facing value above (`label`, `placeholder`, `subject`, messages,
  checkbox labels, `submit_label`, `intro_text`, `consent_text`, option `label`s)
  is a **translation key** — see [Translations](#-translations). `name` and
  option `value`s are raw data and are never translated.

### How the config reaches the browser

All configurable text (messages, checkbox labels, subject, error class) is
rendered into an **inert `<script type="application/json">` block** in the form.
That block is *data, not code* — the browser never executes it; the client
script reads it at runtime. This is why the shipped `contact-form.js` hard-codes
no strings and everything stays translatable. The recipient is carried
separately (see below), obfuscated.

### Recipient obfuscation

The recipient address is never printed as readable text:

| `obfuscation` | What lands in the HTML source | Strength |
| ------------- | ----------------------------- | -------- |
| `entities` (default) | Each character as an HTML numeric entity (`&#104;…`); the browser decodes it for the script | Deters naïve scrapers; a determined one can still decode it |
| `jsassembly` | Only an array of character codes; the address is rebuilt in JS at submit time and never appears in the source | Stronger, still not a guarantee |

Any value other than exactly `jsassembly` — including a typo such as
`js-assembly` — silently uses `entities`.

## 🌍 Translations

The form uses Nera's built-in `t()` helper, so you **declare the fields once**
and translate the text — no per-language form duplication. Every user-facing
value in `config/contact-form.yaml` is a translation **key**; the template
resolves it for each page's language via the same `translations:` block in
`config/app.yaml` that the rest of your site uses. A key with no translation
renders literally, so a single-language site simply writes the final text.

**1. Use keys in `config/contact-form.yaml`:**

```yaml
recipient: hello@example.com
subject: contact_subject
submit_label: contact_submit
error_required: contact_required
checkbox_checked_label: contact_yes
checkbox_unchecked_label: contact_no
fields:
    - { name: name, label: contact_name, type: text, required: true }
    - { name: message, label: contact_message, type: textarea, required: true }
```

**2. Translate them in `config/app.yaml`:**

```yaml
translations:
    en:
        contact_subject: Contact form message
        contact_submit: Send message
        contact_required: Please fill in all required fields.
        contact_yes: Yes
        contact_no: No
        contact_name: Your name
        contact_message: Message
    de:
        contact_subject: Kontaktformular
        contact_submit: Nachricht senden
        contact_required: Bitte alle Pflichtfelder ausfüllen.
        contact_yes: Ja
        contact_no: Nein
        contact_name: Ihr Name
        contact_message: Nachricht
```

Each page renders the form — visible labels, the email subject and body labels,
and the validation messages — in its own `meta.lang`. `name` and option
`value`s stay untranslated, so the data you receive is consistent across
languages.

## 🧩 Usage

The form markup is **Pug, and belongs in a view** — a layout or a partial in
your views folder. Nera renders `pages/**/*.md` as Markdown, so Pug pasted into
a Markdown page is published as literal text.

The paths below are for a site scaffolded with `nera new`, whose presentation
lives in `theme/views/` and `theme/assets/`. On an older site that renders from
root `views/` and `assets/`, drop the `theme/` prefix — `npx nera-contact-form`
picks the right destination automatically.

### 1. Publish the template

```bash
npx nera-contact-form
```

This copies `contact-form.pug` to `theme/views/vendor/plugin-contact-form/` and
the client script to `theme/assets/js/contact-form.js`, which the template loads
as `/js/contact-form.js`. See [Template Publishing](#️-template-publishing) for
how re-publishing skips existing copies and what `--force` does.

### 2. Add a page and a layout that shows it

The page and layout live in **your site**, not in the plugin. Create
`pages/contact.md`; its body is rendered as intro copy above the form:

```markdown
---
layout: pages/contact.pug
title: Contact
---

## Get in touch

Fill in the form below and your email client will open with everything ready to
send.
```

The `---` frontmatter must be the **first line** of the file, and it must set
`layout` — a page without a `layout` is skipped by Nera without any message.

Then create the layout `theme/views/pages/contact.pug`, which renders the page
content and includes the form partial:

```pug
extends ../layouts/layout

block content
  main.contact
    != content
    include ../vendor/plugin-contact-form/contact-form
```

`layouts/layout` is the base layout `nera new` scaffolds; extend your own base
layout if it is named differently. Include paths are relative to the including
file, so the `../` above assumes a layout one level below the views folder
(here `theme/views/pages/`). Adjust the number of `../` segments to match. On
Nera v4.3.0+ you can use the location-independent form instead — there is no
`views/` segment in it:

```pug
include /vendor/plugin-contact-form/contact-form
```

Run `nera build` (or `npm run build`) and open `public/contact.html`.

### 3. Or build your own markup from `app.contactForm`

The shipped template reads everything from `app.contactForm`. With the
configuration above it looks like this:

```javascript
app.contactForm = {
    recipientMode: 'entities',   // or 'jsassembly'
    honeypot: 'website',
    errorClass: 'contact-form__input--error',
    // Translation keys from here on — resolve them with t(key)
    submitLabel: 'Send message',
    subject: 'Contact form message',
    messages: { required: '…', email: '…' },
    booleanLabels: { checked: 'Yes', unchecked: 'No' },
    fields: [
        {
            name: 'topic',
            label: 'Topic',
            type: 'select',
            required: true,
            placeholder: '',     // always a string, '' when unset
            options: [
                { value: 'general', label: 'General enquiry' },
                { value: 'support', label: 'Support' },
            ],
        },
        // … one entry per valid field, in config order; `options` is [] for
        // every type except select and radio
    ],
    recipient: '&#104;&#101;…',  // entities mode only
    // recipientCodes: '[104,101,…]' — jsassembly mode only, a JSON string
    // introText / consentText — present only when configured
}
```

When `recipient` is missing or no field is valid, `app.contactForm` is
**absent** (not empty), so guard with `if app.contactForm`. Custom markup must
keep the [contract attributes](#customizing-the-published-template) for the
client script to work.

## 🛠️ Template Publishing

```bash
npx nera-contact-form
```

copies two files:

```
theme/views/vendor/plugin-contact-form/
└── contact-form.pug        # the form partial
theme/assets/js/
└── contact-form.js         # the client script, served as /js/contact-form.js
```

Both destinations are **theme-aware**: with a `theme/` folder they go under
`theme/` — where the build actually looks — and on an older site without one
into root `views/vendor/plugin-contact-form/` and `assets/js/`.

> **The two copies are skipped differently, and both silently.** The template
> is skipped at **directory** level: if `…/vendor/plugin-contact-form/` already
> exists, nothing is copied into it — even if you deleted `contact-form.pug` —
> and the command still exits successfully. The script is skipped per **file**:
> an existing `contact-form.js` is left alone, a deleted one is restored. Either
> way, **upgrading the plugin never updates your published copies.** To pull in
> a newer template and script, re-run with `--force`:
>
> ```bash
> npx nera-contact-form --force
> ```
>
> `--force` overwrites both files and discards local edits, so diff your copies
> first if you have customised them.

### Customizing the published template

The published `contact-form.pug` is yours to restyle. The client script finds
everything through a small set of **contract attributes** — if you edit the
template, keep these exact hooks or the script stops working:

| Attribute | On | Purpose |
| --------- | -- | ------- |
| `data-contact-form` | the `<form>` | the form to enhance |
| `data-contact-config` | a `<script type="application/json">` | messages, labels, subject, error class |
| `data-contact-field` | every real input/select/textarea | its value goes into the email |
| `data-contact-label` | each field | that field's label for the email body |
| `data-contact-status` | one element | where validation messages are written |
| `data-contact-recipient` / `data-contact-recipient-codes` | one element | the obfuscated recipient |

The **honeypot** is deliberately *not* marked. The script identifies it as the
one named control that has **no** `data-contact-field` — so don't add unmarked
named inputs of your own, and don't remove the decoy field.

## 🎨 Styling

The plugin ships no CSS beyond an inline rule that keeps the honeypot hidden.
Everything else is styled from your own stylesheet using these BEM classes:

| Class | Element |
| ----- | ------- |
| `.contact-form` | the `<form>` |
| `.contact-form__intro` / `.contact-form__consent` | optional HTML blocks |
| `.contact-form__field` (+ `--<type>` modifier) | one field wrapper |
| `.contact-form__label` (+ `--checkbox` / `--radio`) | field label |
| `.contact-form__label-text` | the text beside a checkbox or radio button |
| `.contact-form__input` (+ `--textarea` / `--select` / `--checkbox` / `--radio`) | the control; `text`, `email` and `tel` inputs carry no modifier |
| `.contact-form__options` | radio-group wrapper |
| `.contact-form__status` | validation message region (`aria-live`) |
| `.contact-form__submit` | submit button |
| `.contact-form__input--error` | added by the script to an invalid field |
| `.contact-form__recipient` | hidden element carrying the obfuscated recipient |
| `.contact-form__decoy` | honeypot wrapper, moved off-screen by an inline style |

**These class names are a public contract.** You style them from your own CSS,
so renaming one here is a breaking change and ships as a **major** version.

`.contact-form__decoy` says in plain words what the wrapper is. The script never
relies on it — it finds the honeypot structurally — so you may rename that class
in your published copy if you would rather not advertise it.

## 📊 Generated Output

With the configuration from [Configuration](#️-configuration), the shipped
template renders (output of `nera build`):

```html
<form class="contact-form" novalidate="novalidate" data-contact-form="data-contact-form">
  <script type="application/json" data-contact-config="data-contact-config">
    {
      "subject": "Contact form message",
      "errorClass": "contact-form__input--error",
      "messages": {
        "required": "Please fill in all required fields.",
        "email": "Please enter a valid email address."
      },
      "booleanLabels": {
        "checked": "Yes",
        "unchecked": "No"
      }
    }
  </script><span class="contact-form__recipient" hidden="hidden" data-contact-recipient="&#104;&#101;&#108;&#108;&#111;&#64;&#101;&#120;&#97;&#109;&#112;&#108;&#101;&#46;&#99;&#111;&#109;"></span>
  <div class="contact-form__field contact-form__field--text"><label class="contact-form__label" for="contact-name">Your name</label><input class="contact-form__input" type="text" id="contact-name" name="name" placeholder="Jane Doe" data-contact-field="data-contact-field" data-contact-label="Your name" required="required" /></div>
  <div class="contact-form__field contact-form__field--email"><label class="contact-form__label" for="contact-email">Your email</label><input class="contact-form__input" type="email" id="contact-email" name="email" data-contact-field="data-contact-field" data-contact-label="Your email" required="required" /></div>
  <div class="contact-form__field contact-form__field--select"><label class="contact-form__label" for="contact-topic">Topic</label><select class="contact-form__input contact-form__input--select" id="contact-topic" name="topic" data-contact-field="data-contact-field" data-contact-label="Topic" required="required">
      <option value="" disabled="disabled" selected="selected">…</option>
      <option value="general">General enquiry</option>
      <option value="support">Support</option>
    </select></div>
  <div class="contact-form__field contact-form__field--textarea"><label class="contact-form__label" for="contact-message">Message</label><textarea class="contact-form__input contact-form__input--textarea" id="contact-message" name="message" data-contact-field="data-contact-field" data-contact-label="Message" required="required"></textarea></div>
  <div class="contact-form__field contact-form__field--checkbox"><label class="contact-form__label contact-form__label--checkbox" for="contact-newsletter"><input class="contact-form__input contact-form__input--checkbox" type="checkbox" id="contact-newsletter" name="newsletter" data-contact-field="data-contact-field" data-contact-label="Add me to the newsletter" /><span class="contact-form__label-text">Add me to the newsletter</span></label></div>
  <div class="contact-form__decoy" aria-hidden="true" style="position:absolute;left:-9999px;top:auto;width:1px;height:1px;overflow:hidden"><label for="contact-website">website</label><input type="text" id="contact-website" name="website" tabindex="-1" autocomplete="off" /></div>
  <div class="contact-form__status" role="alert" aria-live="polite" data-contact-status="data-contact-status"></div><button class="contact-form__submit" type="submit">Send message</button>
</form>
<script src="/js/contact-form.js"></script>
```

A `radio` field (`{ name: reply_by, label: Reply by, type: radio, required:
true, options: [Email, Phone] }`) renders as:

```html
<div class="contact-form__field contact-form__field--radio"><span class="contact-form__label">Reply by</span>
  <div class="contact-form__options" role="radiogroup" aria-label="Reply by"><label class="contact-form__label contact-form__label--radio" for="contact-reply_by-0"><input class="contact-form__input contact-form__input--radio" type="radio" id="contact-reply_by-0" name="reply_by" value="Email" data-contact-field="data-contact-field" data-contact-label="Reply by" required="required" /><span class="contact-form__label-text">Email</span></label><label class="contact-form__label contact-form__label--radio" for="contact-reply_by-1"><input class="contact-form__input contact-form__input--radio" type="radio" id="contact-reply_by-1" name="reply_by" value="Phone" data-contact-field="data-contact-field" data-contact-label="Reply by" required="required" /><span class="contact-form__label-text">Phone</span></label></div>
</div>
```

With `obfuscation: jsassembly` the recipient element carries only char codes:

```html
<span class="contact-form__recipient" hidden="hidden" data-contact-recipient-codes="[104,101,108,108,111,64,101,120,97,109,112,108,101,46,99,111,109]"></span>
```

The form renders the same on every page whose layout includes it, including
pages generated by other plugins: `app.contactForm` is site-wide, not per page.

## 🔒 Data protection & GDPR

This form is unusually privacy-friendly, but "no backend" does not mean "no
obligations". The accurate picture:

- **Your website stores and transmits nothing.** There is no server, no
  database, no cookie, no network request, and no third-party service. When the
  visitor submits, their message is handed to **their own** email client via a
  `mailto:` link. The data leaves via their email, not via your site.
- **The honeypot collects nothing** — it exists only to be ignored by humans.
- **The recipient address is exposed in the page**, obfuscated but present.
  `entities` deters casual scrapers; `jsassembly` is stronger; neither is
  bulletproof. Use an address you are willing to publish.
- **A privacy policy / Impressum may still be legally required** for your site
  as a whole (e.g. in Germany), even though this component processes no personal
  data. Nothing here removes that obligation — this plugin simply adds no new
  processing to disclose.

If you later add a real backend, analytics, or a third-party form service, those
change the picture — this note describes the `mailto:` approach only.

## ⚠️ mailto limitations

`mailto:` links are capped in practice (~2000 characters) by the operating
system and mail client, so a very long message may be truncated on the way in.
The visitor must also have a mail client configured; browsers without one may
do nothing on submit. For high-volume or guaranteed delivery, a hosted form
backend is the right tool — this plugin is for the common "let people email me"
case.

## 🧪 Development

```bash
npm install
npx vitest run
npm run lint
```

`npm test` starts Vitest in **watch** mode and does not exit; use `npx vitest run`
for a single pass.

Tests use [Vitest](https://vitest.dev) and cover the `getAppData` hook, the
template (rendered with Pug, with and without translations) and the client
script (run against a DOM stub).

## 🤝 Contributing

Issues and pull requests are welcome. See the
[Nera contributing guide](https://github.com/seebaermichi/nera/blob/main/CONTRIBUTING.md)
for plugin development, the hook contract, and local setup.

For this repo specifically:

- `npx vitest run` and `npm run lint` must pass (`npm test` is watch mode).
- Bump the version and update `CHANGELOG.md` **in the same commit** as the change.
- Template markup and BEM class names are a **public contract** — users style
  them from their own CSS, so changing one is a **major** bump.
- Releases publish from CI on a pushed `v*` tag. Never run `npm publish`.

## 🧑‍💻 Author

Michael Becker  
[https://github.com/seebaermichi](https://github.com/seebaermichi)

## 🔗 Links

- [Plugin Repository](https://github.com/seebaermichi/nera-plugin-contact-form)
- [NPM Package](https://www.npmjs.com/package/@nera-static/plugin-contact-form)
- [Nera Website](https://nera.js.org)
- [Nera Static Site Generator](https://github.com/seebaermichi/nera)

## 🧩 Compatibility

- **Nera**: v4.1.0+ — a baseline rather than a requirement; the plugin needs only
  `app` data and the `t()` translation helper, both present since 4.1.0. The
  root-absolute `include /vendor/…` form needs v4.3.0+ (pug `basedir`), and the
  `theme/` folder layout used in the examples above — what `nera new` scaffolds —
  needs v4.6.0+.
- **Node.js**: >= 20.0.0
- **Plugin Utils**: `^1.5.0` — where theme-aware publishing (`publishAsset` and
  the `theme/` destinations) landed, which `npx nera-contact-form` relies on.
- **Plugin API**: Uses `getAppData()` to expose `app.contactForm`

## 📦 License

MIT © [Michael Becker](https://github.com/seebaermichi)

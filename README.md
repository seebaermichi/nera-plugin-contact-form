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
- Built-in **honeypot** that silently drops bot submissions and is named
  nowhere in the page
- Client-side required-field and email validation with your own messages
- Ships a Pug template with BEM-compatible markup and a client script, both
  published on request
- Synchronous hooks — compatible with Nera v4.3.0+

## 🚀 Installation

```bash
npm install @nera-static/plugin-contact-form
```

The plugin is automatically detected and run during the render process.

## ⚙️ Configuration

Configure the plugin via **your site's** `config/contact-form.yaml` (the file
shipped inside the package is documentation only — there is no merge between the
two). A `recipient` and at least one valid field are required; without them the
form does not render.

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

### Field notes

- **`name`** is required per field and becomes the field's form `name`.
- **`type`** defaults to `text`. An unknown type falls back to `text` with a
  warning rather than breaking the build.
- **`label`** defaults to `name`; it is used in the form and as the prefix for
  that field's line in the email body.
- **`required: true`** is validated in the browser before the `mailto:` link is
  built. For a `radio` group it means at least one option must be chosen.
- **`options`** (for `select` and `radio`) accept either a scalar (used as both
  value and label) or a `{ value, label }` mapping.
- **`checkbox_checked_label` / `checkbox_unchecked_label`** are how a checkbox is
  written into the email body (e.g. `Ja` / `Nein`).
- **`intro_text` / `consent_text`** are injected as **HTML** so a privacy-policy
  link works. Author them yourself — never fill them from user input.
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

The form markup is **Pug, and belongs in a view** — a layout or a partial under
`views/`. Nera renders `pages/**/*.md` as Markdown, so Pug pasted into a
Markdown page is published as literal text.

### 1. Publish the template

```bash
npx nera-contact-form
```

This copies `contact-form.pug` to `views/vendor/plugin-contact-form/` and the
client script to `assets/js/contact-form.js`. See
[Template publishing](#-template-publishing) for the skip-if-exists rule and
`--force`.

### 2. Add a page and a layout that shows it

The page and layout live in **your site**, not in the plugin. Create a Markdown
page whose body is rendered as intro copy above the form:

```markdown
<!-- pages/contact.md -->
---
layout: pages/contact.pug
title: Contact
---

## Get in touch

Fill in the form below and your email client will open with everything ready to
send.
```

Then a layout that renders the page content and includes the form partial:

```pug
//- views/pages/contact.pug
extends ../layouts/default

block content
  section.contact
    != content
    include ../vendor/plugin-contact-form/contact-form
```

Run `npm run render` and open `public/contact.html`.

## 🛠 Customizing the template

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
| `.contact-form__input` (+ `--textarea` / `--select` / `--checkbox` / `--radio`) | the control |
| `.contact-form__options` | radio-group wrapper |
| `.contact-form__status` | validation message region (`aria-live`) |
| `.contact-form__submit` | submit button |
| `.contact-form__input--error` | added by the script to an invalid field |

These names are a **public contract** — renaming one is a breaking change,
because sites style them from their own CSS.

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

## 📦 Template publishing

`npx nera-contact-form` copies the template into `views/vendor/plugin-contact-form/`
and the script into `assets/js/`. Both destinations are **theme-aware**: on a
themed site (a `theme/` folder) they go to `theme/views/vendor/plugin-contact-form/`
and `theme/assets/js/` instead — where the build actually looks. It **skips any
file that already exists** so it never discards your edits; re-run with `--force`
to overwrite (this replaces your customized copies):

```bash
npx nera-contact-form --force
```

Because published copies are yours, upgrading the package does **not** update
them. After a breaking change to the markup or class names, delete your vendor
copy (and the published `contact-form.js`) and re-publish.

> Theme-aware publishing requires `@nera-static/plugin-utils` ≥ 1.5.0, which
> this plugin depends on.

## 🧪 Development

```bash
npx vitest run     # run the tests once
npm run lint       # eslint
```

## 📄 License

MIT © [Michael Becker](https://github.com/seebaermichi)

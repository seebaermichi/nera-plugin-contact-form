# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-07-24

### Changed

- **Publishing is now theme-aware.** `npx nera-contact-form` publishes the
    template and client script into `theme/views/vendor/` and `theme/assets/js/`
    on a themed site (and still into root `views/`/`assets/` on a legacy one),
    so a themed build finds them where the layered view resolver looks. The
    client-JS copy now goes through `plugin-utils`' `publishAsset` instead of a
    hand-rolled root `assets/js/` copy.
- Raised the minimum `@nera-static/plugin-utils` to `^1.5.0`, which adds the
    theme-aware `publishAsset` / `resolveAssetsDir` used above. No template,
    config, or `app.contactForm` contract changed.

## [1.0.0] - 2026-07-24

### Added

- Initial release: a backend-free contact form for Nera that builds a `mailto:`
    link from configurable fields on submit.
- `getAppData` hook exposing the form from `config/contact-form.yaml`
    (synchronous, Nera v4.3.0+ compatible).
- Supported field types: `text`, `email`, `tel`, `textarea`, `select`,
    `checkbox`, `radio`, with per-field `label`, `required`, `placeholder`, and
    `options`.
- **Translatable via Nera's `t()` helper**: fields are declared once and every
    user-facing value (labels, placeholders, subject, messages, checkbox
    `Yes/No` labels, submit label) is a translation key resolved per page
    language from `config/app.yaml` — no per-language form duplication. A key
    with no translation renders literally, so single-language sites need no
    setup.
- All user-facing text is delivered to the browser through an inert
    `<script type="application/json">` config block, so the shipped client
    script contains no strings of its own.
- Recipient obfuscation: `entities` (default) keeps the address out of readable
    source as HTML numeric entities; `jsassembly` emits only character codes and
    rebuilds the address in JavaScript.
- Honeypot field that silently drops bot submissions and is named nowhere in the
    page — the client identifies it structurally, as the one named control
    without a `data-contact-field` marker.
- Client-side required-field and email validation with configurable messages.
- Shipped Pug template (`contact-form.pug`) with BEM-compatible markup and a
    dependency-free client script (`contact-form.js`), both published via
    `npx nera-contact-form` (skip-if-exists, `--force` to overwrite).

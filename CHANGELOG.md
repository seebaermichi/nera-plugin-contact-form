# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.1] - 2026-10-08

### Fixed

- A field with the same `name` as the honeypot (default `website`) rendered
    two elements with `id="contact-website"` — invalid HTML, with no hint why.
    The plugin now logs a warning naming the clash. Rendered output is
    unchanged.
- README: the Usage example now works on a site scaffolded with `nera new`.
    It placed the layout in root `views/` and extended `layouts/default`, both
    of which fail on the scaffold's `theme/views/` + `layouts/layout`; it told
    you to run `npm run render`, which a thin site does not have (`nera build`);
    and its page example began with a filename comment above the frontmatter,
    which made Nera skip the page silently.
- README: Template Publishing now says the template is skipped per
    **directory** (a deleted `contact-form.pug` is not restored, exit 0) while
    the script is skipped per file, and that `--force` is what delivers a newer
    template and script. It previously said every existing file is skipped.
- README: the Nera floor is stated as v4.1.0+ with the feature named
    (verified by rendering on 4.1.0); it claimed v4.3.0+ without a reason. The
    root-absolute `include /vendor/…` alternative (v4.3.0+) and the `theme/`
    layout (v4.6.0+) are named separately.

### Added

- README: `app.contactForm` is documented (shape, and absent rather than
    empty when the form is not configured); the BEM list gains
    `.contact-form__label-text`, `.contact-form__recipient` and
    `.contact-form__decoy`; field notes cover a required checkbox, the required
    `select` placeholder, skipped malformed fields and the honeypot-name clash;
    a typo in `obfuscation` is documented as falling back to `entities`.
- README: Generated Output (rendered by `nera build`), Development watch-mode
    note, Contributing, Author, Links and Compatibility sections, and the
    `## 📦 License` heading, matching the rest of the plugin fleet.

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

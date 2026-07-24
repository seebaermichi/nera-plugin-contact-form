#!/usr/bin/env node

import path from 'path'
import { fileURLToPath } from 'url'
import { publishAllTemplates, publishAsset } from '@nera-static/plugin-utils'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const sourceDir = path.resolve(__dirname, '../views/')
const force = process.argv.includes('--force')

// Both destinations are theme-aware (plugin-utils >= 1.5.0): on a themed site
// the template lands in theme/views/vendor/plugin-contact-form/ and the client
// script in theme/assets/js/, where the build actually looks; on a legacy site
// they fall back to the deprecated root views/ and assets/. Same skip-if-exists
// rule for both, so re-running never discards a user's edits.
const templatesOk = publishAllTemplates({
    pluginName: 'plugin-contact-form',
    sourceDir,
    force,
})

const clientJsOk = publishAsset({
    sourceFile: path.join(sourceDir, 'contact-form.js'),
    targetPath: 'js/contact-form.js',
    force,
})

process.exit(templatesOk && clientJsOk ? 0 : 1)

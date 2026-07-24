#!/usr/bin/env node

import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { publishAllTemplates } from '@nera-static/plugin-utils'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const pluginName = 'plugin-contact-form'
const sourceDir = path.resolve(__dirname, '../views/')
const force = process.argv.includes('--force')

// Publish all pug templates to views/vendor/plugin-contact-form/
const result = publishAllTemplates({
    pluginName,
    sourceDir,
    force,
})

// Also publish contact-form.js into assets/js/. Same skip-if-exists rule as
// the templates above — re-running this command must not discard user edits.
const publishClientJS = () => {
    const jsSource = path.join(sourceDir, 'contact-form.js')
    const jsTarget = path.resolve(process.cwd(), 'assets/js/contact-form.js')

    if (fs.existsSync(jsTarget) && !force) {
        console.log(
            '⚠️  assets/js/contact-form.js already exists — skipping.\n' +
                '    Re-run with --force to overwrite (this will discard your edits).'
        )
        return true
    }

    try {
        fs.mkdirSync(path.dirname(jsTarget), { recursive: true })
        fs.copyFileSync(jsSource, jsTarget)

        console.log('✓ contact-form.js copied to assets/js/contact-form.js')
        return true
    } catch (err) {
        console.error('✗ Failed to copy contact-form.js to assets/js/', err)
        return false
    }
}

process.exit(result && publishClientJS() ? 0 : 1)

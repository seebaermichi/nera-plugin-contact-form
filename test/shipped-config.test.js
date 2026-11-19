import { describe, it, expect } from 'vitest'
import path from 'path'
import { fileURLToPath } from 'url'
import { getConfig } from '@nera-static/plugin-utils'

// `nera add contact-form` copies this file into a site that has none. A sample
// recipient would render a form that addresses mail to example.com; without
// one the form does not render and the build warns.
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const shipped = getConfig(path.join(__dirname, '../config/contact-form.yaml'))

describe('shipped config/contact-form.yaml', () => {
    it('sets no recipient', () => {
        expect(shipped).not.toHaveProperty('recipient')
    })

    it('still ships a usable set of fields', () => {
        expect(Array.isArray(shipped.fields)).toBe(true)
        expect(shipped.fields.length).toBeGreaterThan(0)
    })
})

import fs from 'fs'
import os from 'os'
import path from 'path'
import { execFileSync } from 'child_process'
import { fileURLToPath } from 'url'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'

const REPO_ROOT = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '..'
)
const SCRIPT_PATH = path.join(REPO_ROOT, 'bin/publish-template.js')
const SOURCE_DIR = path.join(REPO_ROOT, 'views')
const TEMPLATES = ['contact-form.pug']
const CLIENT_JS = 'contact-form.js'

// Runs the real bin script, so it also covers the Nera-project validation the
// script performs and the extra step that copies the client JS into assets/js/.
let testDir
let templatesDir

const run = (...args) =>
    execFileSync('node', [SCRIPT_PATH, ...args], {
        cwd: testDir,
        stdio: 'pipe',
    }).toString()

beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nera-contact-publish-'))
    templatesDir = path.join(testDir, 'views/vendor/plugin-contact-form')

    // A real Nera project shape, which is what validateNeraProject checks for.
    fs.writeFileSync(
        path.join(testDir, 'package.json'),
        JSON.stringify({ name: 'my-site' })
    )
    fs.mkdirSync(path.join(testDir, 'config'), { recursive: true })
    fs.writeFileSync(path.join(testDir, 'config/app.yaml'), 'lang: en\n')
    fs.mkdirSync(path.join(testDir, 'pages'), { recursive: true })
})

afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true })
})

describe('template publishing', () => {
    it('publishes every template to the vendor directory', () => {
        run()

        for (const file of TEMPLATES) {
            expect(fs.existsSync(path.join(templatesDir, file))).toBe(true)
        }
    })

    it('copies the client script to assets/js/', () => {
        run()

        const target = path.join(testDir, 'assets/js', CLIENT_JS)
        expect(fs.existsSync(target)).toBe(true)
        expect(fs.readFileSync(target, 'utf8')).toBe(
            fs.readFileSync(path.join(SOURCE_DIR, CLIENT_JS), 'utf8')
        )
    })

    it('ships every template and the client script it publishes', () => {
        for (const file of [...TEMPLATES, CLIENT_JS]) {
            expect(fs.existsSync(path.join(SOURCE_DIR, file))).toBe(true)
        }
    })

    it('skips an existing template without overwriting it', () => {
        fs.mkdirSync(templatesDir, { recursive: true })
        const target = path.join(templatesDir, 'contact-form.pug')
        fs.writeFileSync(target, 'mine')

        expect(run()).toMatch(/Skipping/i)
        expect(fs.readFileSync(target, 'utf8')).toBe('mine')
    })

    it('skips an existing client script without overwriting it', () => {
        fs.mkdirSync(path.join(testDir, 'assets/js'), { recursive: true })
        const target = path.join(testDir, 'assets/js', CLIENT_JS)
        fs.writeFileSync(target, 'mine')

        expect(run()).toMatch(/already exists/i)
        expect(fs.readFileSync(target, 'utf8')).toBe('mine')
    })

    it('overwrites both when --force is passed', () => {
        fs.mkdirSync(templatesDir, { recursive: true })
        fs.mkdirSync(path.join(testDir, 'assets/js'), { recursive: true })
        const tpl = path.join(templatesDir, 'contact-form.pug')
        const js = path.join(testDir, 'assets/js', CLIENT_JS)
        fs.writeFileSync(tpl, 'mine')
        fs.writeFileSync(js, 'mine')

        run('--force')

        expect(fs.readFileSync(tpl, 'utf8')).toBe(
            fs.readFileSync(path.join(SOURCE_DIR, 'contact-form.pug'), 'utf8')
        )
        expect(fs.readFileSync(js, 'utf8')).toBe(
            fs.readFileSync(path.join(SOURCE_DIR, CLIENT_JS), 'utf8')
        )
    })

    it('refuses to publish outside a Nera project', () => {
        fs.rmSync(path.join(testDir, 'config/app.yaml'))
        fs.rmSync(path.join(testDir, 'pages'), { recursive: true })
        fs.writeFileSync(
            path.join(testDir, 'package.json'),
            JSON.stringify({ name: 'definitely-not-a-nera-project' })
        )

        expect(() => run()).toThrow()
        expect(fs.existsSync(templatesDir)).toBe(false)
    })
})

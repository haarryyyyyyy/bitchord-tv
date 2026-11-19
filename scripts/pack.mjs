// Turns dist/ into BitChordTV.wgt (an unsigned zip).
// Tizen widgets run from file://, where <script type="module"> is blocked, so the
// IIFE bundle is loaded as a classic deferred script instead.
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { zipSync } from 'fflate'

const dist = 'dist'
const htmlPath = join(dist, 'index.html')
let html = readFileSync(htmlPath, 'utf8')
html = html
  .replace(/<script type="module" crossorigin src="([^"]+)"><\/script>/g, '<script defer src="$1"></script>')
  .replace(/<link rel="stylesheet" crossorigin /g, '<link rel="stylesheet" ')
if (/type="module"/.test(html)) throw new Error('module script left in index.html')
writeFileSync(htmlPath, html)

const files = {}
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p)
    else files[relative(dist, p).split(sep).join('/')] = new Uint8Array(readFileSync(p))
  }
}
walk(dist)
writeFileSync('BitChordTV.wgt', zipSync(files, { level: 9 }))
console.log('BitChordTV.wgt:', Object.keys(files).length, 'files')

// La regola di AGENTS.md: nessuno script va in rete, si lavora solo su file
// HTML forniti dall'utente. Fantacalcio.it ha diffidato il repo per gli script che
// accedevano ai suoi servizi in automatico: questo test impedisce che ne
// rientri uno, anche per sbaglio.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const radice = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function file(cartella, estensioni) {
    const dir = path.join(radice, cartella);
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir, { recursive: true })
        .filter(f => estensioni.some(e => f.endsWith(e)))
        .map(f => path.join(cartella, f));
}

const VIETATI = [
    [/\bfetch\s*\(/, 'fetch'],
    [/['"]node:(https?|http2|net|tls|dgram)['"]|['"](https?|http2|net|tls|dgram)['"]\s*\)/, 'moduli di rete'],
    [/\b(axios|node-fetch|undici|got|ky|superagent|playwright|puppeteer|selenium-webdriver)\b['"]/, 'librerie di rete o browser'],
    [/XMLHttpRequest|WebSocket|EventSource/, 'API di rete'],
    [/\b(curl|wget|Invoke-WebRequest|Invoke-RestMethod)\b/, 'download da riga di comando'],
    [/\bbearer\b|\bauthorization\s*:/i, 'intestazioni di autenticazione'],
];

test('gli script della skill non vanno in rete', () => {
    for (const f of file('.claude/skills', ['.mjs', '.js', '.cjs'])) {
        const testo = fs.readFileSync(path.join(radice, f), 'utf8');
        for (const [re, cosa] of VIETATI) assert.doesNotMatch(testo, re, `${f}: ${cosa}`);
        // l'unico comando esterno ammesso è git, sulla storia locale
        for (const m of testo.matchAll(/exec(?:File)?(?:Sync)?\(\s*['"]([^'"]+)['"]/g)) {
            assert.equal(m[1], 'git', `${f}: lancia ${m[1]}`);
        }
    }
});

test('nessun workflow programmato o che scarica dati', () => {
    for (const f of file('.github/workflows', ['.yml', '.yaml'])) {
        // i commenti non contano: si guardano solo le righe che fanno qualcosa
        const testo = fs.readFileSync(path.join(radice, f), 'utf8')
            .split(/\r?\n/).filter(r => !/^\s*#/.test(r)).join('\n');
        assert.doesNotMatch(testo, /^\s*schedule\s*:/m, `${f}: gira da solo`);
        assert.doesNotMatch(testo, /fantacalcio|\bcurl\b|\bwget\b/i, `${f}: va in rete`);
    }
});

test('il sito chiede solo i propri file di dati', () => {
    const testo = fs.readFileSync(path.join(radice, 'script.js'), 'utf8');
    for (const m of testo.matchAll(/fetchJsonNoCache\(\s*([^)]+)\)/g)) {
        assert.doesNotMatch(m[1], /https?:/, `script.js chiede ${m[1]}`);
    }
    assert.equal([...testo.matchAll(/\bfetch\s*\(/g)].length, 1, 'un solo fetch, quello dei JSON in data/');
});

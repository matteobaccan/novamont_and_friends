#!/usr/bin/env node
// Aggiunge al dizionario "players" i giocatori arrivati col mercato.
//
//   node aggiungi-giocatori.mjs <nuovi.json> [--stagione 2026-2027] [--dry-run]
//
// `nuovi.json` è l'uscita di preleva-rose.js: { "<pid>": { name, role, serieA } }.
// Aggiunge solo i pid che mancano e lascia stare gli altri, così si può
// ripassare lo stesso file senza farci danni. Se un pid c'è già ma con dati
// diversi lo segnala e non lo tocca: un cambio di squadra di Serie A a gennaio
// è vero, ma riscriverlo cambierebbe anche le giornate già pubblicate, e quella
// è una decisione da prendere a mano.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const QUI = path.dirname(fileURLToPath(import.meta.url));
const RADICE = path.resolve(QUI, '..', '..', '..');

const RUOLI = ['P', 'D', 'C', 'A'];

function fail(messaggio) {
    console.error(`ERRORE: ${messaggio}`);
    process.exit(1);
}

const argomenti = process.argv.slice(2);
const dryRun = argomenti.includes('--dry-run');
const iStagione = argomenti.indexOf('--stagione');
const stagioneChiesta = iStagione >= 0 ? argomenti[iStagione + 1] : null;
// Il valore di --stagione non è il file: va saltato, ma solo se c'è davvero
// (con indexOf a -1, iStagione + 1 è 0, cioè il file stesso).
const iValore = iStagione >= 0 ? iStagione + 1 : -1;
const file = argomenti.find((a, i) => !a.startsWith('--') && i !== iValore);

if (!file) fail('manca il file con i giocatori nuovi (uscita di preleva-rose.js)');

const index = JSON.parse(fs.readFileSync(path.join(RADICE, 'data/seasons.json'), 'utf8'));
const seasonId = stagioneChiesta || index.currentSeason;
const season = index.seasons.find(s => s.id === seasonId);
if (!season) fail(`stagione "${seasonId}" assente da data/seasons.json`);

const seasonPath = path.join(RADICE, season.file);
const data = JSON.parse(fs.readFileSync(seasonPath, 'utf8'));
data.players ||= {};

const nuovi = JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));

const aggiunti = [];
const diversi = [];
const invariati = [];

for (const [pid, dati] of Object.entries(nuovi)) {
    if (!/^\d+$/.test(pid)) fail(`"${pid}" non è un pid`);
    for (const campo of ['name', 'role', 'serieA']) {
        if (!dati?.[campo]) fail(`pid ${pid}: manca il campo "${campo}"`);
    }
    if (!RUOLI.includes(dati.role)) fail(`pid ${pid}: ruolo "${dati.role}" non è uno di ${RUOLI.join(' ')}`);

    const presente = data.players[pid];
    if (!presente) {
        data.players[pid] = { name: dati.name, role: dati.role, serieA: dati.serieA };
        aggiunti.push(pid);
    } else if (presente.name !== dati.name || presente.role !== dati.role || presente.serieA !== dati.serieA) {
        diversi.push({ pid, presente, dati });
    } else {
        invariati.push(pid);
    }
}

// Il dizionario è ordinato per pid: tenerlo così rende i diff leggibili.
const ordinato = {};
for (const pid of Object.keys(data.players).sort((a, b) => Number(a) - Number(b))) {
    ordinato[pid] = data.players[pid];
}
data.players = ordinato;

if (aggiunti.length === 0) console.log('Nessun giocatore nuovo da aggiungere.');
else {
    console.log(`${aggiunti.length} giocatori aggiunti a "players":`);
    for (const pid of aggiunti) {
        const p = data.players[pid];
        console.log(`  ${pid} ${p.name} (${p.role}, ${p.serieA})`);
    }
}

if (invariati.length > 0) console.log(`${invariati.length} già presenti e identici, lasciati stare.`);

if (diversi.length > 0) {
    console.log(`\nATTENZIONE, ${diversi.length} già presenti ma con dati diversi (NON toccati):`);
    for (const { pid, presente, dati } of diversi) {
        console.log(`  ${pid}: c'è "${presente.name} (${presente.role}, ${presente.serieA})"`);
        console.log(`       la lega dice "${dati.name} (${dati.role}, ${dati.serieA})"`);
    }
    console.log('  Se è un trasferimento di gennaio, decidi a mano: riscriverlo cambia');
    console.log('  anche le rose delle giornate già pubblicate.');
}

if (dryRun) {
    console.log('\n--dry-run: nessuna scrittura.');
} else if (aggiunti.length > 0) {
    fs.writeFileSync(seasonPath, JSON.stringify(data, null, 2) + '\n');
    console.log(`\nScritto ${season.file} (${Object.keys(data.players).length} giocatori).`);
}

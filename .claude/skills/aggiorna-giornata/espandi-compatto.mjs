#!/usr/bin/env node
// Espande le formazioni prelevate dal browser nella forma che l'API
// restituisce, cioè quella che scarica-giornata.mjs si aspetta da --grezzo.
//
//   node espandi-compatto.mjs <compatto.json> > grezzo.json
//
// Il formato compatto esiste per una ragione sola: il canale che riporta i
// dati dal browser taglia i risultati sopra il migliaio e mezzo di caratteri,
// e una partita in forma piena non ci sta. Lo snippet in preleva-browser.js
// comprime ogni giocatore in una riga e tiene le partite in `window.__G`, da
// cui si estraggono una per volta; qui si rimettono in forma piena.
//
// Un giocatore compatto è `pid:voto:votoBonus:eventi:ptype`, con gli eventi
// scritti `slot=n` separati da virgola e i campi vuoti in coda omessi:
//
//   7600:7.5:11.5:2=1,13=1,15=1   gol, assist e flag
//   536:55:100::U                 senza voto, non schierabile
//   5877:6.5:6.5                  voto liscio, nessun evento
//
// I due lati sono separati da `//`: prima i titolari, poi la panchina.

import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

const SLOT = 16;

function fail(message) {
    console.error(`ERRORE: ${message}`);
    process.exit(1);
}

export function espandiGiocatore(riga, contesto) {
    const campi = riga.split(':');
    if (campi.length < 3) fail(`${contesto}: "${riga}" non ha nemmeno pid, voto e voto con bonus`);

    const [pid, scr, cscr, eventi = '', ptype = ''] = campi;
    const b = Array(SLOT).fill(0);
    for (const coppia of eventi ? eventi.split(',') : []) {
        const [slot, n] = coppia.split('=');
        if (!(Number(slot) >= 0 && Number(slot) < SLOT)) fail(`${contesto}: slot "${slot}" fuori intervallo`);
        b[Number(slot)] = Number(n);
    }

    return { pid: Number(pid), scr: Number(scr), cscr: Number(cscr), b: b.join(';'), ptype: ptype || '-' };
}

export function espandiLato(compatto, tot, contesto) {
    const [titolari, panchina] = compatto.split('//');
    if (panchina === undefined) fail(`${contesto}: manca il separatore "//" fra titolari e panchina`);
    return {
        tot,
        starts: titolari.split('|').map(r => espandiGiocatore(r, `${contesto} titolari`)),
        bench: panchina.split('|').map(r => espandiGiocatore(r, `${contesto} panchina`))
    };
}

export function espandi(compatto) {
    return compatto.map(m => {
        for (const campo of ['casa', 'fuori', 'res', 'totCasa', 'totFuori', 'home', 'away']) {
            if (m[campo] === undefined) fail(`una partita non ha il campo "${campo}"`);
        }
        const contesto = `${m.casa}-${m.fuori}`;
        return {
            casa: m.casa,
            fuori: m.fuori,
            res: m.res,
            home: espandiLato(m.home, m.totCasa, `${contesto} [${m.casa}]`),
            away: espandiLato(m.away, m.totFuori, `${contesto} [${m.fuori}]`)
        };
    });
}

function main() {
    const percorso = process.argv[2];
    if (!percorso) fail('uso: node espandi-compatto.mjs <compatto.json> > grezzo.json');

    const compatto = JSON.parse(fs.readFileSync(percorso, 'utf8'));
    if (!Array.isArray(compatto)) fail('il file deve contenere un array di partite');

    const grezzo = espandi(compatto);
    const giocatori = grezzo.reduce(
        (n, m) => n + m.home.starts.length + m.home.bench.length + m.away.starts.length + m.away.bench.length,
        0
    );
    console.error(`espanse ${grezzo.length} partite, ${giocatori} giocatori`);
    console.log(JSON.stringify(grezzo, null, 1));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();

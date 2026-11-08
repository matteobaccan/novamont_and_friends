#!/usr/bin/env node
// Precarica il calendario della stagione in data/<stagione>.json:
//
//   calendar           le giornate della lega: chi gioca in casa con chi e a
//                      quale giornata di Serie A corrisponde ognuna
//   calendarioSerieA   le 38 giornate di Serie A, con data e partite
//
// Uso:
//   node leggi-calendario.mjs [--lega <calendario.html>] [--serie-a <serie-a.txt>]
//                             [--stagione 2026-2027] [--dry-run]
//
// --lega è la pagina HTML "calendario" della lega. La pagina carica le giornate mentre si scorre: quelle che
// non contiene si prendono dal calendario già scritto o dalle giornate già
// giocate, che hanno gli accoppiamenti. La giornata di Serie A di quelle si
// ricava dallo scarto fisso fra le due numerazioni, se è lo stesso per tutte
// le giornate lette.
//
// --serie-a è un file di testo, una riga per giornata, trascritto dal
// calendario ufficiale (che esce come PDF a immagine, senza testo):
//
//   11 08/11/2026 Cagliari-Frosinone Fiorentina-Juventus ...
//
// Il file viene verificato prima di scrivere: dieci partite per giornata, ogni
// squadra una volta per giornata, ogni accoppiamento casa-fuori una volta sola
// nella stagione. Un errore di trascrizione fa quasi sempre saltare uno dei tre.

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = process.cwd();

function fail(msg) {
    console.error(`ERRORE: ${msg}`);
    process.exit(1);
}

function argomento(argv, nome) {
    const i = argv.indexOf(nome);
    return i === -1 ? null : argv[i + 1];
}

// ------------------------------------------------------------
// Calendario della lega
// ------------------------------------------------------------

const testo = (html) => html
    .replace(/<!---->/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();

// I due nomi di una riga stanno nello <span> accanto al logo: il primo dopo
// il logo di casa, il secondo prima del logo della trasferta
function squadreDellaRiga(riga) {
    const casa = riga.match(/<\/ui-team-logo>\s*<span[^>]*>([^<]+)<\/span>/);
    const fuori = riga.match(/<span[^>]*>([^<]+)<\/span>\s*<ui-team-logo/g);
    if (!casa || !fuori) return null;
    const ultimo = fuori[fuori.length - 1].match(/<span[^>]*>([^<]+)<\/span>/);
    return [casa[1].trim(), ultimo[1].trim()];
}

export function leggiCalendarioLega(html) {
    const schede = html.split(/<view-matchweek-card[^>]*\bid="matchweek-/).slice(1);
    return schede.map(scheda => {
        const round = Number(scheda.match(/^(\d+)/)[1]);
        const serieA = testo(scheda.slice(0, 4000)).match(/(\d+)ª giornata di Serie A/i);
        const righe = scheda.split('<ui-match-row').slice(1)
            .map(r => r.slice(0, r.indexOf('</ui-match-row>')));
        const matches = righe.map(r => {
            const squadre = squadreDellaRiga(r);
            if (!squadre) fail(`giornata ${round}: una partita senza le due squadre`);
            return { homeTeam: squadre[0], awayTeam: squadre[1] };
        });
        return { round, roundSerieA: serieA ? Number(serieA[1]) : null, matches };
    });
}

// La lega scrive certi nomi tutti maiuscoli ("PARTIZAN TIRANA")
function canonico(nome, teams) {
    const t = teams.find(x => x.name.toLowerCase() === nome.toLowerCase());
    if (!t) fail(`squadra "${nome}" non presente fra le squadre della stagione`);
    return t.name;
}

function completaCalendarioLega(lette, data) {
    const teams = data.teams || [];
    const perGiornata = new Map();

    for (const g of lette) {
        perGiornata.set(g.round, {
            round: g.round,
            roundSerieA: g.roundSerieA,
            matches: g.matches.map(m => ({ homeTeam: canonico(m.homeTeam, teams), awayTeam: canonico(m.awayTeam, teams) }))
        });
    }

    // Le giornate che la pagina non conteneva
    const scarti = new Set(lette.filter(g => g.roundSerieA).map(g => g.roundSerieA - g.round));
    const scarto = scarti.size === 1 ? [...scarti][0] : null;
    const recuperate = [];

    for (const g of data.calendar || []) {
        if (!perGiornata.has(g.round)) {
            perGiornata.set(g.round, g);
            recuperate.push(`${g.round} (dal calendario già scritto)`);
        }
    }
    for (const r of data.rounds || []) {
        if (perGiornata.has(r.round)) continue;
        perGiornata.set(r.round, {
            round: r.round,
            roundSerieA: scarto === null ? null : r.round + scarto,
            matches: r.matches.map(m => ({ homeTeam: m.homeTeam, awayTeam: m.awayTeam }))
        });
        recuperate.push(`${r.round} (dalle giornate giocate${scarto === null ? ', giornata di Serie A ignota' : `, Serie A ${r.round + scarto}`})`);
    }

    const calendario = [...perGiornata.values()].sort((a, b) => a.round - b.round);

    // Le giornate giocate devono avere gli stessi accoppiamenti del calendario
    for (const r of data.rounds || []) {
        const g = perGiornata.get(r.round);
        const chiave = (ms) => ms.map(m => `${m.homeTeam}-${m.awayTeam}`).join(' | ');
        if (chiave(g.matches) !== chiave(r.matches)) {
            fail(`giornata ${r.round}: il calendario dice ${chiave(g.matches)}, i dati ${chiave(r.matches)}`);
        }
    }

    // Ogni squadra una volta per giornata
    for (const g of calendario) {
        const viste = g.matches.flatMap(m => [m.homeTeam, m.awayTeam]);
        if (new Set(viste).size !== viste.length || viste.length !== teams.length) {
            fail(`giornata ${g.round}: squadre ripetute o mancanti (${viste.join(', ')})`);
        }
    }

    const buchi = [];
    for (let n = 1; n <= calendario[calendario.length - 1].round; n++) if (!perGiornata.has(n)) buchi.push(n);
    if (buchi.length) fail(`mancano le giornate ${buchi.join(', ')}: la pagina HTML non le contiene`);

    return { calendario, recuperate };
}

// ------------------------------------------------------------
// Calendario di Serie A
// ------------------------------------------------------------

export function leggiCalendarioSerieA(txt) {
    const righe = txt.split(/\r?\n/).map(r => r.trim()).filter(r => r && !r.startsWith('#'));
    return righe.map(riga => {
        const [numero, data, ...partite] = riga.split(/\s+/);
        const [gg, mm, aaaa] = data.split('/');
        if (!aaaa) fail(`riga "${riga.slice(0, 30)}...": data non nel formato gg/mm/aaaa`);
        return {
            giornata: Number(numero),
            data: `${aaaa}-${mm}-${gg}`,
            partite: partite.map(p => {
                const [casa, fuori] = p.split('-');
                if (!fuori) fail(`giornata ${numero}: "${p}" non è nel formato Casa-Fuori`);
                return { casa, fuori };
            })
        };
    });
}

function verificaSerieA(giornate) {
    const errori = [];
    const squadre = new Set(giornate.flatMap(g => g.partite.flatMap(p => [p.casa, p.fuori])));
    const perGirone = squadre.size - 1;
    const coppie = new Map();

    giornate.forEach((g, i) => {
        if (g.giornata !== i + 1) errori.push(`la riga ${i + 1} è la giornata ${g.giornata}`);
        if (g.partite.length !== squadre.size / 2) errori.push(`giornata ${g.giornata}: ${g.partite.length} partite`);
        const viste = new Set();
        for (const { casa, fuori } of g.partite) {
            for (const s of [casa, fuori]) {
                if (viste.has(s)) errori.push(`giornata ${g.giornata}: ${s} gioca due volte`);
                viste.add(s);
            }
            const k = `${casa}-${fuori}`;
            if (coppie.has(k)) errori.push(`${k} sia alla ${coppie.get(k)} sia alla ${g.giornata}`);
            coppie.set(k, g.giornata);
        }
    });

    // Andata e ritorno: nello stesso girone due squadre si incontrano una volta
    for (const inizio of [1, perGirone + 1]) {
        const viste = new Map();
        for (const g of giornate.filter(g => g.giornata >= inizio && g.giornata < inizio + perGirone)) {
            for (const { casa, fuori } of g.partite) {
                const k = [casa, fuori].sort().join(' - ');
                if (viste.has(k)) errori.push(`${k} si incontrano alla ${viste.get(k)} e alla ${g.giornata}, stesso girone`);
                viste.set(k, g.giornata);
            }
        }
    }

    return { errori, squadre };
}

// ------------------------------------------------------------

function main() {
    const argv = process.argv.slice(2);
    const fileLega = argomento(argv, '--lega');
    const fileSerieA = argomento(argv, '--serie-a');
    const dryRun = argv.includes('--dry-run');
    if (!fileLega && !fileSerieA) fail('uso: node leggi-calendario.mjs [--lega <calendario.html>] [--serie-a <serie-a.txt>] [--dry-run]');

    const indice = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/seasons.json'), 'utf8'));
    const idStagione = argomento(argv, '--stagione') || indice.currentSeason;
    const stagione = indice.seasons.find(s => s.id === idStagione);
    if (!stagione) fail(`stagione ${idStagione} non presente in data/seasons.json`);
    const seasonPath = path.join(ROOT, stagione.file);
    const data = JSON.parse(fs.readFileSync(seasonPath, 'utf8'));

    if (fileLega) {
        const lette = leggiCalendarioLega(fs.readFileSync(fileLega, 'utf8'));
        if (lette.length === 0) fail(`${fileLega}: nessuna giornata trovata, non è la pagina del calendario?`);
        const { calendario, recuperate } = completaCalendarioLega(lette, data);
        console.log(`Lega: ${lette.length} giornate lette dalla pagina, ${calendario.length} in tutto`);
        for (const r of recuperate) console.log(`  recuperata la ${r}`);
        const senzaSerieA = calendario.filter(g => !g.roundSerieA).map(g => g.round);
        if (senzaSerieA.length) console.log(`  ATTENZIONE, senza giornata di Serie A: ${senzaSerieA.join(', ')}`);
        data.calendar = calendario;
    }

    if (fileSerieA) {
        const giornate = leggiCalendarioSerieA(fs.readFileSync(fileSerieA, 'utf8'));
        const { errori, squadre } = verificaSerieA(giornate);
        if (errori.length) fail(`calendario di Serie A non coerente:\n  ${errori.join('\n  ')}`);
        console.log(`Serie A: ${giornate.length} giornate, ${squadre.size} squadre, dal ${giornate[0].data} al ${giornate[giornate.length - 1].data}`);
        data.calendarioSerieA = giornate;
    }

    // Le giornate di Serie A citate dalla lega devono esistere
    if (data.calendar && data.calendarioSerieA) {
        const fuori = data.calendar.filter(g => g.roundSerieA && !data.calendarioSerieA.some(s => s.giornata === g.roundSerieA));
        if (fuori.length) fail(`giornate della lega su giornate di Serie A inesistenti: ${fuori.map(g => g.round).join(', ')}`);
    }

    if (dryRun) {
        console.log('\n--dry-run: niente scritto');
        return;
    }
    fs.writeFileSync(seasonPath, JSON.stringify(data, null, 2) + '\n');
    console.log(`\nScritto ${stagione.file}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();

#!/usr/bin/env node
// Il primo passo di ogni aggiornamento: cosa manca e cosa chiedere all'utente.
//
//   node cosa-serve.mjs [--oggi 2026-11-07] [--stagione 2026-2027]
//
// Dal calendario precaricato sa quali giornate della lega si sono già giocate
// (quelle la cui giornata di Serie A è finita), le confronta con quelle sul
// sito ed elenca le pagine delle partite da salvare, una per una con il link.
// Poi guarda data/probabili.json: di quando sono, di che turno, e se è quello
// giusto per la prossima giornata.
//
// Non va in rete: legge solo i file del repo. Le pagine le apre e le salva
// l'utente (Ctrl+S, «Pagina web completa»).

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const URL_PROBABILI = 'https://www.fantacalcio.it/probabili-formazioni-serie-a';
export const URL_RIGORISTI = 'https://www.fantacalcio.it/rigoristi-serie-a';
export const URL_INFORTUNATI = 'https://www.fantacalcio.it/infortunati-serie-a';

// Un turno di Serie A si gioca intorno alla data del calendario ufficiale,
// fino al lunedì: lo si considera finito dal secondo giorno dopo. Meglio
// chiedere una giornata un giorno dopo che salvarla col posticipo ancora da
// giocare.
const GIORNI_DOPO_LA_DATA = 2;

// Le probabili cambiano fino al fischio: più di due giorni e sono da rifare
const GIORNI_PROBABILI_VECCHIE = 2;

const giorno = (iso) => {
    const [a, m, g] = String(iso).slice(0, 10).split('-').map(Number);
    return Date.UTC(a, m - 1, g) / 86400000;
};

function urlPartita(source, giornata, indice) {
    if (!source || !source.roundUrl) return null;
    const base = Number.isInteger(source.matchIndexBase) ? source.matchIndexBase : 0;
    return source.roundUrl.replace('{round}', String(giornata)).replace('{match}', String(indice + base));
}

export function cosaServe({ dati, source, probabili, oggi }) {
    const calendario = dati.calendar || [];
    const serieA = new Map((dati.calendarioSerieA || []).map(g => [g.giornata, g]));
    const presenti = new Set((dati.rounds || []).map(r => r.round));
    const oggiN = giorno(oggi);

    const conData = calendario.map(g => {
        const s = serieA.get(g.roundSerieA);
        return { ...g, data: s ? s.data : null };
    });

    const giocata = (g) => g.data !== null && oggiN >= giorno(g.data) + GIORNI_DOPO_LA_DATA;

    const mancanti = conData
        .filter(g => giocata(g) && !presenti.has(g.round))
        .map(g => ({
            round: g.round,
            roundSerieA: g.roundSerieA,
            data: g.data,
            partite: g.matches.map((m, i) => ({
                casa: m.homeTeam,
                fuori: m.awayTeam,
                url: urlPartita(source, g.round, i)
            }))
        }));

    const prossima = conData.find(g => !giocata(g)) || null;

    let statoProbabili;
    if (!probabili || !probabili.aggiornato) {
        statoProbabili = { stato: 'mancanti' };
    } else {
        const giorni = Math.round(oggiN - giorno(probabili.aggiornato));
        const turno = probabili.prossimoTurno ? probabili.prossimoTurno.numero : null;
        const atteso = prossima ? prossima.roundSerieA : null;
        const iniziato = !!(probabili.prossimoTurno && (probabili.prossimoTurno.partite || []).some(p => p.giocata));
        const turnoSbagliato = atteso !== null && turno !== atteso;
        statoProbabili = {
            stato: turnoSbagliato ? 'turno-sbagliato' : (giorni > GIORNI_PROBABILI_VECCHIE ? 'vecchie' : 'fresche'),
            aggiornato: probabili.aggiornato,
            giorni,
            turno,
            turnoAtteso: atteso,
            iniziato
        };
    }

    return { mancanti, prossima, probabili: statoProbabili };
}

// ------------------------------------------------------------

function quando(iso) {
    const d = new Date(iso);
    return d.toLocaleString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' });
}

function dataBreve(iso) {
    const [a, m, g] = iso.split('-').map(Number);
    return new Date(Date.UTC(a, m - 1, g)).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
}

function main() {
    const argv = process.argv.slice(2);
    const valore = (nome) => { const i = argv.indexOf(nome); return i === -1 ? null : argv[i + 1]; };

    const oggi = valore('--oggi') || new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' });
    const radice = process.cwd();
    const indice = JSON.parse(fs.readFileSync(path.join(radice, 'data/seasons.json'), 'utf8'));
    const stagione = indice.seasons.find(s => s.id === (valore('--stagione') || indice.currentSeason));
    const dati = JSON.parse(fs.readFileSync(path.join(radice, stagione.file), 'utf8'));
    const fileProbabili = path.join(radice, 'data/probabili.json');
    const probabili = fs.existsSync(fileProbabili) ? JSON.parse(fs.readFileSync(fileProbabili, 'utf8')) : null;

    if (!(dati.calendar || []).length || !(dati.calendarioSerieA || []).length) {
        console.log(`Stagione ${stagione.id}: manca il calendario in ${stagione.file}.`);
        console.log(`Chiedi all'utente la pagina del calendario della lega (${stagione.source && stagione.source.calendarUrl})`);
        console.log('e il calendario di Serie A, poi lancia leggi-calendario.mjs.');
        return;
    }

    const s = cosaServe({ dati, source: stagione.source, probabili, oggi });
    const daChiedere = [];

    console.log(`Stagione ${stagione.id}, oggi ${dataBreve(oggi)}\n`);

    if (s.mancanti.length === 0) {
        console.log('Giornate: il sito è in pari con la lega.');
    } else {
        console.log(`Giornate giocate ma non ancora sul sito: ${s.mancanti.map(g => g.round).join(', ')}`);
        console.log(`  (si inseriscono una alla volta, in ordine: prima la ${s.mancanti[0].round})`);
        for (const g of s.mancanti) {
            daChiedere.push(`Giornata ${g.round} (${g.roundSerieA}ª di Serie A, ${dataBreve(g.data)}): le ${g.partite.length} pagine delle partite`);
            for (const p of g.partite) daChiedere.push(`    ${p.casa} - ${p.fuori}: ${p.url}`);
        }
    }

    if (s.prossima) {
        console.log(`Prossima giornata: la ${s.prossima.round}, sulla ${s.prossima.roundSerieA}ª di Serie A (${dataBreve(s.prossima.data)})`);
    } else {
        console.log('Prossima giornata: nessuna, il calendario è finito.');
    }

    const p = s.probabili;
    console.log('');
    if (p.stato === 'mancanti') {
        console.log('Probabili formazioni: nessun file data/probabili.json.');
    } else {
        const eta = p.giorni <= 0 ? 'oggi' : (p.giorni === 1 ? 'ieri' : `${p.giorni} giorni fa`);
        console.log(`Probabili formazioni: salvate ${quando(p.aggiornato)} (${eta}), turno ${p.turno} di Serie A.`);
        if (p.stato === 'turno-sbagliato') console.log(`  Sono del turno ${p.turno}, ma la prossima giornata si gioca sul turno ${p.turnoAtteso}: vanno rifatte.`);
        else if (p.stato === 'vecchie') console.log(`  Hanno più di ${GIORNI_PROBABILI_VECCHIE} giorni: conviene rifarle.`);
        else if (p.iniziato) console.log('  Il turno è già cominciato: il consiglio di questa giornata è congelato, rifarle serve solo per le partite che restano.');
        else console.log('  Sono del turno giusto. Si possono comunque rifare per avere le ultime notizie.');
    }
    if (p.stato !== 'fresche' || !s.prossima) {
        daChiedere.push(`Probabili formazioni${s.prossima ? ` del turno ${s.prossima.roundSerieA}` : ''}: ${URL_PROBABILI}`);
        daChiedere.push(`    facoltative, se sono cambiate: rigoristi ${URL_RIGORISTI}, infortunati ${URL_INFORTUNATI}`);
    }

    console.log('');
    if (daChiedere.length === 0) {
        console.log('Da chiedere all\'utente: niente, è tutto aggiornato.');
    } else {
        console.log('Da chiedere all\'utente (aprire la pagina, Ctrl+S, «Pagina web completa»):');
        for (const r of daChiedere) console.log(r.startsWith('    ') ? r : `  - ${r}`);
    }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();

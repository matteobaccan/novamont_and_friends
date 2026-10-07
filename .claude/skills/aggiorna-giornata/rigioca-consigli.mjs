#!/usr/bin/env node
// Rigioca le giornate già valutate con pesi diversi del modello, per capire
// quali avrebbero consigliato meglio. Ogni giornata si rifà con i dati che si
// avevano allora: le giornate precedenti e le probabili salvate nel consiglio,
// ripescate dalla storia git di data/probabili.json.
//
//   node rigioca-consigli.mjs GIORNATE_PRIOR=2,4,6 PESO_FORMA=0.2,0.4 [--stagione 2026-2027]
//
// Prova tutte le combinazioni e le ordina per punti della formazione
// consigliata. Serve la storia git completa: in un clone superficiale,
// `git fetch --unshallow` (o un fetch con --depth ampio) prima di lanciarlo.
//
// Per una giornata senza consiglio salvato si può indicare a mano da quale
// commit prendere le probabili: --giornata 1 --probabili <commit>.
// Attenzione a non usare probabili scaricate dopo la giornata: sanno già chi ha
// giocato e fanno sembrare il modello più bravo di quanto sia.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { radiceProgetto } from '../../../test/aiuto/carica-script.mjs';
import { calcolaConsigli, PARAMETRI } from './salva-consigli.mjs';
import { leggiConsigli, valutaStagione } from './valuta-consigli.mjs';

const git = (...argomenti) => execFileSync('git', argomenti, { cwd: radiceProgetto, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

// Il commit in cui data/probabili.json ha preso quel timestamp di aggiornamento
export function commitDelleProbabili(aggiornato) {
    const commit = git('log', '--format=%H', `-S"aggiornato": "${aggiornato}"`, '--', 'data/probabili.json')
        .trim().split('\n').filter(Boolean);
    // -S elenca sia il commit che lo introduce sia quello che lo toglie: il più
    // vecchio è quello giusto
    return commit.at(-1) || null;
}

export function probabiliAl(commit) {
    return JSON.parse(git('show', `${commit}:data/probabili.json`));
}

// Prodotto cartesiano dei valori da provare: { A: [1, 2], B: [3] } diventa
// [{ A: 1, B: 3 }, { A: 2, B: 3 }]
export function combinazioni(griglia) {
    return Object.entries(griglia).reduce(
        (finora, [nome, valori]) => finora.flatMap(c => valori.map(v => ({ ...c, [nome]: v }))),
        [{}]
    );
}

// I dati come erano prima della giornata: le giornate precedenti per i voti,
// la rosa della giornata stessa perché è quella che il fantallenatore aveva
export function datiPrimaDi(dati, giornata) {
    return {
        ...dati,
        rounds: (dati.rounds || []).filter(r => r.round < giornata),
        rosterHistory: (dati.rosterHistory || []).filter(s => s.fromRound <= giornata)
    };
}

function leggiArgomenti(argv) {
    const griglia = {};
    const opzioni = {};
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a.startsWith('--')) {
            opzioni[a.slice(2)] = argv[++i];
            continue;
        }
        const [nome, valori] = a.split('=');
        if (!PARAMETRI.includes(nome) || !valori) {
            console.error(`Parametro sconosciuto: ${a}. Ammessi: ${PARAMETRI.join(', ')}`);
            process.exit(1);
        }
        griglia[nome] = valori.split(',').map(Number);
    }
    return { griglia, opzioni };
}

function main() {
    const { griglia, opzioni } = leggiArgomenti(process.argv.slice(2));
    const stagioni = JSON.parse(fs.readFileSync(path.join(radiceProgetto, 'data/seasons.json'), 'utf8'));
    const id = opzioni.stagione || stagioni.currentSeason;
    const stagione = stagioni.seasons.find(s => s.id === id);
    const dati = JSON.parse(fs.readFileSync(path.join(radiceProgetto, stagione.file), 'utf8'));

    // Le giornate da rigiocare, ciascuna con le sue probabili
    const giornate = leggiConsigli(path.join(radiceProgetto, 'data', 'consigli', id))
        .filter(c => (dati.rounds || []).some(r => r.round === c.giornata))
        .map(c => {
            const commit = c.probabiliDel ? commitDelleProbabili(c.probabiliDel) : null;
            if (!commit) console.warn(`Giornata ${c.giornata}: probabili del ${c.probabiliDel} non trovate in git, la salto`);
            return commit ? { giornata: c.giornata, probabili: probabiliAl(commit) } : null;
        })
        .filter(Boolean);

    if (opzioni.giornata && opzioni.probabili) {
        giornate.push({ giornata: Number(opzioni.giornata), probabili: probabiliAl(opzioni.probabili) });
    }
    if (giornate.length === 0) {
        console.log('Nessuna giornata da rigiocare: servono consigli salvati per giornate già inserite.');
        return;
    }

    const risultati = combinazioni(griglia).map(costanti => {
        const consigli = giornate.map(({ giornata, probabili }) => ({
            giornata,
            probabiliDel: probabili.aggiornato,
            ...calcolaConsigli(datiPrimaDi(dati, giornata), probabili, { costanti })
        }));
        const v = valutaStagione(dati, consigli);
        const punti = v.allenatori.reduce((s, b) => s + b.consigliata, 0);
        const schierati = v.allenatori.reduce((s, b) => s + b.schierata, 0);
        return { costanti, punti, schierati, modello: v.modello };
    }).sort((a, b) => b.punti - a.punti);

    console.log(`Giornate rigiocate: ${giornate.map(g => g.giornata).join(', ')}`);
    console.log(`Punti delle formazioni schierate: ${risultati[0].schierati.toFixed(1)}\n`);
    for (const r of risultati) {
        const pesi = Object.entries(r.costanti).map(([k, v]) => `${k}=${v}`).join(' ') || '(pesi attuali)';
        const resa = r.modello ? r.modello.resa.tutti.erroreMedio : '—';
        const brier = r.modello ? r.modello.gioca.brier : '—';
        console.log(`${r.punti.toFixed(1).padStart(7)} punti  errore resa ${resa}  Brier ${brier}  ${pesi}`);
    }
}

if (import.meta.url === `file://${process.argv[1]}`) main();

#!/usr/bin/env node
// Confronta i consigli salvati da salva-consigli.mjs con quello che è successo
// davvero: per ogni giornata giocata, i punti della formazione consigliata,
// di quella schierata dal fantallenatore e di quella ideale col senno di poi.
//
//   node valuta-consigli.mjs [stagione]
//
// Le tre colonne si contano tutte allo stesso modo — fantavoto dei titolari,
// al massimo tre cambi dalla panchina con un pari ruolo che ha preso il voto —
// senza bonus casa né modificatori: servono a confrontarle fra loro, non a
// rifare il punteggio ufficiale.

import fs from 'node:fs';
import path from 'node:path';
import { radiceProgetto } from '../../../test/aiuto/carica-script.mjs';

const MODULI = [[3, 4, 3], [4, 3, 3], [3, 5, 2], [4, 4, 2], [5, 3, 2], [4, 5, 1], [5, 4, 1]];
const CAMBI_MASSIMI = 3;

// Fantavoto di ogni giocatore che ha preso un voto nella giornata
export function fantavotiDellaGiornata(round) {
    const voti = {};
    for (const match of round.matches) {
        if (!match.lineups) continue;
        for (const lato of ['home', 'away']) {
            for (const g of match.lineups[lato]) {
                if (g.b !== undefined) voti[g.p] = g.b;
            }
        }
    }
    return voti;
}

export function punteggioConCambi(titolari, panchina, voti, ruolo) {
    let totale = 0;
    let cambi = 0;
    const entrati = new Set();
    for (const pid of titolari) {
        if (voti[pid] !== undefined) {
            totale += voti[pid];
            continue;
        }
        if (cambi >= CAMBI_MASSIMI) continue;
        const cambio = panchina.find(q => !entrati.has(q) && ruolo(q) === ruolo(pid) && voti[q] !== undefined);
        if (cambio !== undefined) {
            entrati.add(cambio);
            cambi++;
            totale += voti[cambio];
        }
    }
    return totale;
}

export function punteggioIdeale(rosa, voti, ruolo) {
    const migliori = (r) => rosa
        .filter(pid => ruolo(pid) === r && voti[pid] !== undefined)
        .map(pid => voti[pid])
        .sort((a, b) => b - a);
    const P = migliori('P'), D = migliori('D'), C = migliori('C'), A = migliori('A');
    const somma = (elenco) => elenco.reduce((s, v) => s + v, 0);

    let massimo = null;
    for (const [d, c, a] of MODULI) {
        if (P.length === 0 || D.length < d || C.length < c || A.length < a) continue;
        const totale = P[0] + somma(D.slice(0, d)) + somma(C.slice(0, c)) + somma(A.slice(0, a));
        if (massimo === null || totale > massimo) massimo = totale;
    }
    return massimo;
}

export function valutaGiornata(dati, round, consiglio) {
    const voti = fantavotiDellaGiornata(round);
    const ruolo = (pid) => ((dati.players || {})[pid] || {}).role;
    const rose = (dati.rosterHistory || []).filter(s => s.fromRound <= round.round).at(-1);

    const righe = [];
    for (const match of round.matches) {
        if (!match.lineups) continue;
        for (const [lato, team] of [['home', match.homeTeam], ['away', match.awayTeam]]) {
            const consigliata = consiglio.squadre[team];
            if (!consigliata) continue;
            const schierata = match.lineups[lato];
            const titolari = schierata.filter(g => g.t === 's' || g.t === 'out').map(g => g.p);
            const panchina = schierata.filter(g => g.t === 'b' || g.t === 'in').map(g => g.p);
            righe.push({
                squadra: team,
                schierata: punteggioConCambi(titolari, panchina, voti, ruolo),
                consigliata: punteggioConCambi(consigliata.titolari.map(g => g.pid), consigliata.panchina, voti, ruolo),
                ideale: punteggioIdeale((rose && rose.teams[team]) || [], voti, ruolo)
            });
        }
    }
    return righe;
}

function main() {
    const stagioni = JSON.parse(fs.readFileSync(path.join(radiceProgetto, 'data/seasons.json'), 'utf8'));
    const id = process.argv[2] || stagioni.currentSeason;
    const stagione = stagioni.seasons.find(s => s.id === id);
    if (!stagione) {
        console.error(`Stagione ${id} sconosciuta`);
        process.exit(1);
    }
    const dati = JSON.parse(fs.readFileSync(path.join(radiceProgetto, stagione.file), 'utf8'));
    const cartella = path.join(radiceProgetto, 'data', 'consigli', id);
    const file = fs.existsSync(cartella) ? fs.readdirSync(cartella).filter(f => f.endsWith('.json')) : [];

    const totali = { schierata: 0, consigliata: 0, ideale: 0, meglio: 0, squadre: 0 };
    for (const nome of file.sort((a, b) => parseInt(a.match(/\d+/)) - parseInt(b.match(/\d+/)))) {
        const consiglio = JSON.parse(fs.readFileSync(path.join(cartella, nome), 'utf8'));
        const round = (dati.rounds || []).find(r => r.round === consiglio.giornata);
        if (!round) continue;

        console.log(`\nGiornata ${consiglio.giornata} (probabili del ${consiglio.probabiliDel})`);
        console.log('Squadra            schierata  consigliata  ideale');
        for (const r of valutaGiornata(dati, round, consiglio)) {
            console.log(`${r.squadra.padEnd(18)} ${r.schierata.toFixed(1).padStart(9)}  ${r.consigliata.toFixed(1).padStart(11)}  ${r.ideale === null ? '—' : r.ideale.toFixed(1).padStart(6)}`);
            totali.schierata += r.schierata;
            totali.consigliata += r.consigliata;
            totali.ideale += r.ideale || 0;
            totali.squadre++;
            if (r.consigliata > r.schierata) totali.meglio++;
        }
    }

    if (totali.squadre === 0) {
        console.log('Nessun consiglio salvato per una giornata già giocata.');
        return;
    }
    console.log(`\nIn totale: schierate ${totali.schierata.toFixed(1)}, consigliate ${totali.consigliata.toFixed(1)}, ideali ${totali.ideale.toFixed(1)}`);
    console.log(`Il consiglio ha battuto il fantallenatore ${totali.meglio} volte su ${totali.squadre}`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();

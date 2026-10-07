#!/usr/bin/env node
// Confronta i consigli salvati da salva-consigli.mjs con quello che è successo
// davvero, e misura due cose diverse:
//
//   - il modello: quanto sbaglia la resa prevista e quanto è calibrata la
//     probabilità di giocare, giocatore per giocatore
//   - i fantallenatori: quanti punti hanno fatto con la formazione schierata
//     rispetto a quella che il sito consigliava
//
//   node valuta-consigli.mjs [stagione] [--scrivi]
//
// Con --scrivi il risultato finisce in data/consigli/<stagione>/valutazione.json,
// che la pagina della formazione legge per la tabella degli allenatori.
//
// I punti delle formazioni si contano tutti allo stesso modo — fantavoto dei
// titolari, al massimo tre cambi dalla panchina con un pari ruolo che ha preso
// il voto — senza bonus casa né modificatori: servono a confrontarle fra loro,
// non a rifare il punteggio ufficiale.

import fs from 'node:fs';
import path from 'node:path';
import { radiceProgetto } from '../../../test/aiuto/carica-script.mjs';

const MODULI = [[3, 4, 3], [4, 3, 3], [3, 5, 2], [4, 4, 2], [5, 3, 2], [4, 5, 1], [5, 4, 1]];
const CAMBI_MASSIMI = 3;
const RUOLI = ['P', 'D', 'C', 'A'];

const arrotonda = (x, cifre = 2) => (x === null || x === undefined || Number.isNaN(x)
    ? null
    : Math.round(x * 10 ** cifre) / 10 ** cifre);

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

// Errore del modello sui giocatori di una giornata.
//
// La resa si giudica solo su chi ha preso il voto: è la previsione di quanto
// rende QUANDO gioca. La probabilità di giocare si giudica su tutti, con il
// punteggio di Brier: la media di (probabilità − esito)², dove l'esito è 1 se ha
// preso il voto e 0 se no. Zero è perfetto, 0,25 è tirare a indovinare al 50%.
export function erroreModello(rosaPrevista, voti) {
    const accumula = () => ({ n: 0, assoluto: 0, scarto: 0 });
    const resa = { tutti: accumula(), ...Object.fromEntries(RUOLI.map(r => [r, accumula()])) };
    const brier = { n: 0, somma: 0, previsti: 0, giocato: 0 };

    for (const g of rosaPrevista) {
        const giocato = voti[g.pid] !== undefined;
        if (g.probabilita !== null && g.probabilita !== undefined) {
            brier.n++;
            brier.somma += (g.probabilita - (giocato ? 1 : 0)) ** 2;
            brier.previsti += g.probabilita;
            brier.giocato += giocato ? 1 : 0;
        }
        if (!giocato || g.resa === null || g.resa === undefined) continue;
        // Scarto positivo: ha fatto meglio della previsione
        const scarto = voti[g.pid] - (g.resa + (g.rigori || 0));
        for (const chiave of ['tutti', g.ruolo]) {
            if (!resa[chiave]) continue;
            resa[chiave].n++;
            resa[chiave].assoluto += Math.abs(scarto);
            resa[chiave].scarto += scarto;
        }
    }
    return { resa, brier };
}

// Somma gli accumulatori di più giornate e li trasforma in medie leggibili
export function riassumiErrore(errori) {
    const resa = {};
    for (const chiave of ['tutti', ...RUOLI]) {
        const n = errori.reduce((s, e) => s + e.resa[chiave].n, 0);
        const assoluto = errori.reduce((s, e) => s + e.resa[chiave].assoluto, 0);
        const scarto = errori.reduce((s, e) => s + e.resa[chiave].scarto, 0);
        resa[chiave] = { voti: n, erroreMedio: n ? arrotonda(assoluto / n) : null, distorsione: n ? arrotonda(scarto / n) : null };
    }
    const n = errori.reduce((s, e) => s + e.brier.n, 0);
    const somma = (campo) => errori.reduce((s, e) => s + e.brier[campo], 0);
    return {
        resa,
        gioca: {
            giocatori: n,
            brier: n ? arrotonda(somma('somma') / n, 3) : null,
            attesiInCampo: arrotonda(somma('previsti'), 1),
            inCampo: somma('giocato')
        }
    };
}

export function valutaGiornata(dati, round, consiglio) {
    const voti = fantavotiDellaGiornata(round);
    const ruolo = (pid) => ((dati.players || {})[pid] || {}).role;
    const rose = (dati.rosterHistory || []).filter(s => s.fromRound <= round.round).at(-1);

    const squadre = [];
    const errori = [];
    for (const match of round.matches) {
        if (!match.lineups) continue;
        for (const [lato, team] of [['home', match.homeTeam], ['away', match.awayTeam]]) {
            const consigliata = consiglio.squadre[team];
            if (!consigliata) continue;
            const schierata = match.lineups[lato];
            const titolari = schierata.filter(g => g.t === 's' || g.t === 'out').map(g => g.p);
            const panchina = schierata.filter(g => g.t === 'b' || g.t === 'in').map(g => g.p);

            // Il valore atteso della formazione schierata, secondo il modello di
            // quel giorno: dice se il fantallenatore ha rischiato contro il
            // consiglio o se il consiglio era quasi lo stesso
            const previsione = new Map((consigliata.rosa || []).map(g => [g.pid, g]));
            const attesoSchierata = titolari.every(pid => previsione.has(pid))
                ? titolari.reduce((s, pid) => s + previsione.get(pid).atteso, 0)
                : null;

            squadre.push({
                squadra: team,
                schierata: punteggioConCambi(titolari, panchina, voti, ruolo),
                consigliata: punteggioConCambi(consigliata.titolari, consigliata.panchina, voti, ruolo),
                ideale: punteggioIdeale((rose && rose.teams[team]) || [], voti, ruolo),
                attesoSchierata: arrotonda(attesoSchierata),
                attesoConsigliata: arrotonda(consigliata.totale),
                inComune: titolari.filter(pid => consigliata.titolari.includes(pid)).length
            });
            if (consigliata.rosa) errori.push(erroreModello(consigliata.rosa, voti));
        }
    }
    return { squadre, errori };
}

// Bilancio di ogni fantallenatore contro il consiglio, su tutte le giornate.
// Differenza positiva: ha fatto meglio del sito.
export function bilancioAllenatori(giornate) {
    const perSquadra = new Map();
    for (const giornata of giornate) {
        for (const r of giornata.squadre) {
            const b = perSquadra.get(r.squadra) || {
                squadra: r.squadra, giornate: 0, schierata: 0, consigliata: 0, ideale: 0,
                meglio: 0, pari: 0, peggio: 0, inComune: 0
            };
            b.giornate++;
            b.schierata += r.schierata;
            b.consigliata += r.consigliata;
            b.ideale += r.ideale || 0;
            b.inComune += r.inComune;
            if (r.schierata > r.consigliata) b.meglio++;
            else if (r.schierata < r.consigliata) b.peggio++;
            else b.pari++;
            perSquadra.set(r.squadra, b);
        }
    }
    return [...perSquadra.values()]
        .map(b => ({
            ...b,
            schierata: arrotonda(b.schierata, 1),
            consigliata: arrotonda(b.consigliata, 1),
            ideale: arrotonda(b.ideale, 1),
            differenza: arrotonda(b.schierata - b.consigliata, 1),
            mediaDifferenza: arrotonda((b.schierata - b.consigliata) / b.giornate),
            inComune: arrotonda(b.inComune / b.giornate, 1)
        }))
        .sort((a, b) => b.differenza - a.differenza);
}

export function valutaStagione(dati, consigli) {
    const giornate = [];
    const tuttiGliErrori = [];
    for (const consiglio of [...consigli].sort((a, b) => a.giornata - b.giornata)) {
        const round = (dati.rounds || []).find(r => r.round === consiglio.giornata);
        if (!round) continue;
        const { squadre, errori } = valutaGiornata(dati, round, consiglio);
        tuttiGliErrori.push(...errori);
        giornate.push({
            giornata: consiglio.giornata,
            probabiliDel: consiglio.probabiliDel || null,
            parametri: consiglio.parametri || null,
            squadre: squadre.map(r => ({
                ...r,
                schierata: arrotonda(r.schierata, 1),
                consigliata: arrotonda(r.consigliata, 1),
                ideale: arrotonda(r.ideale, 1)
            })),
            modello: errori.length ? riassumiErrore(errori) : null
        });
    }
    return {
        stagione: dati.season || null,
        ultimaGiornata: giornate.length ? giornate.at(-1).giornata : null,
        modello: tuttiGliErrori.length ? riassumiErrore(tuttiGliErrori) : null,
        allenatori: bilancioAllenatori(giornate),
        giornate
    };
}

export function leggiConsigli(cartella) {
    if (!fs.existsSync(cartella)) return [];
    return fs.readdirSync(cartella)
        .filter(f => /^giornata-\d+\.json$/.test(f))
        .map(f => JSON.parse(fs.readFileSync(path.join(cartella, f), 'utf8')));
}

function stampa(valutazione) {
    for (const g of valutazione.giornate) {
        console.log(`\nGiornata ${g.giornata} (probabili del ${g.probabiliDel})`);
        console.log('Squadra            schierata  consigliata  ideale  titolari in comune');
        for (const r of g.squadre) {
            console.log(`${r.squadra.padEnd(18)} ${r.schierata.toFixed(1).padStart(9)}  ${r.consigliata.toFixed(1).padStart(11)}  ${r.ideale === null ? '     —' : r.ideale.toFixed(1).padStart(6)}  ${String(r.inComune).padStart(8)}/11`);
        }
    }

    if (valutazione.modello) {
        const { resa, gioca } = valutazione.modello;
        console.log('\nModello');
        for (const chiave of ['tutti', ...RUOLI]) {
            const r = resa[chiave];
            if (!r.voti) continue;
            console.log(`  resa ${chiave.padEnd(5)}: errore medio ${r.erroreMedio} su ${r.voti} voti, distorsione ${r.distorsione > 0 ? '+' : ''}${r.distorsione}`);
        }
        console.log(`  gioca: Brier ${gioca.brier} su ${gioca.giocatori} giocatori, attesi in campo ${gioca.attesiInCampo}, scesi davvero ${gioca.inCampo}`);
    }

    console.log('\nAllenatori contro il consiglio (differenza positiva = meglio del sito)');
    for (const b of valutazione.allenatori) {
        console.log(`  ${b.squadra.padEnd(18)} ${b.differenza > 0 ? '+' : ''}${b.differenza} in ${b.giornate} giornate, meglio ${b.meglio} / pari ${b.pari} / peggio ${b.peggio}`);
    }
}

function main() {
    const argomenti = process.argv.slice(2);
    const scrivi = argomenti.includes('--scrivi');
    const stagioni = JSON.parse(fs.readFileSync(path.join(radiceProgetto, 'data/seasons.json'), 'utf8'));
    const id = argomenti.find(a => !a.startsWith('--')) || stagioni.currentSeason;
    const stagione = stagioni.seasons.find(s => s.id === id);
    if (!stagione) {
        console.error(`Stagione ${id} sconosciuta`);
        process.exit(1);
    }
    const dati = JSON.parse(fs.readFileSync(path.join(radiceProgetto, stagione.file), 'utf8'));
    const cartella = path.join(radiceProgetto, 'data', 'consigli', id);
    const valutazione = valutaStagione(dati, leggiConsigli(cartella));

    if (valutazione.giornate.length === 0) {
        console.log('Nessun consiglio salvato per una giornata già giocata.');
        return;
    }
    stampa(valutazione);

    if (scrivi) {
        const destinazione = path.join(cartella, 'valutazione.json');
        fs.writeFileSync(destinazione, JSON.stringify(valutazione, null, 2) + '\n');
        console.log(`\nScritto ${path.relative(radiceProgetto, destinazione)}`);
    }
}

if (import.meta.url === `file://${process.argv[1]}`) main();

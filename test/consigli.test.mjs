// Il suggeritore di formazione: quanto si fida dei voti di un giocatore, e i
// due script che salvano il consiglio prima della giornata e lo confrontano
// con quello che è successo dopo.

import test from 'node:test';
import assert from 'node:assert/strict';
import { caricaScript, valuta, esegui } from './aiuto/carica-script.mjs';
import { sovrascrivibile } from '../.claude/skills/aggiorna-giornata/salva-consigli.mjs';
import { punteggioConCambi, punteggioIdeale } from '../.claude/skills/aggiorna-giornata/valuta-consigli.mjs';

const app = caricaScript();

// Una lega minima: un centrocampista (1) con i voti indicati, uno (2) senza
// voti, e abbastanza altri voti di ruolo per avere una media di lega nota
function lega(votiDi1) {
    const players = { 1: { name: 'Uno', role: 'C' }, 2: { name: 'Due', role: 'C' } };
    const rounds = votiDi1.map((voto, i) => {
        const home = [{ p: 1, t: 's', v: voto, b: voto }];
        for (let k = 0; k < 10; k++) {
            players[100 + k] = { name: `C${k}`, role: 'C' };
            home.push({ p: 100 + k, t: 's', v: 6, b: 6 });
        }
        return { round: i + 1, matches: [{ homeTeam: 'A', awayTeam: 'B', lineups: { home, away: [] } }] };
    });
    return { teams: [], players, rounds, rosterHistory: [{ fromRound: 1, teams: { A: [1, 2] } }] };
}

function qualitaDi(dati, pid) {
    esegui(app, `fantacalcioData = ${JSON.stringify(dati)}; probabiliFormazioni = null;`);
    return valuta(app, `punteggioAtteso(${pid}, {}, ${dati.rounds.length})`);
}

test('un 14 alla prima giornata resta molto più vicino alla media di ruolo che a 14', () => {
    const g = qualitaDi(lega([14]), 1);
    const mediaRuolo = g.mediaRuolo;
    // Un voto contro quattro giornate virtuali: pesa un quinto
    assert.ok(Math.abs(g.qualitaBase - (14 + 4 * mediaRuolo) / 5) < 1e-9);
    assert.ok(g.qualitaBase - mediaRuolo < 14 - g.qualitaBase,
        `qualità ${g.qualitaBase} più vicina al voto singolo che alla media di ruolo ${mediaRuolo}`);
});

test('con tante giornate conta la stagione del giocatore, non la media di ruolo', () => {
    const una = qualitaDi(lega([8]), 1);
    const venti = qualitaDi(lega(Array(20).fill(8)), 1);
    assert.ok(venti.qualitaBase > una.qualitaBase);
    assert.ok(8 - venti.qualitaBase < 0.5, `dopo venti 8 la qualità è ${venti.qualitaBase}`);
});

test('chi non ha voti vale la media del suo ruolo nella lega', () => {
    const g = qualitaDi(lega([6, 6]), 2);
    assert.equal(g.senzaDati, true);
    assert.equal(g.qualitaBase, g.mediaRuolo);
});

test('con pochi voti nel ruolo si usa la media di ripiego', () => {
    const dati = lega([7]);
    dati.rounds[0].matches[0].lineups.home = [{ p: 1, t: 's', v: 7, b: 7 }];
    const g = qualitaDi(dati, 1);
    assert.equal(g.mediaRuolo, valuta(app, 'MEDIA_RUOLO_RIPIEGO.C'));
});

test('senza probabili formazioni il suggeritore ripiega sullo storico invece di rompersi', () => {
    // Prima l'indice dei rigoristi restava null quando probabili.json non si
    // caricava, e quotaRigori faceva .get su null
    esegui(app, 'indiceRigoristi = null; indiceRigoristiPer = null; indiceInfortunati = null; indiceInfortunatiPer = null;');
    esegui(app, `fantacalcioData = ${JSON.stringify(lega([6]))}; probabiliFormazioni = null;`);
    assert.doesNotThrow(() => valuta(app, 'suggerisciFormazione("A")'));
});

// ------------------------------------------------------------------
// Salvataggio e valutazione dei consigli
// ------------------------------------------------------------------

const probabili = (numero, giocata = false) => ({ prossimoTurno: { numero, partite: [{ casa: 'X', fuori: 'Y', giocata }] } });

test('il consiglio si scrive la prima volta e si aggiorna finché il turno non comincia', () => {
    assert.equal(sovrascrivibile(null, probabili(6)), true);
    assert.equal(sovrascrivibile({ turnoSerieA: 6 }, probabili(6)), true);
});

test('il consiglio si congela quando il turno comincia o le probabili passano al turno dopo', () => {
    assert.equal(sovrascrivibile({ turnoSerieA: 6 }, probabili(6, true)), false);
    assert.equal(sovrascrivibile({ turnoSerieA: 6 }, probabili(7)), false);
});

const ruoli = { 1: 'P', 2: 'D', 3: 'D', 4: 'D', 5: 'D', 6: 'D', 7: 'D' };
const ruolo = (pid) => ruoli[pid];

test('chi non prende il voto è sostituito da un pari ruolo della panchina, al massimo tre volte', () => {
    const voti = { 1: 6, 5: 7, 6: 6, 7: 5 };
    // Tre difensori titolari senza voto, tre in panchina con il voto
    assert.equal(punteggioConCambi([1, 2, 3, 4], [5, 6, 7], voti, ruolo), 6 + 7 + 6 + 5);
    // Un quarto senza voto resta scoperto
    const ruoliQuattro = (pid) => (pid === 1 ? 'P' : 'D');
    assert.equal(punteggioConCambi([1, 2, 3, 4, 8], [5, 6, 7, 9], { ...voti, 9: 8 }, ruoliQuattro), 6 + 7 + 6 + 5);
});

test('un cambio deve avere lo stesso ruolo', () => {
    assert.equal(punteggioConCambi([2], [1], { 1: 6 }, ruolo), 0);
});

test('la formazione ideale prova i moduli e tiene il migliore', () => {
    const r = (pid) => (pid === 0 ? 'P' : pid <= 5 ? 'D' : pid <= 10 ? 'C' : 'A');
    const rosa = Array.from({ length: 14 }, (_, i) => i);
    const voti = Object.fromEntries(rosa.map(pid => [pid, r(pid) === 'A' ? 10 : 6]));
    // Tre attaccanti da 10 battono qualunque modulo con meno attaccanti
    assert.equal(punteggioIdeale(rosa, voti, r), 6 + 3 * 6 + 4 * 6 + 3 * 10);
});

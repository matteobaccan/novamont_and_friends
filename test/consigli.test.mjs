// Il suggeritore di formazione: quanto si fida dei voti di un giocatore, e i
// due script che salvano il consiglio prima della giornata e lo confrontano
// con quello che è successo dopo.

import test from 'node:test';
import assert from 'node:assert/strict';
import { caricaScript, valuta, esegui } from './aiuto/carica-script.mjs';
import { sovrascrivibile, jsonCompatto } from '../.claude/skills/aggiorna-giornata/salva-consigli.mjs';
import { punteggioConCambi, punteggioIdeale, erroreModello, riassumiErrore, bilancioAllenatori } from '../.claude/skills/aggiorna-giornata/valuta-consigli.mjs';
import { combinazioni, datiPrimaDi } from '../.claude/skills/aggiorna-giornata/rigioca-consigli.mjs';

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

// ------------------------------------------------------------------
// Precisione del modello e bilancio degli allenatori
// ------------------------------------------------------------------

test('la resa si giudica su chi ha preso il voto, la probabilità su tutti', () => {
    const rosa = [
        { pid: 1, ruolo: 'C', resa: 6, rigori: 0.5, probabilita: 1 },   // gioca, fa 8: +1,5
        { pid: 2, ruolo: 'A', resa: 7, rigori: 0, probabilita: 0.5 },   // gioca, fa 5: −2
        { pid: 3, ruolo: 'D', resa: 6, rigori: 0, probabilita: 0.5 }    // non gioca
    ];
    const r = riassumiErrore([erroreModello(rosa, { 1: 8, 2: 5 })]);
    assert.equal(r.resa.tutti.voti, 2);
    assert.equal(r.resa.tutti.erroreMedio, 1.75);
    assert.equal(r.resa.tutti.distorsione, -0.25);
    assert.equal(r.resa.D.voti, 0);
    // (1−1)² + (0,5−1)² + (0,5−0)² = 0,5 su tre giocatori
    assert.equal(r.gioca.brier, 0.167);
    assert.equal(r.gioca.inCampo, 2);
});

test('il bilancio degli allenatori somma le giornate e mette in cima chi ha battuto il consiglio', () => {
    const giornate = [
        { squadre: [
            { squadra: 'A', schierata: 70, consigliata: 66, ideale: 80, inComune: 9 },
            { squadra: 'B', schierata: 60, consigliata: 65, ideale: 75, inComune: 7 }
        ] },
        { squadre: [
            { squadra: 'A', schierata: 68, consigliata: 68, ideale: 74, inComune: 11 },
            { squadra: 'B', schierata: 72, consigliata: 70, ideale: 78, inComune: 8 }
        ] }
    ];
    const [primo, secondo] = bilancioAllenatori(giornate);
    assert.equal(primo.squadra, 'A');
    assert.equal(primo.differenza, 4);
    assert.deepEqual([primo.meglio, primo.pari, primo.peggio], [1, 1, 0]);
    assert.equal(primo.inComune, 10);
    assert.equal(secondo.differenza, -3);
    assert.deepEqual([secondo.meglio, secondo.pari, secondo.peggio], [1, 0, 1]);
});

test('rigiocare una giornata usa solo le giornate precedenti e la rosa di quella giornata', () => {
    const dati = {
        rounds: [{ round: 1 }, { round: 2 }, { round: 3 }],
        rosterHistory: [{ fromRound: 1 }, { fromRound: 3 }, { fromRound: 4 }]
    };
    const prima = datiPrimaDi(dati, 3);
    assert.deepEqual(prima.rounds.map(r => r.round), [1, 2]);
    assert.deepEqual(prima.rosterHistory.map(s => s.fromRound), [1, 3]);
});

test('la griglia dei pesi prova tutte le combinazioni', () => {
    const c = combinazioni({ A: [1, 2], B: [3, 4, 5] });
    assert.equal(c.length, 6);
    assert.deepEqual(c[0], { A: 1, B: 3 });
    assert.deepEqual(combinazioni({}), [{}]);
});

test('una costante sostituita cambia il modello, una inesistente è un errore', () => {
    const prova = caricaScript({ costanti: { GIORNATE_PRIOR: 0 } });
    assert.equal(valuta(prova, 'GIORNATE_PRIOR'), 0);
    assert.throws(() => caricaScript({ costanti: { NON_ESISTE: 1 } }), /NON_ESISTE/);
});

test('il JSON compatto resta JSON valido anche con virgole dentro le stringhe', () => {
    const valore = { a: [1, 2], b: { nome: 'Rossi, M.', n: null }, c: [{ x: 'y,z' }] };
    assert.deepEqual(JSON.parse(jsonCompatto(valore)), valore);
});

// ------------------------------------------------------------------
// E se avesse giocato il sito?
// ------------------------------------------------------------------

const partita = { homeTeam: 'A', awayTeam: 'B', homeScore: 70, awayScore: 72.5 };
const perSquadra = (casa, fuori) => new Map([
    ['A', { squadra: 'A', inComune: 8, ...casa }],
    ['B', { squadra: 'B', inComune: 9, ...fuori }]
]);

test('il punteggio col sito è quello vero più lo scarto fra consigliata e schierata', () => {
    const s = valuta(app, `scenariSito(${JSON.stringify(partita)}, new Map(${JSON.stringify([...perSquadra({ schierata: 68, consigliata: 75 }, { schierata: 70, consigliata: 70 })])}))`);
    assert.equal(s.reale.casa, 70);
    assert.equal(s.sitoCasa.casa, 77);
    assert.equal(s.sitoFuori.fuori, 72.5);
    // 70-72,5 è 1-2; 77-72,5 fa 2-2 per gol, e lo scarto di 4,5 dà il terzo
    assert.equal(`${s.reale.golCasa}-${s.reale.golFuori}`, '1-2');
    assert.equal(`${s.sitoCasa.golCasa}-${s.sitoCasa.golFuori}`, '3-2');
});

test('Caressa racconta il risultato che cambia, Bergomi fa i conti dal lato del fantallenatore', () => {
    const mappa = `new Map(${JSON.stringify([...perSquadra({ schierata: 68, consigliata: 75 }, { schierata: 70, consigliata: 67 })])})`;
    const c = valuta(app, `commentoSito(${JSON.stringify(partita)}, scenariSito(${JSON.stringify(partita)}, ${mappa}))`);
    // A passa da sconfitta a vittoria, B solo da vittoria a pari: vince il cambio più grosso
    assert.match(c.caressa, /Con la formazione del sito A l'avrebbe vinta 3-2/);
    // A ha fatto 7 punti meno del sito, B 3 punti più del sito
    assert.match(c.bergomi, /A −7,0 sul sito/);
    assert.match(c.bergomi, /B \+3,0 sul sito/);
    assert.match(c.bergomi, /Uno a uno/);
});

test('senza la valutazione di una delle due squadre non si inventa niente', () => {
    const s = valuta(app, `scenariSito(${JSON.stringify(partita)}, new Map([['A', { schierata: 1, consigliata: 2, inComune: 5 }]]))`);
    assert.equal(s, null);
});

// ------------------------------------------------------------------
// La partita di Serie A sotto il nome
// ------------------------------------------------------------------

test('la partita mette la casa prima, la squadra del giocatore in grassetto, posizione e forma di tutte e due', () => {
    esegui(app, `probabiliFormazioni = ${JSON.stringify({
        classificaSerieA: { Inter: 2, Parma: 15 },
        formaSerieA: { Inter: { punti: 7, partite: 3, esiti: 'VVP' }, Parma: { punti: 1, partite: 3, esiti: 'PNP' } }
    })};`);
    const html = valuta(app, `htmlPartitaSerieA({ noto: true, squadra: 'Parma', avversario: 'Inter', casa: false })`);
    assert.ok(html.indexOf('INT') < html.indexOf('PAR'), 'la squadra di casa va prima');
    assert.match(html, /<span class="partita-squadra">INT 2°<span class="contesto-su">↑<\/span>/);
    assert.match(html, /<span class="partita-squadra sua">PAR 15°<span class="contesto-giu">↓<\/span>/);
    assert.match(html, /title="Inter-Parma · Inter, 2° in classifica, ultime 3 VVP \(7 punti\) · Parma/);
});

test('senza partita nota non si scrive niente sotto il nome', () => {
    assert.equal(valuta(app, 'htmlPartitaSerieA({ noto: false })'), '');
});

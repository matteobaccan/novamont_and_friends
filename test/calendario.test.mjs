// Il calendario precaricato: se è sbagliato il sito mostra accoppiamenti che
// non esistono e converti-giornata cerca nelle pagine partite che non ci sono.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { caricaScript, esegui } from './aiuto/carica-script.mjs';

const indice = JSON.parse(fs.readFileSync(new URL('../data/seasons.json', import.meta.url), 'utf8'));
const corrente = indice.seasons.find(s => s.id === indice.currentSeason);
const dati = JSON.parse(fs.readFileSync(new URL(`../${corrente.file}`, import.meta.url), 'utf8'));

test('il calendario della lega copre tutte le giornate, ogni squadra una volta per giornata', () => {
    const squadre = dati.teams.map(t => t.name);
    assert.ok(dati.calendar.length > 0);
    dati.calendar.forEach((g, i) => {
        assert.equal(g.round, i + 1);
        const viste = g.matches.flatMap(m => [m.homeTeam, m.awayTeam]).sort();
        assert.deepEqual(viste, [...squadre].sort(), `giornata ${g.round}`);
    });
});

test('le giornate giocate hanno gli accoppiamenti del calendario', () => {
    for (const r of dati.rounds) {
        const g = dati.calendar.find(c => c.round === r.round);
        assert.deepEqual(
            r.matches.map(m => [m.homeTeam, m.awayTeam]),
            g.matches.map(m => [m.homeTeam, m.awayTeam]),
            `giornata ${r.round}`
        );
    }
});

test('il calendario di Serie A: 38 giornate, andata e ritorno, nessun accoppiamento ripetuto', () => {
    const giornate = dati.calendarioSerieA;
    assert.equal(giornate.length, 38);
    const coppie = new Set();
    for (const g of giornate) {
        assert.equal(g.partite.length, 10, `giornata ${g.giornata}`);
        const viste = new Set(g.partite.flatMap(p => [p.casa, p.fuori]));
        assert.equal(viste.size, 20, `giornata ${g.giornata}`);
        for (const p of g.partite) coppie.add(`${p.casa}-${p.fuori}`);
    }
    assert.equal(coppie.size, 380);
    for (const g of dati.calendar) {
        assert.ok(giornate.some(s => s.giornata === g.roundSerieA), `la giornata ${g.round} cita la Serie A ${g.roundSerieA}`);
    }
});

test('il sito elenca le giornate da giocare e ne mostra gli accoppiamenti', () => {
    const app = caricaScript();
    esegui(app, `fantacalcioData = ${JSON.stringify(dati)};`);

    const daGiocare = esegui(app, 'giornateDaGiocare().map(g => g.round)');
    const ultima = Math.max(...dati.rounds.map(r => r.round));
    assert.equal(daGiocare[0], ultima + 1);
    assert.equal(daGiocare.at(-1), dati.calendar.length);

    const html = esegui(app, `htmlGiornataDaGiocare(giornataInCalendario(${ultima + 1}))`);
    const prossima = dati.calendar.find(g => g.round === ultima + 1);
    for (const m of prossima.matches) {
        assert.ok(html.includes(m.homeTeam) && html.includes(m.awayTeam));
    }
    assert.ok(html.includes(`${prossima.roundSerieA}ª giornata di Serie A`));
});

test('senza le partite nelle probabili, casa e trasferta arrivano dal calendario di Serie A', () => {
    const app = caricaScript();
    esegui(app, `fantacalcioData = ${JSON.stringify(dati)};`);
    // Gli oggetti nati nel contesto vm hanno altri prototipi: si confronta il JSON
    const turno = (t) => JSON.parse(JSON.stringify(esegui(app, `partiteDelTurno(${t})`)));
    const g11 = dati.calendarioSerieA.find(g => g.giornata === 11);

    assert.deepEqual(turno('{ numero: 11, partite: [] }'), g11.partite);
    assert.deepEqual(turno('{ numero: 11, partite: [{ casa: "A", fuori: "B" }] }'), [{ casa: 'A', fuori: 'B' }]);
    assert.deepEqual(turno('null'), []);
});

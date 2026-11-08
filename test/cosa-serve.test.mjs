// Il primo passo di ogni aggiornamento: se sbaglia, all'utente si chiedono le
// pagine sbagliate o non si chiede niente quando manca una giornata.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { cosaServe } from '../.claude/skills/aggiorna-giornata/cosa-serve.mjs';

const leggi = (f) => JSON.parse(fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8'));
const indice = leggi('data/seasons.json');
const stagione = indice.seasons.find(s => s.id === indice.currentSeason);
const dati = leggi(stagione.file);

const ultima = Math.max(...dati.rounds.map(r => r.round));
const dopo = dati.calendar.find(g => g.round === ultima + 1);
const dataSerieA = (g) => dati.calendarioSerieA.find(s => s.giornata === g.roundSerieA).data;
const piuGiorni = (iso, n) => new Date(Date.parse(iso + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
const probabili = (aggiornato, numero, giocata = false) => ({ aggiornato, prossimoTurno: { numero, partite: [{ giocata }] } });

test('il giorno della partita la giornata non è ancora da chiedere', () => {
    const oggi = dataSerieA(dopo);
    const s = cosaServe({ dati, source: stagione.source, probabili: null, oggi });
    assert.deepEqual(s.mancanti, []);
    assert.equal(s.prossima.round, dopo.round);
});

test('a turno finito chiede le pagine di ogni partita, con il link giusto', () => {
    const oggi = piuGiorni(dataSerieA(dopo), 2);
    const s = cosaServe({ dati, source: stagione.source, probabili: null, oggi });
    assert.deepEqual(s.mancanti.map(g => g.round), [dopo.round]);

    const [g] = s.mancanti;
    assert.equal(g.partite.length, dopo.matches.length);
    assert.equal(g.partite[0].casa, dopo.matches[0].homeTeam);
    assert.match(g.partite[0].url, new RegExp(`/round/${dopo.round}\\?i=0$`));
    assert.match(g.partite[1].url, new RegExp(`/round/${dopo.round}\\?i=1$`));
    assert.equal(s.prossima.round, dopo.round + 1);
});

test('le probabili: giuste, vecchie, o del turno sbagliato', () => {
    const oggi = dataSerieA(dopo);
    const stato = (p) => cosaServe({ dati, source: stagione.source, probabili: p, oggi }).probabili;

    assert.equal(stato(probabili(oggi + 'T10:00:00Z', dopo.roundSerieA)).stato, 'fresche');
    assert.equal(stato(probabili(piuGiorni(oggi, -5) + 'T10:00:00Z', dopo.roundSerieA)).stato, 'vecchie');

    const sbagliate = stato(probabili(oggi + 'T10:00:00Z', dopo.roundSerieA - 1));
    assert.equal(sbagliate.stato, 'turno-sbagliato');
    assert.equal(sbagliate.turnoAtteso, dopo.roundSerieA);

    assert.equal(stato(null).stato, 'mancanti');
    assert.equal(stato(probabili(oggi + 'T10:00:00Z', dopo.roundSerieA, true)).iniziato, true);
});

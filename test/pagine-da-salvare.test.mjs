// I link alle pagine di fantacalcio.it da salvare a mano: se l'indirizzo di
// una partita è sbagliato si salva la pagina sbagliata e lo si scopre solo
// quando i conti non tornano.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { caricaScript } from './aiuto/carica-script.mjs';

const app = caricaScript();
const indice = JSON.parse(fs.readFileSync(new URL('../data/seasons.json', import.meta.url), 'utf8'));
const corrente = indice.seasons.find(s => s.id === indice.currentSeason);

test('ogni partita ha il suo indirizzo, contato da 1', () => {
    const url = app.urlPartitaLega(corrente.source, 7, 0);
    assert.match(url, /\/round\/7\?i=1$/);
    assert.match(app.urlPartitaLega(corrente.source, 7, 3), /\/round\/7\?i=4$/);
});

test('matchIndexBase sposta il conteggio', () => {
    const source = { roundUrl: 'https://x/round/{round}?i={match}', matchIndexBase: 0 };
    assert.equal(app.urlPartitaLega(source, 2, 0), 'https://x/round/2?i=0');
});

test('giornata a video, prossima e probabili', () => {
    const round = { round: 6, matches: [
        { homeTeam: 'A', awayTeam: 'B' }, { homeTeam: 'C', awayTeam: 'D' }
    ] };
    const pagine = app.pagineDaSalvare(corrente.source, round, 7, 2);

    assert.equal(pagine.calendario, corrente.source.calendarUrl);
    assert.deepEqual(pagine.giornata.partite.map(p => p.etichetta), ['A - B', 'C - D']);
    assert.deepEqual(pagine.prossima.partite.map(p => p.etichetta), ['Partita 1', 'Partita 2']);
    assert.match(pagine.prossima.partite[1].url, /\/round\/7\?i=2$/);
    assert.match(pagine.probabili, /probabili-formazioni-serie-a$/);
});

test('una stagione archiviata, senza sorgente, non mostra niente', () => {
    assert.equal(app.pagineDaSalvare(undefined, null, 1, 4), null);
    assert.equal(app.htmlPagineDaSalvare(null), '');
});

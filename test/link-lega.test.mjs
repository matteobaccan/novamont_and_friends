// I link alle pagine della lega: se l'indirizzo di una partita è sbagliato si
// legge la pagina sbagliata e lo si scopre solo quando i conti non tornano.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { caricaScript, esegui } from './aiuto/carica-script.mjs';

const app = caricaScript();
const indice = JSON.parse(fs.readFileSync(new URL('../data/seasons.json', import.meta.url), 'utf8'));
const corrente = indice.seasons.find(s => s.id === indice.currentSeason);

test('ogni partita ha il suo indirizzo, contato da 0 come fa la lega', () => {
    const url = app.urlPartitaLega(corrente.source, 7, 0);
    assert.match(url, /\/round\/7\?i=0$/);
    assert.match(app.urlPartitaLega(corrente.source, 7, 3), /\/round\/7\?i=3$/);
});

test('matchIndexBase sposta il conteggio', () => {
    const source = { roundUrl: 'https://x/round/{round}?i={match}', matchIndexBase: 1 };
    assert.equal(app.urlPartitaLega(source, 2, 0), 'https://x/round/2?i=1');
});

test('il link di ogni partita, per l\'angolo del suo box', () => {
    esegui(app, `seasonsIndex = ${JSON.stringify(indice)}; currentSeasonId = ${JSON.stringify(indice.currentSeason)};`);
    const html = app.linkPartitaLega(7, 1);
    assert.match(html, /class="match-link"/);
    assert.match(html, /\/round\/7\?i=1"/);
    assert.doesNotMatch(html, /Ctrl\+S|salva/i, 'il suggerimento non parla di salvare pagine');
});

test('una stagione archiviata, senza sorgente, non ha link alle partite', () => {
    assert.equal(app.urlPartitaLega(undefined, 1, 0), null);
    esegui(app, `currentSeasonId = 'stagione-che-non-esiste';`);
    assert.equal(app.linkPartitaLega(1, 0), '');
});

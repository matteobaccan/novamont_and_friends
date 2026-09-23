// Lo scraper gira due volte al giorno in una GitHub Action e committa il
// risultato: se fantacalcio.it cambia impaginazione, i parser restituiscono
// meno dati e il suggeritore di formazione peggiora senza che nessuno se ne
// accorga. Il controllo di plausibilità nel workflow prende solo il caso
// limite (zero squadre, meno di 300 giocatori); questi test prendono il resto.
//
// Le fixture sono frammenti reali di pagina, datati nel loro commento di testa.
// Quando un test fallisce va capito se è cambiato il sito o si è rotto il
// parser: nel primo caso si rigenera la fixture e si aggiornano le attese
// insieme, nel secondo si aggiusta il parser. Mai il contrario.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    decodificaEntita,
    analizza,
    analizzaRigoristi,
    analizzaInfortunati
} from '../.claude/skills/aggiorna-giornata/scarica-probabili.mjs';

const QUI = path.dirname(fileURLToPath(import.meta.url));
const fixture = (nome) => fs.readFileSync(path.join(QUI, 'fixture', nome), 'utf8');

// ------------------------------------------------------------------
// Entità HTML
// ------------------------------------------------------------------

test('le entità HTML si decodificano, in tutte e tre le forme', () => {
    // Le pagine mescolano esadecimali, decimali e nomi: nel frammento delle
    // probabili ci sono &#xE8; e &#xF2;, in quello degli infortunati &agrave;
    assert.equal(decodificaEntita('Bernab&#xE8;'), 'Bernabè');
    assert.equal(decodificaEntita('Per&#xF2; s&#xEC;'), 'Però sì');
    assert.equal(decodificaEntita('met&agrave;'), 'metà');
    assert.equal(decodificaEntita('Citt&#224;'), 'Città');
});

test('quello che non è un\'entità resta com\'è', () => {
    // Un nome con una & dentro non deve sparire
    assert.equal(decodificaEntita('Novamont &friends;'), 'Novamont &friends;');
    assert.equal(decodificaEntita('100% sicuro'), '100% sicuro');
});

// ------------------------------------------------------------------
// Probabili formazioni
// ------------------------------------------------------------------

test('dalle probabili escono squadra, modulo, titolari e riserve', () => {
    const { squadre } = analizza(fixture('probabili.html'));

    assert.equal(squadre.length, 2, 'la fixture contiene due card squadra');

    const genoa = squadre.find(s => s.nome === 'Genoa');
    assert.ok(genoa, 'il Genoa deve essere riconosciuto');
    assert.equal(genoa.modulo, '3-5-2');
    assert.equal(genoa.titolari, 11, 'undici titolari, sempre');

    const fiorentina = squadre.find(s => s.nome === 'Fiorentina');
    assert.ok(fiorentina);
    assert.equal(fiorentina.modulo, '4-3-2-1');
    assert.equal(fiorentina.titolari, 11);
});

test('ogni giocatore porta id, nome, ruolo e probabilità', () => {
    const { giocatori } = analizza(fixture('probabili.html'));

    // Non "estrae 47 giocatori": questo giocatore, con questi campi. Il primo
    // si rompe quando cambia la Serie A, il secondo quando si rompe il parser.
    assert.deepEqual({ ...giocatori[791] }, {
        nome: 'Sabelli',
        squadra: 'Genoa',
        ruolo: 'D',
        probabilita: 25,
        titolare: false
    });

    assert.equal(giocatori[795].nome, 'El Shaarawy');
    assert.equal(giocatori[795].ruolo, 'C');
    assert.equal(giocatori[795].probabilita, 60);
});

test('i titolari hanno probabilità 100 anche senza la barretta', () => {
    const { giocatori } = analizza(fixture('probabili.html'));
    const titolari = Object.values(giocatori).filter(g => g.titolare);

    assert.equal(titolari.length, 22, 'undici per squadra');
    for (const g of titolari) {
        assert.ok(g.probabilita > 0, `${g.nome} è titolare ma ha probabilità ${g.probabilita}`);
    }
});

test('un giocatore compare una volta sola, e vince la voce da titolare', () => {
    const { giocatori } = analizza(fixture('probabili.html'));
    const ids = Object.keys(giocatori);
    assert.equal(new Set(ids).size, ids.length, 'nessun id ripetuto');

    // ogni giocatore ha una squadra sola
    for (const [pid, g] of Object.entries(giocatori)) {
        assert.ok(g.squadra, `il giocatore ${pid} è senza squadra`);
        assert.ok(g.nome, `il giocatore ${pid} è senza nome`);
    }
});

test('una pagina senza card squadra non esplode, torna vuoto', () => {
    const vuoto = analizza('<html><body><p>manutenzione</p></body></html>');
    assert.deepEqual(vuoto.squadre, []);
    assert.deepEqual(Object.keys(vuoto.giocatori), []);
});

// ------------------------------------------------------------------
// Rigoristi
// ------------------------------------------------------------------

test('i rigoristi arrivano in ordine di gerarchia', () => {
    const rigoristi = analizzaRigoristi(fixture('rigoristi.html'));

    // L'ordine è l'informazione: il secondo calcia quando il primo non gioca
    assert.deepEqual(
        rigoristi.Atalanta.map(r => r.nome),
        ['Scamacca', 'Krstovic', 'Samardzic']
    );
    assert.equal(rigoristi.Atalanta[0].pid, 2137);

    assert.deepEqual(
        rigoristi.Bologna.map(r => r.nome),
        ['Orsolini', 'Bernardeschi', 'Dovbyk']
    );
});

test('dei rigoristi si tiene anche il nome, non solo l\'id', () => {
    // Serve per riconoscere un rigorista infortunato che non è in nessuna rosa
    // della lega, e quindi senza anagrafica locale a cui agganciarsi
    const rigoristi = analizzaRigoristi(fixture('rigoristi.html'));
    for (const voci of Object.values(rigoristi)) {
        for (const v of voci) {
            assert.equal(typeof v.pid, 'number');
            assert.ok(Number.isFinite(v.pid) && v.pid > 0);
            assert.ok(v.nome && v.nome.length > 0);
        }
    }
});

// ------------------------------------------------------------------
// Infortunati
// ------------------------------------------------------------------

test('gli infortunati portano nome, squadra e nota leggibile', () => {
    const infortunati = analizzaInfortunati(fixture('infortunati.html'));

    assert.equal(infortunati.length, 4);

    const kossounou = infortunati.find(i => i.nome === 'Kossounou');
    assert.ok(kossounou, 'Kossounou deve essere riconosciuto');
    assert.equal(kossounou.squadra, 'Atalanta');
    assert.match(kossounou.nota, /lesione muscolare/);

    const odgaard = infortunati.find(i => i.nome === 'Odgaard');
    assert.equal(odgaard.squadra, 'Bologna');
});

test('la nota dell\'infortunio esce senza tag e con gli accenti giusti', () => {
    const infortunati = analizzaInfortunati(fixture('infortunati.html'));
    const hien = infortunati.find(i => i.nome === 'Hien');

    assert.ok(hien, 'Hien deve essere riconosciuto');
    assert.match(hien.nota, /metà di ottobre/, 'le entità HTML vanno decodificate');

    for (const i of infortunati) {
        assert.ok(!/[<>]/.test(i.nota), `la nota di ${i.nome} contiene ancora del markup`);
        assert.ok(!/&[a-zA-Z#]+;/.test(i.nota), `la nota di ${i.nome} contiene ancora un'entità`);
        assert.equal(i.nota, i.nota.trim(), `la nota di ${i.nome} ha spazi ai bordi`);
    }
});

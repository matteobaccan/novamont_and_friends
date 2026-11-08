// I parser leggono pagine HTML: se il sito cambia
// impaginazione, restituiscono meno dati e il suggeritore di formazione
// peggiora senza che nessuno se ne accorga. Lo script si ferma solo nel caso
// limite (zero squadre); questi test prendono il resto.
//
// Le fixture sono file HTML che NON stanno nel repo (test/fixture/*.html è
// in .gitignore). Se non sono presenti, i test non li validano: quelli che li
// usano vengono saltati, e quelli che non ne hanno bisogno girano lo stesso.
//
// Quando un test fallisce va capito se è cambiato il sito o si è rotto il
// parser: nel primo caso si aggiornano le attese, nel secondo si aggiusta il
// parser. Mai il contrario.

import base from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    decodificaEntita,
    analizza,
    analizzaRigoristi,
    analizzaInfortunati,
    analizzaSqualificati,
    analizzaPartite,
    numeroProssimoTurno
} from '../.claude/skills/aggiorna-giornata/leggi-probabili.mjs';
import { leggiCalendarioLega, leggiCalendarioSerieA } from '../.claude/skills/aggiorna-giornata/leggi-calendario.mjs';
import { leggiPartita, confrontaPartita } from '../.claude/skills/aggiorna-giornata/leggi-partita.mjs';

const QUI = path.dirname(fileURLToPath(import.meta.url));
class SenzaFixture extends Error {}
const fixture = (nome) => {
    const file = path.join(QUI, 'fixture', nome);
    if (!fs.existsSync(file)) throw new SenzaFixture(`manca test/fixture/${nome}, file HTML non presente, il test non lo valida`);
    return fs.readFileSync(file, 'utf8');
};

// Un test che chiede una fixture assente viene saltato, non fallisce
const test = (nome, corpo) => base(nome, (t) => {
    try {
        return corpo(t);
    } catch (e) {
        if (e instanceof SenzaFixture) return t.skip(e.message);
        throw e;
    }
});

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
// Squalificati
// ------------------------------------------------------------------

test('gli squalificati portano id, nome e squadra', () => {
    const squalificati = analizzaSqualificati(fixture('squalificati.html'));

    assert.equal(squalificati.length, 1, 'nella fixture ce ne sta uno solo');
    assert.deepEqual(squalificati[0], { pid: 5585, nome: 'Malen', squadra: 'Roma' });
});

test('lo squalificato va alla squadra giusta delle due della partita', () => {
    // La sezione sta dentro la card della partita e ha un blocco per squadra,
    // prima la casa e poi la trasferta: sbagliare l'ordine darebbe Malen al
    // Genoa, che nel suo blocco non ha nessuno
    const squalificati = analizzaSqualificati(fixture('squalificati.html'));

    assert.equal(squalificati.filter(s => s.squadra === 'Genoa').length, 0);
});

test('senza squalificati non esce niente, non una voce vuota', () => {
    // La fixture delle probabili ha la sezione Squalificati con «Nessun
    // calciatore» in tutti e due i blocchi
    assert.deepEqual(analizzaSqualificati(fixture('probabili.html')), []);
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

// ------------------------------------------------------------------
// Calendario
// ------------------------------------------------------------------

test('il calendario della lega: accoppiamenti e giornata di Serie A, giocata o no', () => {
    const giornate = leggiCalendarioLega(fixture('calendario-lega.html'));
    assert.deepEqual(giornate.map(g => [g.round, g.roundSerieA]), [[6, 10], [7, 11]]);

    // La 6 è giocata: il risultato in mezzo non deve finire nei nomi
    assert.deepEqual(giornate[0].matches[0], { homeTeam: 'Real Pattagghiu', awayTeam: 'PARTIZAN TIRANA' });
    assert.deepEqual(giornate[1].matches.map(m => `${m.homeTeam}-${m.awayTeam}`), [
        'Team24-Ultimo', 'Cusiana-Real Pattagghiu', 'PARTIZAN TIRANA-SM Frattese', 'Shakhtar Donuts-Real Ichnusa'
    ]);
});

test('il calendario di Serie A trascritto: data in ISO, partite casa-fuori', () => {
    const [g] = leggiCalendarioSerieA('# commento\n11 08/11/2026 Cagliari-Frosinone Venezia-Udinese\n');
    assert.equal(g.giornata, 11);
    assert.equal(g.data, '2026-11-08');
    assert.deepEqual(g.partite, [{ casa: 'Cagliari', fuori: 'Frosinone' }, { casa: 'Venezia', fuori: 'Udinese' }]);
});

// ------------------------------------------------------------------
// Pagina di una partita della lega
// ------------------------------------------------------------------

const partita = () => leggiPartita(fixture('partita-lega.html'));
const pubblicata = () => {
    const dati = JSON.parse(fs.readFileSync(path.join(QUI, '..', 'data', '2026-2027.json'), 'utf8'));
    return dati.rounds.find(r => r.round === 6).matches[0];
};

test('la partita: squadre, moduli, gol e punteggi dall\'intestazione', () => {
    const p = partita();
    assert.deepEqual(
        [p.casa, p.fuori, p.moduloCasa, p.moduloFuori, p.golCasa, p.golFuori, p.puntiCasa, p.puntiFuori],
        ['Real Pattagghiu', 'PARTIZAN TIRANA', '4-4-2', '3-4-3', 3, 0, 78.5, 62.5]
    );
    assert.deepEqual(p.anomalie, []);
});

test('la partita: titolari e panchina divisi per squadra, con lo stato di ognuno', () => {
    const { lineups, giocatori } = partita();
    assert.equal(lineups.home.length, 22);
    assert.equal(lineups.away.length, 20);

    const stato = (lato, nome) => lineups[lato].find(g => giocatori[g.p].nome === nome).t;
    assert.equal(stato('home', 'Mandas'), 's');
    assert.equal(stato('home', 'Baldanzi'), 'out', 'titolare attenuato: uscito');
    assert.equal(stato('home', 'Adopo'), 'in', 'panchinaro non attenuato: entrato');
    assert.equal(stato('home', 'Fabbian'), 'b');
    assert.equal(stato('away', 'Martinez Jo.'), 'in');
});

test('la partita: voti, fantavoti, senza voto ed eventi contati per icona', () => {
    const { lineups, giocatori } = partita();
    const di = (nome) => [...lineups.home, ...lineups.away].find(g => giocatori[g.p].nome === nome);

    assert.deepEqual(di('Da Cunha'), { p: 5559, t: 's', v: 7, b: 10, e: { gol: 1 } }, 'rigore segnato è un gol, il migliore in campo non pesa');
    assert.deepEqual(di('Soulè').e, { assist: 2 }, 'assist e assist soft si sommano');
    assert.deepEqual(di('Martinez Jo.').e, { golSubiti: 3 }, 'tre icone, tre gol subiti');
    assert.deepEqual(di('Dimarco'), { p: 254, t: 'out', sv: true });
    assert.deepEqual(di('Provedel'), { p: 2814, t: 'out' }, 'non ha giocato: niente voto e niente sv');
});

test('la partita letta dalla pagina coincide con quella pubblicata', () => {
    assert.deepEqual(confrontaPartita(partita(), pubblicata()), []);
});

test('il confronto trova le differenze', () => {
    const m = pubblicata();
    m.homeScore = 79;
    m.lineups.home[1].v = 6.5;
    delete m.lineups.away[1].sv;
    const diff = confrontaPartita(partita(), m);
    assert.equal(diff.length, 3);
    assert.match(diff.join('\n'), /punteggio casa: pagina 78.5, dati 79/);
    assert.match(diff.join('\n'), /Miranda J\.: v pagina 7, dati 6.5/);
    assert.match(diff.join('\n'), /Dimarco: senza voto/);
});

test('un evento mai visto ferma la lettura invece di essere indovinato', () => {
    const html = fixture('partita-lega.html').replace('data-icon-key="yellowCards"', 'data-icon-key="redCards"');
    const { anomalie } = leggiPartita(html);
    assert.ok(anomalie.some(a => /evento sconosciuto "redCards"/.test(a)), anomalie.join('\n'));
});

// ------------------------------------------------------------------
// Partite del turno nelle probabili
// ------------------------------------------------------------------

test('le partite del turno si leggono anche con i <meta> senza barra finale', () => {
    const originale = fixture('probabili.html');
    // Alcuni file HTML hanno <meta ...> invece di <meta ... />: prima di
    // novembre 2026 il lettore non trovava più nessuna partita
    const salvata = originale.replace(/(<meta itemprop="name" content="[^"]*")\s*\/>/g, '$1>');
    assert.notEqual(salvata, originale);

    for (const html of [originale, salvata]) {
        const turno = numeroProssimoTurno(html);
        assert.equal(turno, 6);
        assert.deepEqual(analizzaPartite(html, turno).map(p => `${p.casa}-${p.fuori}`), ['Inter-Parma']);
    }
});

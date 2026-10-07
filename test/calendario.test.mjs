// Il calendario di tutte le competizioni, per la stanchezza di chi ha giocato a
// metà settimana: nomi ESPN riportati a quelli di fantacalcio.it, giorni di
// riposo, e il peso che la stanchezza ha nel contesto della partita.
//
// La fixture è costruita a mano sulla forma dello scoreboard ESPN
// (events[].date, competitions[0].competitors[].homeAway/team.displayName).

import test from 'node:test';
import assert from 'node:assert/strict';
import { nomeSerieA, analizzaScoreboard, calcolaCalendario, scaricaCalendario, unisciPartite } from '../.claude/skills/aggiorna-giornata/calendario-squadre.mjs';
import { caricaScript, valuta, esegui } from './aiuto/carica-script.mjs';

const SERIE_A = ['Atalanta', 'Bologna', 'Como', 'Inter', 'Juventus', 'Milan', 'Napoli', 'Roma', 'Udinese', 'Verona'];

test('i nomi ESPN tornano quelli di fantacalcio.it', () => {
    assert.equal(nomeSerieA('Internazionale', SERIE_A), 'Inter');
    assert.equal(nomeSerieA('AC Milan', SERIE_A), 'Milan');
    assert.equal(nomeSerieA('AS Roma', SERIE_A), 'Roma');
    assert.equal(nomeSerieA('Hellas Verona', SERIE_A), 'Verona');
    assert.equal(nomeSerieA('Udinese Calcio 1896', SERIE_A), 'Udinese');
    assert.equal(nomeSerieA('Bayern Munich', SERIE_A), null);
});

test('in Europa un nome che contiene quello di una italiana non basta', () => {
    assert.equal(nomeSerieA("Inter Club d'Escaldes", SERIE_A, { approssimato: false }), null);
    assert.equal(nomeSerieA('Internazionale', SERIE_A, { approssimato: false }), 'Inter');
});

const evento = (data, casa, fuori, stato = 'STATUS_SCHEDULED') => ({
    date: data,
    status: { type: { name: stato } },
    competitions: [{ competitors: [
        { homeAway: 'home', team: { displayName: casa } },
        { homeAway: 'away', team: { displayName: fuori } }
    ] }]
});

test('lo scoreboard dà data, squadre e competizione, e segna le partite rinviate', () => {
    const partite = analizzaScoreboard({ events: [
        evento('2026-10-01T19:00Z', 'Internazionale', 'Bayern Munich'),
        evento('2026-10-02T19:00Z', 'AS Roma', 'Porto', 'STATUS_POSTPONED')
    ] }, 'Champions League');
    assert.equal(partite.length, 2);
    assert.deepEqual(partite[0], { data: '2026-10-01T19:00Z', competizione: 'Champions League', casa: 'Internazionale', fuori: 'Bayern Munich', annullata: false });
    assert.equal(partite[1].annullata, true);
});

test('i giorni di riposo vanno dalla partita prima, di qualunque competizione, alla prossima di Serie A', () => {
    const partite = [
        ...analizzaScoreboard({ events: [
            evento('2026-09-27T16:00Z', 'Internazionale', 'Como'),
            evento('2026-10-04T18:45Z', 'Internazionale', 'AS Roma'),
            evento('2026-10-04T16:00Z', 'Napoli', 'Como')
        ] }, 'Serie A'),
        ...analizzaScoreboard({ events: [
            evento('2026-10-01T19:00Z', 'Internazionale', 'Bayern Munich'),
            evento('2026-10-07T19:00Z', 'AS Roma', 'Porto')
        ] }, 'Champions League')
    ];
    const { calendario } = calcolaCalendario(partite, SERIE_A, '2026-10-02T10:00:00Z');

    // Inter: Champions mercoledì sera, Serie A sabato sera
    assert.equal(calendario.Inter.giorniRiposo, 3);
    assert.equal(calendario.Inter.precedente.competizione, 'Champions League');
    assert.equal(calendario.Inter.partiteUltimaSettimana, 1);
    assert.equal(calendario.Inter.prossima.avversario, 'Roma');

    // Roma: nessuna partita prima nella finestra, Champions tre giorni dopo
    assert.equal(calendario.Roma.giorniRiposo, null);
    assert.equal(calendario.Roma.dopo.competizione, 'Champions League');
    assert.equal(calendario.Roma.giorniAllaSuccessiva, 3);

    // Como: una settimana piena
    assert.equal(calendario.Como.giorniRiposo, 7);
});

test('una squadra di Serie A con un nome sconosciuto finisce nel log, una straniera no', () => {
    const partite = [
        ...analizzaScoreboard({ events: [evento('2026-10-04T18:45Z', 'Squadra Misteriosa', 'Internazionale')] }, 'Serie A'),
        ...analizzaScoreboard({ events: [evento('2026-10-01T19:00Z', 'Internazionale', 'Bayern Munich')] }, 'Champions League')
    ];
    const { sconosciute } = calcolaCalendario(partite, SERIE_A, '2026-10-02T10:00:00Z');
    assert.deepEqual(sconosciute, ['Squadra Misteriosa']);
});

// ------------------------------------------------------------------
// Il peso nel contesto della partita
// ------------------------------------------------------------------

const app = caricaScript();

function contestoCon(calendarioSquadre) {
    esegui(app, `probabiliFormazioni = ${JSON.stringify({
        prossimoTurno: { numero: 6, partite: [{ casa: 'Inter', fuori: 'Roma', giocata: false }] },
        classificaSerieA: {},
        formaSerieA: {},
        calendarioSquadre
    })}; contestiPartita.clear(); contestiPartitaPer = null;`);
    return {
        inter: valuta(app, 'calcolaContestoPartita("Inter")'),
        roma: valuta(app, 'calcolaContestoPartita("Roma")')
    };
}

test('chi ha giocato da tre giorni perde contro chi ha riposato, e l\'altro guadagna altrettanto', () => {
    const { inter, roma } = contestoCon({ Inter: { giorniRiposo: 3 }, Roma: { giorniRiposo: 7 } });
    const peso = valuta(app, 'PESO_STANCHEZZA');
    assert.equal(inter.stanchezza, -peso);
    assert.equal(roma.stanchezza, peso);
});

test('con quattro giorni di riposo la stanchezza vale la metà', () => {
    const { inter } = contestoCon({ Inter: { giorniRiposo: 4 }, Roma: { giorniRiposo: 7 } });
    assert.equal(inter.stanchezza, -valuta(app, 'PESO_STANCHEZZA') / 2);
});

test('se hanno giocato tutte e due, o il calendario non c\'è, nessuno ha un vantaggio', () => {
    assert.equal(contestoCon({ Inter: { giorniRiposo: 3 }, Roma: { giorniRiposo: 3 } }).inter.stanchezza, 0);
    assert.equal(contestoCon(undefined).inter.stanchezza, 0);
});

test('sotto il nome compaiono i giorni di riposo corti e il rischio turnover', () => {
    contestoCon({ Inter: { giorniRiposo: 3, precedente: { data: '2026-10-01T19:00Z', competizione: 'Champions League', avversario: 'Bayern Munich' } },
        Roma: { giorniRiposo: 7, giorniAllaSuccessiva: 3, dopo: { data: '2026-10-07T19:00Z', competizione: 'Champions League', avversario: 'Porto' } } });
    const html = valuta(app, 'htmlPartitaSerieA(calcolaContestoPartita("Inter"))');
    assert.match(html, /INT<span class="partita-riposo">3g<\/span>/);
    assert.match(html, /ROM<span class="partita-turnover">»<\/span>/);
    assert.match(html, /Inter ha giocato .* \(Champions League con Bayern Munich\): 3 giorni di riposo/);
    assert.match(html, /Fra 3 giorni Champions League con Porto: rischio turnover/);
});

// ------------------------------------------------------------------
// Scaricamento: intervallo, e giorno per giorno se l'intervallo è rifiutato
// ------------------------------------------------------------------


const silenzio = () => {
    const originali = { log: console.log, warn: console.warn };
    console.log = () => {};
    console.warn = () => {};
    return () => Object.assign(console, originali);
};

test('se l\'intervallo di date viene rifiutato si chiede un giorno alla volta, senza doppioni', async () => {
    const richieste = [];
    const finto = async (url) => {
        richieste.push(url);
        if (/dates=\d{8}-\d{8}/.test(url)) throw new Error('400');
        // Ogni giorno restituisce la stessa partita: deve contare una volta sola
        return url.includes('ita.1') ? { events: [evento('2099-01-01T18:00Z', 'Internazionale', 'AS Roma')] } : { events: [] };
    };
    const ripristina = silenzio();
    try {
        await scaricaCalendario(SERIE_A, finto);
    } finally {
        ripristina();
    }
    const intervalli = richieste.filter(u => /dates=\d{8}-\d{8}/.test(u));
    const giornaliere = richieste.filter(u => /dates=\d{8}$/.test(u));
    assert.equal(intervalli.length, 5, 'una prova con l\'intervallo per competizione');
    assert.ok(giornaliere.length >= 5 * 22, `poi un giorno alla volta, ${giornaliere.length} richieste`);
});

test('se l\'intervallo funziona basta una richiesta per competizione', async () => {
    const richieste = [];
    const ripristina = silenzio();
    try {
        await scaricaCalendario(SERIE_A, async (url) => { richieste.push(url); return { events: [] }; });
    } finally {
        ripristina();
    }
    assert.equal(richieste.length, 5);
    assert.ok(richieste.every(u => !u.includes('limit=')));
});

// ------------------------------------------------------------------
// Memoria delle partite già viste
// ------------------------------------------------------------------


test('le partite ricordate restano, quelle nuove le aggiornano, le vecchie si buttano', () => {
    const adesso = Date.parse('2026-10-10T12:00Z');
    const ricordate = [
        { data: '2026-10-07T19:00Z', competizione: 'Champions League', casa: 'Internazionale', fuori: 'Bayern Munich' },
        { data: '2026-10-11T16:00Z', competizione: 'Serie A', casa: 'AC Milan', fuori: 'Sassuolo' },
        { data: '2026-09-20T19:00Z', competizione: 'Serie A', casa: 'AS Roma', fuori: 'Como' }
    ];
    // Milan-Sassuolo spostata di un giorno
    const nuove = [{ data: '2026-10-12T16:00Z', competizione: 'Serie A', casa: 'AC Milan', fuori: 'Sassuolo' }];
    const unite = unisciPartite(ricordate, nuove, adesso);
    assert.deepEqual(unite.map(p => `${p.casa} ${p.data.slice(5, 10)}`), ['Internazionale 10-07', 'AC Milan 10-12']);
});

test('con la memoria la coppa di mercoledì dà il riposo del weekend anche se la fonte non la dà più', async () => {
    const ricordate = [{ data: new Date(Date.now() - 3 * 86400000).toISOString(), competizione: 'Champions League', casa: 'Internazionale', fuori: 'Bayern Munich' }];
    // La fonte dà solo il futuro: la partita di domenica, non la coppa di mercoledì
    const finto = async (url) => (url.includes('ita.1')
        ? { events: [evento(new Date(Date.now() + 86400000).toISOString(), 'Internazionale', 'AS Roma')] }
        : { events: [] });
    const ripristina = silenzio();
    let risultato;
    try {
        risultato = await scaricaCalendario(SERIE_A, finto, ricordate);
    } finally {
        ripristina();
    }
    assert.equal(risultato.calendario.Inter.giorniRiposo, 4);
    assert.equal(risultato.calendario.Inter.precedente.competizione, 'Champions League');
    assert.equal(risultato.partite.length, 2);
});

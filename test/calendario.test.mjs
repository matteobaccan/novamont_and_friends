// Il calendario di tutte le competizioni, per la stanchezza di chi ha giocato a
// metà settimana: nomi ESPN riportati a quelli di fantacalcio.it, giorni di
// riposo, e il peso che la stanchezza ha nel contesto della partita.
//
// La fixture è costruita a mano sulla forma dello scoreboard ESPN
// (events[].date, competitions[0].competitors[].homeAway/team.displayName).

import test from 'node:test';
import assert from 'node:assert/strict';
import { nomeSerieA, analizzaScoreboard, calcolaCalendario, scaricaCalendario, unisciPartite, quotaDecimale, quoteDellaGara, probabilitaDaQuote } from '../.claude/skills/aggiorna-giornata/calendario-squadre.mjs';
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
    assert.deepEqual(partite[0], { data: '2026-10-01T19:00Z', competizione: 'Champions League', casa: 'Internazionale', fuori: 'Bayern Munich', annullata: false, quote: null });
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

// ------------------------------------------------------------------
// Quote dei bookmaker
// ------------------------------------------------------------------

test('le quote americane e decimali diventano tutte decimali', () => {
    assert.equal(quotaDecimale(-250), 1.4);
    assert.equal(quotaDecimale('+150'), 2.5);
    assert.equal(quotaDecimale('EVEN'), 2);
    assert.equal(quotaDecimale(1.45), 1.45);
    assert.equal(quotaDecimale({ close: { odds: '-200' } }), 1.5);
    assert.equal(quotaDecimale({ current: { moneyLine: { american: '+300' } } }), 4);
    assert.equal(quotaDecimale('OFF'), null);
    assert.equal(quotaDecimale(undefined), null);
});

test('le quote si leggono in tutte e due le forme dello scoreboard', () => {
    const vecchia = { odds: [{ provider: { name: 'DraftKings' }, homeTeamOdds: { moneyLine: -250 }, awayTeamOdds: { moneyLine: 600 }, drawOdds: { moneyLine: 380 } }] };
    assert.deepEqual(quoteDellaGara(vecchia), { casa: 1.4, pareggio: 4.8, fuori: 7, fonte: 'DraftKings' });

    const nuova = { odds: [{ moneyline: { home: { close: { odds: '+120' } }, draw: { close: { odds: '+230' } }, away: { close: { odds: '+250' } } } }] };
    assert.deepEqual(quoteDellaGara(nuova), { casa: 2.2, pareggio: 3.3, fuori: 3.5, fonte: null });

    // Senza il pareggio non è una quota 1X2: meglio niente che una sbagliata
    assert.equal(quoteDellaGara({ odds: [{ homeTeamOdds: { moneyLine: -150 }, awayTeamOdds: { moneyLine: 130 } }] }), null);
    assert.equal(quoteDellaGara({}), null);

    // Una voce nulla nell'elenco, come succede davvero in Conference League
    assert.deepEqual(quoteDellaGara({ odds: [null, vecchia.odds[0]] }), { casa: 1.4, pareggio: 4.8, fuori: 7, fonte: 'DraftKings' });
});

test('quote in un formato inatteso fanno perdere le quote, non la partita', () => {
    const strana = evento('2026-10-15T19:00Z', 'AC Milan', 'Porto');
    Object.defineProperty(strana.competitions[0], 'odds', { get() { throw new Error('formato inatteso'); } });
    const [partita] = analizzaScoreboard({ events: [strana] }, 'Europa League');
    assert.equal(partita.casa, 'AC Milan');
    assert.equal(partita.quote, null);
});

test('le probabilità dalle quote tolgono il margine del bookmaker e sommano a 1', () => {
    const p = probabilitaDaQuote({ casa: 1.4, pareggio: 4.8, fuori: 7 });
    assert.ok(Math.abs(p.casa + p.pareggio + p.fuori - 1) < 0.002);
    assert.ok(p.casa > 0.65 && p.casa < 0.7, `casa ${p.casa}`);
});

test('nel calendario le probabilità sono dal punto di vista di ciascuna squadra', () => {
    const json = { events: [{ ...evento('2099-10-10T16:00Z', 'Internazionale', 'Parma'),
        competitions: [{ ...evento('2099-10-10T16:00Z', 'Internazionale', 'Parma').competitions[0],
            odds: [{ homeTeamOdds: { moneyLine: -250 }, awayTeamOdds: { moneyLine: 600 }, drawOdds: { moneyLine: 380 } }] }] }] };
    const { calendario } = calcolaCalendario(analizzaScoreboard(json, 'Serie A'), [...SERIE_A, 'Parma'], '2099-10-08T10:00Z');
    assert.ok(calendario.Inter.prossima.esiti.vittoria > 0.6);
    assert.equal(calendario.Inter.prossima.esiti.vittoria, calendario.Parma.prossima.esiti.sconfitta);
});

test('le quote viste prima restano se la fonte non le dà più', () => {
    const adesso = Date.parse('2026-10-10T17:00Z');
    const ricordata = { data: '2026-10-10T16:00Z', competizione: 'Serie A', casa: 'Internazionale', fuori: 'Parma', quote: { casa: 1.4, pareggio: 4.8, fuori: 7 } };
    const [unita] = unisciPartite([ricordata], [{ ...ricordata, quote: null }], adesso);
    assert.deepEqual(unita.quote, ricordata.quote);
});

test('con le quote una netta favorita guadagna, l\'altra perde, e campo e classifica non contano più', () => {
    const esiti = (v, n, s) => ({ prossima: { esiti: { vittoria: v, pareggio: n, sconfitta: s, quote: {} } } });
    const { inter, roma } = contestoCon({ Inter: esiti(0.65, 0.2, 0.15), Roma: esiti(0.15, 0.2, 0.65) });
    const peso = valuta(app, 'PESO_QUOTE');
    const soglia = valuta(app, 'SOGLIA_QUOTE');
    const atteso = (0.5 - soglia) / (1 - soglia) * peso;
    assert.ok(Math.abs(inter.quote - atteso) < 1e-9);
    assert.ok(Math.abs(roma.quote + atteso) < 1e-9);
    // Inter in casa, ma il fattore è solo quello delle quote
    assert.ok(Math.abs(inter.fattore - (1 + atteso)) < 1e-9);
});

test('una partita equilibrata secondo i bookmaker non sposta niente', () => {
    const esiti = (v, n, s) => ({ prossima: { esiti: { vittoria: v, pareggio: n, sconfitta: s, quote: {} } } });
    const { inter } = contestoCon({ Inter: esiti(0.4, 0.3, 0.3), Roma: esiti(0.3, 0.3, 0.4) });
    assert.equal(inter.quote, 0);
    assert.equal(inter.fattore, 1);
});

test('sotto il nome compare la probabilità di vittoria, in evidenza per la netta favorita', () => {
    const esiti = (v, n, s) => ({ prossima: { esiti: { vittoria: v, pareggio: n, sconfitta: s, quote: { casa: 1.4, pareggio: 4.8, fuori: 7, fonte: 'DraftKings' } } } });
    contestoCon({ Inter: esiti(0.68, 0.18, 0.14), Roma: esiti(0.14, 0.18, 0.68) });
    const html = valuta(app, 'htmlPartitaSerieA(calcolaContestoPartita("Roma"))');
    assert.match(html, /INT<span class="partita-quota favorita">68%<\/span>/);
    assert.match(html, /ROM<span class="partita-quota">14%<\/span>/);
    assert.match(html, /Quote 1 1.4 · X 4.8 · 2 7 \(DraftKings\): vince Inter 68%, pari 18%, vince Roma 14%/);
});

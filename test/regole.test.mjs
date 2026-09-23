// Le regole della lega sono aritmetica pura: conversione punteggio/gol, il
// pareggio con scarto, il saldo di bonus e malus, la scala dei punti di merito.
// È esattamente il codice che un test copre bene e una rilettura copre male.

import test from 'node:test';
import assert from 'node:assert/strict';
import { caricaScript, valuta, esegui } from './aiuto/carica-script.mjs';

const app = caricaScript();

// ------------------------------------------------------------------
// Conversione punteggio -> gol
// ------------------------------------------------------------------

test('il primo gol arriva a 66 punti, poi uno ogni 6', () => {
    const attesi = [
        [0, 0], [59.5, 0], [60, 0], [65, 0], [65.5, 0],
        [66, 1], [71.5, 1],
        [72, 2], [77.5, 2],
        [78, 3], [84, 4], [90, 5]
    ];
    for (const [punteggio, gol] of attesi) {
        assert.equal(app.calculateGoalsFromScore(punteggio), gol,
            `${punteggio} punti dovrebbero valere ${gol} gol`);
    }
});

test('il confine fra zero gol e un gol sta esattamente a 66', () => {
    assert.equal(app.calculateGoalsFromScore(65.9), 0);
    assert.equal(app.calculateGoalsFromScore(66), 1);
});

test('un punteggio disastroso vale zero gol, mai meno di zero', () => {
    // La guardia `score < 66` sembra servire al confine dei 66, ma lì la formula
    // ci arriva da sola: Math.floor((65.9 - 60) / 6) fa già 0. Quello che la
    // guardia impedisce davvero sono i gol negativi sotto i 60 punti, dove
    // Math.floor((0 - 60) / 6) darebbe -10 e una squadra si ritroverebbe con
    // dieci gol in meno. Togliendola, è questo test a cadere.
    for (const punteggio of [0, 30, 50, 59.5]) {
        assert.equal(app.calculateGoalsFromScore(punteggio), 0,
            `${punteggio} punti non possono valere gol negativi`);
    }
});

// ------------------------------------------------------------------
// Gol della partita e regola del pareggio
// ------------------------------------------------------------------

// calculateMatchGoals torna un oggetto creato dentro il contesto vm: ha un
// Object.prototype diverso da quello dell'host, e deepStrictEqual lo rifiuta
// anche a contenuto identico. Si confrontano i due numeri.
function gol(casa, fuori) {
    const r = app.calculateMatchGoals(casa, fuori);
    return [r.homeGoals, r.awayGoals];
}

test('a parità di gol, uno scarto di almeno 4 punti premia chi ha fatto di più', () => {
    // pari in gol e scarto sotto soglia: resta pari
    assert.deepEqual(gol(70, 70), [1, 1]);   // scarto 0
    assert.deepEqual(gol(71, 68), [1, 1]);   // scarto 3
    assert.deepEqual(gol(72, 75), [2, 2]);   // scarto 3

    // pari in gol e scarto esattamente 4: il gol in più va a chi ha il punteggio alto
    assert.deepEqual(gol(76, 72), [3, 2]);
    assert.deepEqual(gol(72, 76), [2, 3]);
});

test('lo scarto conta solo dove i gol pareggiano davvero', () => {
    // 72 e 68 distano 4 punti ma valgono 2 gol e 1: la soglia non c'entra,
    // e chi legge la regola in fretta si aspetta un 3-1 che non arriva
    assert.deepEqual(gol(72, 68), [2, 1]);
});

test('se i gol sono già diversi la regola dello scarto non si applica', () => {
    // 84 -> 4 gol, 66 -> 1 gol: nessun aggiustamento, anche se lo scarto è enorme
    assert.deepEqual(gol(84, 66), [4, 1]);
});

test('il bonus casa non entra nei gol della partita vera', () => {
    // Il +1 alla squadra di casa vive solo nel calcolo ideale. Se un giorno
    // rientrasse qui, 65.5 in casa diventerebbe 66 e quindi un gol.
    assert.deepEqual(gol(65.5, 65.5), [0, 0]);
});

// ------------------------------------------------------------------
// Punti di merito, scala Formula 1
// ------------------------------------------------------------------

const SCALA_F1 = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];

function punteggiDistinti(quante) {
    // 100, 99, 98... così l'ordine è certo e nessuno è appaiato
    return Array.from({ length: quante }, (_, i) => ({ team: 'S' + i, score: 100 - i }));
}

test('otto punteggi distinti prendono la scala della Formula 1', () => {
    const assegnati = app.puntiMeritoDiGiornata(punteggiDistinti(8));
    for (let i = 0; i < 8; i += 1) {
        assert.equal(assegnati.get('S' + i).punti, SCALA_F1[i]);
        assert.equal(assegnati.get('S' + i).posizione, i + 1);
    }
});

test('le piazze contese si dividono in parti uguali', () => {
    const punteggi = [
        { team: 'primo', score: 90 },
        { team: 'secondoA', score: 80 },
        { team: 'secondoB', score: 80 },
        { team: 'quarto', score: 70 }
    ];
    const a = app.puntiMeritoDiGiornata(punteggi);

    assert.equal(a.get('primo').punti, 25);
    // secondo e terzo posto: (18 + 15) / 2
    assert.equal(a.get('secondoA').punti, 16.5);
    assert.equal(a.get('secondoB').punti, 16.5);
    // entrambi sono "secondi", quindi il successivo è quarto
    assert.equal(a.get('secondoA').posizione, 2);
    assert.equal(a.get('secondoB').posizione, 2);
    assert.equal(a.get('quarto').posizione, 4);
    assert.equal(a.get('quarto').punti, 12);
});

test('il monte punti della giornata non dipende da come finiscono i pari merito', () => {
    // È l'invariante che copre tutte le combinazioni di parimerito in una volta:
    // comunque siano distribuiti, si assegna sempre la somma dei primi N valori.
    const casi = [
        [90, 85, 80, 75, 70, 65, 60, 55],   // tutti distinti
        [90, 80, 80, 75, 70, 65, 60, 55],   // due appaiati
        [80, 80, 80, 80, 70, 65, 60, 55],   // quattro appaiati in testa
        [70, 70, 70, 70, 70, 70, 70, 70],   // tutti uguali
        [90, 85, 80, 75, 70, 65, 60, 60]    // appaiati in coda
    ];
    const atteso = SCALA_F1.slice(0, 8).reduce((a, b) => a + b, 0);

    for (const punteggi of casi) {
        const voci = punteggi.map((score, i) => ({ team: 'S' + i, score }));
        const assegnati = app.puntiMeritoDiGiornata(voci);
        const totale = [...assegnati.values()].reduce((somma, v) => somma + v.punti, 0);
        assert.ok(Math.abs(totale - atteso) < 1e-9,
            `con ${punteggi.join(',')} il monte è ${totale}, atteso ${atteso}`);
    }
});

test('oltre la decima piazza non si prendono punti', () => {
    const assegnati = app.puntiMeritoDiGiornata(punteggiDistinti(12));
    assert.equal(assegnati.get('S9').punti, 1);    // decimo
    assert.equal(assegnati.get('S10').punti, 0);   // undicesimo
    assert.equal(assegnati.get('S11').punti, 0);
});

// ------------------------------------------------------------------
// Statistiche giocatore: incompresi e malus
// ------------------------------------------------------------------

function conFormazioni(casa, fuori) {
    return {
        teams: [{ name: 'Casa' }, { name: 'Fuori' }],
        rounds: [{
            round: 1,
            matches: [{
                homeTeam: 'Casa', awayTeam: 'Fuori', homeScore: 70, awayScore: 70,
                lineups: { home: casa, away: fuori }
            }]
        }]
    };
}

function statistiche(dati) {
    esegui(app, `fantacalcioData = ${JSON.stringify(dati)};`);
    return app.calcolaStatisticheGiocatori();
}

test('gli incompresi contano i bonus presi in panchina, non gli episodi', () => {
    const s = statistiche(conFormazioni(
        [
            { p: 1, t: 'b', v: 6, b: 9, e: { gol: 1 } },        // gol in panchina: +3
            { p: 2, t: 'b', v: 6, b: 7, e: { assist: 1 } },     // assist pieno: +1
            { p: 3, t: 'b', v: 6, b: 6.5, e: { assist: 1 } }    // assist da mezzo punto
        ],
        [{ p: 4, t: 's', v: 6, b: 9, e: { gol: 1 } }]           // schierato: non è un incompreso
    ));

    assert.equal(s[1].incompreso, 3);
    assert.equal(s[2].incompreso, 1);
    assert.equal(s[3].incompreso, 0.5);
    // chi ha giocato non entra: il rimpianto è solo di chi è rimasto fuori
    assert.equal(s[4].incompreso, 0);
});

test('un malus preso in panchina sconta il rimpianto invece di sparire', () => {
    const s = statistiche(conFormazioni(
        [{ p: 1, t: 'b', v: 6, b: 8.5, e: { gol: 1, amm: 1 } }],  // +3 gol, -0.5 giallo
        [{ p: 2, t: 's', v: 6, b: 6 }]
    ));
    assert.equal(s[1].incompreso, 2.5);
});

test('i malus in campo si sommano a punti, non a episodi', () => {
    const s = statistiche(conFormazioni(
        [{ p: 1, t: 's', v: 6, b: 5, e: { esp: 1 } }],           // espulsione: 1 punto
        [{ p: 2, t: 's', v: 6, b: 5.5, e: { amm: 1 } }]          // ammonizione: 0,5
    ));
    const malus = valuta(app, 'MALUS');
    assert.equal(malus.esp, 1);
    assert.equal(malus.amm, 0.5);
    assert.equal(s[1].malus, 1);
    assert.equal(s[2].malus, 0.5);
    // un'espulsione e un'ammonizione sono un episodio a testa ma non lo stesso danno
    assert.equal(s[1].episodiMalus, 1);
    assert.equal(s[2].episodiMalus, 1);
});

test('i gol subiti dal portiere non contano come malus', () => {
    const s = statistiche(conFormazioni(
        [{ p: 1, t: 's', v: 6, b: 3, e: { golSubiti: 3 } }],
        [{ p: 2, t: 's', v: 6, b: 6 }]
    ));
    assert.equal(s[1].malus, 0, 'i gol subiti sono il mestiere del portiere');
});

// ------------------------------------------------------------------
// I due peggiori di ogni reparto
// ------------------------------------------------------------------

// La regola ha una sottigliezza: chi ha giocato meno di metà giornate è
// peggiore comunque, anche con una fantamedia altissima, perché quella media
// sta su troppe poche partite per voler dire qualcosa.
function scenarioReparto(giornateTotali, giocatori) {
    const players = {};
    const pids = [];
    const stats = {};
    giocatori.forEach((g, i) => {
        const pid = 100 + i;
        pids.push(pid);
        players[pid] = { name: g.nome, role: g.ruolo, serieA: '' };
        stats[pid] = { presenze: g.presenze, mediaFanta: g.fanta, mediaVoto: g.fanta };
    });

    // Giornate finte, solo per far contare giornateGiocate()
    const rounds = Array.from({ length: giornateTotali }, (_, i) => ({
        round: i + 1,
        matches: [{ homeTeam: 'A', awayTeam: 'B', homeScore: 70, awayScore: 70 }]
    }));

    esegui(app, `fantacalcioData = ${JSON.stringify({ teams: [], players, rounds, rosterHistory: [] })};`);
    return { pids, stats };
}

test('sotto metà delle giornate si è peggiori comunque, anche giocando bene', () => {
    const { pids, stats } = scenarioReparto(10, [
        { nome: 'Fenomeno assente', ruolo: 'D', presenze: 2, fanta: 9.5 },  // 20%: peggiore
        { nome: 'Mediocre presente', ruolo: 'D', presenze: 9, fanta: 5.2 },
        { nome: 'Discreto', ruolo: 'D', presenze: 10, fanta: 6.4 },
        { nome: 'Buono', ruolo: 'D', presenze: 8, fanta: 7.1 }
    ]);

    const peggiori = app.peggioriPerRuolo(pids, stats);
    const segnati = pids.filter(p => peggiori.has(p));

    assert.equal(segnati.length, 2);
    assert.ok(peggiori.has(pids[0]), 'chi ha giocato il 20% è peggiore anche con 9,5 di media');
    assert.ok(peggiori.has(pids[1]), 'fra chi ha giocato abbastanza, il peggiore è quello con la fantamedia più bassa');
    assert.ok(!peggiori.has(pids[2]));
});

test('il motivo scritto nel title distingue le presenze dalla fantamedia', () => {
    const { pids, stats } = scenarioReparto(10, [
        { nome: 'Assente', ruolo: 'C', presenze: 1, fanta: 8 },
        { nome: 'Scarso', ruolo: 'C', presenze: 10, fanta: 4.9 },
        { nome: 'Normale', ruolo: 'C', presenze: 10, fanta: 6.5 }
    ]);
    const peggiori = app.peggioriPerRuolo(pids, stats);

    assert.match(peggiori.get(pids[0]), /sotto la met/, 'chi gioca poco va segnato per le presenze');
    assert.match(peggiori.get(pids[1]), /fantamedia/, 'chi gioca va segnato per la fantamedia');
});

test('con due soli giocatori in un reparto non si segna nessuno', () => {
    // "I due peggiori di due" non dice niente
    const { pids, stats } = scenarioReparto(10, [
        { nome: 'Uno', ruolo: 'A', presenze: 2, fanta: 5 },
        { nome: 'Due', ruolo: 'A', presenze: 9, fanta: 6 }
    ]);
    assert.equal(app.peggioriPerRuolo(pids, stats).size, 0);
});

test('i portieri restano fuori dal giudizio', () => {
    const { pids, stats } = scenarioReparto(10, [
        { nome: 'P1', ruolo: 'P', presenze: 0, fanta: null },
        { nome: 'P2', ruolo: 'P', presenze: 1, fanta: 4 },
        { nome: 'P3', ruolo: 'P', presenze: 10, fanta: 6 }
    ]);
    assert.equal(app.peggioriPerRuolo(pids, stats).size, 0,
        'in rosa i portieri sono tre e il confronto fra loro è un altro discorso');
});

test('chi non ha mai giocato sta in fondo, non in cima', () => {
    const { pids, stats } = scenarioReparto(10, [
        { nome: 'Mai visto', ruolo: 'A', presenze: 0, fanta: null },
        { nome: 'Poco e male', ruolo: 'A', presenze: 3, fanta: 4.5 },
        { nome: 'Titolare', ruolo: 'A', presenze: 10, fanta: 7 },
        { nome: 'Titolare 2', ruolo: 'A', presenze: 9, fanta: 6.8 }
    ]);
    const peggiori = app.peggioriPerRuolo(pids, stats);

    // mediaFanta null non deve valere piu' di qualunque voto vero
    assert.ok(peggiori.has(pids[0]), 'chi non ha mai giocato è il peggiore');
    assert.ok(peggiori.has(pids[1]));
    assert.ok(!peggiori.has(pids[2]));
    assert.ok(!peggiori.has(pids[3]));
});

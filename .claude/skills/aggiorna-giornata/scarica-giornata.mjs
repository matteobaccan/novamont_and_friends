#!/usr/bin/env node
// Scarica una giornata dall'API della lega e produce l'estratto per
// calcola-giornata.mjs, con voti ed eventi per ogni giocatore.
//
//   FANTA_TOKEN=... node scarica-giornata.mjs <input.json> > estratto.json
//
// L'input descrive la giornata e gli accoppiamenti, che si leggono dal
// calendario della lega; vedi SKILL.md.

import fs from 'node:fs';

const API = 'https://apileague.fantacalcio.it';
const APP_KEY = 'ICiELOObd5DF5uJEATi77CRvHiiRuMU0';

// Slot del campo "b" delle formazioni, col peso che hanno sul voto.
// I pesi marcati "verificato" sono stati ricavati dai dati della giornata 1,
// isolando i giocatori con un solo slot attivo. Gli altri sono ipotesi: se
// sbagliate, il controllo di quadratura più sotto le fa emergere subito.
const EVENTI = {
    0: { chiave: 'amm', peso: -0.5, label: 'ammonizione' },          // verificato, 16 campioni
    1: { chiave: 'esp', peso: -1, label: 'espulsione' },             // ipotesi: mai osservato
    2: { chiave: 'gol', peso: 3, label: 'gol' },                     // verificato, 8 campioni
    3: { chiave: 'golSubiti', peso: -1, label: 'gol subito' },       // verificato, 8 campioni
    4: { chiave: 'rigParato', peso: 3, label: 'rigore parato' },     // verificato per sottrazione
    5: { chiave: 'rigSbagliato', peso: -3, label: 'rigore sbagliato' }, // verificato, 1 campione
    6: { chiave: 'gol', peso: 3, label: 'gol (su rigore)' },         // verificato, 1 campione
    7: { chiave: 'autogol', peso: -2, label: 'autogol' },            // ipotesi: mai osservato
    12: { chiave: 'assist', peso: 1, label: 'assist' },              // verificato, 3 campioni
    13: { chiave: 'assist', peso: 1, label: 'assist' },              // verificato, 8 campioni
    15: { chiave: null, peso: 0, label: 'flag senza punti' }         // verificato: non muove il voto
};

// Due sentinelle diverse, entrambe con cscr = 100:
//   scr 55 = senza voto (s.v.), scr 56 = non ha giocato
const SENTINELLA_CSCR = 100;
const SCR_SENZA_VOTO = 55;

function fail(message) {
    console.error(`ERRORE: ${message}`);
    process.exit(1);
}

async function chiamaApi(path, token) {
    const res = await fetch(`${API}${path}`, {
        headers: {
            accept: 'application/json, text/plain, */*',
            app_key: APP_KEY,
            authorization: `Bearer ${token}`,
            origin: 'https://leghe.fantacalcio.it',
            referer: 'https://leghe.fantacalcio.it/'
        }
    });
    if (!res.ok) fail(`${path} ha risposto ${res.status}`);
    return res.json();
}

// Traduce il campo "b" in eventi con un nome, verificando che i pesi
// spieghino davvero la differenza fra voto e voto con bonus.
function decodificaEventi(raw, voto, votoBonus) {
    const slot = raw.split(';').map(Number);
    const eventi = {};
    const sconosciuti = [];
    let atteso = 0;

    slot.forEach((n, i) => {
        if (!n) return;
        const def = EVENTI[i];
        if (!def) { sconosciuti.push(`${i}:${n}`); return; }
        atteso += def.peso * n;
        if (def.chiave) eventi[def.chiave] = (eventi[def.chiave] || 0) + n;
    });

    const effettivo = Math.round((votoBonus - voto) * 10) / 10;
    const quadra = Math.abs(effettivo - Math.round(atteso * 10) / 10) < 0.01;

    return { eventi, sconosciuti, quadra, atteso, effettivo };
}

function convertiGiocatore(p, stato, contesto, anomalie) {
    const rec = { p: p.pid, t: stato };

    if (p.cscr === SENTINELLA_CSCR) {
        // sv = è sceso in campo ma senza voto; senza il flag non ha proprio giocato
        if (p.scr === SCR_SENZA_VOTO) rec.sv = true;
        return rec;
    }

    rec.v = p.scr;
    rec.b = p.cscr;

    const { eventi, sconosciuti, quadra, atteso, effettivo } = decodificaEventi(p.b, p.scr, p.cscr);
    if (Object.keys(eventi).length > 0) rec.e = eventi;

    if (sconosciuti.length > 0) {
        anomalie.push(`${contesto} pid ${p.pid}: slot sconosciuti ${sconosciuti.join(', ')} (b="${p.b}")`);
    }
    if (!quadra) {
        anomalie.push(
            `${contesto} pid ${p.pid}: gli eventi valgono ${atteso} ma il voto cambia di ${effettivo} (b="${p.b}")`
        );
    }
    return rec;
}

// ptype: E = entrato dalla panchina, U = uscito/non schierabile
function statoDi(p, base) {
    if (p.ptype === 'E') return 'in';
    if (p.ptype === 'U') return 'out';
    return base;
}

function convertiSquadra(lato, contesto, anomalie) {
    return [
        ...lato.starts.map(p => convertiGiocatore(p, statoDi(p, 's'), contesto, anomalie)),
        ...lato.bench.map(p => convertiGiocatore(p, statoDi(p, 'b'), contesto, anomalie))
    ];
}

async function main() {
    const inputPath = process.argv[2];
    if (!inputPath) fail('uso: FANTA_TOKEN=... node scarica-giornata.mjs <input.json>');

    const token = process.env.FANTA_TOKEN;
    if (!token) fail('manca la variabile d\'ambiente FANTA_TOKEN');

    const input = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
    for (const campo of ['competizione', 'round', 'roundSerieA', 'date', 'partite']) {
        if (input[campo] === undefined) fail(`l'input non ha il campo "${campo}"`);
    }

    // Gli id squadra arrivano dall'API, non vanno scritti a mano
    const partecipanti = await chiamaApi('/onboarding/v1/invitation/participants?pageNumber=1&pageSize=1000', token);
    const idDi = {};
    for (const t of partecipanti) idDi[t.teamName.toLowerCase()] = t.teamId;

    const anomalie = [];
    const matches = [];

    for (const [i, partita] of input.partite.entries()) {
        const [casa, trasferta] = partita;
        const idCasa = idDi[casa.toLowerCase()];
        const idTrasferta = idDi[trasferta.toLowerCase()];
        if (!idCasa) fail(`squadra "${casa}" non trovata fra i partecipanti`);
        if (!idTrasferta) fail(`squadra "${trasferta}" non trovata fra i partecipanti`);

        const d = await chiamaApi(
            `/gaming/v1/teamLineup/${input.competizione}/${input.round}/${input.roundSerieA}/${idCasa}/${idTrasferta}`,
            token
        );

        const contesto = `${casa}-${trasferta}`;
        matches.push({
            homeTeam: casa,
            awayTeam: trasferta,
            homeScore: d.home.tot,
            awayScore: d.away.tot,
            golLega: d.res,
            lineups: {
                home: convertiSquadra(d.home, `${contesto} [${casa}]`, anomalie),
                away: convertiSquadra(d.away, `${contesto} [${trasferta}]`, anomalie)
            }
        });
    }

    if (anomalie.length > 0) {
        console.error('ATTENZIONE, decodifica eventi non pulita:');
        for (const a of anomalie) console.error('  ' + a);
        console.error('  Aggiorna la tabella EVENTI prima di fidarti di marcatori e cartellini.\n');
    }

    const estratto = {
        round: input.round,
        date: input.date,
        golAttesi: matches.map(m => m.golLega.split('-').map(Number)),
        matches: matches.map(({ golLega, ...resto }) => resto)
    };
    if (input.lastUpdate) estratto.lastUpdate = input.lastUpdate;

    console.log(JSON.stringify(estratto, null, 2));
}

main();

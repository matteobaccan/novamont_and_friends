#!/usr/bin/env node
// Converte le formazioni di una giornata nell'estratto per calcola-giornata.mjs,
// con voti ed eventi per ogni giocatore.
//
//   node converti-giornata.mjs <input.json> --grezzo <formazioni.json> > estratto.json
//
// Non va in rete: l'accesso automatico ai servizi di Leghe Fantacalcio non è
// consentito, quindi niente API e niente token. Il file passato a --grezzo è
// un array di partite, ognuna con casa, fuori, res e i due lati (tot, starts,
// bench), ricavato dalle pagine della lega salvate a mano. Qui resta la
// decodifica degli eventi, che vale comunque da qualunque parte arrivino i dati.
//
// L'input descrive la giornata e gli accoppiamenti, che si leggono dal
// calendario della lega; vedi SKILL.md.

import fs from 'node:fs';

// Slot del campo "b" delle formazioni, col peso che hanno sul voto.
// I pesi marcati "verificato" sono stati ricavati dai dati, isolando i
// giocatori con un solo slot attivo; espulsione e autogol, a lungo solo
// ipotesi, sono comparsi nella giornata 2 e hanno quadrato. Se un giorno
// spuntasse un evento nuovo, il controllo di quadratura più sotto lo fa
// emergere subito, invece di inventare un risultato.
const EVENTI = {
    0: { chiave: 'amm', peso: -0.5, label: 'ammonizione' },          // verificato, 16 campioni
    1: { chiave: 'esp', peso: -1, label: 'espulsione' },             // verificato, 2 campioni
    2: { chiave: 'gol', peso: 3, label: 'gol' },                     // verificato, 8 campioni
    3: { chiave: 'golSubiti', peso: -1, label: 'gol subito' },       // verificato, 8 campioni
    4: { chiave: 'rigParato', peso: 3, label: 'rigore parato' },     // verificato per sottrazione
    5: { chiave: 'rigSbagliato', peso: -3, label: 'rigore sbagliato' }, // verificato, 1 campione
    6: { chiave: 'gol', peso: 3, label: 'gol (su rigore)' },         // verificato, 1 campione
    7: { chiave: 'autogol', peso: -2, label: 'autogol' },            // verificato per sottrazione
    12: { chiave: 'assist', peso: 1, label: 'assist' },              // verificato, 3 campioni
    13: { chiave: 'assist', peso: 1, label: 'assist' },              // verificato, 8 campioni
    14: { chiave: 'assist', peso: 1, label: 'assist' },              // verificato, 2 campioni (Serie A 7, assist sui voti fantacalcio.it)
    15: { chiave: null, peso: 0, label: 'flag senza punti' }         // verificato: non muove il voto
};

// Due sentinelle diverse, entrambe con cscr = 100:
//   scr 55 = senza voto (s.v.), scr 56 = non ha giocato
// La sentinella è lo scr, non il cscr: un fantavoto pari a 0 arriva anch'esso
// come cscr = 100 (Muric, Serie A 7: voto 4, quattro gol subiti), e il
// fantavoto può andare sotto zero. Con un voto vero e un cscr fuori scala il
// fantavoto si ricostruisce dagli eventi.
const SENTINELLA_CSCR = 100;
const SCR_SENZA_VOTO = 55;
const SCR_NON_GIOCA = 56;
const FANTAVOTO_MAX = 50; // nessun fantavoto vero ci arriva: oltre è un codice

function fail(message) {
    console.error(`ERRORE: ${message}`);
    process.exit(1);
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

    if (p.scr === SCR_SENZA_VOTO || p.scr === SCR_NON_GIOCA) {
        if (p.cscr !== SENTINELLA_CSCR) {
            anomalie.push(`${contesto} pid ${p.pid}: scr ${p.scr} ma cscr ${p.cscr} invece di ${SENTINELLA_CSCR}`);
        }
        // sv = è sceso in campo ma senza voto; senza il flag non ha proprio giocato
        if (p.scr === SCR_SENZA_VOTO) rec.sv = true;
        return rec;
    }

    const fuoriScala = p.cscr > FANTAVOTO_MAX;
    const { eventi, sconosciuti, quadra, atteso, effettivo } = decodificaEventi(p.b, p.scr, p.cscr);

    rec.v = p.scr;
    rec.b = fuoriScala ? Math.round((p.scr + atteso) * 10) / 10 : p.cscr;
    if (Object.keys(eventi).length > 0) rec.e = eventi;

    if (sconosciuti.length > 0) {
        anomalie.push(`${contesto} pid ${p.pid}: slot sconosciuti ${sconosciuti.join(', ')} (b="${p.b}")`);
    }
    // Ricostruito dagli eventi non c'è niente con cui farlo quadrare: basta
    // che gli slot siano tutti noti, e quello lo dice già il controllo sopra
    if (!fuoriScala && !quadra) {
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

function main() {
    const argv = process.argv.slice(2);
    const iGrezzo = argv.indexOf('--grezzo');
    const grezzoPath = iGrezzo === -1 ? null : argv[iGrezzo + 1];
    const inputPath = argv.filter((a, i) => i !== iGrezzo && i !== iGrezzo + 1)[0];
    if (!inputPath || !grezzoPath) fail('uso: node converti-giornata.mjs <input.json> --grezzo <formazioni.json>');

    const input = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
    for (const campo of ['round', 'date', 'partite']) {
        if (input[campo] === undefined) fail(`l'input non ha il campo "${campo}"`);
    }

    // Le partite si cercano per accoppiamento
    const grezzo = JSON.parse(fs.readFileSync(grezzoPath, 'utf8'));
    const prendiPartita = (casa, trasferta) => {
        const m = grezzo.find(g =>
            g.casa.toLowerCase() === casa.toLowerCase() &&
            g.fuori.toLowerCase() === trasferta.toLowerCase());
        if (!m) fail(`${casa}-${trasferta} non e' nel file passato a --grezzo`);
        return m;
    };

    const anomalie = [];
    const matches = [];

    for (const [i, partita] of input.partite.entries()) {
        const [casa, trasferta] = partita;
        const d = prendiPartita(casa, trasferta);

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

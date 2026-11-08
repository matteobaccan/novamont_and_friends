#!/usr/bin/env node
// Legge la pagina HTML di una partita della lega e ne ricava squadre, punteggi e formazioni con voti ed
// eventi, nel formato di data/<stagione>.json.
//
// Uso:
//   node leggi-partita.mjs <partita.html> [...]                stampa le partite in JSON
//   node leggi-partita.mjs <partita.html> [...] --confronta [--giornata N]
//                                                              le confronta con i dati pubblicati
//
// Non va in rete: legge solo i file passati.
//
// Com'è fatta la pagina (leghe.fantacalcio.it, novembre 2026):
//   - <ui-match-showcase>: le due squadre (<span nz-tooltip>), il modulo, i gol
//     e il punteggio di ognuna, casa a sinistra
//   - <ui-match-players>: quattro colonne di <ui-match-player data-player-id>,
//     nell'ordine titolari di casa, titolari in trasferta, poi "Panchina" con
//     la panchina di casa e quella in trasferta
//   - in ogni giocatore: data-role (P D C A), il voto in <ui-match-grade>, il
//     fantavoto in <ui-match-fantagrade> ("s.v." se senza voto; assenti del
//     tutto se non ha giocato) e un'icona per ogni evento, data-icon-key
//     ripetuto tante volte quanti sono gli eventi
//   - chi non conta nel punteggio è attenuato con la classe opacity-50: un
//     titolare attenuato è uscito (sostituito o senza voto), un panchinaro
//     non attenuato è entrato

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// Le icone degli eventi, con la chiave che usa il sito e il peso sul voto.
// Ognuna è verificata sulla pagina di Real Pattagghiu-Partizan Tirana
// (giornata 6) contro i dati già pubblicati. Quelle che non si sono ancora
// viste (espulsione, autogol, rigore sbagliato, rigore parato) mancano
// apposta: alla prima che compare il lettore si ferma e dice il nome
// dell'icona, invece di indovinarlo.
export const EVENTI_ICONA = {
    scoredGoals: { chiave: 'gol', peso: 3 },
    scoredPenalties: { chiave: 'gol', peso: 3 },
    assists: { chiave: 'assist', peso: 1 },
    softAssists: { chiave: 'assist', peso: 1 },
    yellowCards: { chiave: 'amm', peso: -0.5 },
    concededGoals: { chiave: 'golSubiti', peso: -1 },
    manOfTheMatch: { chiave: null, peso: 0 }       // migliore in campo: non muove il voto
};

const testo = (html) => html
    .replace(/<!---->/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();

const numero = (s) => {
    const n = Number(String(s).trim().replace(',', '.'));
    return Number.isFinite(n) ? n : null;
};

function sezione(html, tag) {
    const inizio = html.indexOf(`<${tag}`);
    const fine = html.indexOf(`</${tag}>`, inizio);
    if (inizio === -1 || fine === -1) return null;
    return html.slice(inizio, fine);
}

function leggiIntestazione(html) {
    const showcase = sezione(html, 'ui-match-showcase');
    if (!showcase) throw new Error('manca <ui-match-showcase>: non è la pagina di una partita?');

    const nomi = [...showcase.matchAll(/<span[^>]*\bnz-tooltip\b[^>]*>([\s\S]*?)<\/span>/g)].map(m => testo(m[1]));
    const moduli = [...showcase.matchAll(/\b(\d-\d-\d(?:-\d)?)\b/g)].map(m => m[1]);

    // Il blocco del risultato: <div><span>gol</span><span>punti</span></div> - <div>...</div>
    const risultato = [...showcase.matchAll(/<div[^>]*>\s*(?:<!---->)*\s*<span[^>]*>\s*(\d+)\s*<\/span>\s*(?:<!---->)*\s*<span[^>]*>\s*([\d.,]+)\s*<\/span>/g)];

    if (nomi.length < 2) throw new Error('intestazione: non trovo i nomi delle due squadre');
    if (risultato.length < 2) throw new Error('intestazione: non trovo gol e punteggio delle due squadre');

    return {
        casa: nomi[0],
        fuori: nomi[1],
        moduloCasa: moduli[0] || null,
        moduloFuori: moduli[1] || null,
        golCasa: Number(risultato[0][1]),
        golFuori: Number(risultato[1][1]),
        puntiCasa: numero(risultato[0][2]),
        puntiFuori: numero(risultato[1][2])
    };
}

function leggiGiocatore(apertura, corpo, colonna, anomalie) {
    const pid = Number(apertura.match(/data-player-id="(\d+)"/)[1]);
    const attenuato = /\bopacity-50\b/.test(apertura);
    const titolare = colonna === 'titolari';
    const t = titolare ? (attenuato ? 'out' : 's') : (attenuato ? 'b' : 'in');

    const nome = testo((corpo.match(/<span[^>]*class="truncate"[^>]*>([\s\S]*?)<\/span>/) || [])[1] || '');
    const ruolo = (corpo.match(/data-role="([^"]+)"/) || [])[1] || null;
    const voto = (corpo.match(/<ui-match-grade[^>]*>([\s\S]*?)<\/ui-match-grade>/) || [])[1];
    const fanta = (corpo.match(/<ui-match-fantagrade[^>]*>([\s\S]*?)<\/ui-match-fantagrade>/) || [])[1];

    const rec = { p: pid, t };
    const info = { nome, ruolo };

    if (voto === undefined) return { rec, info };                 // non ha giocato
    if (testo(voto).toLowerCase() === 's.v.') {                    // in campo, senza voto
        rec.sv = true;
        return { rec, info };
    }

    rec.v = numero(testo(voto));
    rec.b = numero(testo(fanta || ''));
    if (rec.v === null || rec.b === null) {
        anomalie.push(`${nome || pid}: voto "${testo(voto)}" o fantavoto "${testo(fanta || '')}" illeggibili`);
        return { rec, info };
    }

    // Eventi: un'icona per evento. Si verifica che spieghino il fantavoto
    const eventi = {};
    let atteso = 0;
    for (const m of corpo.matchAll(/<figure[^>]*?(?:data-overflow-label="([^"]*)")?[^>]*>\s*(?:<!---->)*\s*<ui-live-event-icon[^>]*data-icon-key="([^"]+)"/g)) {
        const [, etichetta, chiave] = m;
        const def = EVENTI_ICONA[chiave];
        if (!def) {
            anomalie.push(`${nome || pid}: evento sconosciuto "${chiave}"${etichetta ? ` («${etichetta}»)` : ''}, va aggiunto a EVENTI_ICONA`);
            continue;
        }
        atteso += def.peso;
        if (def.chiave) eventi[def.chiave] = (eventi[def.chiave] || 0) + 1;
    }
    if (Object.keys(eventi).length) rec.e = eventi;

    const effettivo = Math.round((rec.b - rec.v) * 10) / 10;
    if (Math.abs(effettivo - Math.round(atteso * 10) / 10) > 0.01) {
        anomalie.push(`${nome || pid}: gli eventi valgono ${atteso} ma il fantavoto si scosta dal voto di ${effettivo}`);
    }
    return { rec, info };
}

// Le quattro colonne nell'ordine in cui le disegna la pagina
function leggiColonne(html, anomalie) {
    const giocatori = sezione(html, 'ui-match-players');
    if (!giocatori) throw new Error('manca <ui-match-players>: la pagina non ha le formazioni');

    const iPanchina = giocatori.search(/>\s*Panchina\s*</);
    if (iPanchina === -1) throw new Error('non trovo la riga "Panchina" fra le formazioni');

    // Una colonna è una sequenza di giocatori consecutivi: fra due colonne c'è
    // sempre la chiusura di un <div>
    const colonneDi = (pezzo, tipo) => {
        const colonne = [];
        let corrente = null;
        const re = /<ui-match-player\b([^>]*)>([\s\S]*?)<\/ui-match-player>|<\/div>\s*(?:<!---->)*\s*<div\b/g;
        let m;
        while ((m = re.exec(pezzo))) {
            if (m[1] === undefined) { corrente = null; continue; }
            if (!/data-player-id=/.test(m[1])) continue;
            if (!corrente) { corrente = []; colonne.push(corrente); }
            corrente.push(leggiGiocatore(m[1], m[2], tipo, anomalie));
        }
        return colonne;
    };

    const titolari = colonneDi(giocatori.slice(0, iPanchina), 'titolari');
    const panchina = colonneDi(giocatori.slice(iPanchina), 'panchina');
    if (titolari.length !== 2) throw new Error(`titolari: trovate ${titolari.length} colonne invece di 2`);
    if (panchina.length > 2) throw new Error(`panchina: trovate ${panchina.length} colonne invece di 2`);

    return {
        home: [...titolari[0], ...(panchina[0] || [])],
        away: [...titolari[1], ...(panchina[1] || [])]
    };
}

export function leggiPartita(html) {
    const anomalie = [];
    const testa = leggiIntestazione(html);
    const { home, away } = leggiColonne(html, anomalie);

    for (const [lato, squadra] of [['home', home], ['away', away]]) {
        const titolari = squadra.filter(g => g.rec.t === 's' || g.rec.t === 'out').length;
        if (titolari !== 11) anomalie.push(`${lato === 'home' ? testa.casa : testa.fuori}: ${titolari} titolari invece di 11`);
    }

    return {
        ...testa,
        lineups: { home: home.map(g => g.rec), away: away.map(g => g.rec) },
        giocatori: Object.fromEntries([...home, ...away].map(g => [g.rec.p, g.info])),
        anomalie
    };
}

// ------------------------------------------------------------
// Confronto con i dati pubblicati
// ------------------------------------------------------------

const ugualeEventi = (a = {}, b = {}) => {
    const ka = Object.keys(a).sort(), kb = Object.keys(b).sort();
    return ka.length === kb.length && ka.every((k, i) => k === kb[i] && a[k] === b[k]);
};

// Le differenze fra la partita letta e quella pubblicata, una riga ciascuna.
// Si confrontano i giocatori per pid, nello stesso ordine.
export function confrontaPartita(letta, pubblicata) {
    const diff = [];
    if (letta.puntiCasa !== pubblicata.homeScore) diff.push(`punteggio casa: pagina ${letta.puntiCasa}, dati ${pubblicata.homeScore}`);
    if (letta.puntiFuori !== pubblicata.awayScore) diff.push(`punteggio trasferta: pagina ${letta.puntiFuori}, dati ${pubblicata.awayScore}`);

    for (const lato of ['home', 'away']) {
        const nomeLato = lato === 'home' ? 'casa' : 'trasferta';
        const nostri = (pubblicata.lineups && pubblicata.lineups[lato]) || [];
        const loro = letta.lineups[lato];
        const perPid = new Map(nostri.map(g => [g.p, g]));
        const pidLoro = new Set(loro.map(g => g.p));

        for (const g of loro) {
            const n = perPid.get(g.p);
            const chi = `${nomeLato}, ${(letta.giocatori[g.p] || {}).nome || g.p}`;
            if (!n) { diff.push(`${chi}: nella pagina ma non nei dati`); continue; }
            for (const campo of ['t', 'v', 'b']) {
                if (g[campo] !== n[campo]) diff.push(`${chi}: ${campo} pagina ${g[campo]}, dati ${n[campo]}`);
            }
            if (!!g.sv !== !!n.sv) diff.push(`${chi}: senza voto pagina ${!!g.sv}, dati ${!!n.sv}`);
            if (!ugualeEventi(g.e, n.e)) diff.push(`${chi}: eventi pagina ${JSON.stringify(g.e || {})}, dati ${JSON.stringify(n.e || {})}`);
        }
        for (const n of nostri) if (!pidLoro.has(n.p)) diff.push(`${nomeLato}, pid ${n.p}: nei dati ma non nella pagina`);

        const ordineLoro = loro.map(g => g.p).join(',');
        const ordineNostro = nostri.map(g => g.p).join(',');
        if (ordineLoro !== ordineNostro && diff.length === 0) diff.push(`${nomeLato}: stessi giocatori in ordine diverso`);
    }
    return diff;
}

// ------------------------------------------------------------

function main() {
    const argv = process.argv.slice(2);
    const confronta = argv.includes('--confronta');
    const iGiornata = argv.indexOf('--giornata');
    const giornata = iGiornata === -1 ? null : Number(argv[iGiornata + 1]);
    const file = argv.filter((a, i) => !a.startsWith('--') && (iGiornata === -1 || i !== iGiornata + 1));
    if (file.length === 0) {
        console.error('uso: node leggi-partita.mjs <partita.html> [...] [--confronta [--giornata N]]');
        process.exit(1);
    }

    const partite = file.map(f => ({ file: f, ...leggiPartita(fs.readFileSync(f, 'utf8')) }));
    let errori = 0;

    for (const p of partite) {
        if (p.anomalie.length) {
            errori++;
            console.error(`ATTENZIONE, ${path.basename(p.file)}:`);
            for (const a of p.anomalie) console.error(`  ${a}`);
        }
    }

    if (!confronta) {
        console.log(JSON.stringify(partite.map(({ file: _f, giocatori: _g, anomalie: _a, ...resto }) => resto), null, 2));
        process.exit(errori ? 1 : 0);
    }

    const indice = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data/seasons.json'), 'utf8'));
    const stagione = indice.seasons.find(s => s.id === indice.currentSeason);
    const dati = JSON.parse(fs.readFileSync(path.join(process.cwd(), stagione.file), 'utf8'));
    const canonico = (nome) => (dati.teams.find(t => t.name.toLowerCase() === nome.toLowerCase()) || { name: nome }).name;

    for (const p of partite) {
        const casa = canonico(p.casa), fuori = canonico(p.fuori);
        const candidate = dati.rounds
            .filter(r => giornata === null || r.round === giornata)
            .flatMap(r => r.matches.map(m => ({ round: r.round, m })))
            .filter(({ m }) => m.homeTeam === casa && m.awayTeam === fuori);

        console.log(`\n${path.basename(p.file)}: ${casa} ${p.golCasa}-${p.golFuori} ${fuori} (${p.puntiCasa} - ${p.puntiFuori})`);
        if (candidate.length !== 1) {
            errori++;
            console.log(`  ${candidate.length === 0 ? 'nessuna partita' : `${candidate.length} partite`} ${casa}-${fuori} nei dati${giornata ? ` della giornata ${giornata}` : ''}: usa --giornata`);
            continue;
        }
        const { round, m } = candidate[0];
        const diff = confrontaPartita(p, m);
        const n = p.lineups.home.length + p.lineups.away.length;
        if (diff.length === 0) {
            console.log(`  giornata ${round}: tutto uguale, ${n} giocatori fra voti, fantavoti, eventi e stato`);
        } else {
            errori++;
            console.log(`  giornata ${round}: ${diff.length} differenze`);
            for (const d of diff) console.log(`    ${d}`);
        }
    }
    process.exit(errori ? 1 : 0);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();

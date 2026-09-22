#!/usr/bin/env node
// Calcola i punteggi ideali di una giornata e la inserisce nel JSON della stagione.
//
//   node calcola-giornata.mjs <estratto.json> [--dry-run]
//
// L'estratto è quello prodotto da scarica-giornata.mjs; vedi SKILL.md.

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// Moduli ammessi: difensori, centrocampisti, attaccanti. Il portiere è sempre uno.
const MODULI = [
    [3, 4, 3],
    [3, 5, 2],
    [4, 3, 3],
    [4, 4, 2],
    [4, 5, 1],
    [5, 3, 2],
    [5, 4, 1]
];

const RUOLI = ['P', 'D', 'C', 'A'];

function fail(message) {
    console.error(`ERRORE: ${message}`);
    process.exit(1);
}

// I punteggi fantacalcio sono multipli di 0.5: evita 83.49999999999999
function round1(value) {
    return Math.round(value * 10) / 10;
}

// Somma dei migliori `count` punteggi; null se i giocatori non bastano
function topN(scores, count) {
    if (scores.length < count) return null;
    return scores.slice(0, count).reduce((sum, score) => sum + score, 0);
}

// Miglior formazione possibile fra tutti i giocatori che hanno preso un voto,
// scegliendo anche il modulo. Restituisce il punteggio SENZA fattore campo.
export function calcolaIdeale(voti) {
    const perRuolo = {};
    for (const ruolo of RUOLI) {
        perRuolo[ruolo] = voti.filter(v => v.role === ruolo).map(v => v.score).sort((a, b) => b - a);
    }

    if (perRuolo.P.length === 0) return { score: null, modulo: null, motivo: 'nessun portiere con voto' };

    let best = null;
    for (const [d, c, a] of MODULI) {
        const parti = [topN(perRuolo.D, d), topN(perRuolo.C, c), topN(perRuolo.A, a)];
        if (parti.some(p => p === null)) continue; // modulo non schierabile

        const score = perRuolo.P[0] + parti[0] + parti[1] + parti[2];
        if (!best || score > best.score) best = { score: round1(score), modulo: `${d}-${c}-${a}` };
    }

    if (!best) return { score: null, modulo: null, motivo: 'nessun modulo schierabile' };
    return best;
}

// 66 punti = 1 gol, poi un gol ogni 6 punti. Identica a script.js.
export function golDaPunteggio(score) {
    if (score < 66) return 0;
    return Math.floor((score - 60) / 6);
}

// Prende i voti utili al calcolo ideale, con il ruolo dal dizionario giocatori
function votiConRuolo(lineup, players, contesto) {
    const sconosciuti = [];
    const voti = [];

    for (const g of lineup) {
        if (g.b === undefined) continue; // senza voto: non selezionabile
        const anagrafica = players[g.p];
        if (!anagrafica) { sconosciuti.push(g.p); continue; }
        voti.push({ role: anagrafica.role, score: g.b });
    }

    if (sconosciuti.length > 0) {
        fail(
            `${contesto}: pid non presenti nel dizionario "players": ${sconosciuti.join(', ')}\n` +
            `  Sono acquisti nuovi: riallinea "players" dalla pagina Rose prima di rilanciare.`
        );
    }
    return voti;
}

// La lega scrive certi nomi tutti maiuscoli ("PARTIZAN TIRANA"): senza
// normalizzarli passerebbero per squadre nuove a ogni giornata.
function nomeCanonico(nome, teams, contesto) {
    const trovato = teams.find(t => t.name.toLowerCase() === String(nome).toLowerCase());
    if (!trovato) {
        fail(`${contesto}: squadra "${nome}" non presente fra le squadre della stagione`);
    }
    return trovato.name;
}

function elaboraMatch(match, players, teams, index) {
    for (const campo of ['homeTeam', 'awayTeam', 'homeScore', 'awayScore']) {
        if (match[campo] === undefined) fail(`match ${index + 1}: manca il campo "${campo}"`);
    }

    const risultato = {
        id: index + 1,
        homeTeam: nomeCanonico(match.homeTeam, teams, `match ${index + 1}`),
        awayTeam: nomeCanonico(match.awayTeam, teams, `match ${index + 1}`),
        homeScore: match.homeScore,
        awayScore: match.awayScore
    };

    let moduli = null;
    if (match.lineups) {
        const casa = calcolaIdeale(votiConRuolo(match.lineups.home, players, `match ${index + 1} casa`));
        const fuori = calcolaIdeale(votiConRuolo(match.lineups.away, players, `match ${index + 1} trasferta`));

        if (casa.score === null) fail(`match ${index + 1} (${match.homeTeam}): ${casa.motivo}`);
        if (fuori.score === null) fail(`match ${index + 1} (${match.awayTeam}): ${fuori.motivo}`);

        // Il punteggio ideale di casa NON include il fattore campo: il +1 lo
        // aggiunge script.js quando calcola gol e punti persi (vedi BONUS_CASA.md).
        risultato.homeIdealScore = casa.score;
        risultato.awayIdealScore = fuori.score;
        moduli = { home: casa.modulo, away: fuori.modulo };
    }

    if (match.commentary) risultato.commentary = match.commentary;
    if (match.lineups) risultato.lineups = match.lineups;

    return { risultato, moduli };
}

// Controlla che i gol ricalcolati coincidano con quelli mostrati dalla lega
function verificaGol(matches, attesi) {
    if (!attesi) return [];
    const errori = [];
    matches.forEach((match, i) => {
        const atteso = attesi[i];
        if (!atteso) return;
        const casa = golDaPunteggio(match.homeScore);
        const fuori = golDaPunteggio(match.awayScore);
        if (casa !== atteso[0] || fuori !== atteso[1]) {
            errori.push(
                `  match ${i + 1} ${match.homeTeam}-${match.awayTeam}: ` +
                `calcolati ${casa}-${fuori}, la lega mostra ${atteso[0]}-${atteso[1]}`
            );
        }
    });
    return errori;
}

// Le rose cambiano in corsa: se la giornata mostra una rosa diversa
// dall'ultimo snapshot, se ne aggiunge uno nuovo valido da qui in avanti.
function aggiornaRose(data, round, matches) {
    const rosaDellaGiornata = {};
    for (const m of matches) {
        rosaDellaGiornata[m.homeTeam] = m.lineups.home.map(g => g.p).sort((a, b) => a - b);
        rosaDellaGiornata[m.awayTeam] = m.lineups.away.map(g => g.p).sort((a, b) => a - b);
    }

    data.rosterHistory ||= [];
    const ultimo = data.rosterHistory.filter(s => s.fromRound <= round).at(-1);

    const cambiate = [];
    for (const [team, rosa] of Object.entries(rosaDellaGiornata)) {
        const prima = ultimo?.teams?.[team];
        // Le formazioni possono non coprire tutta la rosa: conta solo chi è
        // comparso e non risultava presente, non chi manca all'appello.
        const nuovi = prima ? rosa.filter(p => !prima.includes(p)) : rosa;
        if (nuovi.length > 0) cambiate.push({ team, nuovi });
    }

    if (cambiate.length === 0) return null;

    const teams = { ...(ultimo?.teams || {}) };
    for (const { team, nuovi } of cambiate) {
        teams[team] = [...new Set([...(teams[team] || []), ...nuovi])].sort((a, b) => a - b);
    }

    if (ultimo && ultimo.fromRound === round) ultimo.teams = teams;
    else {
        data.rosterHistory.push({ fromRound: round, teams });
        data.rosterHistory.sort((a, b) => a.fromRound - b.fromRound);
    }
    return cambiate;
}

function main() {
    const args = process.argv.slice(2);
    const dryRun = args.includes('--dry-run');
    const inputPath = args.find(a => !a.startsWith('--'));
    if (!inputPath) fail('uso: node calcola-giornata.mjs <estratto.json> [--dry-run]');

    const input = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
    for (const campo of ['round', 'date', 'matches']) {
        if (input[campo] === undefined) fail(`l'estratto non ha il campo "${campo}"`);
    }

    const repoRoot = process.cwd();
    const index = JSON.parse(fs.readFileSync(path.join(repoRoot, 'data/seasons.json'), 'utf8'));
    const seasonId = input.season || index.currentSeason;
    const season = index.seasons.find(s => s.id === seasonId);
    if (!season) fail(`stagione "${seasonId}" assente da data/seasons.json`);

    const seasonPath = path.join(repoRoot, season.file);
    const data = JSON.parse(fs.readFileSync(seasonPath, 'utf8'));

    if (data.rounds.some(r => r.round === input.round)) {
        fail(`la giornata ${input.round} esiste già in ${season.file}. Rimuovila prima di reinserirla.`);
    }

    const elaborati = input.matches.map((m, i) => elaboraMatch(m, data.players || {}, data.teams, i));
    const matches = elaborati.map(e => e.risultato);

    const errori = verificaGol(matches, input.golAttesi);
    if (errori.length > 0) fail(`i gol non coincidono con quelli della lega:\n${errori.join('\n')}`);

    const round = { round: input.round, date: input.date, matches };
    if (input.generalComment) round.generalComment = input.generalComment;

    data.rounds.push(round);
    data.rounds.sort((a, b) => a.round - b.round);
    if (input.lastUpdate) data.lastUpdate = input.lastUpdate;

    const cambiate = matches.every(m => m.lineups) ? aggiornaRose(data, input.round, matches) : null;

    console.log(`Giornata ${input.round} — ${input.date} (${seasonId})`);
    matches.forEach((match, i) => {
        const gh = golDaPunteggio(match.homeScore);
        const ga = golDaPunteggio(match.awayScore);
        let riga = `  ${match.homeTeam} ${gh}-${ga} ${match.awayTeam}  reale ${match.homeScore}-${match.awayScore}`;
        const moduli = elaborati[i].moduli;
        riga += moduli
            ? `  ideale ${match.homeIdealScore}-${match.awayIdealScore}  [${moduli.home} / ${moduli.away}]`
            : '  ideale non calcolato';
        console.log(riga);
    });

    if (cambiate) {
        console.log('\nRose cambiate, nuovo snapshot da questa giornata:');
        for (const { team, nuovi } of cambiate) {
            const nomi = nuovi.map(p => data.players[p]?.name || p).join(', ');
            console.log(`  ${team}: +${nomi}`);
        }
    }

    if (dryRun) {
        console.log('\n--dry-run: nessuna scrittura.');
        return;
    }

    fs.writeFileSync(seasonPath, JSON.stringify(data, null, 2) + '\n');
    console.log(`\nScritto ${season.file} (${data.rounds.length} giornate).`);
}

// argv[1] manca quando il modulo viene importato da `node -e`
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();

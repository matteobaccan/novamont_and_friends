#!/usr/bin/env node
// Calcola i punteggi ideali di una giornata e la inserisce nel JSON della stagione.
//
//   node calcola-giornata.mjs <estratto.json> [--dry-run]
//
// L'estratto contiene quello che si legge dalle pagine partita della lega; vedi
// SKILL.md per il formato e per il significato di ogni campo.

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// Moduli ammessi: numero di difensori, centrocampisti e attaccanti.
// Il portiere è sempre uno solo.
const MODULES = [
    [3, 4, 3],
    [3, 5, 2],
    [4, 3, 3],
    [4, 4, 2],
    [4, 5, 1],
    [5, 3, 2],
    [5, 4, 1]
];

const ROLES = ['P', 'D', 'C', 'A'];

function fail(message) {
    console.error(`ERRORE: ${message}`);
    process.exit(1);
}

// Somma dei migliori `count` punteggi; null se i giocatori non bastano
function topN(scores, count) {
    if (scores.length < count) return null;
    return scores.slice(0, count).reduce((sum, score) => sum + score, 0);
}

// Miglior formazione possibile fra tutti i giocatori che hanno preso un voto,
// scegliendo anche il modulo. Restituisce il punteggio SENZA fattore campo.
export function calcolaIdeale(players) {
    const byRole = {};
    for (const role of ROLES) {
        byRole[role] = players
            .filter(p => p.role === role && typeof p.score === 'number')
            .map(p => p.score)
            .sort((a, b) => b - a);
    }

    if (byRole.P.length === 0) {
        return { score: null, module: null, reason: 'nessun portiere con voto' };
    }

    let best = null;
    for (const [d, c, a] of MODULES) {
        const parts = [topN(byRole.D, d), topN(byRole.C, c), topN(byRole.A, a)];
        if (parts.some(part => part === null)) continue; // modulo non schierabile

        const score = byRole.P[0] + parts[0] + parts[1] + parts[2];
        if (!best || score > best.score) {
            best = { score: round1(score), module: `${d}-${c}-${a}` };
        }
    }

    if (!best) return { score: null, module: null, reason: 'nessun modulo schierabile' };
    return best;
}

// I punteggi fantacalcio sono multipli di 0.5: evita 83.49999999999999
function round1(value) {
    return Math.round(value * 10) / 10;
}

// 66 punti = 1 gol, poi un gol ogni 6 punti. Identica a script.js.
export function golDaPunteggio(score) {
    if (score < 66) return 0;
    return Math.floor((score - 60) / 6);
}

function rosaDi(teamName, rosters) {
    const roster = rosters[teamName];
    if (!roster) fail(`la rosa di "${teamName}" non è in data/<stagione>.json (chiave "rosters")`);
    return new Map(roster.map(p => [p.name.toLowerCase(), p.role]));
}

// Associa a ogni giocatore il ruolo preso dalla rosa della squadra
function assegnaRuoli(teamName, players, rosters) {
    const roleByName = rosaDi(teamName, rosters);
    const sconosciuti = [];

    const withRoles = players.map(player => {
        const role = roleByName.get(player.name.toLowerCase());
        if (!role) sconosciuti.push(player.name);
        return { ...player, role };
    });

    if (sconosciuti.length > 0) {
        fail(
            `giocatori di "${teamName}" non presenti in rosa: ${sconosciuti.join(', ')}\n` +
            `  Se sono acquisti nuovi, riallinea "rosters" dalla pagina Rose prima di rilanciare.`
        );
    }

    return withRoles;
}

// Le pagine partita elencano casa e trasferta mescolate: si separano per rosa.
// Un nome che compare in entrambe le rose, o in nessuna, è un errore.
function dividiPerSquadra(players, homeTeam, awayTeam, rosters, matchLabel) {
    const home = rosaDi(homeTeam, rosters);
    const away = rosaDi(awayTeam, rosters);
    const result = { homePlayers: [], awayPlayers: [] };
    const orfani = [];
    const ambigui = [];

    for (const player of players) {
        const key = player.name.toLowerCase();
        const inHome = home.has(key);
        const inAway = away.has(key);

        if (inHome && inAway) ambigui.push(player.name);
        else if (inHome) result.homePlayers.push(player);
        else if (inAway) result.awayPlayers.push(player);
        else orfani.push(player.name);
    }

    if (ambigui.length > 0) {
        fail(`${matchLabel}: presenti in entrambe le rose: ${ambigui.join(', ')}`);
    }
    if (orfani.length > 0) {
        fail(
            `${matchLabel}: non in rosa né di ${homeTeam} né di ${awayTeam}: ${orfani.join(', ')}\n` +
            `  Probabile refuso nel nome, oppure "rosters" da riallineare dopo il mercato.`
        );
    }

    return result;
}

function elaboraMatch(match, rosters, index) {
    for (const field of ['homeTeam', 'awayTeam', 'homeScore', 'awayScore']) {
        if (match[field] === undefined) fail(`match ${index + 1}: manca il campo "${field}"`);
    }

    const result = {
        id: index + 1,
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
        homeScore: match.homeScore,
        awayScore: match.awayScore
    };

    // "players" è la lista piatta letta dalla pagina partita (casa + trasferta
    // mescolate); homePlayers/awayPlayers è l'alternativa già separata.
    const label = `match ${index + 1} (${match.homeTeam}-${match.awayTeam})`;
    const squadre = match.players
        ? dividiPerSquadra(match.players, match.homeTeam, match.awayTeam, rosters, label)
        : match;

    // I punteggi ideali sono facoltativi: senza formazioni si inserisce la
    // giornata con i soli punteggi reali e il sito degrada correttamente.
    if (squadre.homePlayers && squadre.awayPlayers) {
        const home = calcolaIdeale(assegnaRuoli(match.homeTeam, squadre.homePlayers, rosters));
        const away = calcolaIdeale(assegnaRuoli(match.awayTeam, squadre.awayPlayers, rosters));

        if (home.score === null) fail(`match ${index + 1} (${match.homeTeam}): ${home.reason}`);
        if (away.score === null) fail(`match ${index + 1} (${match.awayTeam}): ${away.reason}`);

        // Nel JSON il punteggio ideale di casa NON include il fattore campo:
        // il +1 lo aggiunge script.js al momento di calcolare gol e punti persi.
        result.homeIdealScore = home.score;
        result.awayIdealScore = away.score;
        result._moduloIdeale = { home: home.module, away: away.module };
    }

    if (match.commentary) result.commentary = match.commentary;
    return result;
}

// Controlla che i gol ricalcolati coincidano con quelli mostrati dalla lega
function verificaGol(matches, attesi) {
    if (!attesi) return [];

    const errori = [];
    matches.forEach((match, i) => {
        const atteso = attesi[i];
        if (!atteso) return;

        const home = golDaPunteggio(match.homeScore);
        const away = golDaPunteggio(match.awayScore);
        if (home !== atteso[0] || away !== atteso[1]) {
            errori.push(
                `  match ${i + 1} ${match.homeTeam}-${match.awayTeam}: ` +
                `calcolati ${home}-${away}, la lega mostra ${atteso[0]}-${atteso[1]}`
            );
        }
    });
    return errori;
}

function main() {
    const args = process.argv.slice(2);
    const dryRun = args.includes('--dry-run');
    const inputPath = args.find(a => !a.startsWith('--'));

    if (!inputPath) fail('uso: node calcola-giornata.mjs <estratto.json> [--dry-run]');

    const input = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
    for (const field of ['round', 'date', 'matches']) {
        if (input[field] === undefined) fail(`l'estratto non ha il campo "${field}"`);
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

    const matches = input.matches.map((match, i) => elaboraMatch(match, data.rosters || {}, i));

    const errori = verificaGol(matches, input.golAttesi);
    if (errori.length > 0) {
        fail(`i gol non coincidono con quelli della lega:\n${errori.join('\n')}`);
    }

    // Il modulo ideale serve solo a chi rilegge l'output: fuori dal JSON finale
    const moduli = matches.map(m => m._moduloIdeale);
    matches.forEach(m => delete m._moduloIdeale);

    const round = { round: input.round, date: input.date, matches };
    if (input.generalComment) round.generalComment = input.generalComment;

    data.rounds.push(round);
    data.rounds.sort((a, b) => a.round - b.round);
    if (input.lastUpdate) data.lastUpdate = input.lastUpdate;

    console.log(`Giornata ${input.round} — ${input.date} (${seasonId})`);
    for (const [i, match] of matches.entries()) {
        const gh = golDaPunteggio(match.homeScore);
        const ga = golDaPunteggio(match.awayScore);
        let line = `  ${match.homeTeam} ${gh}-${ga} ${match.awayTeam}` +
                   `  reale ${match.homeScore}-${match.awayScore}`;
        if (match.homeIdealScore !== undefined) {
            line += `  ideale ${match.homeIdealScore}-${match.awayIdealScore}` +
                    `  [${moduli[i].home} / ${moduli[i].away}]`;
        } else {
            line += '  ideale non calcolato';
        }
        console.log(line);
    }

    if (dryRun) {
        console.log('\n--dry-run: nessuna scrittura.');
        return;
    }

    fs.writeFileSync(seasonPath, JSON.stringify(data, null, 2) + '\n');
    console.log(`\nScritto ${season.file} (${data.rounds.length} giornate).`);
}

// pathToFileURL normalizza i path Windows (file:///D:/...), che una semplice
// concatenazione "file://" + argv[1] sbaglierebbe. argv[1] manca quando il
// modulo viene importato da `node -e`, quindi va controllato prima.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();

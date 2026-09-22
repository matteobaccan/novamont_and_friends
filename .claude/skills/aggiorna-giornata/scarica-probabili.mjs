#!/usr/bin/env node
// Scarica le probabili formazioni di Serie A e le salva in data/probabili.json,
// usate dal suggeritore per pesare quanto è probabile che un giocatore giochi.
//
//   node scarica-probabili.mjs [--dry-run]
//
// La pagina è pubblica e non richiede autenticazione. I giocatori sono
// identificati dallo stesso id globale Fantacalcio usato in data/<stagione>.json.

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const URL_PROBABILI = 'https://www.fantacalcio.it/probabili-formazioni-serie-a';
const DESTINAZIONE = 'data/probabili.json';

function fail(message) {
    console.error(`ERRORE: ${message}`);
    process.exit(1);
}

// Estrae i blocchi di una squadra: nome, modulo, titolari e riserve
function dividiPerSquadra(html) {
    const blocchi = [];
    const regexCard = /<h3 class="h6 team-name">([^<]+)<\/h3>\s*<div class="h6 team-formation">([^<]*)<\/div>([\s\S]*?)(?=<h3 class="h6 team-name">|$)/g;

    let m;
    while ((m = regexCard.exec(html)) !== null) {
        blocchi.push({ squadra: m[1].trim(), modulo: m[2].trim(), html: m[3] });
    }
    return blocchi;
}

// Una voce giocatore: ruolo, id, nome e percentuale di titolarità
function estraiGiocatori(htmlLista, titolari) {
    const giocatori = [];
    const regexItem = /<li class="player-item pill"[^>]*>([\s\S]*?)<\/li>/g;

    let m;
    while ((m = regexItem.exec(htmlLista)) !== null) {
        const item = m[1];

        const ruolo = /<span class="role" data-value="([^"]*)"/.exec(item);
        const link = /href="[^"]*\/(\d+)"/.exec(item);
        const nome = /<span>([^<]+)<\/span>/.exec(item);
        const percentuale = /aria-valuenow="(\d+)"/.exec(item);

        if (!link) continue; // voce senza id: inutilizzabile per il match

        giocatori.push({
            pid: Number(link[1]),
            nome: nome ? nome[1].trim() : null,
            ruolo: ruolo ? ruolo[1].toUpperCase() : null,
            probabilita: percentuale ? Number(percentuale[1]) : (titolari ? 100 : 0),
            titolare: titolari
        });
    }
    return giocatori;
}

function analizza(html) {
    const squadre = [];
    const giocatori = {};

    for (const blocco of dividiPerSquadra(html)) {
        const listaTitolari = /<ul class="player-list starters">([\s\S]*?)<\/ul>/.exec(blocco.html);
        const listaRiserve = /<ul class="player-list reserves">([\s\S]*?)<\/ul>/.exec(blocco.html);

        const titolari = listaTitolari ? estraiGiocatori(listaTitolari[1], true) : [];
        const riserve = listaRiserve ? estraiGiocatori(listaRiserve[1], false) : [];

        if (titolari.length === 0 && riserve.length === 0) continue;

        squadre.push({ nome: blocco.squadra, modulo: blocco.modulo, titolari: titolari.length, riserve: riserve.length });

        for (const g of [...titolari, ...riserve]) {
            // Un giocatore può comparire una volta sola: vince la voce titolare
            if (giocatori[g.pid] && giocatori[g.pid].titolare) continue;
            giocatori[g.pid] = {
                nome: g.nome,
                squadra: blocco.squadra,
                ruolo: g.ruolo,
                probabilita: g.probabilita,
                titolare: g.titolare
            };
        }
    }

    return { squadre, giocatori };
}

async function main() {
    const dryRun = process.argv.includes('--dry-run');

    const res = await fetch(URL_PROBABILI, {
        headers: {
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36',
            accept: 'text/html,application/xhtml+xml'
        }
    });
    if (!res.ok) fail(`la pagina ha risposto ${res.status}`);

    const { squadre, giocatori } = analizza(await res.text());

    if (squadre.length === 0) {
        fail('nessuna squadra trovata: la pagina ha probabilmente cambiato struttura');
    }

    console.log(`Probabili formazioni: ${squadre.length} squadre, ${Object.keys(giocatori).length} giocatori`);
    for (const s of squadre) {
        console.log(`  ${s.nome.padEnd(12)} ${s.modulo.padEnd(7)} titolari ${s.titolari}, riserve ${s.riserve}`);
    }

    const incomplete = squadre.filter(s => s.titolari !== 11);
    if (incomplete.length > 0) {
        console.warn('\nATTENZIONE, squadre senza 11 titolari:');
        for (const s of incomplete) console.warn(`  ${s.nome}: ${s.titolari}`);
    }

    if (dryRun) {
        console.log('\n--dry-run: nessuna scrittura.');
        return;
    }

    const output = {
        aggiornato: new Date().toISOString(),
        fonte: URL_PROBABILI,
        squadre: squadre.length,
        giocatori
    };

    const destinazione = path.join(process.cwd(), DESTINAZIONE);
    fs.writeFileSync(destinazione, JSON.stringify(output, null, 2) + '\n');
    console.log(`\nScritto ${DESTINAZIONE}.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();

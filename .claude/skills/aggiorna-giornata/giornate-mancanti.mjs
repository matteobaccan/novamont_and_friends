#!/usr/bin/env node
// Quali giornate ci sono, quali mancano e qual è la prossima da fare.
//
//   node giornate-mancanti.mjs [--fino-a N] [--stagione 2026-2027]
//
// Senza --fino-a guarda solo quello che c'è nel file. Con --fino-a N, cioè la
// giornata a cui è arrivata la lega, elenca tutto quello che manca per starle
// dietro. Serve perché "ultima giornata: 5" non dice se la 3 e la 4 ci sono:
// dimenticarne una e accorgersene tre settimane dopo è successo davvero.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const QUI = path.dirname(fileURLToPath(import.meta.url));
const RADICE = path.resolve(QUI, '..', '..', '..');

function fail(messaggio) {
    console.error(`ERRORE: ${messaggio}`);
    process.exit(1);
}

export function statoGiornate(seasonId, finoA) {
    const indice = JSON.parse(fs.readFileSync(path.join(RADICE, 'data', 'seasons.json'), 'utf8'));
    const id = seasonId || indice.currentSeason;
    const stagione = indice.seasons.find(s => s.id === id);
    if (!stagione) fail(`stagione "${id}" non presente in data/seasons.json`);

    const dati = JSON.parse(fs.readFileSync(path.join(RADICE, stagione.file), 'utf8'));
    const presenti = (dati.rounds || []).map(r => r.round).sort((a, b) => a - b);
    const ultima = presenti.length > 0 ? presenti[presenti.length - 1] : 0;

    // Il traguardo è dove è arrivata la lega, se lo si sa; altrimenti si
    // guardano solo i buchi fra quelle che ci sono
    const traguardo = Number.isFinite(finoA) ? finoA : ultima;

    const mancanti = [];
    for (let r = 1; r <= traguardo; r += 1) {
        if (!presenti.includes(r)) mancanti.push(r);
    }

    return { stagione: id, file: stagione.file, presenti, ultima, traguardo, mancanti };
}

function main() {
    const args = process.argv.slice(2);
    const valore = (nome) => {
        const i = args.indexOf(nome);
        return i >= 0 ? args[i + 1] : null;
    };

    const finoAGrezzo = valore('--fino-a');
    const finoA = finoAGrezzo === null ? null : Number(finoAGrezzo);
    if (finoAGrezzo !== null && !Number.isInteger(finoA)) fail('--fino-a vuole un numero di giornata');

    const s = statoGiornate(valore('--stagione'), finoA);

    console.log(`Stagione ${s.stagione} (${s.file})`);
    console.log(`  presenti: ${s.presenti.length > 0 ? s.presenti.join(', ') : 'nessuna'}`);

    if (s.mancanti.length === 0) {
        const prossima = s.traguardo + 1;
        console.log('  mancanti: nessuna');
        console.log(finoAGrezzo === null
            ? `  prossima da fare: ${prossima} (controlla sul calendario della lega che sia stata giocata)`
            : `  in pari con la giornata ${s.traguardo} della lega. La prossima sarà la ${prossima}.`);
        return;
    }

    console.log(`  mancanti: ${s.mancanti.join(', ')}`);
    console.log('');
    console.log(`  Si fanno UNA ALLA VOLTA e IN ORDINE CRESCENTE: prima la ${s.mancanti[0]}.`);
    console.log('  Una giornata si inserisce solo quando tutte quelle prima ci sono già:');
    console.log('  ogni snapshot delle rose viene costruito su quello precedente, e saltare');
    console.log('  un turno lascerebbe fuori chi è arrivato proprio in quel turno.');
}

// argv[1] manca quando il modulo viene importato da `node -e`
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();

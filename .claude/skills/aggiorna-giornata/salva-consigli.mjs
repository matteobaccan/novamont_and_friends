#!/usr/bin/env node
// Salva la formazione consigliata di ogni squadra per la prossima giornata in
// data/consigli/<stagione>/giornata-<N>.json, così a giornata giocata si può
// misurare se il suggeritore aveva ragione (vedi valuta-consigli.mjs).
//
//   node salva-consigli.mjs [--dry-run]
//
// Gira nella stessa Action delle probabili, subito dopo averle scaricate. Il
// file di una giornata si riscrive finché le probabili riguardano ancora lo
// stesso turno di Serie A e nessuna partita di quel turno è cominciata: così
// resta l'ultimo consiglio utile prima del fischio, e non uno scritto dopo,
// con probabili che già sanno chi ha giocato.

import fs from 'node:fs';
import path from 'node:path';
import { caricaScript, esegui, valuta, radiceProgetto } from '../../../test/aiuto/carica-script.mjs';

const leggi = (file) => JSON.parse(fs.readFileSync(path.join(radiceProgetto, file), 'utf8'));

export function turnoCominciato(probabili) {
    const partite = (probabili.prossimoTurno && probabili.prossimoTurno.partite) || [];
    return partite.some(p => p.giocata);
}

// Si può (ri)scrivere il consiglio? Sì se non c'è ancora, oppure se quello
// salvato riguarda lo stesso turno di Serie A e il turno non è cominciato.
export function sovrascrivibile(esistente, probabili) {
    if (!esistente) return !turnoCominciato(probabili);
    const turno = probabili.prossimoTurno ? probabili.prossimoTurno.numero : null;
    return esistente.turnoSerieA === turno && !turnoCominciato(probabili);
}

export function calcolaConsigli(dati, probabili) {
    const app = caricaScript();
    app.__dati = dati;
    app.__probabili = probabili;
    esegui(app, 'fantacalcioData = __dati; probabiliFormazioni = __probabili;');

    const squadre = {};
    const ultima = (dati.rosterHistory || []).at(-1);
    for (const team of Object.keys((ultima && ultima.teams) || {})) {
        const f = valuta(app, `suggerisciFormazione(${JSON.stringify(team)})`);
        if (!f) continue;
        squadre[team] = {
            modulo: f.modulo,
            totale: Math.round(f.totale * 100) / 100,
            titolari: f.undici.map(g => ({
                pid: g.pid,
                atteso: Math.round(g.atteso * 100) / 100,
                probabilita: g.probabilita
            })),
            panchina: f.panchina.map(g => g.pid)
        };
    }
    return squadre;
}

function main() {
    const dryRun = process.argv.includes('--dry-run');
    const stagioni = leggi('data/seasons.json');
    const stagione = stagioni.seasons.find(s => s.id === stagioni.currentSeason);
    const dati = leggi(stagione.file);
    const probabili = leggi('data/probabili.json');

    const giornata = (dati.rounds || []).length + 1;
    const destinazione = path.join(radiceProgetto, 'data', 'consigli', stagione.id, `giornata-${giornata}.json`);
    const esistente = fs.existsSync(destinazione) ? JSON.parse(fs.readFileSync(destinazione, 'utf8')) : null;

    if (!sovrascrivibile(esistente, probabili)) {
        console.log(`Consiglio della giornata ${giornata} congelato: il turno di Serie A è cominciato o è cambiato.`);
        return;
    }

    const consiglio = {
        stagione: stagione.id,
        giornata,
        generato: new Date().toISOString(),
        probabiliDel: probabili.aggiornato || null,
        turnoSerieA: probabili.prossimoTurno ? probabili.prossimoTurno.numero : null,
        squadre: calcolaConsigli(dati, probabili)
    };

    if (dryRun) {
        console.log(JSON.stringify(consiglio, null, 2));
        return;
    }
    fs.mkdirSync(path.dirname(destinazione), { recursive: true });
    fs.writeFileSync(destinazione, JSON.stringify(consiglio, null, 2) + '\n');
    console.log(`Salvato ${path.relative(radiceProgetto, destinazione)}: ${Object.keys(consiglio.squadre).length} squadre`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();

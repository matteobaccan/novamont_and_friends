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

// I pesi del modello che si possono far variare quando si rigiocano le giornate.
// Si salvano con ogni consiglio, così si sa con quali pesi era stato dato.
export const PARAMETRI = [
    'GIORNATE_PRIOR', 'PESO_FORMA', 'EPS_MODULO', 'VOTO_RIPIEGO',
    'PESO_CONTESTO', 'PESO_STANCHEZZA', 'PESO_QUOTE', 'SOGLIA_QUOTE', 'BONUS_RIGORE_PARTITA', 'PROB_FUORI_LISTA', 'PROB_INFORTUNATO'
];

// JSON leggibile in un diff ma senza una riga per numero: un oggetto o un
// array fatto solo di valori semplici sta su una riga, il resto va a capo.
export function jsonCompatto(valore, rientro = '') {
    const semplice = (v) => v === null || typeof v !== 'object';
    if (semplice(valore)) return JSON.stringify(valore);
    const voci = Array.isArray(valore) ? valore : Object.values(valore);
    if (voci.every(semplice)) {
        return Array.isArray(valore)
            ? `[${valore.map(v => JSON.stringify(v)).join(', ')}]`
            : `{${Object.entries(valore).map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(', ')}}`;
    }
    const dentro = rientro + '  ';
    const righe = Array.isArray(valore)
        ? valore.map(v => dentro + jsonCompatto(v, dentro))
        : Object.entries(valore).map(([k, v]) => `${dentro}${JSON.stringify(k)}: ${jsonCompatto(v, dentro)}`);
    const [apri, chiudi] = Array.isArray(valore) ? ['[', ']'] : ['{', '}'];
    return righe.length === 0 ? apri + chiudi : `${apri}\n${righe.join(',\n')}\n${rientro}${chiudi}`;
}

const arrotonda = (x) => (x === null || x === undefined ? null : Math.round(x * 1000) / 1000);

// La formazione consigliata di ogni squadra, più la previsione per ogni
// giocatore della rosa: chi è rimasto fuori serve tanto quanto chi è stato
// scelto, sia per misurare l'errore del modello sia per dare un valore atteso
// alla formazione che il fantallenatore ha schierato davvero.
export function calcolaConsigli(dati, probabili, { costanti = {} } = {}) {
    const app = caricaScript({ costanti });
    app.__dati = dati;
    app.__probabili = probabili;
    esegui(app, 'fantacalcioData = __dati; probabiliFormazioni = __probabili;');

    const parametri = Object.fromEntries(PARAMETRI.map(nome => [nome, valuta(app, nome)]));

    const squadre = {};
    const ultima = (dati.rosterHistory || []).at(-1);
    for (const team of Object.keys((ultima && ultima.teams) || {})) {
        const f = valuta(app, `suggerisciFormazione(${JSON.stringify(team)})`);
        if (!f) continue;
        const tutti = [...f.undici, ...f.panchina];
        squadre[team] = {
            modulo: f.modulo,
            totale: arrotonda(f.totale),
            titolari: f.undici.map(g => g.pid),
            panchina: f.panchina.map(g => g.pid),
            rosa: tutti.map(g => ({
                pid: g.pid,
                ruolo: valuta(app, `anagraficaGiocatore(${g.pid}).role`),
                atteso: arrotonda(g.atteso),
                resa: arrotonda(g.qualita),
                rigori: arrotonda(g.rigori ? g.rigori.bonus : 0),
                grezza: arrotonda(g.qualitaGrezza),
                mediaRuolo: arrotonda(g.mediaRuolo),
                presenze: g.presenze,
                probabilita: arrotonda(g.probabilita),
                fonte: g.fonteProbabilita
            }))
        };
    }
    return { parametri, squadre };
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
        ...calcolaConsigli(dati, probabili)
    };

    if (dryRun) {
        console.log(jsonCompatto(consiglio));
        return;
    }
    fs.mkdirSync(path.dirname(destinazione), { recursive: true });
    fs.writeFileSync(destinazione, jsonCompatto(consiglio) + '\n');
    console.log(`Salvato ${path.relative(radiceProgetto, destinazione)}: ${Object.keys(consiglio.squadre).length} squadre`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();

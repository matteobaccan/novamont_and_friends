#!/usr/bin/env node
// Scarica da fantacalcio.it tutto ciò che serve al suggeritore di formazione e
// lo salva in data/probabili.json:
//
//   - probabili formazioni: quanto è probabile che un giocatore scenda in campo
//   - rigoristi: chi batte i rigori, in ordine di gerarchia
//   - infortunati: chi non schierare, con il motivo
//   - contesto: classifica di Serie A, partite del prossimo turno, forma recente
//
//   node scarica-probabili.mjs [--dry-run]
//
// Le pagine sono pubbliche e non richiedono autenticazione. I giocatori sono
// identificati dallo stesso id globale Fantacalcio usato in data/<stagione>.json,
// tranne gli infortunati: quella pagina non espone id, quindi l'abbinamento alla
// rosa si fa per nome e squadra nel browser, dove le rose sono già caricate.

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const URL_PROBABILI = 'https://www.fantacalcio.it/probabili-formazioni-serie-a';
const URL_RIGORISTI = 'https://www.fantacalcio.it/rigoristi-serie-a';
const URL_INFORTUNATI = 'https://www.fantacalcio.it/infortunati-serie-a';
const URL_CALENDARIO = 'https://www.fantacalcio.it/serie-a/calendario';
const DESTINAZIONE = 'data/probabili.json';

// Quanti turni giocati guardare per la forma recente
const TURNI_FORMA = 3;

function fail(message) {
    console.error(`ERRORE: ${message}`);
    process.exit(1);
}

async function scarica(url) {
    const res = await fetch(url, {
        headers: {
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36',
            accept: 'text/html,application/xhtml+xml'
        }
    });
    if (!res.ok) throw new Error(`${url} ha risposto ${res.status}`);
    return res.text();
}

// Le descrizioni degli infortuni arrivano con le entità HTML non decodificate
// (Bernab&#xE8;, met&agrave;): senza questo il nome non combacia con la rosa.
const ENTITA = {
    amp: '&', lt: '<', gt: '>', quot: '"', apos: '\'', nbsp: ' ',
    agrave: 'à', egrave: 'è', eacute: 'é', igrave: 'ì', ograve: 'ò', ugrave: 'ù',
    Agrave: 'À', Egrave: 'È', Eacute: 'É', Igrave: 'Ì', Ograve: 'Ò', Ugrave: 'Ù'
};

function decodificaEntita(testo) {
    return testo
        .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
        .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
        .replace(/&([a-zA-Z]+);/g, (tutto, nome) => (nome in ENTITA ? ENTITA[nome] : tutto));
}

function testoPulito(html) {
    return decodificaEntita(html.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

// ============================================================
// Probabili formazioni
// ============================================================

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
            nome: nome ? decodificaEntita(nome[1].trim()) : null,
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

// ============================================================
// Rigoristi e infortunati: due pagine, la stessa impaginazione a card
// ============================================================

// Le pagine rigoristi e infortunati sono fatte di una card per squadra
function dividiCardSquadra(html) {
    const blocchi = [];
    const regexCard = /<div id="team-\d+" class="card team-card">([\s\S]*?)(?=<div id="team-\d+" class="card team-card">|<\/main>|$)/g;

    let m;
    while ((m = regexCard.exec(html)) !== null) {
        const nome = /<span class="team-name">([^<]+)<\/span>/.exec(m[1]);
        if (!nome) continue;
        blocchi.push({ squadra: decodificaEntita(nome[1].trim()), html: m[1] });
    }
    return blocchi;
}

// pid -> ordine di rigore (1 = primo rigorista). Interessa solo la colonna
// "Rigori": i calci piazzati sono un'altra cosa e non danno bonus diretto.
function analizzaRigoristi(html) {
    const rigoristi = {};

    for (const blocco of dividiCardSquadra(html)) {
        const colonna = /<header class="primary">Rigori<\/header>\s*<ol[^>]*>([\s\S]*?)<\/ol>/.exec(blocco.html);
        if (!colonna) continue;

        const ids = [...colonna[1].matchAll(/href="[^"]*\/(\d+)"/g)].map(m => Number(m[1]));
        ids.forEach((pid, i) => {
            // Un giocatore potrebbe comparire in due squadre dopo un trasferimento:
            // vince la gerarchia più alta
            if (!rigoristi[pid] || rigoristi[pid] > i + 1) rigoristi[pid] = i + 1;
        });
    }
    return rigoristi;
}

// La pagina non espone gli id: si tiene nome e squadra, l'abbinamento alla rosa
// lo fa il browser che ha già l'anagrafica dei giocatori della lega.
function analizzaInfortunati(html) {
    const infortunati = [];

    for (const blocco of dividiCardSquadra(html)) {
        const regexVoce = /<strong class="item-name">([^<]+)<\/strong>\s*<div class="item-description">([\s\S]*?)<\/div>/g;

        let m;
        while ((m = regexVoce.exec(blocco.html)) !== null) {
            infortunati.push({
                nome: decodificaEntita(m[1].trim()),
                squadra: blocco.squadra,
                nota: testoPulito(m[2])
            });
        }
    }
    return infortunati;
}

// ============================================================
// Contesto: classifica, partite del turno, forma recente
// ============================================================

// squadra -> posizione, dal widget di classifica presente nelle pagine di contorno
function analizzaClassifica(html) {
    const classifica = {};
    const regexRiga = /<tr data-name="([^"]+)"[^>]*data-team-position="(\d+)"/g;

    let m;
    while ((m = regexRiga.exec(html)) !== null) {
        classifica[decodificaEntita(m[1].trim())] = Number(m[2]);
    }
    return classifica;
}

// Le partite di un turno. Le pagine mostrano anche pill di altri turni nei
// widget laterali e ripetono lo stesso incontro più volte, quindi si filtra per
// numero di turno e si tengono gli accoppiamenti una volta sola.
function analizzaPartite(html, turno) {
    const partite = [];
    const viste = new Set();
    const regexPill = /class="match-pill[^"]*" data-match-status="(\d+)"([\s\S]*?)(?=class="match-pill|<\/main>|$)/g;

    let m;
    while ((m = regexPill.exec(html)) !== null) {
        const stato = Number(m[1]);
        const pill = m[2];

        const numero = /<div class="matchweek">\s*(\d+)\s*<\/div>/.exec(pill);
        if (!numero || Number(numero[1]) !== turno) continue;

        const squadre = [...pill.matchAll(/<meta itemprop="name" content="([^"]+)" \/>/g)].map(x => decodificaEntita(x[1]));
        if (squadre.length < 2) continue;

        const [casa, fuori] = squadre;
        const chiave = `${casa}|${fuori}`;
        if (viste.has(chiave)) continue;
        viste.add(chiave);

        const golCasa = /class="score-home">(\d+)</.exec(pill);
        const golFuori = /class="score-away">(\d+)</.exec(pill);
        const data = /itemprop="startDate" content="([^"]+)"/.exec(pill);

        const giocata = stato === 4;

        partite.push({
            casa,
            fuori,
            // Il 1970 è il segnaposto che il sito mette quando l'orario non c'è ancora
            data: data && !data[1].startsWith('1970') ? data[1] : null,
            giocata,
            // Una partita da giocare mostra 0-0 come segnaposto: non è un risultato
            golCasa: giocata && golCasa ? Number(golCasa[1]) : null,
            golFuori: giocata && golFuori ? Number(golFuori[1]) : null
        });
    }
    return partite;
}

function numeroProssimoTurno(html) {
    const numeri = [...html.matchAll(/<div class="matchweek">\s*(\d+)\s*<\/div>/g)].map(m => Number(m[1]));
    if (numeri.length === 0) return null;
    // Le probabili sono sempre del turno che sta per cominciare: se la pagina ne
    // cita più di uno, quello in corso è il più basso
    return Math.min(...numeri);
}

// Punti ed esiti delle ultime giornate, dalla più vecchia alla più recente.
// A inizio stagione i turni sono meno di TURNI_FORMA e si usa quel che c'è: il
// front-end normalizza sui turni effettivamente contati.
async function scaricaForma(prossimoTurno) {
    const forma = {};
    const primo = Math.max(1, prossimoTurno - TURNI_FORMA);

    for (let turno = primo; turno < prossimoTurno; turno++) {
        let partite;
        try {
            partite = analizzaPartite(await scarica(`${URL_CALENDARIO}/${turno}`), turno);
        } catch (error) {
            console.warn(`Turno ${turno} non scaricato: ${error.message}`);
            continue;
        }

        for (const p of partite) {
            if (!p.giocata || p.golCasa === null || p.golFuori === null) continue;

            const esiti = p.golCasa === p.golFuori
                ? ['N', 'N']
                : (p.golCasa > p.golFuori ? ['V', 'P'] : ['P', 'V']);

            for (const [squadra, esito] of [[p.casa, esiti[0]], [p.fuori, esiti[1]]]) {
                if (!forma[squadra]) forma[squadra] = { punti: 0, partite: 0, esiti: '' };
                forma[squadra].punti += esito === 'V' ? 3 : (esito === 'N' ? 1 : 0);
                forma[squadra].partite += 1;
                forma[squadra].esiti += esito;
            }
        }
    }
    return forma;
}

// ============================================================

async function main() {
    const dryRun = process.argv.includes('--dry-run');

    let htmlProbabili;
    try {
        htmlProbabili = await scarica(URL_PROBABILI);
    } catch (error) {
        fail(error.message);
    }

    const { squadre, giocatori } = analizza(htmlProbabili);

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

    // Da qui in poi nulla è bloccante: rigoristi, infortunati e contesto affinano
    // il suggerimento, ma senza di loro resta valido
    let rigoristi = {};
    try {
        rigoristi = analizzaRigoristi(await scarica(URL_RIGORISTI));
        console.log(`\nRigoristi: ${Object.keys(rigoristi).length}`);
    } catch (error) {
        console.warn(`\nRigoristi non disponibili: ${error.message}`);
    }

    let infortunati = [];
    let classifica = {};
    try {
        const htmlInfortunati = await scarica(URL_INFORTUNATI);
        infortunati = analizzaInfortunati(htmlInfortunati);
        classifica = analizzaClassifica(htmlInfortunati);
        console.log(`Infortunati: ${infortunati.length}`);
        console.log(`Classifica: ${Object.keys(classifica).length} squadre`);
    } catch (error) {
        console.warn(`Infortunati e classifica non disponibili: ${error.message}`);
    }

    const turno = numeroProssimoTurno(htmlProbabili);
    const partite = turno ? analizzaPartite(htmlProbabili, turno) : [];
    console.log(`Prossimo turno: ${turno ?? 'ignoto'}, ${partite.length} partite`);

    const forma = turno ? await scaricaForma(turno) : {};
    console.log(`Forma recente: ${Object.keys(forma).length} squadre`);

    if (dryRun) {
        console.log('\n--dry-run: nessuna scrittura.');
        return;
    }

    const output = {
        aggiornato: new Date().toISOString(),
        fonte: URL_PROBABILI,
        squadre: squadre.length,
        prossimoTurno: turno ? { numero: turno, partite } : null,
        classificaSerieA: classifica,
        formaSerieA: forma,
        rigoristi,
        infortunati,
        giocatori
    };

    const destinazione = path.join(process.cwd(), DESTINAZIONE);
    fs.writeFileSync(destinazione, JSON.stringify(output, null, 2) + '\n');
    console.log(`\nScritto ${DESTINAZIONE}.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();

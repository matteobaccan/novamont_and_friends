#!/usr/bin/env node
// Prepara data/probabili.json per il suggeritore di formazione, a partire dalle
// pagine di fantacalcio.it salvate a mano dall'utente (Ctrl+S, link nella
// scheda Giornate del sito):
//
//   - probabili formazioni, squalificati e prossimo turno
//   - rigoristi, in ordine di gerarchia
//   - infortunati e classifica di Serie A
//
//   node leggi-probabili.mjs [--probabili <file.html>] [--rigoristi <file.html>]
//                            [--infortunati <file.html>] [--dry-run]
//
// Non va in rete. Quello che non si passa resta com'era nel data/probabili.json
// precedente. I giocatori sono identificati dallo stesso id globale Fantacalcio
// usato in data/<stagione>.json, tranne gli infortunati: quella pagina non
// espone id, quindi l'abbinamento alla rosa si fa per nome e squadra nel
// browser, dove le rose sono già caricate.

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const URL_PROBABILI = 'https://www.fantacalcio.it/probabili-formazioni-serie-a';
const DESTINAZIONE = 'data/probabili.json';

function fail(message) {
    console.error(`ERRORE: ${message}`);
    process.exit(1);
}

// Le descrizioni degli infortuni arrivano con le entità HTML non decodificate
// (Bernab&#xE8;, met&agrave;): senza questo il nome non combacia con la rosa.
const ENTITA = {
    amp: '&', lt: '<', gt: '>', quot: '"', apos: '\'', nbsp: ' ',
    agrave: 'à', egrave: 'è', eacute: 'é', igrave: 'ì', ograve: 'ò', ugrave: 'ù',
    Agrave: 'À', Egrave: 'È', Eacute: 'É', Igrave: 'Ì', Ograve: 'Ò', Ugrave: 'Ù'
};

export function decodificaEntita(testo) {
    return testo
        .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
        .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
        .replace(/&([a-zA-Z]+);/g, (tutto, nome) => (nome in ENTITA ? ENTITA[nome] : tutto));
}

export function testoPulito(html) {
    return decodificaEntita(html.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

// ============================================================
// Probabili formazioni
// ============================================================

// Estrae i blocchi di una squadra: nome, modulo, titolari e riserve
export function dividiPerSquadra(html) {
    const blocchi = [];
    const regexCard = /<h3 class="h6 team-name">([^<]+)<\/h3>\s*<div class="h6 team-formation">([^<]*)<\/div>([\s\S]*?)(?=<h3 class="h6 team-name">|$)/g;

    let m;
    while ((m = regexCard.exec(html)) !== null) {
        blocchi.push({ squadra: m[1].trim(), modulo: m[2].trim(), html: m[3] });
    }
    return blocchi;
}

// Una voce giocatore: ruolo, id, nome e percentuale di titolarità
export function estraiGiocatori(htmlLista, titolari) {
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

export function analizza(html) {
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

// Gli squalificati stanno nella pagina delle probabili, non in una loro: una
// sezione per partita, con un blocco per squadra — prima la casa, poi la
// trasferta — e dentro i giocatori che quel turno non possono scendere in
// campo. A differenza degli infortunati la pagina espone gli id, quindi
// l'abbinamento alla rosa della lega è esatto e non passa per il nome.
//
// Non comparire nelle probabili non basta a riconoscerli: ci finisce anche chi
// è fuori lista o semplicemente fuori dai ventidue, che invece una chance di
// giocare ce l'ha. Senza questa sezione uno squalificato resta un «fuori dalle
// probabili» qualunque, e il suggeritore lo può schierare.
export function analizzaSqualificati(html) {
    const squalificati = [];

    // Le due squadre di una partita sono le ultime due nominate prima della
    // sezione: la pagina mette le due formazioni e poi i dettagli
    const nomi = [...html.matchAll(/<h3 class="h6 team-name">([^<]+)<\/h3>/g)]
        .map(m => ({ dove: m.index, nome: decodificaEntita(m[1].trim()) }));

    const regexSezione = /<section class="suspendeds">([\s\S]*?)<\/section>/g;

    let m;
    while ((m = regexSezione.exec(html)) !== null) {
        const partita = nomi.filter(n => n.dove < m.index).slice(-2);

        // Un blocco per squadra: o la lista, o «Nessun calciatore»
        const blocchi = m[1].split(/<div class="content">/).slice(1);

        blocchi.forEach((blocco, i) => {
            const voci = blocco.matchAll(/href="[^"]*\/(\d+)"[^>]*>\s*<span>([^<]+)<\/span>/g);
            for (const voce of voci) {
                squalificati.push({
                    pid: Number(voce[1]),
                    nome: decodificaEntita(voce[2].trim()),
                    squadra: partita[i] ? partita[i].nome : null
                });
            }
        });
    }
    return squalificati;
}

// ============================================================
// Rigoristi e infortunati: due pagine, la stessa impaginazione a card
// ============================================================

// Le pagine rigoristi e infortunati sono fatte di una card per squadra
export function dividiCardSquadra(html) {
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

// squadra -> rigoristi in ordine di gerarchia. Serve la gerarchia intera e non
// il solo grado del singolo: il secondo calcia i rigori quando il primo non
// gioca, quindi per pesarlo bisogna sapere chi ha davanti e quanto è probabile
// che scenda in campo. Interessa solo la colonna "Rigori": i calci piazzati
// sono un'altra cosa e non danno bonus diretto.
export function analizzaRigoristi(html) {
    const rigoristi = {};

    for (const blocco of dividiCardSquadra(html)) {
        const colonna = /<header class="primary">Rigori<\/header>\s*<ol[^>]*>([\s\S]*?)<\/ol>/.exec(blocco.html);
        if (!colonna) continue;

        // Il nome serve al browser per riconoscere un rigorista infortunato che
        // non è in nessuna rosa della lega, e quindi senza anagrafica locale
        const voci = [...colonna[1].matchAll(/href="[^"]*\/(\d+)"[^>]*>\s*<span>([^<]+)<\/span>/g)]
            .map(m => ({ pid: Number(m[1]), nome: decodificaEntita(m[2].trim()) }));

        if (voci.length > 0) rigoristi[blocco.squadra] = voci;
    }
    return rigoristi;
}

// La pagina non espone gli id: si tiene nome e squadra, l'abbinamento alla rosa
// lo fa il browser che ha già l'anagrafica dei giocatori della lega.
export function analizzaInfortunati(html) {
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
export function analizzaClassifica(html) {
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
export function analizzaPartite(html, turno) {
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

export function numeroProssimoTurno(html) {
    const numeri = [...html.matchAll(/<div class="matchweek">\s*(\d+)\s*<\/div>/g)].map(m => Number(m[1]));
    if (numeri.length === 0) return null;
    // Le probabili sono sempre del turno che sta per cominciare: se la pagina ne
    // cita più di uno, quello in corso è il più basso
    return Math.min(...numeri);
}


// ============================================================

// Il valore di un'opzione (--probabili file.html), null se non c'è
function opzione(argv, nome) {
    const i = argv.indexOf(nome);
    if (i === -1) return null;
    const valore = argv[i + 1];
    if (!valore || valore.startsWith('--')) fail(`${nome} vuole il file della pagina salvata`);
    return valore;
}

function leggiPagina(file) {
    try {
        return fs.readFileSync(file, 'utf8');
    } catch (error) {
        fail(`non riesco a leggere ${file}: ${error.message}`);
    }
}

function main() {
    const argv = process.argv.slice(2);
    const dryRun = argv.includes('--dry-run');
    const fileProbabili = opzione(argv, '--probabili');
    const fileRigoristi = opzione(argv, '--rigoristi');
    const fileInfortunati = opzione(argv, '--infortunati');

    // Il file precedente: quello che non arriva da una pagina salvata resta com'era
    let precedenti = {};
    try {
        precedenti = JSON.parse(fs.readFileSync(path.join(process.cwd(), DESTINAZIONE), 'utf8'));
    } catch {
        // primo giro, o file rotto: si riparte senza memoria
    }

    let aggiornato = precedenti.aggiornato || null;
    let nSquadre = precedenti.squadre || 0;
    let giocatori = precedenti.giocatori || {};
    let squalificati = precedenti.squalificati || [];
    let prossimoTurno = precedenti.prossimoTurno || null;

    if (fileProbabili) {
        const htmlProbabili = leggiPagina(fileProbabili);
        const analisi = analizza(htmlProbabili);
        if (analisi.squadre.length === 0) {
            fail(`nessuna squadra trovata in ${fileProbabili}: è la pagina delle probabili formazioni?`);
        }

        console.log(`Probabili formazioni: ${analisi.squadre.length} squadre, ${Object.keys(analisi.giocatori).length} giocatori`);
        for (const s of analisi.squadre) {
            console.log(`  ${s.nome.padEnd(12)} ${s.modulo.padEnd(7)} titolari ${s.titolari}, riserve ${s.riserve}`);
        }
        const incomplete = analisi.squadre.filter(s => s.titolari !== 11);
        if (incomplete.length > 0) {
            console.warn('\nATTENZIONE, squadre senza 11 titolari:');
            for (const s of incomplete) console.warn(`  ${s.nome}: ${s.titolari}`);
        }

        // Dalla stessa pagina vengono squalificati e prossimo turno
        squalificati = analizzaSqualificati(htmlProbabili);
        console.log(`\nSqualificati: ${squalificati.length}`);
        for (const g of squalificati) console.log(`  ${g.nome} (${g.squadra})`);

        const turno = numeroProssimoTurno(htmlProbabili);
        const partite = turno ? analizzaPartite(htmlProbabili, turno) : [];
        console.log(`Prossimo turno: ${turno ?? 'ignoto'}, ${partite.length} partite`);

        aggiornato = new Date().toISOString();
        nSquadre = analisi.squadre.length;
        giocatori = analisi.giocatori;
        prossimoTurno = turno ? { numero: turno, partite } : null;
    } else {
        console.log(`Probabili: nessun file, restano quelle del ${aggiornato || 'giro precedente'}`);
    }

    let rigoristi = precedenti.rigoristi || {};
    if (fileRigoristi) {
        rigoristi = analizzaRigoristi(leggiPagina(fileRigoristi));
        const quanti = Object.values(rigoristi).reduce((somma, v) => somma + v.length, 0);
        console.log(`Rigoristi: ${quanti} in ${Object.keys(rigoristi).length} squadre`);
    }

    let infortunati = precedenti.infortunati || [];
    let classifica = precedenti.classificaSerieA || {};
    if (fileInfortunati) {
        const html = leggiPagina(fileInfortunati);
        infortunati = analizzaInfortunati(html);
        classifica = analizzaClassifica(html);
        console.log(`Infortunati: ${infortunati.length}`);
        console.log(`Classifica: ${Object.keys(classifica).length} squadre`);
    }

    // La forma recente veniva dalle pagine del calendario di Serie A: per ora
    // resta quella del file precedente
    const forma = precedenti.formaSerieA || {};

    if (dryRun) {
        console.log('\n--dry-run: nessuna scrittura.');
        return;
    }

    // "aggiornato" è l'età delle probabili, che il sito mostra: cambia solo
    // quando arriva una pagina nuova
    const output = {
        aggiornato,
        fonte: URL_PROBABILI,
        squadre: nSquadre,
        prossimoTurno,
        classificaSerieA: classifica,
        formaSerieA: forma,
        rigoristi,
        infortunati,
        squalificati,
        giocatori
    };

    const destinazione = path.join(process.cwd(), DESTINAZIONE);
    fs.writeFileSync(destinazione, JSON.stringify(output, null, 2) + '\n');
    console.log(`\nScritto ${DESTINAZIONE}.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();

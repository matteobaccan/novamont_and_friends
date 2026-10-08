// Il calendario di tutte le competizioni delle squadre di Serie A, per sapere
// chi arriva alla prossima giornata dopo una partita a metà settimana.
//
// fantacalcio.it ha solo il calendario di Serie A, e per il prossimo turno
// spesso senza orari: le coppe (Champions, Europa League, Conference, Coppa
// Italia) vengono dall'API pubblica di ESPN, che non chiede chiavi e mette
// data e ora di ogni partita. Le squadre si chiamano a modo loro
// ("Internazionale", "AS Roma"): nomeSerieA() le riporta ai nomi di
// fantacalcio.it, e chi non si riconosce finisce nel log invece di sparire.
//
// ESPN dà solo le partite da oggi in avanti, non quelle già giocate: la
// partita di coppa di mercoledì, che serve per il riposo del weekend, sparisce
// appena giocata. Per questo le partite viste si ricordano da un giro all'altro
// (in probabili.json, `partiteCalendario`): il workflow gira due volte al giorno
// e guarda dodici giorni avanti, quindi ogni partita viene vista prima di essere
// giocata. Si tengono quindici giorni indietro, poi si buttano.
//
// Nulla qui è bloccante: senza calendario il suggeritore ignora la stanchezza.

const URL_ESPN = 'https://site.api.espn.com/apis/site/v2/sports/soccer';

export const COMPETIZIONI = {
    'ita.1': 'Serie A',
    'ita.coppa_italia': 'Coppa Italia',
    'uefa.champions': 'Champions League',
    'uefa.europa': 'Europa League',
    'uefa.europa.conf': 'Conference League'
};

// Quanti giorni guardare indietro e avanti rispetto a oggi
const GIORNI_INDIETRO = 10;
const GIORNI_AVANTI = 12;

// Quanti giorni di partite passate ricordare
const GIORNI_MEMORIA = 15;

const GIORNO = 86400000;

// Nomi ESPN che non si riconoscono togliendo sigle e punteggiatura
const ALIAS = {
    internazionale: 'Inter',
    hellasverona: 'Verona',
    verona: 'Verona'
};

// Sigle societarie che ESPN aggiunge e fantacalcio.it no
const SIGLE = /\b(ac|as|ss|ssc|acf|fc|us|uc|calcio|bc|afc|cfc|1907|1913|1919)\b/g;

const riduci = (testo) => (testo || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

// `approssimato` permette di riconoscere un nome che ne contiene un altro
// ("Udinese Calcio 1896"): va bene solo nelle competizioni italiane, perché in
// Europa "Inter Club d'Escaldes" non è l'Inter
export function nomeSerieA(nomeEsterno, squadreNote, { approssimato = true } = {}) {
    const pulito = riduci(nomeEsterno).replace(SIGLE, '').replace(/[^a-z]/g, '');
    if (!pulito) return null;
    if (ALIAS[pulito] && squadreNote.includes(ALIAS[pulito])) return ALIAS[pulito];

    const indice = new Map(squadreNote.map(s => [riduci(s).replace(/[^a-z]/g, ''), s]));
    if (indice.has(pulito)) return indice.get(pulito);

    if (!approssimato) return null;
    for (const [chiave, nome] of indice) {
        if (chiave.length >= 4 && (pulito.includes(chiave) || chiave.includes(pulito))) return nome;
    }
    return null;
}

// ------------------------------------------------------------------
// Quote dei bookmaker
// ------------------------------------------------------------------
//
// Lo scoreboard ESPN allega a molte partite le quote di un bookmaker per
// l'esito finale. Il formato è cambiato nel tempo e non è lo stesso per tutte
// le leghe, quindi si accettano le forme note:
//
//   odds[0].homeTeamOdds.moneyLine = -250        (americana, numero)
//   odds[0].moneyline.home.close.odds = "-250"   (americana, stringa)
//   odds[0].homeTeamOdds.current.moneyLine.american = "+150"
//   ... e le stesse con una quota decimale (1.45) al posto dell'americana
//
// Tutto finisce in quota decimale: 1.45 vuol dire che un euro ne rende 1,45.

// Da una quota americana o decimale, in qualunque forma, alla decimale
export function quotaDecimale(valore) {
    if (valore === null || valore === undefined) return null;
    if (typeof valore === 'object') {
        for (const campo of ['decimal', 'american', 'moneyLine', 'odds', 'value', 'close', 'current', 'open']) {
            const q = quotaDecimale(valore[campo]);
            if (q !== null) return q;
        }
        return null;
    }
    const testo = String(valore).trim().toUpperCase();
    if (testo === 'EVEN' || testo === 'EV') return 2;
    const n = Number(testo.replace(/^\+/, ''));
    if (!Number.isFinite(n) || n === 0) return null;
    // Le americane stanno da 100 in su in valore assoluto, le decimali sotto
    if (Math.abs(n) >= 100) return n > 0 ? 1 + n / 100 : 1 + 100 / Math.abs(n);
    return n > 1 ? n : null;
}

export function quoteDellaGara(gara) {
    for (const voce of (gara && gara.odds) || []) {
        // L'elenco a volte contiene voci nulle: si salta alla prossima
        if (!voce || typeof voce !== 'object') continue;
        const ml = voce.moneyline || {};
        const casa = quotaDecimale(voce.homeTeamOdds) ?? quotaDecimale(ml.home);
        const fuori = quotaDecimale(voce.awayTeamOdds) ?? quotaDecimale(ml.away);
        const pareggio = quotaDecimale(voce.drawOdds) ?? quotaDecimale(ml.draw);
        if (casa && fuori && pareggio) {
            const arrotonda = (x) => Math.round(x * 100) / 100;
            return {
                casa: arrotonda(casa),
                pareggio: arrotonda(pareggio),
                fuori: arrotonda(fuori),
                fonte: (voce.provider && voce.provider.name) || null
            };
        }
    }
    return null;
}

// Le quote sono un di più: un formato inatteso deve far perdere le quote di
// quella partita, non la partita e con lei tutto il giorno
function quoteSicure(gara) {
    try {
        return quoteDellaGara(gara);
    } catch {
        return null;
    }
}

// Probabilità dei tre esiti dalle quote. 1/quota somma a più di 1 — è il
// margine del bookmaker — e si riporta a 1 dividendo per la somma.
export function probabilitaDaQuote(quote) {
    if (!quote) return null;
    const grezze = [1 / quote.casa, 1 / quote.pareggio, 1 / quote.fuori];
    const somma = grezze.reduce((a, b) => a + b, 0);
    const [casa, pareggio, fuori] = grezze.map(x => Math.round((x / somma) * 1000) / 1000);
    return { casa, pareggio, fuori };
}

// Le partite di uno scoreboard ESPN: data, casa, fuori, competizione e, se ci
// sono, le quote
export function analizzaScoreboard(json, competizione) {
    const partite = [];
    for (const evento of (json && json.events) || []) {
        const gara = (evento.competitions || [])[0];
        if (!gara || !evento.date) continue;
        const squadre = gara.competitors || [];
        const casa = squadre.find(c => c.homeAway === 'home');
        const fuori = squadre.find(c => c.homeAway === 'away');
        if (!casa || !fuori) continue;
        partite.push({
            data: evento.date,
            competizione,
            casa: (casa.team && (casa.team.displayName || casa.team.name)) || '',
            fuori: (fuori.team && (fuori.team.displayName || fuori.team.name)) || '',
            // Rinviata o annullata: non stanca nessuno
            annullata: /postponed|canceled|cancelled/i.test(((evento.status || {}).type || {}).name || ''),
            quote: quoteSicure(gara)
        });
    }
    return partite;
}

const giorni = (da, a) => Math.round((Date.parse(a) - Date.parse(da)) / GIORNO);

// Per ogni squadra: la prossima di Serie A, la partita prima (qualunque
// competizione) e la prima dopo, con i giorni di riposo in mezzo.
//
// I giorni si contano fra i calci d'inizio e si arrotondano: martedì sera e
// sabato pomeriggio fanno 4, mercoledì sera e sabato sera 3.
export function calcolaCalendario(partite, squadreNote, adesso = new Date().toISOString()) {
    const perSquadra = new Map(squadreNote.map(s => [s, []]));
    const sconosciute = new Set();

    for (const p of partite) {
        if (p.annullata) continue;
        for (const [lato, avversario] of [[p.casa, p.fuori], [p.fuori, p.casa]]) {
            const italiana = p.competizione === 'Serie A' || p.competizione === 'Coppa Italia';
            const nome = nomeSerieA(lato, squadreNote, { approssimato: italiana });
            if (!nome) {
                // Le avversarie straniere e quelle di B in Coppa Italia non sono
                // un problema: lo è solo una squadra di Serie A non riconosciuta
                if (p.competizione === 'Serie A') sconosciute.add(lato);
                continue;
            }
            perSquadra.get(nome).push({ data: p.data, competizione: p.competizione, avversario, casa: lato === p.casa, quote: p.quote || null });
        }
    }

    // Una partita in corso da meno di tre ore è ancora "la prossima"
    const soglia = new Date(Date.parse(adesso) - 3 * 3600000).toISOString();

    const calendario = {};
    for (const [squadra, elenco] of perSquadra) {
        elenco.sort((a, b) => Date.parse(a.data) - Date.parse(b.data));
        const prossima = elenco.find(p => p.competizione === 'Serie A' && p.data >= soglia);
        if (!prossima) continue;

        const prima = elenco.filter(p => Date.parse(p.data) < Date.parse(prossima.data));
        const precedente = prima.at(-1) || null;
        const dopo = elenco.find(p => Date.parse(p.data) > Date.parse(prossima.data)) || null;
        // Le partite in mezzo: quella del weekend prima, sette giorni esatti, non conta
        const ultimaSettimana = prima.filter(p => giorni(p.data, prossima.data) < 7).length;

        // Le probabilità dal punto di vista della squadra: vittoria è la sua
        const p = probabilitaDaQuote(prossima.quote);
        const esiti = p && {
            vittoria: prossima.casa ? p.casa : p.fuori,
            pareggio: p.pareggio,
            sconfitta: prossima.casa ? p.fuori : p.casa,
            quote: prossima.quote
        };

        calendario[squadra] = {
            prossima: {
                data: prossima.data,
                avversario: nomeSerieA(prossima.avversario, squadreNote) || prossima.avversario,
                esiti: esiti || null
            },
            precedente: precedente && { data: precedente.data, competizione: precedente.competizione, avversario: precedente.avversario },
            giorniRiposo: precedente ? giorni(precedente.data, prossima.data) : null,
            partiteUltimaSettimana: ultimaSettimana,
            dopo: dopo && { data: dopo.data, competizione: dopo.competizione, avversario: dopo.avversario },
            giorniAllaSuccessiva: dopo ? giorni(prossima.data, dopo.data) : null
        };
    }
    return { calendario, sconosciute: [...sconosciute] };
}

const aaaammgg = (ms) => new Date(ms).toISOString().slice(0, 10).replace(/-/g, '');

// Le partite di una competizione nella finestra. ESPN accetta un intervallo
// di date, ma non sempre (la prima prova con limit=300 su 23 giorni ha avuto
// 400 ovunque): se l'intervallo viene rifiutato si chiede un giorno alla volta.
// Le partite si tengono una volta sola, perché due giorni possono restituire
// la stessa partita a cavallo della mezzanotte.
async function partiteDellaCompetizione(lega, nome, da, a, scaricaJson) {
    const base = `${URL_ESPN}/${lega}/scoreboard`;
    try {
        return analizzaScoreboard(await scaricaJson(`${base}?dates=${aaaammgg(da)}-${aaaammgg(a)}`), nome);
    } catch (errore) {
        console.warn(`  ${nome}: intervallo rifiutato (${errore.message}), provo giorno per giorno`);
    }

    const viste = new Map();
    let errori = 0;
    let ultimoErrore = null;
    for (let giorno = da; giorno <= a; giorno += GIORNO) {
        try {
            for (const p of analizzaScoreboard(await scaricaJson(`${base}?dates=${aaaammgg(giorno)}`), nome)) {
                viste.set(`${p.data}|${p.casa}|${p.fuori}`, p);
            }
        } catch (errore) {
            errori++;
            ultimoErrore = errore;
        }
    }
    const giorni = Math.round((a - da) / GIORNO) + 1;
    if (errori === giorni) throw ultimoErrore;
    if (errori > 0) console.warn(`  ${nome}: ${errori} giorni su ${giorni} non scaricati (${ultimoErrore.message})`);
    return [...viste.values()];
}

// Unisce le partite ricordate a quelle appena scaricate. Una partita appena
// scaricata vince su quella ricordata (orario spostato, rinvio), e si tengono
// solo quelle degli ultimi GIORNI_MEMORIA giorni.
export function unisciPartite(ricordate, nuove, adesso = Date.now()) {
    const chiave = (p) => `${p.competizione}|${p.casa}|${p.fuori}`;
    const unite = new Map();
    for (const p of ricordate || []) unite.set(chiave(p), p);
    for (const p of nuove) {
        // Una partita già cominciata può perdere le quote dalla fonte: si
        // tengono quelle viste prima, che sono anche le più utili
        const prima = unite.get(chiave(p));
        unite.set(chiave(p), prima && prima.quote && !p.quote ? { ...p, quote: prima.quote } : p);
    }
    const limite = adesso - GIORNI_MEMORIA * GIORNO;
    return [...unite.values()]
        .filter(p => Date.parse(p.data) >= limite)
        .sort((a, b) => Date.parse(a.data) - Date.parse(b.data));
}

export async function scaricaCalendario(squadreNote, scaricaJson, ricordate = []) {
    const adesso = Date.now();
    const da = adesso - GIORNI_INDIETRO * GIORNO;
    const a = adesso + GIORNI_AVANTI * GIORNO;

    const partite = [];
    for (const [lega, nome] of Object.entries(COMPETIZIONI)) {
        try {
            const trovate = await partiteDellaCompetizione(lega, nome, da, a, scaricaJson);
            // I giorni con almeno una partita: se mancano tutti quelli passati,
            // la fonte non dà lo storico e il riposo non si può calcolare
            const giorni = [...new Set(trovate.map(p => p.data.slice(5, 10)))].sort();
            const conQuote = trovate.filter(p => p.quote).length;
            console.log(`  ${nome}: ${trovate.length} partite${giorni.length ? ` (${giorni.join(' ')})` : ''}, ${conQuote} con le quote`);
            partite.push(...trovate);
        } catch (errore) {
            console.warn(`  ${nome} non disponibile: ${errore.message}`);
        }
    }
    // Se una competizione non ha risposto, le sue partite ricordate restano
    const unite = unisciPartite(ricordate, partite, adesso);
    const ricordatePassate = unite.filter(p => Date.parse(p.data) < adesso).length;
    console.log(`  ${unite.length} partite in memoria, ${ricordatePassate} già giocate`);
    return { ...calcolaCalendario(unite, squadreNote, new Date(adesso).toISOString()), partite: unite };
}

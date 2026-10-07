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

// Le partite di uno scoreboard ESPN: data, casa, fuori, competizione
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
            annullata: /postponed|canceled|cancelled/i.test(((evento.status || {}).type || {}).name || '')
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
            perSquadra.get(nome).push({ data: p.data, competizione: p.competizione, avversario, casa: lato === p.casa });
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

        calendario[squadra] = {
            prossima: { data: prossima.data, avversario: nomeSerieA(prossima.avversario, squadreNote) || prossima.avversario },
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

export async function scaricaCalendario(squadreNote, scaricaJson) {
    const adesso = Date.now();
    const intervallo = `${aaaammgg(adesso - GIORNI_INDIETRO * GIORNO)}-${aaaammgg(adesso + GIORNI_AVANTI * GIORNO)}`;

    const partite = [];
    for (const [lega, nome] of Object.entries(COMPETIZIONI)) {
        try {
            const json = await scaricaJson(`${URL_ESPN}/${lega}/scoreboard?dates=${intervallo}&limit=300`);
            const trovate = analizzaScoreboard(json, nome);
            console.log(`  ${nome}: ${trovate.length} partite`);
            partite.push(...trovate);
        } catch (error) {
            console.warn(`  ${nome} non disponibile: ${error.message}`);
        }
    }
    return calcolaCalendario(partite, squadreNote, new Date(adesso).toISOString());
}

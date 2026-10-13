// Preleva una giornata dal browser già loggato, senza token in chiaro.
//
// Si incolla in una pagina di leghe.fantacalcio.it (il tab va aperto lì: il
// bearer sta nel localStorage di quell'origine, e le chiamate all'API vogliono
// origin e referer della lega). Serve quando FANTA_TOKEN non c'è: il token
// resta dentro la pagina, non passa dalla chat e non finisce in un file.
//
// 1. Modifica ROUND, ROUND_SERIE_A e PARTITE con la giornata da prendere:
//    gli accoppiamenti si leggono dal calendario della lega.
// 2. Incolla tutto. Stampa un riepilogo con punteggi e risultati: vanno
//    confrontati col calendario prima di andare avanti.
// 3. Le partite restano in `window.__G`. Si estraggono UNA PER VOLTA, con
//    JSON.stringify(window.__G[0]), poi [1], [2]... perché il canale che le
//    riporta taglia oltre il migliaio e mezzo di caratteri e una partita
//    intera in forma piena non ci sta.
// 4. I pezzi si incollano in un array in un file compatto.json, si espande
//    con espandi-compatto.mjs e si passa a scarica-giornata.mjs --grezzo.
// 5. Alla fine `delete window.__FT`, così il token non resta appeso alla
//    pagina.

const COMPETIZIONE = 805779;
const ROUND = 2;
const ROUND_SERIE_A = 6;
const PARTITE = [
    ['Real Ichnusa', 'SM Frattese'],
    ['Cusiana', 'Ultimo'],
    ['PARTIZAN TIRANA', 'Team24'],
    ['Shakhtar Donuts', 'Real Pattagghiu']
];

const APP_KEY = 'ICiELOObd5DF5uJEATi77CRvHiiRuMU0';
const PARTECIPANTI = '/onboarding/v1/invitation/participants?pageNumber=1&pageSize=1000';

const chiama = async (percorso, token) => {
    const res = await fetch('https://apileague.fantacalcio.it' + percorso, {
        headers: { accept: 'application/json, text/plain, */*', app_key: APP_KEY, authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error(`${percorso} ha risposto ${res.status}`);
    return res.json();
};

// Nel localStorage ci sono più JWT e uno solo è quello della lega: si prova
// quale risponde 200, invece di indovinare dal nome della chiave.
const cercaToken = async () => {
    for (const store of [localStorage, sessionStorage]) {
        for (let i = 0; i < store.length; i++) {
            const valore = store.getItem(store.key(i)) || '';
            for (const jwt of valore.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g) || []) {
                try {
                    await chiama(PARTECIPANTI, jwt);
                    return jwt;
                } catch { /* non è questo: si prova il prossimo */ }
            }
        }
    }
    throw new Error('nessun token valido nella pagina: sei loggato sulla lega?');
};

// pid:voto:votoBonus:slot=n,slot=n:ptype, con i campi vuoti in coda tagliati
const giocatore = (p) => {
    const eventi = p.b.split(';').map(Number).map((n, i) => (n ? `${i}=${n}` : null)).filter(Boolean).join(',');
    return [p.pid, p.scr, p.cscr, eventi, p.ptype && p.ptype !== '-' ? p.ptype : ''].join(':').replace(/:+$/, '');
};
const lato = (L) => L.starts.map(giocatore).join('|') + '//' + L.bench.map(giocatore).join('|');

window.__FT = await cercaToken();

const partecipanti = await chiama(PARTECIPANTI, window.__FT);
const idDi = {};
for (const t of partecipanti) idDi[t.teamName.toLowerCase()] = t.teamId;

window.__G = [];
for (const [casa, fuori] of PARTITE) {
    const idCasa = idDi[casa.toLowerCase()];
    const idFuori = idDi[fuori.toLowerCase()];
    if (!idCasa) throw new Error(`squadra "${casa}" non fra i partecipanti`);
    if (!idFuori) throw new Error(`squadra "${fuori}" non fra i partecipanti`);

    const d = await chiama(`/gaming/v1/teamLineup/${COMPETIZIONE}/${ROUND}/${ROUND_SERIE_A}/${idCasa}/${idFuori}`, window.__FT);
    window.__G.push({
        casa, fuori, res: d.res, totCasa: d.home.tot, totFuori: d.away.tot,
        home: lato(d.home), away: lato(d.away)
    });
}

JSON.stringify(window.__G.map((g, i) => ({
    i, partita: `${g.casa}-${g.fuori}`, res: g.res, punti: `${g.totCasa}-${g.totFuori}`
})));

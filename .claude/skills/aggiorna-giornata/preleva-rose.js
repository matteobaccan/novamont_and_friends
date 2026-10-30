// Prende nome, ruolo e squadra di Serie A dei giocatori nuovi, dalla pagina
// Rose della lega. Serve quando calcola-giornata.mjs si ferma elencando dei
// pid che non sono nel dizionario "players": sono acquisti di mercato.
//
// L'API delle formazioni non li porta: /gaming/v1/teamLineup restituisce solo
// pid, scr, cscr, ptype e b. L'anagrafica sta solo nella pagina Rose, che è
// servita già scritta dal server, quindi basta leggere il DOM: nessun token,
// nessuna chiamata.
//
// 1. Apri https://leghe.fantacalcio.it/<lega>/rose
// 2. Metti in PID i pid segnalati da calcola-giornata.mjs e incolla tutto.
// 3. Salva l'oggetto stampato in un file e passalo a aggiungi-giocatori.mjs.
//
// Senza PID li prende tutti: l'uscita è lunga e il canale che la riporta la
// taglia, quindi si usa solo per ricostruire il dizionario da zero, leggendola
// dalla console del browser invece che da qui.

const PID = [];

// L'href è /squadre/<squadra di Serie A>/<nome>/<pid> e il nome è già scritto
// con la convenzione del dizionario, abbreviazioni comprese ("Paz N."). Il
// testo della cella invece è minuscolo, con il maiuscolo messo dal CSS.
const anagrafica = (tr) => {
    const href = tr.querySelector('a.player-link')?.getAttribute('href') || '';
    const pezzi = new URL(href, location.origin).pathname.split('/').filter(Boolean);
    const i = pezzi.indexOf('squadre');
    if (i < 0 || pezzi.length < i + 4) return null;

    const role = tr.querySelector('td[data-key="role"]')?.dataset.roles || '';
    if (!role) return null;

    return { name: decodeURIComponent(pezzi[i + 2]), role, serieA: decodeURIComponent(pezzi[i + 1]) };
};

const righe = PID.length
    ? PID.map(pid => [pid, document.querySelector(`tr[data-id="${pid}"]`)])
    : [...document.querySelectorAll('tr[data-id]')].map(tr => [Number(tr.dataset.id), tr]);

const players = {};
const persi = [];
for (const [pid, tr] of righe) {
    const dati = tr && anagrafica(tr);
    if (dati) players[pid] = dati; else persi.push(pid);
}

if (persi.length) console.warn('pid non trovati nella pagina Rose:', persi.join(', '));
JSON.stringify(players);

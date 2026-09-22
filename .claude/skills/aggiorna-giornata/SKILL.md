---
name: aggiorna-giornata
description: Use when adding a new matchday (giornata) to the Novamont & Friends fantacalcio site, updating results, or recomputing ideal scores - triggers on "aggiungi la giornata N", "aggiorna il sito col risultato", "inserisci i risultati", "ricalcola gli ideali".
---

# Aggiornare una giornata del sito fantacalcio

Legge una giornata dal sito della lega, calcola i punteggi ideali e la scrive in
`data/<stagione>.json`. Classifica, classifica ideale e statistiche allenatori sono
derivate dai risultati: **non vanno mai scritte a mano**.

## Procedura

### 1. Capire quale giornata inserire

```bash
node -e "const i=require('./data/seasons.json');const d=require('./'+i.seasons.find(s=>s.id===i.currentSeason).file);console.log(i.currentSeason,'- ultima giornata:',d.rounds.at(-1)?.round ?? 0)"
```

La prossima giornata è quella successiva. Gli URL della lega stanno in
`data/seasons.json` sotto `seasons[].source`.

### 2. Leggere le partite dalla lega

Servono le **quattro** pagine partita, con il browser (`mcp__claude-in-chrome`):
`roundUrl` con `{round}` = numero giornata e `{match}` = `0`, `1`, `2`, `3`.

`get_page_text` su ognuna. Ogni pagina dà, in ordine:

1. squadra di casa, allenatore, modulo, gol, punteggio — poi gli stessi dati della trasferta
2. **11 titolari di casa**, poi **11 titolari di trasferta**
3. dopo la riga `Panchina`, le due panchine (mescolate)
4. in fondo: `Totale parziali`, `solo voti`, `fattore campo`, `con bonus/malus`

Per ogni giocatore ci sono **due numeri**: il voto puro e il **voto con bonus/malus**.
Usa **sempre il secondo**. Chi non ha giocato non ha numeri, chi è `s.v.` non ha
punteggio: in entrambi i casi **omettilo**.

> Non serve distinguere casa da trasferta nelle panchine: lo script separa i
> giocatori confrontandoli con le rose, e si ferma se un nome non torna.

### 3. Scrivere l'estratto

Un file JSON temporaneo (mettilo nella scratchpad, non nel repo):

```json
{
  "round": 2,
  "date": "Settembre 2026",
  "lastUpdate": "29 Settembre 2026, 12:00",
  "golAttesi": [[2,1],[3,1],[1,1],[3,4]],
  "generalComment": "...",
  "matches": [
    {
      "homeTeam": "Real Pattagghiu",
      "awayTeam": "Real Ichnusa",
      "homeScore": 75.5,
      "awayScore": 70,
      "players": [
        { "name": "Mandas", "score": 10.5 },
        { "name": "Maignan", "score": 6 }
      ],
      "commentary": { "caressa": "...", "bergomi": "..." }
    }
  ]
}
```

| Campo | Da dove arriva |
|---|---|
| `homeScore` / `awayScore` | riga `con bonus/malus` — per la squadra di casa **include già** il fattore campo |
| `players[].score` | il **secondo** numero di ogni giocatore (voto con bonus/malus) |
| `golAttesi` | i gol mostrati dalla lega, `[[casa,trasferta], ...]`; servono come controllo |
| `date` | mese e anno, nello stile delle giornate già presenti |

`season` è facoltativo: senza, si usa `currentSeason`.

### 4. Calcolare e scrivere

```bash
node .claude/skills/aggiorna-giornata/calcola-giornata.mjs <estratto.json> --dry-run
```

Lo script stampa gol, punteggi reali e ideali, e il modulo scelto per l'ideale.
**Controlla l'output prima di scrivere.** Poi rilancia senza `--dry-run`.

### 5. Verificare

```bash
node -e "const d=require('./data/2026-2027.json');const r=d.rounds.at(-1);console.log('g'+r.round,r.matches.length+' match',r.matches.every(m=>m.commentary)?'commenti ok':'COMMENTI MANCANTI')"
```

Poi confronta la classifica del sito con quella della lega (`standingsUrl`):
punti e punti totali devono coincidere per tutte le squadre.

## Come si calcola il punteggio ideale

Miglior 11 possibile **da tutta la rosa** (titolari + panchina), scegliendo anche il
modulo migliore fra `3-4-3 3-5-2 4-3-3 4-4-2 4-5-1 5-3-2 5-4-1`. Solo i giocatori con
un voto sono selezionabili.

**Il punteggio ideale va nel JSON senza fattore campo.** Il `+1` di casa lo aggiunge
`script.js` quando calcola gol e punti persi — vedi `BONUS_CASA.md`. Sommarlo qui lo
conterebbe due volte.

I ruoli vengono dalla chiave `rosters` di `data/<stagione>.json`. Dopo il mercato vanno
riallineati dalla pagina Rose (`rosterUrl`), altrimenti lo script si ferma sui nomi
sconosciuti.

## Commenti Caressa / Bergomi

Uno per partita, più un `generalComment` di giornata. Stile delle giornate già presenti:

- **Caressa**: entusiasta, presente, esclamazioni; cita il risultato e il protagonista di giornata
- **Bergomi**: analitico, si rivolge a "Fabio", guarda ai dettagli — un voto basso, un big lasciato in panchina — e cita quasi sempre *"con le formazioni ideali sarebbe finita X-Y"*

Per quel dato servono i gol ideali, con il bonus casa applicato:
`Math.floor((punteggio - 60) / 6)`, a zero sotto 66. Se il risultato ideale è di parità
ma i punti distano ≥ 4, chi ha più punti prende un gol in più.

Cita solo numeri che hai davvero letto. Un voto inventato è indistinguibile da uno vero.

## Errori comuni

| Sintomo | Causa |
|---|---|
| `non in rosa né di X né di Y` | refuso nel nome, o `rosters` da riallineare dopo il mercato |
| `i gol non coincidono` | hai preso `solo voti` invece di `con bonus/malus` |
| Ideale più basso del reale | hai usato il primo numero (voto puro) invece del secondo |
| Ideale di casa troppo alto di 1 | hai sommato il fattore campo, che va lasciato a `script.js` |
| `la giornata N esiste già` | rimuovila dal JSON prima di reinserirla |
| Classifica diversa da quella della lega | `homeScore` senza il fattore campo incluso |

## Dopo la scrittura

Serve un `git add` dei file in `data/`. Il sito è statico: nessun build, nessun deploy
manuale — il push su `main` basta.

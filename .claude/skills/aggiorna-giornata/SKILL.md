---
name: aggiorna-giornata
description: Use when adding a new matchday (giornata) to the Novamont & Friends fantacalcio site, updating results, recomputing ideal scores, or refreshing rosters - triggers on "aggiungi la giornata N", "aggiorna il sito col risultato", "inserisci i risultati", "ricalcola gli ideali".
---

# Aggiornare una giornata del sito fantacalcio

Scarica una giornata dall'API della lega, calcola i punteggi ideali e la scrive in
`data/<stagione>.json`. Classifica, classifica ideale, statistiche allenatori, rose e
classifiche marcatori sono tutte **derivate** dai risultati: non vanno mai scritte a mano.

## Prima di iniziare

Serve il token della lega in `FANTA_TOKEN`. **Non va messo in un file del repo**, che è
pubblico: passalo da variabile d'ambiente. Si ricava dall'header `authorization` di una
qualsiasi chiamata a `apileague.fantacalcio.it` fatta dal browser loggato, e dura un anno.

## Procedura

### 1. Capire quale giornata inserire

```bash
node -e "const i=require('./data/seasons.json');const d=require('./'+i.seasons.find(s=>s.id===i.currentSeason).file);console.log(i.currentSeason,'- ultima giornata:',d.rounds.at(-1)?.round ?? 0)"
```

Gli URL della lega stanno in `data/seasons.json` sotto `seasons[].source`.

### 2. Leggere gli accoppiamenti dal calendario

Il calendario non è esposto via API: va letto dalla pagina `calendario` della lega con il
browser (`mcp__claude-in-chrome`). Serve sapere, per la giornata, **chi gioca in casa con
chi** e a quale **giornata di Serie A** corrisponde (il calendario la indica fra parentesi:
"1ª GIORNATA (5ª giornata di Serie A)").

### 3. Scaricare la giornata

Prepara un input nella scratchpad — non nel repo:

```json
{
  "competizione": 805779,
  "round": 2,
  "roundSerieA": 6,
  "date": "Settembre 2026",
  "lastUpdate": "29 Settembre 2026, 12:00",
  "partite": [
    ["Real Ichnusa", "SM Frattese"],
    ["Cusiana", "Ultimo"],
    ["PARTIZAN TIRANA", "Team24"],
    ["Shakhtar Donuts", "Real Pattagghiu"]
  ]
}
```

I nomi possono essere scritti come li scrive la lega: vengono normalizzati sul nome
canonico della stagione. Gli id squadra si risolvono da soli via API.

```bash
FANTA_TOKEN=... node .claude/skills/aggiorna-giornata/scarica-giornata.mjs <input.json> > <estratto.json>
```

Se stampa `ATTENZIONE, decodifica eventi non pulita`, **fermati**: significa che un
evento non è spiegato dalla tabella dei pesi (vedi sotto). Marcatori e cartellini
sarebbero sbagliati.

### 4. Scrivere i commenti

Aggiungi all'estratto `generalComment` e, per ogni match, `commentary`. Vedi più sotto.

### 5. Calcolare e scrivere

```bash
node .claude/skills/aggiorna-giornata/calcola-giornata.mjs <estratto.json> --dry-run
```

Stampa gol, punteggi reali e ideali, il modulo scelto per l'ideale e gli eventuali
cambi di rosa. **Controlla l'output**, poi rilancia senza `--dry-run`.

### 6. Verificare

Confronta la classifica del sito con quella della lega (`standingsUrl`): punti e punti
totali devono coincidere per tutte le squadre.

## Come si calcola il punteggio ideale

Miglior 11 possibile **da tutta la rosa** (titolari + panchina), scegliendo anche il
modulo migliore fra `3-4-3 3-5-2 4-3-3 4-4-2 4-5-1 5-3-2 5-4-1`. Solo i giocatori con un
voto sono selezionabili.

**Nel JSON va senza fattore campo.** Il `+1` di casa lo aggiunge `script.js` quando
calcola gol e punti persi (vedi `BONUS_CASA.md`). Sommarlo qui lo conterebbe due volte.

## Il campo `b` delle formazioni

L'API restituisce per ogni giocatore `scr` (voto), `cscr` (voto con bonus) e `b`, una
stringa di 16 slot con gli eventi. I pesi sono in `EVENTI` dentro `scarica-giornata.mjs`,
ricavati dai dati isolando i giocatori con un solo slot attivo.

Lo script **verifica ogni giocatore**: la somma dei pesi deve spiegare esattamente
`cscr - scr`. Se un giorno comparisse un evento mai visto (espulsione, autogol), la
verifica fallisce e lo segnala invece di inventare un risultato. Quando succede: isola i
giocatori con quello slot da solo, ricava il peso dividendo il delta per il conteggio,
aggiorna `EVENTI` e rilancia.

Due sentinelle, entrambe con `cscr = 100`: `scr 55` = senza voto (s.v.), `scr 56` = non
ha giocato.

## Rose che cambiano

Le rose cambiano durante la stagione. `data/<stagione>.json` tiene:

- `players`: dizionario globale `pid → nome, ruolo, squadra di Serie A`
- `rosterHistory`: snapshot con `fromRound`, scritti **solo quando la rosa cambia**

`calcola-giornata.mjs` confronta la rosa della giornata con l'ultimo snapshot e ne
aggiunge uno nuovo se serve. Le formazioni non coprono sempre l'intera rosa (una squadra
può lasciarne fuori uno), quindi conta solo chi **compare** e non risultava presente.

Se un `pid` non è in `players`, lo script si ferma: è un acquisto nuovo e va aggiunto
leggendo la pagina Rose della lega, dove ogni riga ha il `pid` come attributo `data-id`.

## Commenti Caressa / Bergomi

Uno per partita, più un `generalComment` di giornata. Stile delle giornate già presenti:

- **Caressa**: entusiasta, presente, esclamazioni; cita il risultato e il protagonista
- **Bergomi**: analitico, si rivolge a "Fabio", guarda ai dettagli — un voto basso, un
  big lasciato in panchina — e cita quasi sempre *"con le formazioni ideali sarebbe
  finita X-Y"*

Per i gol ideali: `Math.floor((punteggio - 60) / 6)`, zero sotto 66, col bonus casa
applicato. Se il risultato ideale è di parità ma i punti distano ≥ 4, chi ha più punti
prende un gol in più.

Cita solo numeri che hai davvero letto. Un voto inventato è indistinguibile da uno vero.

## Errori comuni

| Sintomo | Causa |
|---|---|
| `manca la variabile d'ambiente FANTA_TOKEN` | token non passato, o scaduto (dura un anno) |
| `ATTENZIONE, decodifica eventi non pulita` | evento nuovo non in `EVENTI`: va aggiunto il peso |
| `pid non presenti nel dizionario "players"` | acquisto nuovo: aggiorna `players` dalla pagina Rose |
| `squadra "X" non presente fra le squadre` | nome che non esiste nella stagione, o squadra fuori competizione |
| `i gol non coincidono` | `roundSerieA` sbagliato: hai scaricato un'altra giornata |
| `la giornata N esiste già` | rimuovila dal JSON prima di reinserirla |
| Classifica diversa da quella della lega | `homeScore` deve includere il fattore campo, come lo dà l'API |

## Probabili formazioni

Il suggeritore usa le probabili formazioni di Serie A per pesare quanto è probabile che
un giocatore scenda in campo. Sono un'istantanea della **prossima** giornata, non storico:
vanno riscaricate ogni settimana, prima che si giochi.

```bash
node .claude/skills/aggiorna-giornata/scarica-probabili.mjs
```

La pagina è pubblica, non serve token. Lo script scrive `data/probabili.json` con, per
ogni giocatore, la percentuale di titolarità e se è fra i probabili titolari. I giocatori
sono identificati con lo stesso id globale Fantacalcio usato altrove, quindi il match è
esatto: l'ultima verifica copriva 195 dei 200 giocatori della lega.

Se stampa `ATTENZIONE, squadre senza 11 titolari` le probabili non sono ancora complete
(succede a inizio settimana): il file resta valido ma il suggerimento è più debole.
Se si ferma con `nessuna squadra trovata`, la pagina ha cambiato struttura e vanno riviste
le espressioni regolari in `scarica-probabili.mjs`.

## Dopo la scrittura

`git add` dei file in `data/`. Il sito è statico: nessun build, il push su `main` basta.
Se hai cambiato `script.js`, `styles.css` o `config.js`, alza la versione nel query
string di `index.html` e in `sw.js`, altrimenti chi torna sul sito riceve i file vecchi.

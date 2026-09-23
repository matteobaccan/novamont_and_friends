---
name: aggiorna-giornata
description: Use when adding a new matchday (giornata) to the Novamont & Friends fantacalcio site, updating results, recomputing ideal scores, or refreshing rosters - triggers on "aggiungi la giornata N", "aggiorna il sito col risultato", "inserisci i risultati", "ricalcola gli ideali".
---

# Aggiornare una giornata del sito fantacalcio

Scarica una giornata dall'API della lega, calcola i punteggi ideali e la scrive in
`data/<stagione>.json`. Classifica, classifica ideale, statistiche allenatori, rose e
classifiche marcatori sono tutte **derivate** dai risultati: non vanno mai scritte a mano.

**Se il sito è rimasto indietro di più giornate, si recuperano una alla volta e in ordine
crescente.** Con la lega alla 5 e il sito alla 2: prima si porta a casa la 3 tutta intera,
poi la 4, poi la 5. Non è pignoleria — `calcola-giornata.mjs` si rifiuta di scrivere una
giornata se ne manca una prima, e il perché sta in *Rose che cambiano*.

## Prima di iniziare

Serve il token della lega in `FANTA_TOKEN`. **Non va messo in un file del repo**, che è
pubblico: passalo da variabile d'ambiente. Si ricava dall'header `authorization` di una
qualsiasi chiamata a `apileague.fantacalcio.it` fatta dal browser loggato, e dura un anno.

## Procedura

### 0. Capire quante giornate mancano

Prima di tutto, guarda sul calendario della lega **a che giornata è arrivata** (l'ultima
con i risultati), poi:

```bash
node .claude/skills/aggiorna-giornata/giornate-mancanti.mjs --fino-a <giornata della lega>
```

Stampa quelle presenti, quelle che mancano e da quale ricominciare. Senza `--fino-a`
guarda solo i buchi fra quelle che ci sono già.

```
Stagione 2026-2027 (data/2026-2027.json)
  presenti: 1, 2
  mancanti: 3, 4, 5

  Si fanno UNA ALLA VOLTA e IN ORDINE CRESCENTE: prima la 3.
```

**Da qui in avanti i passi da 1 a 6 sono un ciclo**: si ripetono per intero su una
giornata sola, la più bassa fra quelle mancanti. Si passa alla successiva **solo dopo**
che il passo 6 ha confermato che quella è scritta e torna. Niente scorciatoie tipo
scaricare tutte le giornate e poi calcolarle in blocco: ogni giornata legge lo stato
lasciato dalla precedente.

Gli URL della lega stanno in `data/seasons.json` sotto `seasons[].source`.

### 1. La giornata di questo giro

È la più bassa fra le mancanti del passo 0. Tienila a mente: serve in tutti i passi
seguenti, e nell'input del passo 3 è il campo `round`.

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

### 6. Verificare, poi passare alla prossima

Confronta la classifica del sito con quella della lega (`standingsUrl`): punti e punti
totali devono coincidere per tutte le squadre.

Se stai recuperando più giornate, la classifica della lega è quella di **oggi**, cioè
dopo l'ultima giocata: coinciderà solo quando le avrai inserite tutte. Nel frattempo il
controllo utile è un altro:

```bash
node .claude/skills/aggiorna-giornata/giornate-mancanti.mjs --fino-a <giornata della lega>
```

La giornata appena fatta deve essere sparita dalle mancanti. Se ne restano, si ricomincia
dal passo 1 con la più bassa. Quando non ne resta nessuna, allora si confronta la
classifica con quella della lega.

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

**Ed è per questo che le giornate si inseriscono in ordine.** Ogni snapshot è costruito
sopra il precedente: scrivendo la 5 quando manca ancora la 3, lo snapshot della 5 nasce
da quello della 2 e resta senza chi è arrivato alla 3 e alla 5 non ha giocato. Lo script
si ferma da solo se trova un buco prima della giornata che gli stai passando.

L'unico caso in cui ha senso forzare è un recupero vero — una partita rinviata e giocata
dopo le giornate successive. Lì si passa `--forza`, e si controlla a mano che le rose
siano rimaste giuste.

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

## Dati di Serie A per il suggeritore

**Di norma non serve lanciarlo a mano**: il workflow `.github/workflows/probabili.yml` lo
esegue giovedì, venerdì e sabato mattina e committa il risultato. Serve solo per anticipare
l'Action, tipicamente prima di un turno infrasettimanale.

```bash
node .claude/skills/aggiorna-giornata/scarica-probabili.mjs [--dry-run]
```

Le pagine sono pubbliche, non serve token. Lo script scrive `data/probabili.json`, che è
un'istantanea della **prossima** giornata e non storico, con:

| Chiave | Da dove viene | A cosa serve |
|---|---|---|
| `giocatori` | probabili formazioni | percentuale di titolarità, per pesare "gioca" |
| `rigoristi` | pagina rigoristi | spareggio a parità di punteggio atteso |
| `infortunati` | pagina infortunati | chi non schierare, con il motivo |
| `classificaSerieA`, `prossimoTurno`, `formaSerieA` | widget e calendario | il contesto della partita |

Giocatori e rigoristi portano il pid nell'href, quindi combaciano esattamente con
`data/<stagione>.json`. Gli **infortunati no**: quella pagina non espone id, quindi si
salvano nome e squadra e l'abbinamento alla rosa lo fa il browser, che ha già l'anagrafica.

Se stampa `ATTENZIONE, squadre senza 11 titolari` le probabili non sono ancora complete
(succede a inizio settimana): il file resta valido ma il suggerimento è più debole.
Se si ferma con `nessuna squadra trovata`, la pagina ha cambiato struttura e vanno riviste
le espressioni regolari in `scarica-probabili.mjs`. Se invece a mancare è una delle altre
chiavi, lo script si limita a un warning: sono rifiniture, e il suggeritore regge lo stesso.

## Dopo la scrittura

`git add` dei file in `data/`. Il sito è statico: nessun build, il push su `main` basta.
Se hai cambiato `script.js`, `styles.css` o `config.js`, alza la versione nel query
string di `index.html` e in `sw.js`, altrimenti chi torna sul sito riceve i file vecchi.

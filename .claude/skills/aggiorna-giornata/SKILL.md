---
name: aggiorna-giornata
description: Use when adding a new matchday (giornata) to the Novamont & Friends fantacalcio site, updating results, recomputing ideal scores, or refreshing rosters - triggers on "aggiungi la giornata N", "aggiorna il sito col risultato", "inserisci i risultati", "ricalcola gli ideali".
---

# Aggiornare una giornata del sito fantacalcio

Converte una giornata della lega, presa da pagine salvate a mano, calcola i punteggi ideali e la scrive in
`data/<stagione>.json`. Classifica, classifica ideale, statistiche allenatori, rose e
classifiche marcatori sono tutte **derivate** dai risultati: non vanno mai scritte a mano.

**Se il sito è rimasto indietro di più giornate, si recuperano una alla volta e in ordine
crescente.** Con la lega alla 5 e il sito alla 2: prima si porta a casa la 3 tutta intera,
poi la 4, poi la 5. Non è pignoleria — `calcola-giornata.mjs` si rifiuta di scrivere una
giornata se ne manca una prima, e il perché sta in *Rose che cambiano*.

## Prima di iniziare

**Niente accesso automatico a fantacalcio.it.** Fantacalcio consente l'accesso ai suoi
servizi solo dal sito e dalle app ufficiali, in modo manuale: niente API, niente token,
niente script incollati nella pagina, niente browser pilotato (`mcp__claude-in-chrome`).
Le pagine le apre e le salva a mano l'utente (Ctrl+S, «Pagina web completa»); i link stanno nel sito: ogni partita ha il suo nell'angolo alto a destra del box (scheda **Giornate**, anche per le giornate da giocare), il calendario della lega è accanto al titolo della stessa scheda, le probabili formazioni sono nella scheda **Formazione**. La prossima giornata da inserire si apre dal selettore della scheda Giornate, con i suoi box e i suoi link. Si
lavora sui file salvati, o su testo e screenshot incollati in chat.

## Procedura

### 0. Cosa serve, e chiederlo all'utente

Prima di qualunque altra cosa:

```bash
node .claude/skills/aggiorna-giornata/cosa-serve.mjs
```

Dal calendario precaricato sa quali giornate la lega ha già giocato (quelle la cui
giornata di Serie A è finita da almeno due giorni) e le confronta con il sito. Stampa:

- le **giornate giocate ma non ancora sul sito**, e per ognuna le pagine delle partite da
  salvare, una riga per partita con casa, trasferta e link
- la **prossima giornata**, con la giornata di Serie A e la data
- **a quando risalgono le probabili formazioni** in `data/probabili.json` (giorno e ora),
  di che turno sono e se è il turno giusto per la prossima giornata, oppure se sono
  vecchie o se il turno è già cominciato
- in fondo, **«Da chiedere all'utente»**: l'elenco delle pagine da aprire e salvare

**Quell'elenco va girato all'utente così com'è, e ci si ferma finché non arrivano i
file.** Non si va a cercare le pagine da soli: le apre e le salva lui. Se lo script dice
che è tutto aggiornato, lo si dice all'utente e non c'è altro da fare. Se l'utente ha
già passato dei file, si controlla con lo stesso elenco che ci siano tutti: una giornata
vuole le pagine di **tutte** le sue partite.

Esempio, a giornata 7 giocata e probabili vecchie:

```
Da chiedere all'utente (aprire la pagina, Ctrl+S, «Pagina web completa»):
  - Giornata 7 (11ª di Serie A, domenica 8 novembre): le 4 pagine delle partite
    Team24 - Ultimo: https://leghe.fantacalcio.it/novamont-8-friends/view/competition/805779/round/7?i=0
    ...
  - Probabili formazioni del turno 12: https://www.fantacalcio.it/probabili-formazioni-serie-a
```

`--oggi AAAA-MM-GG` fa finta di essere in un altro giorno, per controllare cosa
chiederebbe. Lo stesso elenco di giornate presenti e mancanti, senza calendario, lo dà
`giornate-mancanti.mjs --fino-a <giornata della lega>`:

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

### 2. Gli accoppiamenti dal calendario

Il calendario è **precaricato** in `data/<stagione>.json` (`calendar`, vedi *Calendario
della stagione* più sotto): per ogni giornata dice **chi gioca in casa con chi** e a quale
**giornata di Serie A** corrisponde. Non serve risalvare la pagina del calendario a ogni
giornata: `converti-giornata.mjs` prende gli accoppiamenti da lì se l'input non li indica.

Se la giornata manca dal calendario (stagione nuova, calendario non ancora caricato), si
lancia prima `leggi-calendario.mjs` sulla pagina `calendario` salvata dall'utente.

### 3. Convertire la giornata

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

`partite` si può omettere: lo script la prende dal calendario precaricato e stampa su
stderr gli accoppiamenti che ha usato. Se la si scrive, vince quella. I nomi possono essere
scritti come li scrive la lega: vengono normalizzati sul nome canonico della stagione.

Le formazioni vanno in un file `--grezzo`: un array di partite con `casa`, `fuori`, `res`
e i due lati (`tot`, `starts`, `bench`, con `pid, scr, cscr, ptype, b` per giocatore).

```bash
node .claude/skills/aggiorna-giornata/converti-giornata.mjs <input.json> --grezzo <grezzo.json> > <estratto.json>
```

#### Le pagine delle partite: `leggi-partita.mjs`

Le pagine delle partite salvate a mano (il link è nell'angolo di ogni box della scheda
Giornate) le legge `leggi-partita.mjs`. Dà già squadre, punteggi e formazioni nel formato
di `data/<stagione>.json` (`p, t, v, b, e, sv`), senza passare dal campo `b` a slot:

```bash
node .claude/skills/aggiorna-giornata/leggi-partita.mjs <partita.html> [...]          # JSON delle partite
node .claude/skills/aggiorna-giornata/leggi-partita.mjs <partita.html> [...] --confronta [--giornata N]
```

Con `--confronta` mette ogni partita a fianco di quella già pubblicata (cercata per casa e
trasferta) ed elenca le differenze di punteggio, stato, voto, fantavoto, senza voto ed
eventi. Verificato su Real Pattagghiu-Partizan Tirana della giornata 6: 42 giocatori,
tutto uguale.

Come legge la pagina, in breve: le due colonne dei titolari e le due della panchina sono
casa e trasferta in quest'ordine; chi è attenuato (`opacity-50`) non conta nel
punteggio, quindi un titolare attenuato è `out` e un panchinaro non attenuato è `in`;
gli eventi sono un'icona ciascuno (`data-icon-key`). I pesi delle icone stanno in
`EVENTI_ICONA` e ogni giocatore è verificato come col campo `b`: gli eventi devono
spiegare `fantavoto − voto`. Espulsione, autogol, rigore sbagliato e rigore parato non
sono ancora comparsi in una pagina: alla prima volta il lettore si ferma con
`evento sconosciuto "<icona>"`, e il peso va aggiunto dopo averlo verificato.

Non è ancora agganciato a `calcola-giornata.mjs`: per ora serve a verificare le pagine
salvate, in attesa di usarlo al posto del file `--grezzo`.

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

## Calendario della stagione

Si carica una volta, a inizio stagione (o quando la lega lo cambia):

```bash
node .claude/skills/aggiorna-giornata/leggi-calendario.mjs \
    [--lega <calendario.html>] [--serie-a <serie-a.txt>] [--dry-run]
```

- `--lega`: la pagina `calendario` della lega salvata a mano. Carica le giornate mentre si
  scorre, quindi può non contenerle tutte: quelle mancanti si prendono dal calendario già
  scritto o dalle giornate giocate, e la loro giornata di Serie A dallo scarto fisso fra le
  due numerazioni (nel 2026-2027 è +4). Le giornate giocate devono avere gli stessi
  accoppiamenti del calendario, altrimenti si ferma
- `--serie-a`: un file di testo, una riga per giornata, `N gg/mm/aaaa Casa-Fuori ...` con i
  nomi come in `data/probabili.json` (`Atalanta`, `Inter`...). Il calendario ufficiale esce
  come PDF a immagine, senza testo: va trascritto. Lo script verifica dieci partite per
  giornata, ogni squadra una volta per giornata, ogni accoppiamento casa-fuori una sola
  volta e andata e ritorno completi; un refuso fa quasi sempre saltare uno dei controlli.
  Un riscontro in più: le partite di `prossimoTurno` nelle probabili salvate nella storia
  git devono coincidere con le giornate trascritte

Scrive `calendar` e `calendarioSerieA` in `data/<stagione>.json`; `calcola-giornata.mjs`
li conserva quando riscrive il file.

## Come si calcola il punteggio ideale

Miglior 11 possibile **da tutta la rosa** (titolari + panchina), scegliendo anche il
modulo migliore fra `3-4-3 3-5-2 4-3-3 4-4-2 4-5-1 5-3-2 5-4-1`. Solo i giocatori con un
voto sono selezionabili.

**Uno slot che non si riesce a riempire vale 0**, e il modulo resta valido. Capita quando
una squadra manda una panchina corta e un ruolo resta scoperto: alla giornata 5 il
PARTIZAN TIRANA aveva un solo portiere e due difensori col voto, e nessun modulo chiede
meno di tre difensori. È la stessa cosa che fa la lega col punteggio reale — il titolare
senza voto che non ha un cambio di ruolo in panchina conta zero, non viene saltato.

**Nel JSON va senza fattore campo.** Il `+1` di casa lo aggiunge `script.js` quando
calcola gol e punti persi (vedi `BONUS_CASA.md`). Sommarlo qui lo conterebbe due volte.

**L'ideale non comprende il modificatore di difesa.** Il punteggio reale arriva
dalla lega già modificato, l'ideale si ricostruisce dai voti e quindi no: per questo su una
squadra con la difesa premiata l'ideale può uscire più basso del reale. Non è un errore di
calcolo, ed è il motivo per cui la somma dei voti di una squadra a volte non torna col suo
punteggio. Nei commenti, quindi, non citare somme di voti: cita il punteggio della lega.

## Il campo `b` delle formazioni

Le formazioni portano per ogni giocatore `scr` (voto), `cscr` (voto con bonus) e `b`, una
stringa di 16 slot con gli eventi. I pesi sono in `EVENTI` dentro `converti-giornata.mjs`,
ricavati dai dati isolando i giocatori con un solo slot attivo.

Lo script **verifica ogni giocatore**: la somma dei pesi deve spiegare esattamente
`cscr - scr`. Se un giorno comparisse un evento mai visto (espulsione, autogol), la
verifica fallisce e lo segnala invece di inventare un risultato. Quando succede: isola i
giocatori con quello slot da solo, ricava il peso dividendo il delta per il conteggio,
aggiorna `EVENTI` e rilancia.

Due sentinelle, entrambe con `cscr = 100`: `scr 55` = senza voto (s.v.), `scr 56` = non
ha giocato. **La sentinella è lo `scr`, non il `cscr`**: un fantavoto pari a 0 arriva anche
lui come `cscr = 100` (un portiere da 4 con quattro gol subiti), e il fantavoto può andare
sotto zero. Con un voto vero e un `cscr` fuori scala lo script ricostruisce il fantavoto
dagli eventi, quindi non va corretto a mano.

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

### Gli acquisti di mercato

Se un `pid` schierato non è in `players`, `calcola-giornata.mjs` si ferma ed elenca i pid
con la squadra in cui sono comparsi. Vale per **tutti** gli schierati, non solo per chi ha
preso il voto: il ruolo serve all'ideale, ma il nome serve alla rosa, e un acquisto che
alla sua prima giornata resta in panchina senza giocare entra comunque in `rosterHistory`.
Prima il controllo guardava solo chi aveva un voto, e alla giornata 5 Samardzic è passato
liscio: sul sito sarebbe rimasta una riga senza nome.

Le formazioni danno solo `pid, scr, cscr, ptype, b`: l'anagrafica sta nella pagina Rose
della lega. L'utente la salva a mano; da lì si scrive un file
`{ "<pid>": { name, role, serieA } }` e lo si unisce al dizionario:

```bash
node .claude/skills/aggiorna-giornata/aggiungi-giocatori.mjs <nuovi.json> [--dry-run]
```

Nome e squadra si leggono dall'href del giocatore (`/squadre/<squadra>/<nome>/<pid>`), che
usa già la convenzione del dizionario, abbreviazioni comprese (`Paz N.`); il ruolo sta in
`data-roles`. Il testo della cella no: è minuscolo, con il maiuscolo messo dal CSS.

`aggiungi-giocatori.mjs` aggiunge solo i pid che mancano, quindi lo stesso file si può
ripassare senza fare danni. Se un pid c'è già con dati diversi lo segnala e **non lo
tocca**: un trasferimento di gennaio è vero, ma riscriverlo cambierebbe anche le rose delle
giornate già pubblicate, e quella è una scelta da fare a mano.

Lo snapshot delle rose resta comunque ricavato dalle **formazioni**, non dalla pagina Rose:
la pagina dice com'è la rosa *oggi*, e non servirebbe per ricostruire le giornate passate.

## Commenti Corelli / Bergamotti

Uno per partita, più un `generalComment` di giornata. Stile delle giornate già presenti:

- **Corelli**: entusiasta, presente, esclamazioni; cita il risultato e il protagonista
- **Bergamotti**: analitico, si rivolge a "Fabio", guarda ai dettagli — un voto basso, un
  big lasciato in panchina — e cita quasi sempre *"con le formazioni ideali sarebbe
  finita X-Y"*

Per i gol ideali: `Math.floor((punteggio - 60) / 6)`, zero sotto 66, col bonus casa
applicato. Se il risultato ideale è di parità ma i punti distano ≥ 4, chi ha più punti
prende un gol in più.

Cita solo numeri che hai davvero letto. Un voto inventato è indistinguibile da uno vero.

## Errori comuni

| Sintomo | Causa |
|---|---|
| `ATTENZIONE, decodifica eventi non pulita` | evento nuovo non in `EVENTI`: va aggiunto il peso |
| `pid non presenti nel dizionario "players"` | acquisto nuovo: pagina Rose salvata + `aggiungi-giocatori.mjs` |
| `squadra "X" non presente fra le squadre` | nome che non esiste nella stagione, o squadra fuori competizione |
| `i gol non coincidono` | `roundSerieA` sbagliato: hai convertito un'altra giornata |
| `la giornata N esiste già` | rimuovila dal JSON prima di reinserirla |
| Classifica diversa da quella della lega | `homeScore` deve includere il fattore campo, come lo dà la lega |

## Dati di Serie A per il suggeritore

Si lancia a mano, prima della giornata, sulle pagine delle probabili, dei rigoristi e
degli infortunati salvate dall'utente. Quelle non passate restano come nel
`data/probabili.json` precedente.

```bash
node .claude/skills/aggiorna-giornata/leggi-probabili.mjs \
    [--probabili <probabili.html>] [--rigoristi <rigoristi.html>] \
    [--infortunati <infortunati.html>] [--dry-run]
```

`aggiornato` cambia solo quando si passano le probabili. Lo script scrive `data/probabili.json`, che è
un'istantanea della **prossima** giornata e non storico, con:

| Chiave | Da dove viene | A cosa serve |
|---|---|---|
| `giocatori` | probabili formazioni | percentuale di titolarità, per pesare "gioca" |
| `rigoristi` | pagina rigoristi | spareggio a parità di punteggio atteso |
| `infortunati` | pagina infortunati | chi non schierare, con il motivo |
| `squalificati` | probabili formazioni, sezione per partita | chi non può proprio giocare: probabilità zero |
| `classificaSerieA`, `prossimoTurno` | pagine infortunati e probabili | il contesto della partita; la forma delle squadre il sito la ricava dai voti della lega |

Giocatori, rigoristi e squalificati portano il pid nell'href, quindi combaciano
esattamente con `data/<stagione>.json`. Gli **infortunati no**: quella pagina non espone
id, quindi si salvano nome e squadra e l'abbinamento alla rosa lo fa il browser, che ha
già l'anagrafica.

Gli squalificati stanno nella pagina delle probabili, una sezione per partita con un
blocco per squadra — prima la casa, poi la trasferta. `Squalificati: 0` non è un allarme:
un turno senza squalificati capita davvero.

Se stampa `ATTENZIONE, squadre senza 11 titolari` le probabili non sono ancora complete
(succede a inizio settimana): il file resta valido ma il suggerimento è più debole.

Se si ferma con `nessuna squadra trovata`, il file non è la pagina delle probabili o la pagina ha cambiato struttura e vanno riviste
le espressioni regolari in `leggi-probabili.mjs`. Se invece a mancare è una delle altre
chiavi, lo script si limita a un warning: sono rifiniture, e il suggeritore regge lo stesso.

## Il suggeritore ha avuto ragione?

Dopo `leggi-probabili.mjs` si lancia `salva-consigli.mjs`: salva la formazione
consigliata di ogni squadra per la prossima giornata in
`data/consigli/<stagione>/giornata-<N>.json`. Il file si riscrive finché le probabili
riguardano lo stesso turno di Serie A e nessuna partita è cominciata, poi resta
congelato: è il consiglio che il sito dava prima del fischio.

```bash
node .claude/skills/aggiorna-giornata/salva-consigli.mjs [--dry-run]
```

Ogni consiglio salva anche la previsione per **tutta la rosa** (atteso, resa, media di
ruolo, probabilità di giocare) e i pesi del modello con cui è stato dato.

Il confronto con la realtà lo fa `valuta-consigli.mjs --scrivi`: la valutazione finisce in `data/consigli/<stagione>/valutazione.json` e
il sito la mostra sotto la formazione consigliata. La rifà anche `calcola-giornata.mjs`
appena scrive una giornata: quel file va committato insieme alla giornata. A mano:

```bash
node .claude/skills/aggiorna-giornata/valuta-consigli.mjs [stagione] [--scrivi]
```

Misura due cose:

- **il modello**: errore medio e distorsione della resa prevista, per ruolo, su chi ha
  preso il voto; e il punteggio di Brier della probabilità di giocare (0 perfetto, 0,25
  tirare a indovinare)
- **i fantallenatori**: punti della formazione schierata contro quella consigliata,
  giornate meglio/pari/peggio e titolari in comune. Le formazioni si contano tutte allo
  stesso modo (fantavoto, massimo tre cambi pari ruolo, niente bonus casa né modificatori)

Per scegliere i pesi, `rigioca-consigli.mjs` rifà le giornate valutate con i dati di
allora (giornate precedenti e probabili ripescate dalla storia git) per ogni combinazione
di pesi, e le ordina per punti della formazione consigliata:

```bash
git fetch --unshallow   # serve la storia di data/probabili.json
node .claude/skills/aggiorna-giornata/rigioca-consigli.mjs GIORNATE_PRIOR=2,4,6 PESO_FORMA=0.2,0.4
```

Su poche giornate le differenze sono rumore: aspettare almeno 5-6 giornate valutate prima
di cambiare un peso in `script.js`.

## Dopo la scrittura

`git add` dei file in `data/`. Il sito è statico: nessun build, il push su `main` basta.
Se hai cambiato `script.js`, `styles.css` o `config.js`, alza la versione nel query
string di `index.html` e in `sw.js`, altrimenti chi torna sul sito riceve i file vecchi.

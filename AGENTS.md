# Aggiornare il sito Novamont & Friends

Istruzioni per chi aggiorna i dati del sito, persona o agente. Cosa fa il sito e come sono
fatti i dati sta nel [README](README.md); qui c'è solo come si aggiornano. La procedura
passo per passo di una giornata è nella skill
[`aggiorna-giornata`](.claude/skills/aggiorna-giornata/SKILL.md), con gli script nella
stessa cartella.

## La regola

**Ogni elaborazione si fa su file statici copiati dall'utente.** Fantacalcio.it consente
l'accesso ai suoi servizi solo dal sito e dalle app ufficiali, in modo manuale. Quindi:

- nessuno script va in rete, su fantacalcio.it o altrove: niente richieste HTTP, niente
  API, niente browser pilotato o headless
- le pagine le apre l'utente nel suo browser e le salva con Ctrl+S come «Pagina web
  completa»; gli script leggono solo quei file
- in questo repo non si descrive come ci si autentica a fantacalcio.it o ad altri siti

I test girano su frammenti di pagine salvate in `test/fixture`, e anche loro non vanno
in rete.

## Da dove si parte: cosa serve

```bash
node .claude/skills/aggiorna-giornata/cosa-serve.mjs
```

Dice quali giornate la lega ha già giocato ma mancano sul sito, con il link alla pagina di
ogni partita, qual è la prossima giornata e a quando risalgono le probabili formazioni. In
fondo stampa l'elenco **«Da chiedere all'utente»**: quello si gira all'utente, e si aspetta
che salvi le pagine prima di andare avanti.

I link stanno anche nel sito:

- **la pagina di una partita**: l'angolo in alto a destra del suo box, nella scheda
  Giornate, anche per le giornate da giocare
- **il calendario della lega**: accanto al titolo della scheda Giornate
- **le probabili formazioni**: nella scheda Formazione, accanto a quando sono state
  salvate l'ultima volta

## Una giornata

Le giornate si inseriscono **una alla volta e in ordine crescente**: ogni giornata parte
dalle rose lasciate da quella prima. In breve:

1. le pagine delle partite della giornata, salvate dall'utente, le legge
   `leggi-partita.mjs` (con `--confronta` le verifica contro una giornata già pubblicata)
2. `converti-giornata.mjs` prepara l'estratto; gli accoppiamenti li prende dal calendario
3. si scrivono i commenti di Corelli e Bergamotti
4. `calcola-giornata.mjs` calcola i punteggi ideali e scrive la giornata in
   `data/<stagione>.json`, rifacendo anche la valutazione dei consigli
5. la classifica del sito deve coincidere con quella della lega

Classifiche, rose e statistiche si ricalcolano dai risultati: non si scrivono mai a mano.
I dettagli, gli errori comuni e come si trattano gli acquisti di mercato sono nella skill.

## Prima di una giornata: probabili e consiglio

```bash
node .claude/skills/aggiorna-giornata/leggi-probabili.mjs \
    [--probabili <probabili.html>] [--rigoristi <rigoristi.html>] \
    [--infortunati <infortunati.html>] [--dry-run]
node .claude/skills/aggiorna-giornata/salva-consigli.mjs [--dry-run]
```

Le pagine da salvare sono le
[probabili formazioni](https://www.fantacalcio.it/probabili-formazioni-serie-a) e, quando
cambiano, [rigoristi](https://www.fantacalcio.it/rigoristi-serie-a) e
[infortunati](https://www.fantacalcio.it/infortunati-serie-a). Quello che non si passa
resta com'era in `data/probabili.json`. Il consiglio salvato si riscrive finché il turno non
comincia, poi resta congelato: è quello con cui il sito viene giudicato.

## Il calendario

Si carica una volta, a inizio stagione, o quando la lega lo cambia:

```bash
node .claude/skills/aggiorna-giornata/leggi-calendario.mjs \
    [--lega <calendario.html>] [--serie-a <serie-a.txt>] [--dry-run]
```

- `--lega` è la pagina *calendario* della lega salvata a mano; le giornate che la pagina
  non contiene si recuperano da quelle già giocate
- `--serie-a` è un file di testo con una riga per giornata
  (`11 08/11/2026 Cagliari-Frosinone Fiorentina-Juventus ...`), trascritto dal calendario
  ufficiale, che esce come PDF a immagine

Prima di scrivere lo script controlla che ogni squadra giochi una volta per giornata e che
nessun accoppiamento si ripeta: un errore di trascrizione si ferma lì.

## Una stagione nuova

1. Crea `data/<nuova-stagione>.json` con `lastUpdate`, `season`, `teams`, `rounds: []` e
   `settings`, copiando la struttura da una stagione esistente.
2. Aggiungi la stagione **in cima** all'array `seasons` di `data/seasons.json`, con il suo
   `source` (indirizzi delle pagine della lega; `matchIndexBase` è 0, perché la lega conta
   le partite da zero), aggiorna `currentSeason` e porta la vecchia stagione a
   `"status": "archived"`.
3. Precarica il calendario con `leggi-calendario.mjs`.

Il nome del file deve rispettare il formato `AAAA-AAAA.json`, richiesto dalla whitelist in
`.htaccess`. Nessuna modifica al codice è necessaria.

## Dopo ogni modifica

- `node --test "test/**/*.test.mjs"` deve passare
- se cambiano `script.js`, `styles.css`, `config.js` o `rigiocala.js`, va alzata la
  versione nel query string di `index.html` e in `sw.js`, altrimenti chi torna sul sito
  riceve i file vecchi
- `git add` dei file in `data/`: il sito è statico, il push su `main` basta
- i file salvati dall'utente non vanno nel repo

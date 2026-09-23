# 7. Test automatici

## Il problema

Circa 3300 righe di JavaScript e tre script di scraping, senza un test. Due cose
rendono la situazione peggiore di quanto sembri:

1. **Lo scraper gira da solo in una GitHub Action**, due volte al giorno, e
   committa il risultato. Se fantacalcio.it cambia impaginazione, i parser
   restituiscono meno dati e il suggeritore peggiora **in silenzio**. Il
   controllo di plausibilità nel workflow prende solo il caso limite: zero
   squadre o meno di 300 giocatori.
2. **Le regole della lega sono aritmetica pura** — conversione punteggio/gol,
   bonus casa, saldo bonus/malus, punti di merito — cioè esattamente il tipo di
   codice che un test copre bene e una rilettura copre male.

## Cosa testare, in ordine di resa

### A. Le regole di calcolo (nessuna dipendenza, valore immediato)

`calculateGoalsFromScore` — la regola è: primo gol a 66, poi uno ogni 6 punti.

| Punteggio | Gol attesi |
|-----------|-----------|
| 60 | 0 |
| 65.5 | 0 |
| 66 | 1 |
| 71.5 | 1 |
| 72 | 2 |
| 78 | 3 |
| 84 | 4 |

Il confine a 66 è quello che vale davvero: `Math.floor((66 - 60) / 6)` dà 1, ma
`Math.floor((65 - 60) / 6)` dà 0 anche senza la guardia esplicita. Il test deve
coprire 60, 65.5, 66 perché è lì che una riscrittura sbaglia.

`calculateMatchGoals` — la regola del pareggio con scarto ≥ 4:

| Casa | Fuori | Atteso | Perché |
|------|-------|--------|--------|
| 70 | 70 | 1-1 | pari, scarto 0 |
| 71 | 68 | 1-1 | pari, scarto 3, sotto soglia |
| 72 | 68 | 3-1 → verificare | pari in gol, scarto 4, +1 alla casa |
| 84 | 66 | 4-1 | gol già diversi, nessun aggiustamento |

`calcolaStatisticheGiocatori` — il saldo `b - v` in panchina, che è la base
della classifica Incompresi: una formazione finta con un panchinaro da `v: 6`,
`b: 9` deve dare `3`.

`puntiMeritoDiGiornata` — la scala Formula 1 e la divisione a parimerito:

- otto punteggi distinti → `[25, 18, 15, 12, 10, 8, 6, 4]`
- due appaiati al secondo posto → `16.5` a testa, e il terzo scende a 12
- **invariante**: il monte punti distribuito è sempre uguale alla somma dei
  primi N valori della scala, comunque siano distribuiti i pareggi. Questo
  singolo test copre tutte le combinazioni di parimerito.

### B. I parser dello scraper (il rischio vero)

`scarica-probabili.mjs` estrae probabili, rigoristi, infortunati e calendario da
HTML. Il test non deve chiamare la rete: si salva **un frammento reale di
pagina** come fixture in `test/fixture/` e si verifica che il parser ne ricavi i
campi attesi.

Una fixture per pagina, tenuta corta: le prime due squadre delle probabili, tre
rigoristi, tre infortunati con entità HTML dentro (`Bernab&#xE8;`), perché la
decodifica delle entità è già stata un bug e senza test lo ridiventa.

Il test che conta non è «estrae 20 squadre»: è «da questo HTML estrae *questi*
giocatori con *queste* percentuali». Il primo si rompe quando cambia la Serie A,
il secondo quando si rompe il parser.

### C. Il resto

Le viste (`displayStandings` e compagnia) producono HTML da dati: testarle
richiede un DOM finto e rende poco. Meglio lasciarle fuori e tenere i test sulle
funzioni di calcolo, che è dove stanno le regole.

## Come si mette in piedi

`node --test`, che è nel runtime dal 18 e non aggiunge dipendenze. Il vincolo è
che `script.js` non esporta niente: è uno script da `<script>`, con tutto nel
global.

Due strade:

1. **Estrarre le funzioni pure in `regole.js`**, caricato da `index.html` prima
   di `script.js` e importabile dai test con un piccolo wrapper. Pulito, ma
   tocca file esistenti.
2. **Leggere `script.js` e valutarlo in un contesto `node:vm`** nel test,
   prendendo le funzioni dal contesto. Zero modifiche al sito, un po' di
   attrezzatura nel test.

La prima è migliore se si accetta di spostare codice; la seconda permette di
partire subito senza toccare niente. Gli script dello scraper sono già moduli
ES: si importano e basta.

```
test/
├── regole.test.mjs        # A
├── parser.test.mjs        # B
└── fixture/
    ├── probabili.html
    ├── rigoristi.html
    └── infortunati.html
```

E una Action che gira `node --test test/` su ogni push e su ogni pull request.

## Casi limite

- **Le fixture invecchiano.** Vanno datate in un commento e rigenerate quando un
  test fallisce per un cambio reale del sito, non aggiustate finché passano.
- **Niente rete nei test**, mai: un test che chiama fantacalcio.it fallisce di
  venerdì sera per motivi che non c'entrano col codice.
- **I decimali.** I punteggi sono `x.5` e i punti di merito possono essere
  `16.5`: confrontare con tolleranza dove si sommano molti valori, non con
  uguaglianza stretta.

## Come si verifica

- `node --test test/` passa in locale e in CI.
- Rompendo di proposito la soglia in `calculateGoalsFromScore` (66 → 65) almeno
  un test fallisce.
- Cambiando una percentuale nella fixture delle probabili, il test del parser
  fallisce con un messaggio che dice quale giocatore.

## Fuori scope

Test end-to-end con un browser vero, e copertura come obiettivo numerico: qui
servono pochi test sulle regole che nessuno rilegge, non una percentuale da
esibire.

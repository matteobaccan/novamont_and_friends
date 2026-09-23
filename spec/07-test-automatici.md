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

Attenzione a cosa protegge davvero la guardia `if (score < 66) return 0`. Non il
confine dei 66: lì ci arriva la formula da sola, perché `Math.floor((65.9 - 60) / 6)`
fa già 0. Quello che impedisce sono i **gol negativi** sotto i 60 punti, dove
`Math.floor((0 - 60) / 6)` darebbe −10. Quindi il test deve coprire 0 e 59,5
oltre a 65,9 e 66: cambiare la soglia da 66 a 65 non rompe niente (provato), ma
togliere la guardia sì.

`calculateMatchGoals` — la regola del pareggio con scarto ≥ 4:

| Casa | Fuori | Atteso | Perché |
|------|-------|--------|--------|
| 70 | 70 | 1-1 | pari, scarto 0 |
| 71 | 68 | 1-1 | pari, scarto 3, sotto soglia |
| 72 | 75 | 2-2 | pari, scarto 3, sotto soglia |
| 76 | 72 | 3-2 | pari in gol, scarto 4, +1 alla casa |
| 72 | 68 | 2-1 | scarto 4 ma i gol non pareggiano: la soglia non c'entra |
| 84 | 66 | 4-1 | gol già diversi, nessun aggiustamento |

L'ultima coppia è la trappola: 72 e 68 distano esattamente 4 punti, ma valgono
2 gol e 1, quindi la regola del pareggio non si applica. Chi legge il
regolamento in fretta si aspetta un 3-1.

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

- `node --test "test/**/*.test.mjs"` passa in locale e in CI.
- Togliendo la guardia in `calculateGoalsFromScore` almeno un test fallisce
  (cambiarne solo la soglia da 66 a 65 invece non rompe niente: la formula dà
  comunque 0 in quell'intervallo).
- Cambiando un nome nella fixture dei rigoristi, il test del parser fallisce e
  dice quale nome si aspettava.

## Fuori scope

Test end-to-end con un browser vero, e copertura come obiettivo numerico: qui
servono pochi test sulle regole che nessuno rilegge, non una percentuale da
esibire.

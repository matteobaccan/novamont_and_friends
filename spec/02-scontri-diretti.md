# 2. Scontri diretti

## Il problema

Il sito dice come è andata la stagione, ma non come è andata *fra due squadre
precise*. In una lega che gioca da anni la domanda ricorrente è sempre quella:
«con lui come siamo messi?». Oggi si risponde solo scorrendo le giornate a mano.

## I dati

Tutto in `fantacalcioData.rounds`, già in memoria:

```js
rounds[].matches[] = {
  id, homeTeam, awayTeam,
  homeScore, awayScore,        // voto grezzo della squadra
  homeIdealScore, awayIdealScore,
  lineups: { home: [...], away: [...] }   // può mancare
}
```

I gol si ricavano con `calculateMatchGoals(homeScore, awayScore)`, che già
gestisce la regola del pareggio con scarto ≥ 4. Le squadre stanno in
`fantacalcioData.teams[].name`, oggi otto.

## Comportamento

Costruire una matrice *n×n* squadra contro squadra. Per ogni coppia (A, B),
scorrendo tutte le partite in cui compaiono entrambe:

- **vinte da A**, pareggiate, vinte da B — sul risultato in gol, non sul punteggio
- **gol fatti e subiti** da A contro B
- **punteggio totale e medio** di A contro B
- **numero di sfide**

La diagonale (A contro A) è vuota.

La matrice non è simmetrica nella lettura ma lo è nei dati: calcolare ogni
coppia una volta sola e derivare la cella speculare invertendo vinte/perse e
fatti/subiti, invece di ricalcolare. Dimezza il lavoro ed evita che le due metà
si contraddicano per un errore di segno.

### Forma suggerita

```js
// { 'Cusiana': { 'Team24': { sfide, vinte, pari, perse, golFatti, golSubiti, punteggio } } }
function calculateHeadToHead() { ... }
```

Da mettere accanto alle altre funzioni di calcolo in `script.js`, prima delle
viste.

## Interfaccia

Una nuova sezione, o un blocco in coda a **Classifica**. La forma naturale è una
griglia con le squadre sulle righe e sulle colonne, e in ogni cella il bilancio
compatto `3-1-2` (vinte-pari-perse) letto **dal punto di vista della riga**.

```
             Cus   Par   Ich   Pat   Sha   SMF   T24   Ult
  Cusiana     —   2-0-0 1-1-0  ...
  Partizan  0-0-2   —    ...
```

Colore della cella per l'esito prevalente, con le stesse tinte già usate per i
risultati (`.vinta`, `.persa`, `.pari` in `styles.css`), così la griglia si
legge senza leggerla.

Cliccando una cella si apre l'elenco delle sfide, riusando il pannello che già
esiste per le partite di una squadra (`showTeamMatches`).

### Su mobile

Una matrice 8×8 non ci sta in 390px. Due strade, in ordine di preferenza:

1. **Selettore di squadra**: si sceglie una squadra e si vede la sua riga come
   elenco verticale di sette avversari. È la domanda vera che si fa la gente.
2. Griglia in `overflow-x: auto` con la prima colonna in `position: sticky`.

La prima è più lavoro ma è l'unica che si legge davvero su un telefono.

## Casi limite

- **Girone di ritorno e stagioni lunghe.** Due squadre possono essersi
  incontrate molte volte. Non assumere due sfide.
- **Squadre che cambiano nome fra stagioni.** La matrice è per stagione: non
  tentare l'aggregazione storica finché non esiste una tabella di equivalenza.
- **Squadre presenti in `teams` ma senza partite** (stagione appena aperta): la
  cella vale `—`, non `0-0-0`.
- **Il bonus casa.** `calculateMatchGoals` **non** applica il +1 alla squadra di
  casa: quel bonus vive solo nel calcolo ideale. Usare la funzione così com'è,
  senza reintrodurlo a mano, o i gol non torneranno con quelli mostrati nelle
  Giornate.

## Come si verifica

- La somma delle vinte di A contro B più le perse di B contro A dà sempre lo
  stesso numero, per ogni coppia.
- La somma di tutte le sfide della matrice, divisa per due, è pari al numero
  totale di partite giocate nella stagione.
- I gol fatti da A contro B corrispondono ai gol subiti da B contro A.
- Su `2025-2026` (34 giornate, 8 squadre) le sfide totali sono 136.

## Fuori scope

Aggregazione fra stagioni diverse, e scontri diretti come criterio di spareggio
in classifica: la classifica oggi usa il punteggio totale, e cambiarlo è una
modifica al regolamento della lega, non alla pagina.

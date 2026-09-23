# 4. Heatmap giornata × squadra

## Il problema

La media punti di una squadra nasconde tutto quello che conta: chi fa 70 ogni
domenica e chi alterna 90 e 50 hanno la stessa media e due stagioni opposte. La
heatmap mostra la costanza, che nessuna tabella del sito racconta.

## I dati

Una sola grandezza, già pronta: il punteggio di ogni squadra in ogni giornata,
da `homeScore` / `awayScore` in `fantacalcioData.rounds[].matches[]`. È la stessa
che usa la [classifica di merito](../README.md), quindi conviene estrarla una
volta sola in una funzione condivisa invece di ricostruirla in due punti.

```js
// { 'Cusiana': [84, 71.5, null, 66, ...] }  // null = giornata non giocata
function punteggiPerGiornata() { ... }
```

## Comportamento

Una griglia: una riga per squadra, una colonna per giornata, ogni cella colorata
in base al punteggio.

### La scala di colore

È la decisione che fa o rompe questa vista. Tre regole:

1. **La scala è relativa alla stagione mostrata**, non assoluta: minimo e
   massimo si prendono dai punteggi effettivi. Una scala fissa 0–100
   schiaccerebbe tutto in mezzo, perché i punteggi reali stanno quasi sempre fra
   55 e 90.
2. **Scala divergente centrata sulla mediana** della stagione, non sequenziale:
   la domanda è «sopra o sotto la norma», e una divergente la risponde a colpo
   d'occhio. Freddo sotto, neutro al centro, caldo sopra.
3. **Il colore non è l'unica informazione.** Il punteggio va scritto nella cella
   quando c'è spazio, e comunque nel `title`: serve a chi non distingue i colori
   e a chi vuole il numero esatto.

Evitare rosso/verde come unica coppia: usare una divergente che resti leggibile
in monocromia, e verificarla su entrambi i temi.

### Ordinamento delle righe

Di default per punteggio totale decrescente, così la griglia si legge dall'alto.
Utile poter riordinare per **deviazione standard** dei punteggi: è
letteralmente la classifica della costanza, e non esiste altrove nel sito.

## Interfaccia

CSS Grid, zero librerie:

```css
.heatmap { display: grid; grid-template-columns: max-content repeat(var(--giornate), 1fr); }
```

Nomi squadra nella prima colonna, numeri di giornata in testa. Celle quadrate su
desktop, più strette su mobile.

### Su mobile

34 colonne non stanno in 390px: ogni cella avrebbe 8px. Due opzioni:

1. Contenitore in `overflow-x: auto`, prima colonna `position: sticky`, celle a
   larghezza minima fissa (~22px). Si scorre, ma resta leggibile.
2. Mostrare solo le ultime N giornate, con un comando per allargare.

Preferire la prima: il senso della heatmap è vedere *tutta* la stagione in un
colpo, e troncarla la svuota.

## Casi limite

- **Giornate non giocate**: cella vuota con un tratteggio leggero, mai il
  colore del minimo. Uno zero colorato di blu scuro racconta una cosa falsa.
- **Tutti i punteggi uguali** (o una sola giornata): massimo e minimo
  coincidono, la normalizzazione divide per zero. Ricadere sul colore neutro.
- **Tema chiaro e scuro**: la stessa scala non funziona su entrambi i fondi. Due
  set di tinte via variabili CSS, come fa già il resto del foglio di stile.
- **Squadre con nomi lunghi** nella prima colonna: troncare con ellissi e nome
  intero nel `title`, come già fa `.team-name` nelle classifiche.

## Come si verifica

- Il numero di celle piene per riga è uguale alle giornate giocate da quella
  squadra, e uguale per tutte le squadre di una lega a girone pieno.
- La cella più calda della griglia corrisponde al punteggio massimo della
  stagione, che si può leggere anche dalle statistiche in Classifica.
- Con una sola giornata caricata (`2026-2027`) la griglia ha 8 righe e 1 colonna
  e non lancia errori.
- Il `title` di ogni cella riporta squadra, giornata e punteggio.

## Fuori scope

Heatmap per singolo giocatore: i dati ci sono in `lineups`, ma 500 righe sono
una vista diversa, con problemi di navigazione tutti suoi. Semmai una spec a
parte.

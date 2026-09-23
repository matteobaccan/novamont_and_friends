# 3. Andamento per giornata

## Il problema

Le classifiche dicono dove sei arrivato, non come ci sei arrivato. Chi ha
guidato per venti giornate e si è sciolto alla fine, e chi ha rimontato da
ultimo, oggi finiscono indistinguibili in una riga di tabella.

## I dati

`fantacalcioData.rounds` in ordine di giornata. Per ogni giornata servono, per
ogni squadra:

- il **punteggio** di giornata, da `homeScore` / `awayScore`
- i **punti di campionato** guadagnati: 3, 1 o 0, dalla stessa logica di
  `calculateStandingsFromResults`
- la **posizione** in classifica dopo quella giornata

La posizione va ricalcolata giornata per giornata, rifacendo l'ordinamento sul
parziale. Non esiste già: è il pezzo di lavoro vero di questa spec.

## Comportamento

Una funzione che restituisce la serie storica:

```js
// [{ round: 1, classifica: [{ name, punti, posizione, punteggio }, ...] }, ...]
function calculateSeasonProgression() { ... }
```

Costruita accumulando su una copia dello stato a ogni giornata e ordinando con
gli stessi criteri della classifica vera (punti, poi punteggio totale), così la
spezzata coincide con la tabella a fine stagione. Se non coincide, è un bug.

## Interfaccia

Un grafico **SVG inline**, senza librerie: la spezzata è semplice e Chart.js
peserebbe più di tutto il resto della pagina messo insieme.

Due viste, con un interruttore:

- **Posizione** — asse Y invertito (1º in alto), una linea per squadra
- **Punti** — asse Y crescente, una linea per squadra

Otto linee sono troppe da distinguere per colore. Perciò:

- di default tutte le linee in grigio tenue, **tranne una squadra evidenziata**
- la squadra si sceglie da un selettore, e il sito ne ricorda già una in
  `localStorage` sotto `SQUADRA_STORAGE_KEY` (la usa il suggeritore di
  formazione): riusare quella come default
- passando sopra una linea, questa si evidenzia con il nome in etichetta

Più utile di otto colori che nessuno riesce ad associare, ed evita del tutto la
legenda.

### Costruire l'SVG

Mappare i valori a coordinate del viewBox a mano e tenere
`vector-effect="non-scaling-stroke"` sulle linee. Non usare
`preserveAspectRatio="none"` per far scalare il grafico: deformerebbe tratti e
testo.

Griglia orizzontale leggera, etichette delle giornate solo ogni N per non
affollare l'asse su 34 giornate.

## Casi limite

- **Una sola giornata giocata**: la spezzata è un punto. Disegnare il punto, non
  una linea degenere, e non mostrare affatto il grafico sotto le 2 giornate.
- **Pari merito in classifica**: due squadre alla stessa posizione, le linee si
  sovrappongono. Accettabile, ma la posizione assegnata deve essere la stessa
  che mostra la tabella, non l'indice dell'array.
- **Giornate non giocate** in coda: fermare la serie all'ultima giocata, non
  proseguire a zero.
- **Tema chiaro e scuro**: i colori vanno da variabili CSS, non scritti
  nell'SVG. Linee in `stroke: currentColor` con opacità diverse funzionano in
  entrambi i temi senza duplicare nulla.
- **Reduced motion**: se si anima il disegno della linea, rispettare
  `prefers-reduced-motion`, come fa già il logo.

## Come si verifica

- L'ultimo punto di ogni linea coincide con la riga della tabella di classifica:
  stessa posizione, stessi punti.
- Nessuna giornata distribuisce più punti di quanti ne mettano in palio le
  partite giocate (3 per vittoria, 2 per pareggio, per ogni partita).
- Su `2025-2026` la squadra prima alla 34ª giornata è `Ultimo` con 56 punti.

## Fuori scope

Confronto fra stagioni diverse sullo stesso grafico, e proiezioni sul finale di
stagione: la seconda è una previsione, e il sito tiene le previsioni confinate
al suggeritore di formazione, dove il modello è dichiarato riga per riga.

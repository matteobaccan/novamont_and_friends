# 5. Export CSV

## Il problema

Chi vuole fare i suoi conti — un grafico in Excel, una scommessa interna, un
confronto con un'altra lega — oggi deve ricopiare a mano dalla pagina o aprire
il JSON e arrangiarsi. Il sito ha già tutti i numeri in memoria.

## I dati

Le tabelle già calcolate, senza toccare nulla:

| Export | Funzione che lo produce |
|--------|-------------------------|
| Classifica generale | `calculateStandingsFromResults()` |
| Classifica ideale | `calculateIdealStandings()` |
| Classifica di merito | `calculateMeritStandings()` |
| Statistiche giocatori | `calcolaStatisticheGiocatori()` |
| Risultati per giornata | `fantacalcioData.rounds` |

## Comportamento

Un pulsante per ogni tabella esportabile. Al clic si scarica un CSV con le
stesse colonne e lo stesso ordinamento mostrati in quel momento: se l'utente ha
ordinato per media punti, il CSV esce ordinato per media punti. Esportare un
ordine diverso da quello a schermo è un piccolo tradimento che costa fiducia.

### Generazione

```js
function scaricaCsv(nomeFile, intestazioni, righe) {
    const csv = [intestazioni, ...righe]
        .map(r => r.map(cellaCsv).join(';'))
        .join('\r\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    // ... <a download> con URL.createObjectURL, poi revokeObjectURL
}
```

Tre dettagli che non sono opzionali, se il file deve aprirsi in Excel italiano:

- **Separatore `;`**, non la virgola. Con la virgola Excel in locale italiano
  mette tutta la riga in una cella.
- **BOM `﻿` in testa.** Senza, Excel legge il file come ANSI e gli accenti
  dei nomi squadra diventano caratteri strani.
- **Decimali con la virgola** (`72,38` e non `72.38`), altrimenti Excel italiano
  li tratta come testo e non li somma. Coerente con `;` come separatore, che è
  proprio il motivo per cui il formato italiano usa il punto e virgola.

### Escape

Una cella va racchiusa fra virgolette se contiene `;`, `"`, o un a capo; le
virgolette interne si raddoppiano. I nomi squadra oggi sono innocui, ma vengono
da un JSON modificabile a mano: l'escape va fatto comunque, non verificato caso
per caso.

### Nome del file

`novamont-<tabella>-<stagione>.csv`, per esempio
`novamont-classifica-2025-2026.csv`. Chi ne scarica tre non si ritrova
`export(2).csv`.

## Interfaccia

Un pulsante discreto nell'intestazione di ogni sezione, accanto al titolo:
icona di download più la parola «CSV». Non un blocco a sé: è un'azione di
servizio, non una funzione del sito.

Il testo del pulsante dice cosa succede: «Scarica CSV», non «Esporta».

## Casi limite

- **Nessuna giornata giocata**: il pulsante resta, il CSV esce con la sola riga
  di intestazione. Meglio di un pulsante che non fa niente senza spiegare.
- **Valori `null`** (media posizione a zero giornate, punteggio ideale
  mancante): cella vuota, non la stringa `null`.
- **Safari su iOS** non sempre onora `<a download>` per i blob: apre il file in
  una scheda. Accettabile, ma non promettere «scarica» dove poi non scarica; se
  serve, un `target="_blank"` di riserva.
- **`URL.revokeObjectURL`** va chiamato dopo il clic, altrimenti il blob resta
  in memoria per tutta la sessione.

## Come si verifica

1. Scaricare la classifica, aprirla con doppio clic in Excel: le colonne sono
   separate, gli accenti corretti, i decimali sommabili.
2. Il numero di righe è pari alle squadre più una di intestazione.
3. Riordinando la tabella per un'altra colonna e riscaricando, l'ordine del CSV
   cambia di conseguenza.
4. Aprire lo stesso file con un editor di testo: la prima riga inizia con il BOM
   e le intestazioni sono leggibili.

## Fuori scope

Export PDF: richiederebbe una dipendenza vera (jsPDF o simili) per un risultato
che una stampa del browser dà già. Il README lo considera già lasciato cadere.

# 6. Achievement

## Il problema

Le classifiche premiano una cosa sola: chi ha fatto più punti. Tutto il resto
della stagione — la partita da 95, le sei vittorie di fila, il pomeriggio in cui
hai lasciato in panchina mezza squadra ideale — non lascia traccia da nessuna
parte, anche se è quello di cui si parla nel gruppo.

## I dati

Tutto già presente, niente di nuovo da scaricare:

| Serve | Dove sta |
|-------|----------|
| Punteggio di giornata | `rounds[].matches[].homeScore` / `awayScore` |
| Esito della partita | `calculateMatchGoals()` |
| Punteggio ideale | `rounds[].matches[].homeIdealScore` / `awayIdealScore` |
| Formazioni con voti e bonus | `rounds[].matches[].lineups.home` / `.away` |
| Statistiche giocatore | `calcolaStatisticheGiocatori()` |

La voce di formazione è `{ p: idGiocatore, t: 's'|'b'|'in'|'out', v: voto, b: fantavoto, e: { gol, assist, amm, esp, rigParato, rigSbagliato, autogol, golSubiti } }`.
Il saldo di bonus e malus di un giocatore è `b - v`.

**Attenzione:** `lineups` esiste solo dove è stato raccolto. La stagione
`2025-2026` non ce l'ha per nessuna giornata, `2026-2027` sì. Gli achievement
che dipendono dalle formazioni devono sparire, non azzerarsi, quando il dato
manca.

## Comportamento

Un catalogo dichiarativo, non una catena di `if`: ogni achievement è un oggetto
con un identificativo, un titolo, una descrizione e una funzione che, dati i
dati di stagione, restituisce chi lo ha vinto e con che valore.

```js
const ACHIEVEMENT = [
    {
        id: 'bomba',
        titolo: 'La bomba',
        descrizione: 'Il punteggio di giornata più alto della stagione',
        icona: 'fa-rocket',
        calcola: (dati) => ({ squadra, valore, round })   // null se non assegnabile
    },
    ...
];
```

Così aggiungerne uno è una voce nell'array, e la vista non cambia.

### Catalogo iniziale

Dai soli risultati, sempre disponibili:

| Achievement | Definizione |
|-------------|-------------|
| **La bomba** | Punteggio di giornata più alto della stagione |
| **Il tonfo** | Punteggio di giornata più basso |
| **Rullo compressore** | Striscia più lunga di vittorie consecutive |
| **Traversata** | Striscia più lunga senza vittorie |
| **Regolarista** | Deviazione standard dei punteggi più bassa, con almeno 5 giornate |
| **Montagne russe** | Deviazione standard più alta |
| **Sfortunato** | Più sconfitte pur avendo fatto un punteggio sopra la media di giornata |

Dalle formazioni, solo dove `lineups` esiste:

| Achievement | Definizione |
|-------------|-------------|
| **Occasione persa** | Scarto più ampio fra punteggio reale e ideale in una giornata |
| **Panchina d'oro** | Più punti di bonus lasciati in panchina in una giornata |
| **Uomo giusto** | Giocatore schierato col fantavoto singolo più alto |

Il «Sfortunato» è quello che dà il senso a tutta la sezione: è la stessa idea
della classifica di merito, applicata alla singola partita.

## Interfaccia

Una griglia di tessere in coda a **Rose**, dove stanno già le classifiche
individuali, oppure in una sezione propria se diventano più di una decina.

Ogni tessera: icona, titolo, squadra o giocatore vincitore, il valore, e la
giornata quando ha senso. Al passaggio, il `title` spiega la regola: un
achievement di cui non si capisce il criterio è solo un adesivo.

Nessuna animazione di ingresso: sono dati, non una schermata di premiazione.

## Casi limite

- **Parimerito.** Due squadre con lo stesso punteggio massimo: mostrarle
  entrambe, non sceglierne una per ordine di array. Il tipo di ritorno deve
  prevedere più vincitori fin dall'inizio.
- **Stagione appena aperta.** Con una giornata, «striscia di vittorie» e
  «regolarista» non hanno senso: ogni achievement dichiara un minimo di giornate
  e sotto quella soglia non compare.
- **Formazioni assenti.** Gli achievement che le richiedono non si mostrano
  vuoti: spariscono dalla griglia, e la sezione spiega in una riga perché
  quella stagione ne ha meno.
- **Deviazione standard con una sola giornata**: indefinita, non zero.
- **Le strisce attraversano le giornate non giocate?** No: una giornata mancante
  interrompe la striscia, non la salta. Altrimenti si premiano sequenze che non
  sono mai avvenute.

## Come si verifica

- «La bomba» coincide col punteggio massimo che si può leggere nella heatmap o
  nelle statistiche di Classifica.
- La somma delle strisce di vittorie di una squadra non supera il numero delle
  sue vittorie in classifica.
- Su `2026-2027` (1 giornata) compaiono solo gli achievement con minimo 1
  giornata, e la pagina non lancia errori.
- Su `2025-2026` (34 giornate, senza `lineups`) non compare nessun achievement
  da formazione, e la sezione lo dice.

## Fuori scope

Achievement storici fra stagioni, e notifiche quando se ne sblocca uno: la
seconda richiede stato lato server, che il README colloca fuori portata.

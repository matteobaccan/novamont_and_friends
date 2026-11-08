<p align="center">
  <img src="assets/logo.svg" alt="Novamont &amp; Friends" width="430">
</p>

[![Netlify Status](https://api.netlify.com/api/v1/badges/b010ff6f-b676-4765-9d71-1fb72eee96cf/deploy-status)](https://app.netlify.com/projects/novamontfriends/deploys)

Sito web moderno e completo per la gestione e visualizzazione della classifica del Fantacalcio Novamont & Friends. Una piattaforma interattiva che trasforma il tuo campionato di fantacalcio in un'esperienza coinvolgente e professionale.

## ✨ Cosa fa

### 🏆 Classifiche

- **Classifica generale** — punti, vittorie, gol fatti e subiti, differenza reti, punteggio
  totale e media. Ogni colonna è ordinabile
- **Classifica ideale** — come sarebbe andata con la formazione perfetta di ogni giornata,
  con lo scarto di posizioni e di punti rispetto a quella vera
- **Classifica di merito** — ogni giornata è una gara a sé: conta solo il punteggio e i punti
  si distribuiscono con la scala della Formula 1 (25-18-15-12-10-8-6-4). Toglie di mezzo il
  calendario, e la colonna Δ Pos dice di quante posizioni il campionato ti tratta meglio o
  peggio di quanto meriti
- **Statistiche allenatori** — podio per efficienza e punti medi persi rispetto all'ideale
- **Elenco partite** — un clic su una squadra apre le sue giornate; un clic sulla partita
  mostra le formazioni con voti ed eventi. In Merito, al posto dell'elenco c'è la griglia dei
  punti giornata per giornata, colorata per piazza

### 📈 Letture della stagione

In coda alla Classifica, tre viste che una tabella non può dare:

- **Andamento** — la spezzata di posizione e punti giornata per giornata, in SVG inline. Le
  otto linee restano grigie e una sola si accende, così non serve una legenda di otto colori
- **Heatmap punteggi** — una casella per ogni punteggio, scala divergente centrata sulla
  mediana della stagione. Si ordina per punteggio o **per costanza**, che è la classifica di
  chi tiene lo stesso passo tutte le domeniche
- **Scontri diretti** — matrice 8×8 con vinte-pari-perse dal punto di vista della riga; una
  casella apre l'elenco delle sfide con casa, trasferta, gol e punteggi

Andamento e heatmap arrivano dalla seconda giornata: prima lo dicono con una riga, invece di
non esserci e basta.

### 👥 Rose e giocatori

- **Rendimento per giocatore** — presenze, panchine, medie, gol, assist, cartellini e punti
  raccolti stando in panchina
- **Sei classifiche individuali** — marcatori, assist, ammonizioni, espulsioni, malus e
  **incompresi**, cioè i bonus accumulati mentre il fantallenatore li teneva fuori
- **I due peggiori di ogni reparto** — la pastiglia del ruolo si borda di rosso. Conta se ha
  preso il voto in Serie A, non se il fantallenatore lo ha schierato: un giocatore può essere
  ottimo e restare in panchina per scelta
- **Albo d'oro** — dieci premi ricavati dai dati: la bomba, il tonfo, la striscia di vittorie,
  la traversata, il regolarista, le montagne russe, lo sfortunato, e tre che leggono le
  formazioni. Quelli che non hanno i dati spariscono invece di mostrarsi vuoti

### 🪄 Formazione consigliata

L'undici migliore per la prossima giornata, provando tutti i moduli. Non è "AI": è un modello
dichiarato, e la pagina spiega riga per riga come arriva al numero — resa, forma, contesto
della partita, probabilità di giocare, rigori. I dati di Serie A vengono dalle pagine di
fantacalcio.it salvate a mano, non si scaricano da soli.

Ogni consiglio viene salvato prima del fischio e, a giornata giocata, confrontato con quello
che è successo davvero: sotto la formazione consigliata c'è il bilancio del modello e dei
fantallenatori.

### 📅 Giornate

Risultati reali e ideali per ogni partita, confronto automatico fra i due e commenti inline
in stile Corelli-Bergamotti, uno per partita più uno di giornata.

- **Calendario completo** — nel selettore ci sono anche le giornate da giocare, con gli
  accoppiamenti, la giornata di Serie A corrispondente e la sua data
- **Rigiocala** — ripercorre una partita su un campo visto dall'alto, con gli eventi della
  giornata addosso ai protagonisti. I minuti sono inventati ma ripetibili: la stessa partita
  si rigioca sempre allo stesso modo
- **E se avesse giocato il sito?** — dove c'era un consiglio salvato, il risultato che
  sarebbe uscito schierando la formazione consigliata, da una parte o da tutte e due

### 🧰 Cose di servizio

- **Più stagioni** — selettore in alto, la scelta finisce nell'URL e il link è condivisibile
- **La scheda resta dov'era** — ricaricando da Merito si riapre Merito, e il link con l'ancora
  si può passare già aperto sulla scheda giusta
- **App installabile** — manifest e icone: dal telefono si aggiunge alla schermata Home e si
  apre senza barra degli indirizzi, con i dati dell'ultima visita anche offline
- **Tema chiaro e scuro**, e tutto responsive fino a 390px
- **Sipario d'apertura** — due secondi di marchio animato, saltabile con un clic o con Esc

### ⚙️ Sotto il cofano

- **Niente si scrive a mano** — classifiche, rose e statistiche sono tutte derivate dai
  risultati. Nel JSON si inseriscono solo i punteggi
- **Algoritmo gol** — primo gol a 66 punti, poi uno ogni 6. A parità di gol con almeno 4 punti
  di scarto, chi ha fatto di più ne prende uno in più
- **Bonus casa** — +1 alla squadra di casa nel calcolo dei gol ideali, non nel punteggio
- **Calendario precaricato** — tutte le giornate della lega e le 38 di Serie A stanno nel JSON
  della stagione, verificate prima di essere scritte
- **100 test** senza dipendenze, su ogni push e pull request
- **Nessuna libreria** — grafici, heatmap e marchio sono SVG e CSS grid scritti a mano

## 🚀 Come utilizzare

### 🌐 **Accesso**
- **Online**: Visita il sito su Netlify (vedi badge stato)
- **Locale**: Apri `index.html` in un browser web o avvia un server locale

### 🧭 Le sei sezioni

| | Sezione | Cosa ci trovi |
|---|---|---|
| 🏆 | **Classifica** | la classifica vera, e sotto andamento, heatmap e scontri diretti |
| ⭐ | **Classifica Ideale** | come sarebbe andata con le formazioni perfette, più il podio allenatori |
| ⏱️ | **Merito** | ogni giornata una gara, punti alla Formula 1 |
| 📅 | **Giornate** | risultati, confronto reale contro ideale e commenti |
| 👥 | **Rose** | albo d'oro, rendimento per giocatore e sei classifiche individuali |
| 🪄 | **Formazione** | l'undici consigliato per la prossima giornata |

In Classifica, Classifica Ideale e Merito un clic sulla squadra apre il suo dettaglio; un clic
sulla partita mostra le formazioni con voti ed eventi di tutti i giocatori. Le colonne delle
tabelle si ordinano cliccando sull'intestazione.

## 📅 Stagioni

Il sito gestisce più stagioni. L'elenco vive in `data/seasons.json`, che è l'unica
fonte di verità su quali stagioni esistono e quale è quella corrente:

```json
{
  "currentSeason": "2026-2027",
  "seasons": [
    { "id": "2026-2027", "label": "2026-2027", "file": "data/2026-2027.json", "status": "current" },
    { "id": "2025-2026", "label": "2025-2026", "file": "data/2025-2026.json", "status": "archived" }
  ]
}
```

Ogni stagione ha il suo file in `data/<id>.json` e viene caricata solo quando la si
seleziona dal menu a tendina nell'header. La stagione scelta viene ricordata in
`localStorage` e finisce nell'URL (`?stagione=2025-2026`), così il link è condivisibile.

Come si apre una stagione nuova è in [AGENTS.md](AGENTS.md#una-stagione-nuova).

## 📝 I dati

Tutto quello che il sito mostra sta nel JSON della stagione (`data/<id>.json`): risultati,
formazioni, commenti e calendario. Classifica reale, classifica ideale e statistiche
allenatori sono **ricalcolate dai risultati**, quindi nel file non ci sono.

I campi `homeIdealScore` / `awayIdealScore` sono facoltativi: dove mancano, la
Classifica Miglior Allenatore per quella giornata non viene mostrata e la Classifica
Ideale ricade sui punteggi reali.

**Come si aggiornano i dati è in [AGENTS.md](AGENTS.md)**: si parte sempre da pagine di
fantacalcio.it salvate a mano, e nessuno script va in rete.

### 📆 Calendario

Il JSON della stagione porta anche il calendario intero, scritto una volta a inizio
stagione:

- **`calendar`**: le giornate della lega, ognuna con `round`, `roundSerieA` (la giornata di
  Serie A su cui si gioca) e `matches` con casa e trasferta
- **`calendarioSerieA`**: le 38 giornate di Serie A, con la data ufficiale e le partite
  (`casa`, `fuori`)

Il sito li usa per mostrare le giornate da giocare, con il link a ogni partita sulla lega; il suggeritore ripiega sul calendario di Serie A per casa
e trasferta quando le probabili non riportano le partite del turno.

### 👥 Dati per giocatore

Dalla stagione 2026-2027 il JSON contiene anche:

- **`players`**: dizionario `pid → nome, ruolo, squadra di Serie A`, dove `pid` è
  l'identificativo globale Fantacalcio
- **`rosterHistory`**: snapshot delle rose con `fromRound`, scritti solo quando una rosa
  cambia, così i trasferimenti di metà stagione restano tracciati
- **`rounds[].matches[].lineups`**: per ogni giocatore lo stato (titolare, panchina,
  entrato, sostituito), il voto, il voto con bonus e gli eventi (gol, assist, cartellini)

Da questi dati sono derivate rose, statistiche di rendimento e classifiche individuali.
**Gol, assist e cartellini contano solo per i giocatori effettivamente schierati**: quello
che un giocatore combina restando in panchina non entra nelle classifiche.

L'unica eccezione è la classifica **Incompresi**, che esiste proprio per misurare il
rimpianto: conta i gol e gli assist fatti in Serie A mentre il fantallenatore li teneva
fuori. Accanto, la classifica **Malus** somma i punti persi in campo — mezzo punto per
un'ammonizione, uno per un'espulsione, due per un autogol, tre per un rigore sbagliato.
I gol subiti dai portieri restano fuori: sono il loro mestiere, non un errore, e da soli
riempirebbero la classifica di portieri.

## 🪄 Formazione consigliata

La sezione Formazione propone l'undici migliore per la prossima giornata, provando tutti i
moduli ammessi. Il punteggio atteso di ogni giocatore parte dalla sua **resa**, cioè quanto
rende quando gioca:

- **media fantavoto** sulle giornate in cui ha preso un voto
- **forma recente**, media pesata delle ultime giornate (le più recenti pesano di più)

Qui, a differenza delle classifiche, **contano anche i voti presi stando in panchina**:
per prevedere il rendimento conta che il giocatore abbia giocato in Serie A, non che il
fantallenatore lo avesse schierato. Altrimenti il suggerimento non proporrebbe mai di
promuovere una riserva, che è invece il consiglio più utile.

### Il contesto della partita

Prima di stimare cosa farà il giocatore si guarda la partita che lo aspetta. Tre leggeri
vantaggi correggono la resa, ognuno al massimo del 3%:

| Voce | Segno |
|---|---|
| **Campo** | in casa +3%, in trasferta −3% |
| **Classifica** | proporzionale alla distanza dall'avversario, ±3% agli estremi |
| **Forma** | quanto i giocatori di quella squadra, nelle rose della lega, sono andati sopra o sotto la media del ruolo nelle ultime 3 giornate: +3% a un punto di fantavoto sopra, −3% a uno sotto |

Al massimo ±9% in tutto, meno di ±0,6 di fantavoto su una resa da 6,5: abbastanza per
riordinare due giocatori quasi pari, non per ribaltare uno scarto vero. La freccia accanto
alla sigla di Serie A riassume il conto, con partita, posizioni e punti nel suggerimento.

### Probabilità di giocare

Il peso maggiore ce l'ha la **probabilità di scendere in campo**, presa dalle
[probabili formazioni di Serie A](https://www.fantacalcio.it/probabili-formazioni-serie-a).
Il valore atteso è:

```
atteso = gioca × resa + (1 − gioca) × 4.5
```

dove `4.5` è quanto vale uno slot occupato da chi non gioca: non zero, perché un cambio lo
rimpiazza, ma meno di una prestazione vera anche modesta — altrimenti "non gioca"
batterebbe "gioca male". Chi non compare affatto nelle probabili scende al 15%, e chi è
anche fra gli [infortunati](https://www.fantacalcio.it/infortunati-serie-a) al 3%, con il
motivo dell'infortunio scritto nella riga. Chi invece è infortunato ma compare comunque
nelle probabili tiene la sua percentuale: quella fonte sa già dei rientri in dubbio.

Gli **squalificati** vanno invece a **zero**, con il nome sbarrato nella riga. Non è una
stima prudente come le altre due: quel turno non possono scendere in campo, punto. Li
elenca la pagina delle probabili stessa, partita per partita e con l'id del giocatore, e
la squalifica batte ogni altra fonte — anche un 100% rimasto in formazione per
distrazione. Senza questa voce uno squalificato sarebbe un "fuori dalle probabili"
qualunque al 15%, e il suggeritore se lo poteva ritrovare in formazione.

### I rigori

Chi batte i [rigori](https://www.fantacalcio.it/rigoristi-serie-a) porta punteggio che la
media dei fantavoto non vede arrivare, quindi entra dritto nel valore atteso:

```
atteso = gioca × (resa + rigori) + (1 − gioca) × 4,5
```

Il **primo rigorista** ne calcia dai 5 ai 10 in una stagione: su una trentina di partite
giocate sono ~0,22 rigori a partita, e ogni rigore vale in media `0,76 × 3 − 0,24 × 3 ≈ 1,56`
di fantavoto fra realizzato e sbagliato. Il prodotto è **+0,35 a partita**.

Secondo e terzo invece li tirano **solo quando chi li precede non gioca**, e quella
probabilità è già nelle probabili formazioni. La quota di rigori attesi è quindi:

```
1º:  1
2º:  1 − gioca(1º)
3º:  (1 − gioca(1º)) × (1 − gioca(2º))
```

Il risultato è che lo stesso giocatore vale cose diverse a seconda della settimana. Con i
dati del turno 6: Osmajic, terzo del Como dietro due titolari sani, prende +0,01 e il suo
pallone resta sbiadito; **Adams A., secondo del Venezia, ne prende +0,34 come un primo,
perché Busio è infortunato al 3%**. Il conto per esteso sta nel suggerimento del pallone.

### A parità, l'attacco

Fra due moduli che sommano quasi lo stesso — entro un punto sull'undici — vince quello con
più attaccanti, poi quello con più centrocampisti. L'atteso è una media, e gol e bonus
stanno nella coda della distribuzione: una media sottovaluta gli attaccanti rispetto ai
difensori.

### I dati

Tutto quello che il suggeritore legge da fuori sta in `data/probabili.json`: percentuali,
rigoristi, infortunati, squalificati, classifica di Serie A e partite del turno; la forma
delle squadre il sito la ricava dai voti della lega. Lo scrive `leggi-probabili.mjs` della skill, partendo dalle pagine salvate a mano (vedi
[AGENTS.md](AGENTS.md#prima-di-una-giornata-probabili-e-consiglio)). La
pagina mostra sempre la data dell'ultimo aggiornamento e avvisa quando il file ha più di
due giorni o manca del tutto: senza quella riga, un file vecchio continuerebbe a produrre
percentuali dall'aria credibile riferite a una giornata già giocata.

**Cosa non considera**: i ballottaggi oltre alla percentuale, la forza reale dell'avversario
al di là della posizione in classifica, e il fatto che i primi cambi in panchina hanno più
probabilità di entrare degli altri. Con poche giornate disputate il suggerimento resta
debole e la pagina lo dichiara.

## 📱 Compatibilità

Chrome, Firefox, Safari ed Edge, da desktop, tablet e telefono. Il layout regge fino a 390px
di larghezza, e dove una tabella non ci sta — heatmap, scontri diretti, andamento — si scorre
in orizzontale nel suo riquadro, con la prima colonna agganciata. Installata come app, si apre
anche senza rete con i dati dell'ultima visita.

## 📂 Struttura del progetto

```
novamont_and_friends/
├── index.html              # Pagina principale, 6 sezioni
├── manifest.webmanifest    # Manifest PWA, non .json: sw.js e .htaccess trattano i .json a parte
├── styles.css              # Stili responsive
├── script.js               # Tutta la logica: classifiche, rose, calendario, suggeritore
├── rigiocala.js            # "Rigiocala": la partita animata su un campo visto dall'alto
├── config.js               # Impostazioni di presentazione
├── sw.js                   # Service worker, cache versionata
├── .htaccess               # Header di cache e whitelist dei file dati
├── assets/
│   ├── logo.svg            # Marchio animato, autonomo (usato dal README)
│   ├── icona.svg           # Sorgente delle icone della app
│   ├── icona-maskable.svg  # Variante dentro la safe zone di Android
│   └── icona-*.png         # 192, 512, 180 e maskable-512, generate dagli SVG
├── data/
│   ├── seasons.json        # Indice delle stagioni disponibili
│   ├── 2026-2027.json      # Stagione corrente, calendario compreso
│   ├── 2025-2026.json      # Stagione archiviata
│   ├── probabili.json      # Dati di Serie A per il suggeritore
│   └── consigli/<stagione>/ # Consigli salvati prima del fischio e loro valutazione
├── .claude/skills/aggiorna-giornata/
│   ├── SKILL.md            # Istruzioni della skill
│   ├── cosa-serve.mjs         # Il primo passo: cosa manca e quali pagine chiedere
│   ├── leggi-calendario.mjs   # Calendario della lega e di Serie A, a inizio stagione
│   ├── giornate-mancanti.mjs  # Quali giornate mancano e da quale ricominciare
│   ├── converti-giornata.mjs  # Giornata da formazioni salvate, decodifica eventi
│   ├── leggi-partita.mjs      # Formazioni, voti ed eventi dalla pagina di una partita salvata
│   ├── calcola-giornata.mjs   # Punteggi ideali, scrittura della giornata
│   ├── aggiungi-giocatori.mjs # Acquisti di mercato nel dizionario dei giocatori
│   ├── leggi-probabili.mjs    # Probabili, rigoristi, infortunati da pagine salvate
│   ├── salva-consigli.mjs     # Fotografia del consiglio prima della giornata
│   ├── valuta-consigli.mjs    # Il consiglio confrontato con la realtà
│   └── rigioca-consigli.mjs   # Le giornate passate rigiocate con altri pesi
├── test/
│   ├── regole.test.mjs     # Gol, bonus casa, malus, punti di merito
│   ├── parser.test.mjs     # I parser delle pagine salvate (Serie A, calendario, partite), su fixture reali
│   ├── consigli.test.mjs   # Suggeritore, salvataggio e valutazione dei consigli
│   ├── calendario.test.mjs # Coerenza del calendario e giornate da giocare
│   ├── cosa-serve.test.mjs # Le pagine da chiedere all'utente
│   ├── link-lega.test.mjs  # I link alle pagine della lega
│   ├── aiuto/              # Carica script.js in un contesto vm
│   └── fixture/            # Frammenti di pagina datati, niente rete nei test
├── .github/workflows/
│   └── test.yml            # node --test su ogni push e pull request
├── BONUS_CASA.md           # Il bonus casa nei gol ideali
├── CACHE_MANAGEMENT.md     # Come è gestita la cache
├── AGENTS.md               # Come si aggiornano i dati
└── README.md               # Questo file
```

### 🗂️ **Dettaglio File**
- **`index.html`**: Interfaccia con 6 sezioni (Classifica, Classifica Ideale, Merito, Giornate, Rose, Formazione) e selettore stagione
- **`styles.css`**: ~6000 righe di CSS responsive con glassmorphism e animazioni
- **`script.js`**: ~5700 righe di JavaScript: calcolo classifiche, rose, calendario e suggeritore di formazione
- **`data/seasons.json`**: Indice delle stagioni: id, etichetta, file, stato e indirizzi delle pagine della lega
- **`data/<stagione>.json`**: Database JSON con teams, players, rosterHistory, rounds, calendar, calendarioSerieA e settings
- **`data/probabili.json`**: Istantanea di Serie A ricavata dalle pagine salvate, non scritta a mano
- **`config.js`**: Impostazioni configurabili per personalizzazione

## 🔧 Funzioni Avanzate

### 🎯 **Algoritmo Calcolo Gol**
```javascript
function calculateGoalsFromScore(score) {
    // 66 punti = 1 gol, poi ogni 6 punti un gol in più
    if (score < 66) return 0;
    return Math.floor((score - 60) / 6);
}
```

Nei **gol ideali** la squadra di casa riceve prima un bonus di +1 punto, come nel
regolamento della lega: il dettaglio sta in [`BONUS_CASA.md`](BONUS_CASA.md).

### 📊 **Come è fatta una giornata**

Le giornate non si scrivono a mano — ci pensa la skill — ma questa è la forma che hanno
in `data/<stagione>.json`. Si inseriscono solo i punteggi: **gol, risultati e classifica
sono ricalcolati**, quindi non compaiono nel file.

```javascript
{
    round: 1,
    date: "Settembre 2026",
    matches: [
        {
            id: 1,
            homeTeam: "Real Pattagghiu",
            awayTeam: "Real Ichnusa",
            homeScore: 75.5,
            awayScore: 70,
            homeIdealScore: 79,      // facoltativi: senza, niente Classifica Allenatori
            awayIdealScore: 76.5,
            commentary: { corelli: "...", bergamotti: "..." },
            lineups: { home: [ /* una voce per giocatore */ ], away: [ /* ... */ ] }
        }
    ]
}
```

Una voce di `lineups` è compatta perché si ripete per ogni giocatore di ogni partita:
`p` è il pid, `t` lo stato (`s` titolare, `b` panchina, `in` entrato, `out` sostituito),
`v` il voto, `b` il voto con bonus, `e` gli eventi (`gol`, `assist`, `amm`, `esp`,
`autogol`, `rigSbagliato`, `rigParato`, `golSubiti`).

### 🏆 **Struttura Dati Squadra**

In `teams` sta solo l'anagrafica; punti, vittorie, gol e medie **non si scrivono**, li
calcola `calcolaClassifica()` dai risultati a ogni caricamento.

```javascript
{ id: 1, name: "Cusiana", owner: "Roby, Gaiuz" }
```

## 🤝 Contribuire

1. Fai un fork del progetto
2. Crea un branch per la tua feature (`git checkout -b feature/NuovaFunzione`)
3. Commit le tue modifiche (`git commit -m 'Aggiunge nuova funzione'`)
4. Push al branch (`git push origin feature/NuovaFunzione`)
5. Apri una Pull Request

## 📄 Licenza

Questo progetto è sotto licenza MIT. Vedi il file `LICENSE` per i dettagli.

---

Sviluppato con ❤️ per il Fantacalcio Novamont & Friends.

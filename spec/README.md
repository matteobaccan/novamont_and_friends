# Spec

Una scheda per ogni casella ancora aperta in **Prossimi Sviluppi** del README.
Servono a poter iniziare il lavoro senza prima ricostruire il contesto: dove
stanno i dati, cosa deve succedere, e come si capisce che è fatto.

| # | Spec | Perché vale la pena | Costo |
|---|------|--------------------|-------|
| 1 | [Manifest e icone (PWA)](01-pwa-manifest.md) | Il service worker c'è già: manca solo il manifest perché il sito si installi | Basso |
| 2 | [Scontri diretti](02-scontri-diretti.md) | In una lega che gioca da anni è la statistica che si chiede per prima | Basso |
| 3 | [Andamento per giornata](03-andamento-per-giornata.md) | Racconta la stagione meglio di qualunque tabella | Medio |
| 4 | [Heatmap punteggi](04-heatmap-punteggi.md) | Fa vedere a colpo d'occhio chi è costante e chi a strappi | Basso |
| 5 | [Export CSV](05-export-csv.md) | Chi vuole fare i suoi conti se li porta via | Basso |
| 6 | [Achievement](06-achievement.md) | Premia quello che le classifiche non dicono | Medio |
| 7 | [Test automatici](07-test-automatici.md) | Lo scraper gira da solo in una Action e nessuno guarda | Medio |

## Come sono scritte

Ogni spec ha la stessa forma:

- **Il problema** — cosa manca, e a chi
- **I dati** — dove sono già, con la forma esatta
- **Comportamento** — cosa deve fare, in dettaglio
- **Interfaccia** — dove va e che aspetto ha
- **Casi limite** — quello che rompe le implementazioni frettolose
- **Come si verifica** — il controllo che dice che è finita
- **Fuori scope** — cosa non fa parte di questo lavoro

## Cose da sapere prima di aprirne una

Il sito è **statico**: nessun backend, nessuna build, nessuna dipendenza da
installare. `index.html` carica `styles.css`, `config.js` e `script.js` con una
query string di versione, e `sw.js` mette in cache quegli stessi URL. **Toccando
un file versionato va alzata la versione in tutti e due i posti**, altrimenti i
visitatori continuano a vedere il vecchio.

Tutti i dati di una stagione stanno in `data/<stagione>.json`, già in memoria in
`fantacalcioData` quando le viste girano. Nessuna di queste spec richiede una
fonte nuova.

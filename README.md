# 🏆 Fantacalcio Novamont & Friends

[![Netlify Status](https://api.netlify.com/api/v1/badges/b010ff6f-b676-4765-9d71-1fb72eee96cf/deploy-status)](https://app.netlify.com/projects/novamontfriends/deploys)

Sito web moderno e completo per la gestione e visualizzazione della classifica del Fantacalcio Novamont & Friends. Una piattaforma interattiva che trasforma il tuo campionato di fantacalcio in un'esperienza coinvolgente e professionale.

## ✨ Caratteristiche Principali

### 🏆 **Classifiche Complete**
- **Classifica Reale**: Posizioni, punti campionato, gol fatti/subiti, differenza reti, totale punti fantacalcio
- **Classifica Ideale**: Simulazione con le migliori formazioni possibili e confronto con la classifica reale
- **Ordinamento Dinamico**: Clicca su qualsiasi colonna per ordinare i dati
- **Algoritmo Gol**: Sistema preciso di calcolo gol (66pt = 1 gol, poi ogni 6 punti)

### 📅 **Gestione Giornate Avanzata**
- **Risultati Dettagliati**: Punteggi reali e ideali per ogni match
- **Confronto Intelligente**: Analisi automatica reale vs ideale per ogni giornata
- **Commenti Esclusivi**: Analisi in stile Caressa-Bergomi per la prima giornata
- **Selezione Dinamica**: Naviga facilmente tra le diverse giornate

### 📊 **Statistiche e Analisi**
- **Dashboard Completo**: Leader, punteggi più alti, squadre partecipanti
- **Spiegazione Algoritmi**: Info dettagliate sul calcolo dei gol
- **Metriche Avanzate**: Media punti, differenze prestazioni, confronti storici

### 🎨 **Design e Usabilità**
- **Interface Moderna**: Design gradient con animazioni fluide
- **100% Responsive**: Ottimizzato per desktop, tablet e mobile
- **Navigazione Intuitiva**: Tab system per accesso rapido alle sezioni
- **Font Awesome Icons**: Iconografie professionali in tutto il sito

## 🚀 Come utilizzare

### 🌐 **Accesso**
- **Online**: Visita il sito su Netlify (vedi badge stato)
- **Locale**: Apri `index.html` in un browser web o avvia un server locale

### 🧭 **Navigazione**
1. **🏆 Classifica**: Visualizza la classifica attuale con tutti i dettagli
2. **⭐ Classifica Ideale**: Scopri come sarebbe la classifica con le formazioni perfette
3. **📅 Giornate**: Esplora i risultati di ogni giornata con confronti e commenti
4. **📊 Statistiche**: Consulta dashboard e spiegazioni tecniche

### 💡 **Funzionalità Interattive**
- **Clicca** sulle colonne delle tabelle per ordinare i dati
- **Seleziona** la giornata dal dropdown per vedere risultati specifici
- **Scorri** per vedere il confronto reale vs ideale
- **Leggi** i commenti esclusivi in stile telecronaca

## 📝 Aggiornare i dati

### Metodo semplice (modifica diretta nel JavaScript):
Modifica il file `script.js` nella sezione `fantacalcioData` per aggiornare:
- Classifica delle squadre
- Risultati delle giornate
- Data ultimo aggiornamento

### Metodo avanzato (file JSON):
Modifica il file `fantacalcio_data.json` per gestire tutti i dati in modo più organizzato.

## 📱 Compatibilità

- ✅ Chrome, Firefox, Safari, Edge
- ✅ Dispositivi desktop, tablet e mobile
- ✅ Design responsive per tutte le dimensioni dello schermo

## 🎨 Personalizzazione

### Colori e stili:
Modifica il file `styles.css` per personalizzare:
- Colori del tema
- Font e dimensioni
- Animazioni
- Layout responsive

### Funzionalità:
Modifica il file `script.js` per aggiungere:
- Nuove statistiche
- Grafici interattivi
- Filtri avanzati
- Export dei dati

## 📂 Struttura del progetto

```
novamont_and_friends/
├── index.html              # Pagina principale
├── styles.css              # Stili CSS responsive
├── script.js               # Logica JavaScript completa
├── config.js               # Configurazioni sistema
├── fantacalcio_data.json   # Dati reali del campionato
└── README.md               # Documentazione completa
```

### 🗂️ **Dettaglio File**
- **`index.html`**: Interface completa con 4 sezioni (Classifica, Classifica Ideale, Giornate, Statistiche)
- **`styles.css`**: 700+ righe di CSS responsive con animazioni e design moderno
- **`script.js`**: 1000+ righe di JavaScript con algoritmi avanzati e gestione dati
- **`fantacalcio_data.json`**: Database JSON con teams, rounds, matches e punteggi ideali
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

### 📊 **Aggiungere una Nuova Giornata**
```javascript
const nuovaGiornata = {
    round: 2,
    date: "Ottobre 2025",
    matches: [
        {
            homeTeam: "CUSIANA",
            awayTeam: "Real Ichnusa",
            homeScore: 75.5,
            awayScore: 82.0,
            homeIdealScore: 88.0,  // Punteggio con formazione ideale
            awayIdealScore: 85.5,
            homeGoals: 2,
            awayGoals: 3,
            homeIdealGoals: 4,
            awayIdealGoals: 4,
            result: "away",
            idealResult: "draw"
        }
        // ... altri match
    ]
};
```

### 🏆 **Struttura Dati Squadra Completa**
```javascript
const squadra = {
    id: 1,
    name: "CUSIANA",
    owner: "Manager",
    points: 3,              // Punti campionato
    wins: 1,
    draws: 0, 
    losses: 0,
    totalScore: 145.5,      // Somma punti fantacalcio
    goalsFor: 3,
    goalsAgainst: 2,
    goalDifference: 1,
    avgScore: 72.75,
    matchesPlayed: 2
};
```

## 🎯 Prossimi Sviluppi

### 📈 **Analytics Avanzate**
- [ ] Grafici interattivi con Chart.js (trend performance, confronti)
- [ ] Heatmap delle prestazioni per giornata
- [ ] Predizioni AI per prossime giornate
- [ ] Analisi dettagliate rosa squadre

### 🔐 **Sistema Utenti**
- [ ] Login personalizzato per ogni manager
- [ ] Dashboard privato con statistiche personali
- [ ] Sistema notifiche push per risultati
- [ ] Chat integrata tra squadre

### 🚀 **Integrazioni**
- [ ] API Fantacalcio® ufficiali per dati real-time
- [ ] Export PDF/Excel classifiche e statistiche
- [ ] Integrazione social (condivisione risultati)
- [ ] App mobile PWA (Progressive Web App)

### 🎮 **Gamification**
- [ ] Sistema achievement e trofei
- [ ] Storico confronti head-to-head
- [ ] Prediction game per prossimi risultati
- [ ] Classifica Fair Play e migliori manager

## 🤝 Contribuire

1. Fai un fork del progetto
2. Crea un branch per la tua feature (`git checkout -b feature/NuovaFunzione`)
3. Commit le tue modifiche (`git commit -m 'Aggiunge nuova funzione'`)
4. Push al branch (`git push origin feature/NuovaFunzione`)
5. Apri una Pull Request

## 📄 Licenza

Questo progetto è sotto licenza MIT. Vedi il file `LICENSE` per i dettagli.

## 👥 Team

Sviluppato con ❤️ per il Fantacalcio Novamont & Friends

---

**Ultimo aggiornamento**: 30 Settembre 2025 🚀
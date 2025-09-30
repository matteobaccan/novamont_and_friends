# 🏆 Fantacalcio Novamont & Friends

Sito web moderno per la gestione e visualizzazione della classifica del Fantacalcio Novamont & Friends.

## ✨ Caratteristiche

- **Classifica in tempo reale** con posizioni, punti, vittorie e medie
- **Risultati per giornata** con dettagli di ogni match
- **Statistiche avanzate** del torneo
- **Design moderno e responsive** ottimizzato per tutti i dispositivi
- **Animazioni fluide** e interfaccia intuitiva
- **Dati facilmente aggiornabili** tramite file JSON

## 🚀 Come utilizzare

1. **Aprire il sito**: Apri `index.html` in un browser web
2. **Navigare**: Usa i pulsanti nella barra di navigazione per spostarti tra le sezioni:
   - 🥇 **Classifica**: Visualizza la classifica generale
   - 📅 **Giornate**: Vedi i risultati per ogni giornata
   - 📊 **Statistiche**: Consulta le statistiche del torneo

## 📝 Aggiornare i dati

### Metodo semplice (modifica diretta nel JavaScript):
Modifica il file `script.js` nella sezione `fantacalcioData` per aggiornare:
- Classifica delle squadre
- Risultati delle giornate
- Data ultimo aggiornamento

### Metodo avanzato (file JSON):
Modifica il file `data.json` per gestire tutti i dati in modo più organizzato.

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
├── index.html          # Pagina principale
├── styles.css          # Stili CSS
├── script.js           # Logica JavaScript
├── data.json           # Dati del fantacalcio (opzionale)
└── README.md           # Documentazione
```

## 🔧 Funzioni avanzate

### Aggiungere una nuova giornata:
```javascript
const nuovaGiornata = {
    round: 4,
    date: "5 Settembre 2025",
    matches: [
        {
            homeTeam: "Squadra A",
            awayTeam: "Squadra B",
            homeScore: 85,
            awayScore: 78,
            result: "home"
        }
        // ... altri match
    ]
};

FantacalcioApp.addNewRound(nuovaGiornata);
```

### Aggiornare la classifica:
```javascript
const nuovaClassifica = [
    {
        name: "FC Novamont",
        points: 250,
        wins: 9,
        draws: 2,
        losses: 2,
        avgScore: 83.5
    }
    // ... altre squadre
];

FantacalcioApp.updateTeamStandings(nuovaClassifica);
```

## 🎯 Prossimi sviluppi

- [ ] Grafici interattivi con Chart.js
- [ ] Sistema di login per ogni squadra
- [ ] Storico confronti testa a testa
- [ ] Export PDF della classifica
- [ ] Notifiche push per nuovi risultati
- [ ] Integrazione con API fantacalcio

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

**Ultimo aggiornamento**: Settembre 2025
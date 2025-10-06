# 🏠 Sistema Bonus Casa - Calcolo Gol Ideali

## 📊 Come Funziona il Bonus Casa

Nel calcolo dei **gol ideali**, la squadra di casa riceve un **bonus di +1 punto** al punteggio prima del calcolo dei gol.

### Formula Completa

```javascript
// SQUADRA DI CASA
homeIdealScore = punteggioFantacalcio + 1  // Bonus casa
homeIdealGoals = Math.floor((homeIdealScore - 60) / 6)

// SQUADRA IN TRASFERTA
awayIdealScore = punteggioFantacalcio  // Nessun bonus
awayIdealGoals = Math.floor((awayIdealScore - 60) / 6)
```

## ⚖️ Regola Speciale: Pareggio con Grande Differenza

**Se il risultato ideale è un pareggio MA la differenza di punti è ≥ 4**:
- La squadra con il punteggio maggiore riceve **+1 gol bonus**
- Questo riflette la dominanza effettiva nonostante il pareggio nei gol

### Esempio:
```
Squadra A (casa): 78 pt + 1 (bonus) = 79 pt → 3 gol
Squadra B (trasferta): 83 pt → 3 gol
Risultato base: 3-3 (pareggio)

Differenza punti: |79 - 83| = 4 pt
→ Squadra B riceve +1 gol bonus
Risultato finale: 3-4 per Squadra B
```

## 🎯 Esempio Pratico: Real Ichnusa vs Cambra City

### Dati dal JSON:
```json
{
  "homeTeam": "Real Ichnusa",
  "awayTeam": "Cambra City",
  "homeIdealScore": 83,
  "awayIdealScore": 84.5
}
```

### Calcolo dei Gol Ideali:

#### Real Ichnusa (Casa):
1. Punteggio originale: **83 pt**
2. Bonus casa: **+1 pt**
3. Punteggio effettivo: **84 pt**
4. Calcolo gol: `(84 - 60) / 6 = 24 / 6 = 4 gol`

#### Cambra City (Trasferta):
1. Punteggio originale: **84.5 pt**
2. Bonus casa: **0 pt** (gioca in trasferta)
3. Punteggio effettivo: **84.5 pt**
4. Calcolo gol: `(84.5 - 60) / 6 = 24.5 / 6 = 4.08 → 4 gol`

### Risultato:
**Real Ichnusa 4-4 Cambra City** (Pareggio)

### Calcolo delle Differenze:

#### Real Ichnusa (Casa):
- Differenza punti: **84 pt - 77.5 pt = 6.5 pt** ⚠️ Usa 84 pt (con bonus)!
- Differenza gol: **4 gol - 2 gol = 2 gol**

#### Cambra City (Trasferta):
- Differenza punti: **84.5 pt - 78 pt = 6.5 pt**
- Differenza gol: **4 gol - 3 gol = 1 gol**

> ⚠️ **Importante**: La differenza di punti per la squadra di casa viene calcolata usando il punteggio ideale **con bonus** (84 pt), non quello grezzo (83 pt).

## 📺 Visualizzazione nell'Interfaccia

Nella sezione **Giornate** → **Formazioni Ideali vs Reali**, vedrai:

```
Real Ichnusa (Casa)
├─ Ideale: 4 gol (84 pt)
│  └─ 🏠 +1
├─ Reale: 2 gol (77.5 pt)
└─ Differenza: +6.5 pt (+2 gol)  ← Usa 84 pt!

Cambra City (Trasferta)
├─ Ideale: 4 gol (84.5 pt)
├─ Reale: 3 gol (78 pt)
└─ Differenza: +6.5 pt (+1 gol)
```

### Perché Mostriamo 84 pt invece di 83 pt?

**Motivo**: Per trasparenza e chiarezza!

- Il punteggio **83 pt** è quello "grezzo" dal JSON
- Il punteggio **84 pt** è quello **effettivamente usato** per calcolare i gol
- Mostrare 84 pt rende più chiaro all'utente come si arriva a quel numero di gol

## ⚠️ Nota Importante

### Il bonus casa si applica SOLO ai punteggi ideali!

| Tipo Punteggio | Bonus Casa | Motivo |
|----------------|------------|---------|
| **Punteggio Reale** | ❌ No | È il risultato effettivo della partita |
| **Punteggio Ideale** | ✅ Sì | Simula il vantaggio di giocare in casa |

### Perché il bonus solo sull'ideale?

Il punteggio **ideale** rappresenta il massimo potenziale della squadra. Il bonus casa riflette il **vantaggio statistico** di giocare nel proprio stadio:
- Maggiore conoscenza del campo
- Supporto dei tifosi
- Assenza di viaggio
- Condizioni familiari

## 🔢 Tabella di Riferimento Rapida

| Punteggio Grezzo | +Bonus Casa | Gol |
|------------------|-------------|-----|
| 60 | 61 | 0 |
| 65 | 66 | 1 |
| 71 | 72 | 2 |
| 77 | 78 | 3 |
| 83 | **84** | **4** |
| 89 | 90 | 5 |
| 95 | 96 | 6 |

## 💻 Codice di Riferimento

### Calcolo Gol Ideali (script.js):
```javascript
function calculateIdealGoalsFromScore(score, isHome = false) {
    // Applica il bonus di +1 punto solo per la squadra di casa
    const adjustedScore = isHome ? score + 1 : score;
    return calculateGoalsFromScore(adjustedScore);
}
```

### Visualizzazione con Bonus (script.js):
```javascript
const homeIdealScoreWithBonus = match.homeIdealScore + 1; // Bonus casa
const awayIdealScoreWithBonus = match.awayIdealScore;     // Nessun bonus

// Visualizza nella UI
${homeIdealGoals} gol (${homeIdealScoreWithBonus} pt)
<span class="bonus-indicator">+1</span>
```

## 🎨 Indicatore Visuale

L'indicatore del bonus casa è stilizzato con:
- 🏠 Icona casa
- Colore distintivo (#0c5460 tema light, #90caf9 tema dark)
- Font italic per enfatizzare
- Dimensione ridotta per non distrarre

## 🐛 Troubleshooting

### "Vedo 83 pt invece di 84 pt"
- Svuota la cache (icona 🧹)
- Forza refresh (Ctrl+F5)
- Controlla che la versione sia aggiornata

### "Il calcolo non torna"
Verifica nella console del browser (F12):
```
DEBUG Match 2:
homeIdealScore: 83
awayIdealScore: 84.5
homeIdealGoals calculated: 4
awayIdealGoals calculated: 4
```

## 📖 Riferimenti

- **Calcolo Base Gol**: Vedi `README.md` sezione "Calcolo Gol"
- **Classifica Ideale**: Vedi sezione "Classifica Ideale" nel sito
- **Gestione Cache**: Vedi `CACHE_MANAGEMENT.md`

---

**Aggiornato**: Ottobre 2025  
**Versione**: 2.0

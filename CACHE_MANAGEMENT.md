# 🧹 Gestione Cache - Fantacalcio Novamont & Friends

## 🎯 Problema Risolto

Questo documento spiega come abbiamo risolto i problemi di cache del browser che impedivano agli utenti di vedere gli aggiornamenti del sito, **specialmente per i dati JSON delle partite**.

## 🛠️ Soluzioni Implementate

### 1. **Cache Busting con Versioning**
Tutti i file CSS e JavaScript hanno un parametro di versione nell'URL:
```html
<link rel="stylesheet" href="styles.css?v=2.0">
<script src="script.js?v=2.0"></script>
```
**Come aggiornare**: Quando modifichi i file, incrementa il numero di versione in `index.html`.

### 2. **Cache Busting per JSON con Timestamp**
⭐ **NUOVO**: Il file JSON viene caricato con un timestamp dinamico:
```javascript
const timestamp = new Date().getTime();
const url = `fantacalcio_data.json?t=${timestamp}`;
fetch(url, { cache: 'no-store' })
```
Questo garantisce che **ogni richiesta ottenga sempre i dati più recenti**.

### 3. **Meta Tag Cache Control**
Aggiunto nell'HTML per impedire la cache della pagina principale:
```html
<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
<meta http-equiv="Pragma" content="no-cache">
<meta http-equiv="Expires" content="0">
```

### 4. **Service Worker Intelligente**
Il file `sw.js` gestisce la cache in modo smart:
- **Network-first** per `*.json` con bypass completo della cache HTTP
- **Cache-first** per CSS/JS (performance)
- **Pulizia automatica** delle vecchie cache JSON
- **Pattern matching** per gestire query string (`?t=123456`)

### 5. **Ricarica Dati Smart** 🏆
⭐ **NUOVO**: Cliccando il trofeo 🏆 nell'header:
- Ricarica **solo i dati JSON** senza refresh completo della pagina
- Mostra indicatore di caricamento
- Notifica di successo
- Mantiene la posizione e lo stato della pagina

### 6. **Notifica di Aggiornamento**
Gli utenti vedranno una notifica quando c'è una nuova versione:
```
🔄 Nuova versione disponibile!
[Aggiorna] [Più tardi]
```

### 7. **Pulsante Pulizia Cache Manuale**
Icona 🧹 nell'header che permette di:
- Svuotare tutte le cache
- Ricaricare la pagina completamente

### 8. **Configurazione Server (.htaccess)**
Regole di cache ottimizzate per Apache:
- HTML e JSON: **no cache** (sempre freschi)
- CSS/JS: cache 1 settimana con rivalidazione
- Immagini/Font: cache 1 anno (immutabili)

## 📋 Come Funziona

### Per i Dati JSON (Partite):
**3 Livelli di Protezione:**
1. **Timestamp nella richiesta**: `fantacalcio_data.json?t=1234567890`
2. **Headers no-cache**: `cache: 'no-store'`, `Cache-Control: no-cache`
3. **Service Worker bypass**: Nessuna cache per i file JSON

### Per gli Sviluppatori:
1. Modifica i file CSS/JS
2. Incrementa la versione in `index.html` (es: `v=2.0` → `v=2.1`)
3. Committa e pusha
4. Il Service Worker rileva l'aggiornamento
5. Gli utenti vedono la notifica

### Per gli Utenti:
**Metodo Automatico:**
- Vedono una notifica di aggiornamento
- Cliccano "Aggiorna"
- Il sito si ricarica con la nuova versione

**Metodo Manuale:**
- Cliccano l'icona 🧹 nell'header
- La cache viene svuotata
- Il sito si ricarica

## 🔧 Troubleshooting

### Problema: "Vedo ancora la vecchia versione"
**Soluzione 1**: Clicca l'icona 🧹 nell'header
**Soluzione 2**: Hard refresh (Ctrl+F5 o Cmd+Shift+R)
**Soluzione 3**: Svuota cache browser manualmente

### Problema: "Il Service Worker non si registra"
**Verifica**:
1. Apri DevTools (F12)
2. Tab "Application" → "Service Workers"
3. Controlla lo stato
4. Forza l'aggiornamento se necessario

### Problema: "La notifica non appare"
**Causa**: Il Service Worker è già aggiornato
**Soluzione**: Normale, significa che hai già l'ultima versione

## 📊 Strategia di Cache

| Tipo File | Strategia | Durata | Motivo |
|-----------|-----------|--------|---------|
| `index.html` | No cache | 0 sec | Sempre aggiornato |
| `fantacalcio_data.json` | Network-first | 0 sec | Dati dinamici |
| `script.js?v=X` | Cache-first | 1 settimana | Performance + versioning |
| `styles.css?v=X` | Cache-first | 1 settimana | Performance + versioning |
| Immagini | Cache | 1 anno | Immutabili |
| Font | Cache | 1 anno | Immutabili |

## 🚀 Deployment

### Su Netlify:
Il file `_headers` è già configurato (se necessario, crealo).

### Su Vercel:
Usa `vercel.json` per configurare le cache headers.

### Su server Apache:
Il file `.htaccess` è già incluso e configurato.

## 💡 Best Practices

1. **Incrementa sempre la versione** dopo modifiche a CSS/JS
2. **Testa in incognito** per verificare il cache busting
3. **Monitora il Service Worker** in DevTools
4. **Non cachare mai** i file JSON con dati dinamici
5. **Usa versioning semantico**: 2.0, 2.1, 3.0, etc.

## 🔄 Workflow di Aggiornamento

```bash
# 1. Modifica i file
vim script.js styles.css

# 2. Aggiorna la versione in index.html
# Cambia v=2.0 in v=2.1

# 3. Testa localmente
python -m http.server 8000
# Apri http://localhost:8000 in incognito

# 4. Committa
git add .
git commit -m "feat: aggiornamento calcoli + cache v2.1"
git push

# 5. Gli utenti riceveranno la notifica automaticamente
```

## 📱 Comportamento Mobile

- La notifica è responsive
- Il pulsante cache funziona anche su mobile
- Service Worker supportato da tutti i browser moderni

## ⚠️ Note Importanti

- Il Service Worker funziona **solo su HTTPS** (o localhost)
- La prima visita potrebbe essere più lenta (caching iniziale)
- Le visite successive sono molto più veloci
- La cache viene aggiornata automaticamente in background

## 🆘 Supporto

Se gli utenti hanno problemi:
1. Chiedi di cliccare l'icona 🧹
2. Se persiste, chiedi di fare Ctrl+F5
3. Come ultima risorsa, svuotare manualmente la cache del browser

---

**Versione attuale**: 2.0  
**Ultimo aggiornamento**: Ottobre 2025

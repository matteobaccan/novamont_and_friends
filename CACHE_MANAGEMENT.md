# 🧹 Gestione Cache - Fantacalcio Novamont & Friends

## 🎯 Problema Risolto

Questo documento spiega come abbiamo risolto i problemi di cache del browser che impedivano agli utenti di vedere gli aggiornamenti del sito, **specialmente per i dati JSON delle partite**.

## 🛠️ Soluzioni Implementate

### 1. **Cache Busting con Versioning**
Tutti i file CSS e JavaScript hanno un parametro di versione nell'URL:
```html
<link rel="stylesheet" href="styles.css?v=10.7">
<script src="script.js?v=10.7"></script>
```

**Come aggiornare**: il numero sta in **due file**, e vanno cambiati tutti e due insieme.

| File | Punti da cambiare |
|---|---|
| `index.html` | i quattro `?v=` di `styles.css`, `config.js`, `rigiocala.js`, `script.js` |
| `sw.js` | `CACHE_VERSION` (che dà il nome alla cache) e i quattro URL precaricati |

Cambiarne uno solo non lascia l'utente con i file vecchi — `caches.match()` confronta
l'URL **query string compresa**, quindi un `?v=` nuovo non trova niente in cache e la
richiesta va in rete. Rompe però le altre due cose che la versione tiene insieme:

- **Il sito installato resta senza CSS e JS offline.** `urlsToCache` in `sw.js` precarica
  `/script.js?v=10.7`: se `index.html` nel frattempo chiede `?v=10.8`, quel precaricamento
  non lo richiede nessuno e offline lo script non c'è. È lo stesso motivo del commento
  accanto all'URL di Font Awesome in `sw.js`.
- **La notifica di aggiornamento non parte.** Il browser se ne accorge confrontando i byte
  di `sw.js`: se quel file non cambia, per lui non c'è nessuna versione nuova, e la vecchia
  cache non viene nemmeno ripulita (`activate` cancella solo le cache con un altro nome).

In pratica una sostituzione sola su tutti e due i file:
```bash
sed -i 's/10\.7/10.8/g' index.html sw.js
```

### 2. **Cache Busting per JSON con Timestamp**
⭐ **NUOVO**: Il file JSON viene caricato con un timestamp dinamico:
```javascript
const timestamp = new Date().getTime();
const url = `data/${seasonFile}?t=${timestamp}`;
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
1. **Timestamp nella richiesta**: `data/2026-2027.json?t=1234567890`
2. **Headers no-cache**: `cache: 'no-store'`, `Cache-Control: no-cache`
3. **Service Worker bypass**: Nessuna cache per i file JSON

### Per gli Sviluppatori:
1. Modifica i file CSS/JS
2. Incrementa la versione in `index.html` **e** in `sw.js` (es: `10.7` → `10.8`)
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
| `data/*.json` | Network-first | 0 sec | Dati dinamici |
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

1. **Incrementa sempre la versione** dopo modifiche a CSS/JS, in tutti e due i file
2. **Testa in incognito** per verificare il cache busting
3. **Monitora il Service Worker** in DevTools
4. **Non cachare mai** i file JSON con dati dinamici
5. **Il numero è un contatore, non una versione semantica**: serve solo a essere diverso
   da quello di prima, quindi si incrementa il decimale e basta (10.7 → 10.8). Non vuole
   dire niente sulla portata della modifica

## 🔄 Workflow di Aggiornamento

```bash
# 1. Modifica i file
vim script.js styles.css

# 2. Aggiorna la versione in index.html e sw.js
sed -i 's/10\.7/10.8/g' index.html sw.js

# 3. Testa localmente
python -m http.server 8000
# Apri http://localhost:8000 in incognito

# 4. Committa
git add .
git commit -m "feat: aggiornamento calcoli + cache 10.8"
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

**Versione attuale**: 10.7  
**Ultimo aggiornamento**: Ottobre 2026

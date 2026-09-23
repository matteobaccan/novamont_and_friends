# 1. Manifest e icone (PWA)

## Il problema

`sw.js` esiste, è registrato e mette in cache `index.html`, `styles.css`,
`script.js` e `config.js`, con i dati in network-first. Ma senza un
`manifest.json` il browser non propone mai "Aggiungi a schermata Home": il sito
resta una pagina web anche per chi lo apre ogni domenica dal telefono.

Manca il manifest e mancano le icone. Nient'altro.

## I dati

Nessun dato di stagione. Serve solo materiale statico:

- `assets/logo.svg` — il marchio esiste già, animato, in `viewBox="0 0 172 56"`
- il colore di marca è `#f4b60a` (l'oro della coppa), il fondo scuro del tema
  di default parte da `#0f0c29`

## Comportamento

Creare `manifest.json` nella radice:

```json
{
  "name": "Fantacalcio Novamont & Friends",
  "short_name": "Novamont FC",
  "description": "Classifiche, giornate e formazioni della lega Novamont & Friends",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#0f0c29",
  "theme_color": "#f4b60a",
  "lang": "it",
  "icons": [ ... ]
}
```

Collegarlo da `index.html` nel `<head>`, insieme al `theme-color`:

```html
<link rel="manifest" href="manifest.json?v=<versione>">
<meta name="theme-color" content="#f4b60a">
<link rel="apple-touch-icon" href="assets/icona-180.png">
```

### Le icone

Servono PNG quadrati, perché il manifest SVG non è supportato ovunque:

| File | Misura | A cosa serve |
|------|--------|--------------|
| `assets/icona-192.png` | 192×192 | Android, requisito minimo |
| `assets/icona-512.png` | 512×512 | Splash screen Android |
| `assets/icona-180.png` | 180×180 | `apple-touch-icon` per iOS |
| `assets/icona-maskable-512.png` | 512×512 | `"purpose": "maskable"` |

L'icona **non** è il lockup con il nome: a 192px il testo è illeggibile. È la
sola coppa, centrata, su fondo pieno. La maskable va disegnata dentro la
*safe zone*: il contenuto sta nel cerchio centrale di diametro 80% del lato,
perché Android ritaglia il resto a piacere.

Il modo più diretto è un SVG sorgente `assets/icona.svg` con la sola coppa su
quadrato, convertito ai quattro PNG.

### Service worker

Aggiungere `manifest.json` e i PNG a `urlsToCache` in `sw.js`, e **alzare
`CACHE_VERSION`**: senza quello chi ha già visitato il sito continua a ricevere
il vecchio elenco.

## Interfaccia

Nessuna modifica visibile. L'unico effetto è il prompt di installazione del
browser e, a sito installato, l'assenza della barra degli indirizzi.

## Casi limite

- **iOS ignora quasi tutto il manifest.** Riconosce `apple-touch-icon` e
  `apple-mobile-web-app-capable`. Se l'icona iOS deve funzionare, va messo anche
  il meta, e l'icona non deve avere trasparenza: iOS la rende nera.
- **`start_url` e `scope` con il sito servito da sottocartella** non valgono
  più `/`. Su Netlify il sito è in radice, quindi `/` va bene, ma se qualcuno
  apre il repo con un server locale in sottocartella l'installazione fallisce
  in silenzio.
- **Il manifest non va in network-first.** È statico e versionato: se finisce
  nei `networkFirstPatterns` (che oggi prendono `/\.json$/`) verrà ricaricato
  a ogni avvio. **Attenzione: `manifest.json` finisce nel pattern `/\.json$/`
  così com'è.** Va escluso esplicitamente, o rinominato in modo da non
  terminare per `.json`.
- **`.htaccess` ha una whitelist dei file dati.** Verificare che `manifest.json`
  e `assets/*.png` siano serviti e non bloccati.

## Come si verifica

1. Chrome DevTools → Application → Manifest: nessun errore, le quattro icone
   caricate.
2. Lighthouse categoria PWA: "Installable" verde.
3. Sul telefono: il menu del browser mostra "Installa app" o "Aggiungi a Home".
4. Aperta dall'icona, la app parte senza barra degli indirizzi.
5. In aereo (offline) la pagina si apre comunque dalla cache, con i dati
   dell'ultima visita.

## Fuori scope

Notifiche push, sincronizzazione in background, badge sull'icona: richiedono un
server con stato e chiavi da custodire, che il README colloca già fuori portata.

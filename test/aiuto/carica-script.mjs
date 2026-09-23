// script.js è uno script da <script>: niente export, tutto nel global e quattro
// chiamate al DOM al livello più esterno. Per provarne le regole di calcolo lo
// si valuta in un contesto vm con degli stub, senza toccare il sito.
//
// Gli stub sono Proxy che accettano qualunque cosa e restituiscono se stessi:
// così una nuova riga di DOM in cima al file non fa fallire i test di
// aritmetica, che con il DOM non c'entrano niente. Se un giorno servisse
// provare davvero una vista, allora ci vorrebbe un DOM vero, non questo.

import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const QUI = path.dirname(fileURLToPath(import.meta.url));
const RADICE = path.resolve(QUI, '..', '..');

function stubIndulgente(nome) {
    const fn = function () { return stub; };
    const stub = new Proxy(fn, {
        get(_, prop) {
            if (prop === Symbol.toPrimitive) return () => `[stub ${nome}]`;
            if (prop === 'then') return undefined;       // non deve sembrare una promise
            if (prop === 'length') return 0;
            if (prop === 'classList') return stub;
            return stub;
        },
        set() { return true; },
        apply() { return stub; },
        construct() { return stub; },
        has() { return true; }
    });
    return stub;
}

export function caricaScript() {
    const sorgente = fs.readFileSync(path.join(RADICE, 'script.js'), 'utf8');

    const contesto = {
        console: { log() {}, warn() {}, error() {}, info() {} },
        document: stubIndulgente('document'),
        navigator: stubIndulgente('navigator'),
        localStorage: stubIndulgente('localStorage'),
        fetch: () => Promise.reject(new Error('i test non vanno in rete')),
        setTimeout: () => 0,
        clearTimeout: () => {},
        setInterval: () => 0,
        clearInterval: () => {},
        URLSearchParams,
        URL,
        Math, JSON, Date, Number, String, Object, Array, Set, Map, Intl, RegExp, Error, Promise
    };
    // window è il contesto stesso, quindi le poche funzioni che script.js gli
    // chiede al livello più esterno vanno messe qui a mano: un Proxy non si può
    // usare come contesto vm
    contesto.addEventListener = () => {};
    contesto.removeEventListener = () => {};
    contesto.dispatchEvent = () => true;
    contesto.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
    contesto.requestAnimationFrame = () => 0;
    contesto.scrollTo = () => {};
    contesto.scrollBy = () => {};
    contesto.getComputedStyle = () => ({ getPropertyValue: () => '' });
    contesto.location = { href: 'http://localhost/', search: '', pathname: '/' };
    contesto.history = { replaceState() {}, pushState() {} };

    contesto.window = contesto;
    contesto.globalThis = contesto;
    contesto.self = contesto;

    vm.createContext(contesto);
    vm.runInContext(sorgente, contesto, { filename: 'script.js' });
    return contesto;
}

// config.js definisce delle impostazioni che script.js si aspetta di trovare
// già caricate: qui non servono, ma se un giorno servissero si caricano allo
// stesso modo, prima del sorgente principale.
export const radiceProgetto = RADICE;

// I const al livello più esterno di script.js non diventano proprietà del
// global: stanno nello scope lessicale del contesto. Si leggono valutando
// un'espressione nello stesso contesto, non con contesto.NOME.
export function valuta(contesto, espressione) {
    return vm.runInContext(`(${espressione})`, contesto);
}

// Esegue un'istruzione nel contesto (per esempio assegnare fantacalcioData
// prima di chiamare una funzione che lo legge)
export function esegui(contesto, istruzione) {
    return vm.runInContext(istruzione, contesto);
}

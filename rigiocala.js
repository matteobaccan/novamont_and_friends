// "Rigiocala": ripercorre una partita su un campo visto dall'alto, stile
// Subbuteo, con i dischetti che si passano la palla e gli eventi che scoppiano
// addosso al protagonista.
//
// Quello che la partita ci dà davvero è una lista di voti, bonus e malus: non
// la cronologia dei minuti. Quindi i minuti qui sono inventati, ma in modo
// RIPETIBILE: il generatore casuale è seminato sul nome delle due squadre e
// sulla giornata, così riaprire la stessa partita rigioca la stessa partita, e
// due partite diverse non si somigliano. Niente Math.random: con quello ogni
// riapertura darebbe un'altra storia, e il pulsante sembrerebbe rotto.
//
// Il tabellino in alto mostra il risultato di lega, che è un dato e non lo
// decide l'animazione: nel fantacalcio i gol vengono dai punti, non dai gol
// dei giocatori, e infatti c'è chi segna e perde 0-2. La barra in basso conta
// i punti dai voti, che è un'altra grandezza e si chiama con il suo nome.

(function () {
    'use strict';

    const RUOLI_IN_CAMPO = ['P', 'D', 'C', 'A'];

    // Colonne per ruolo, in frazione di campo: il portiere sulla linea, poi
    // difesa, centrocampo e attacco verso il centro. La squadra di casa gioca
    // da sinistra, l'altra specchiata.
    const COLONNA = { P: 0.055, D: 0.17, C: 0.31, A: 0.43 };

    const CASA = '#e4572e';
    const FUORI = '#2e86ab';

    const DURATA_PASSAGGIO = 520;   // ms
    const DURATA_EVENTO = 1500;
    const DURATA_FINALE = 2600;

    // ----------------------------------------------------------------- caso
    // mulberry32: due righe, nessuna dipendenza, e basta per spargere dei
    // dischetti in campo senza che si sovrappongano sempre allo stesso modo.
    function seme(testo) {
        let h = 2166136261;
        for (let i = 0; i < testo.length; i++) {
            h ^= testo.charCodeAt(i);
            h = Math.imul(h, 16777619);
        }
        return h >>> 0;
    }

    function caso(s) {
        let a = s;
        return function () {
            a |= 0; a = (a + 0x6D2B79F5) | 0;
            let t = Math.imul(a ^ (a >>> 15), 1 | a);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    // ---------------------------------------------------------------- scena

    function nomeBreve(nome) {
        return (nome || '').length > 13 ? nome.slice(0, 12) + '.' : (nome || '?');
    }

    // Un giocatore della formazione, con tutto quello che serve a disegnarlo
    // e a far scoppiare i suoi eventi.
    function leggiGiocatore(riga, anagrafica) {
        const info = anagrafica[riga.p] || {};
        const ruolo = RUOLI_IN_CAMPO.includes(info.role) ? info.role : 'C';
        return {
            pid: riga.p,
            nome: info.name || `#${riga.p}`,
            ruolo,
            stato: riga.t,
            voto: riga.v,
            bonus: riga.b,
            senzaVoto: !!riga.sv || riga.v === undefined,
            eventi: riga.e || {}
        };
    }

    // Dispone una formazione in campo: una colonna per ruolo, i giocatori
    // dello stesso ruolo spalmati in verticale con un filo di disordine, così
    // non sembrano incollati su una griglia.
    function disponi(giocatori, lato, rnd) {
        const perRuolo = {};
        for (const g of giocatori) (perRuolo[g.ruolo] = perRuolo[g.ruolo] || []).push(g);

        for (const ruolo of RUOLI_IN_CAMPO) {
            const fila = perRuolo[ruolo] || [];
            fila.forEach((g, i) => {
                const passo = 1 / (fila.length + 1);
                const y = passo * (i + 1) + (rnd() - 0.5) * passo * 0.35;
                const x = COLONNA[ruolo] + (rnd() - 0.5) * 0.025;
                g.casa = lato === 'casa';
                g.x = lato === 'casa' ? x : 1 - x;
                g.y = Math.min(0.93, Math.max(0.07, y));
            });
        }
        return giocatori;
    }

    function costruisciSquadra(formazione, anagrafica, lato, rnd) {
        const righe = formazione.map(r => leggiGiocatore(r, anagrafica));

        // In campo all'inizio ci sono i titolari, anche quelli che poi
        // verranno sostituiti: "out" vuol dire uscito o non schierabile.
        const titolari = righe.filter(g => g.stato === 's' || g.stato === 'out');
        const entranti = righe.filter(g => g.stato === 'in');

        disponi(titolari, lato, rnd);
        // Chi entra prende il posto di chi esce, quindi la posizione gliela
        // diamo al momento del cambio: per ora sta fuori dal campo.
        for (const g of entranti) { g.casa = lato === 'casa'; g.x = -1; g.y = -1; }

        return { titolari, entranti, inCampo: titolari.slice() };
    }

    // Gli eventi di una squadra, ancora senza minuto.
    function eventiDi(squadra, chiave) {
        const fuori = [];
        for (const g of squadra.titolari.concat(squadra.entranti)) {
            const e = g.eventi;
            for (let i = 0; i < (e.gol || 0); i++) fuori.push({ tipo: 'gol', chi: g, lato: chiave });
            for (let i = 0; i < (e.autogol || 0); i++) fuori.push({ tipo: 'autogol', chi: g, lato: chiave });
            for (let i = 0; i < (e.assist || 0); i++) fuori.push({ tipo: 'assist', chi: g, lato: chiave });
            for (let i = 0; i < (e.amm || 0); i++) fuori.push({ tipo: 'ammonizione', chi: g, lato: chiave });
            for (let i = 0; i < (e.esp || 0); i++) fuori.push({ tipo: 'espulsione', chi: g, lato: chiave });
            for (let i = 0; i < (e.rigParato || 0); i++) fuori.push({ tipo: 'rigoreParato', chi: g, lato: chiave });
            for (let i = 0; i < (e.rigSbagliato || 0); i++) fuori.push({ tipo: 'rigoreSbagliato', chi: g, lato: chiave });
        }
        return fuori;
    }

    // Accoppia ogni assist col gol più vicino della stessa squadra: così la
    // palla arriva al marcatore dal piede di chi l'assist l'ha fatto davvero,
    // invece di inventarsi un passaggio qualsiasi.
    function accoppiaAssist(eventi) {
        const assist = eventi.filter(e => e.tipo === 'assist');
        const gol = eventi.filter(e => e.tipo === 'gol');
        for (const a of assist) {
            const suo = gol.find(g => g.lato === a.lato && !g.assistDi && g.chi.pid !== a.chi.pid);
            if (suo) { suo.assistDi = a.chi; a.assorbito = true; }
        }
        return eventi.filter(e => !e.assorbito);
    }

    // I cambi: chi esce lo sappiamo, chi entra lo sappiamo, l'ordine no. Si
    // appaiano in ordine e chi resta senza compagno e' un buco in formazione,
    // che e' esattamente quello che succede a chi finisce i cambi.
    function costruisciCambi(squadra, chiave, rnd) {
        const escono = squadra.titolari.filter(g => g.stato === 'out');
        const entrano = squadra.entranti.slice();
        const cambi = [];
        escono.forEach((esce, i) => {
            const entra = entrano[i];
            if (!entra) return;
            cambi.push({ tipo: 'cambio', chi: entra, esce, lato: chiave, minuto: 52 + Math.floor(rnd() * 8) + i * 6 });
        });
        return cambi;
    }

    // Sparge gli eventi su novanta minuti. L'ordine e' finto ma stabile, e i
    // cartellini stanno dopo l'inizio perche' un giallo al primo minuto fa
    // sempre un effetto strano.
    function assegnaMinuti(eventi, rnd) {
        const conMinuto = eventi.map(e => {
            const presto = e.tipo === 'ammonizione' || e.tipo === 'espulsione' ? 12 : 2;
            return Object.assign({}, e, { minuto: presto + Math.floor(rnd() * (88 - presto)) });
        });
        conMinuto.sort((a, b) => a.minuto - b.minuto || a.chi.pid - b.chi.pid);
        // Due eventi nello stesso minuto si leggono male nella barra: li
        // distanziamo di uno tenendo l'ordine.
        let ultimo = -1;
        for (const e of conMinuto) {
            if (e.minuto <= ultimo) e.minuto = ultimo + 1;
            ultimo = e.minuto;
        }
        return conMinuto;
    }

    const PUNTI = {
        gol: 3, autogol: -2, assist: 1, ammonizione: -0.5,
        espulsione: -1, rigoreParato: 3, rigoreSbagliato: -3
    };

    // Le chiavi con cui gli eventi stanno nei dati, e il momento che ne facciamo
    const TIPO_DA_CHIAVE = {
        gol: 'gol', autogol: 'autogol', assist: 'assist', amm: 'ammonizione',
        esp: 'espulsione', rigParato: 'rigoreParato', rigSbagliato: 'rigoreSbagliato'
    };

    // Quanto vale un giocatore PRIMA dei bonus che l'animazione fa scoppiare uno
    // per uno. Si ricava per sottrazione dal suo voto con bonus, non sommando i
    // pesi: così nella base finiscono da sole anche le voci che in campo non
    // mettiamo in scena — i gol subiti dal portiere, per dirne una, che non sono
    // un momento da rigiocare — e la barra arriva esatta sulla somma dei voti.
    function base(g) {
        if (g.senzaVoto) return 0;
        let animati = 0;
        for (const [chiave, quante] of Object.entries(g.eventi)) {
            const tipo = TIPO_DA_CHIAVE[chiave];
            if (tipo) animati += PUNTI[tipo] * quante;
        }
        return g.bonus - animati;
    }

    const ETICHETTA = {
        gol: 'GOL!', autogol: 'Autogol', assist: 'Assist', ammonizione: 'Ammonito',
        espulsione: 'Espulso', rigoreParato: 'Rigore parato!', rigoreSbagliato: 'Rigore sbagliato',
        cambio: 'Cambio'
    };

    // Costruisce i passi dell'animazione: qualche passaggio per arrivare al
    // protagonista, poi il suo momento. Ogni passo sa quando comincia, quindi
    // la barra si puo' trascinare senza ricalcolare niente.
    function costruisciPassi(scena, rnd) {
        const passi = [];
        let t = 0;

        const aggiungi = (passo, durata) => {
            passi.push(Object.assign(passo, { da: t, a: t + durata }));
            t += durata;
        };

        for (const ev of scena.eventi) {
            const squadra = ev.lato === 'casa' ? scena.casa : scena.fuori;
            // Solo chi resta in campo per tutta la partita: far passare la
            // palla a un sostituito la manderebbe in un punto vuoto.
            const disponibili = squadra.titolari.filter(
                g => g.stato === 's' && !g.senzaVoto && g.pid !== ev.chi.pid
            );

            // La catena di passaggi: due o tre compagni, e se l'assist c'e'
            // l'ultimo tocco e' suo.
            const catena = [];
            const quanti = 2 + Math.floor(rnd() * 2);
            for (let i = 0; i < quanti && disponibili.length; i++) {
                catena.push(disponibili[Math.floor(rnd() * disponibili.length)]);
            }
            if (ev.assistDi) catena.push(ev.assistDi);
            catena.push(ev.chi);

            for (let i = 1; i < catena.length; i++) {
                if (catena[i - 1].pid === catena[i].pid) continue;
                aggiungi({
                    tipo: 'passaggio',
                    dal: catena[i - 1],
                    al: catena[i],
                    assist: !!ev.assistDi && i === catena.length - 1,
                    minuto: ev.minuto
                }, DURATA_PASSAGGIO);
            }

            aggiungi({ tipo: 'evento', evento: ev, minuto: ev.minuto }, DURATA_EVENTO);
        }

        aggiungi({ tipo: 'fine', minuto: 90 }, DURATA_FINALE);
        return passi;
    }

    function costruisciScena(partita, anagrafica, giornata) {
        const rnd = caso(seme(`${giornata}|${partita.homeTeam}|${partita.awayTeam}`));

        const casa = costruisciSquadra(partita.lineups.home, anagrafica, 'casa', rnd);
        const fuori = costruisciSquadra(partita.lineups.away, anagrafica, 'fuori', rnd);

        let eventi = accoppiaAssist(eventiDi(casa, 'casa').concat(eventiDi(fuori, 'fuori')));
        eventi = assegnaMinuti(eventi, rnd)
            .concat(costruisciCambi(casa, 'casa', rnd), costruisciCambi(fuori, 'fuori', rnd))
            .sort((a, b) => a.minuto - b.minuto);

        const scena = { casa, fuori, eventi, partita };
        scena.passi = costruisciPassi(scena, rnd);
        scena.durata = scena.passi.length ? scena.passi[scena.passi.length - 1].a : 0;

        // Chi parte in campo porta subito la sua base; chi entra la porta al
        // momento del cambio. Questa somma non è il punteggio di lega, che
        // comprende anche il modificatore di difesa: per quello c'è il tabellino.
        for (const [chiave, squadra] of [['casa', casa], ['fuori', fuori]]) {
            scena[chiave].puntiIniziali = squadra.titolari.reduce((s, g) => s + base(g), 0);
        }
        return scena;
    }

    // ------------------------------------------------------------- disegno

    function variabile(nome, difetto) {
        const v = getComputedStyle(document.documentElement).getPropertyValue(nome).trim();
        return v || difetto;
    }

    function disegnaCampo(c, L, H) {
        const erba = c.createLinearGradient(0, 0, 0, H);
        erba.addColorStop(0, '#2f7d32');
        erba.addColorStop(1, '#276628');
        c.fillStyle = erba;
        c.fillRect(0, 0, L, H);

        // Strisce del taglio dell'erba
        c.fillStyle = 'rgba(255,255,255,0.035)';
        for (let i = 0; i < 10; i += 2) c.fillRect((L / 10) * i, 0, L / 10, H);

        c.strokeStyle = 'rgba(255,255,255,0.55)';
        c.lineWidth = Math.max(1, L * 0.0035);
        const m = L * 0.02;
        c.strokeRect(m, m, L - m * 2, H - m * 2);

        c.beginPath();
        c.moveTo(L / 2, m);
        c.lineTo(L / 2, H - m);
        c.stroke();

        c.beginPath();
        c.arc(L / 2, H / 2, H * 0.13, 0, Math.PI * 2);
        c.stroke();

        // Aree e porte, da entrambi i lati
        const areaL = L * 0.13, areaH = H * 0.52;
        for (const lato of [0, 1]) {
            const x = lato ? L - m - areaL : m;
            c.strokeRect(x, (H - areaH) / 2, areaL, areaH);
            const portaH = H * 0.24, portaL = L * 0.012;
            c.fillStyle = 'rgba(255,255,255,0.75)';
            c.fillRect(lato ? L - m : m - portaL, (H - portaH) / 2, portaL, portaH);
        }
    }

    function disegnaDischetto(c, g, raggio, evidenzia) {
        const x = g.px, y = g.py;

        c.beginPath();
        c.ellipse(x, y + raggio * 0.55, raggio * 0.95, raggio * 0.4, 0, 0, Math.PI * 2);
        c.fillStyle = 'rgba(0,0,0,0.28)';
        c.fill();

        c.beginPath();
        c.arc(x, y, raggio, 0, Math.PI * 2);
        c.fillStyle = g.casa ? CASA : FUORI;
        c.fill();
        c.lineWidth = raggio * 0.18;
        c.strokeStyle = 'rgba(255,255,255,0.9)';
        c.stroke();

        if (g.ammonito) {
            c.beginPath();
            c.arc(x, y, raggio * 1.45, 0, Math.PI * 2);
            c.strokeStyle = '#facc15';
            c.lineWidth = raggio * 0.22;
            c.stroke();
        }
        if (evidenzia) {
            c.beginPath();
            c.arc(x, y, raggio * 1.75, 0, Math.PI * 2);
            c.strokeStyle = '#ffffff';
            c.lineWidth = raggio * 0.16;
            c.stroke();
        }

        c.fillStyle = '#ffffff';
        c.font = `700 ${raggio * 0.95}px Poppins, system-ui, sans-serif`;
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillText(g.ruolo, x, y + raggio * 0.04);
    }

    function disegnaPalla(c, x, y, raggio) {
        c.beginPath();
        c.ellipse(x, y + raggio * 0.8, raggio * 0.9, raggio * 0.35, 0, 0, Math.PI * 2);
        c.fillStyle = 'rgba(0,0,0,0.3)';
        c.fill();

        c.beginPath();
        c.arc(x, y, raggio, 0, Math.PI * 2);
        c.fillStyle = '#ffffff';
        c.fill();
        c.strokeStyle = 'rgba(0,0,0,0.35)';
        c.lineWidth = raggio * 0.25;
        c.stroke();
    }

    // L'etichetta sta sopra il protagonista, ma se lassù non ci sta scende
    // sotto: meglio spostarla che incollarla al bordo sopra il dischetto.
    function altezzaEtichetta(c, testo, sotto, L) {
        const dim = Math.max(11, L * 0.026);
        return sotto ? dim * 2.9 : dim * 1.9;
    }

    function disegnaEtichetta(c, testo, sotto, x, y, L) {
        const dim = Math.max(11, L * 0.026);
        c.font = `700 ${dim}px Poppins, system-ui, sans-serif`;
        const largo = Math.max(c.measureText(testo).width, c.measureText(sotto || '').width) + dim * 1.4;
        const alto = sotto ? dim * 2.9 : dim * 1.9;
        const bx = Math.min(Math.max(x - largo / 2, 4), L - largo - 4);
        const by = Math.max(y, 4);

        c.fillStyle = 'rgba(12,16,28,0.86)';
        if (c.roundRect) {
            c.beginPath();
            c.roundRect(bx, by, largo, alto, dim * 0.5);
            c.fill();
        } else {
            c.fillRect(bx, by, largo, alto);
        }

        c.fillStyle = '#ffffff';
        c.textAlign = 'center';
        c.textBaseline = 'top';
        c.fillText(testo, bx + largo / 2, by + dim * 0.45);
        if (sotto) {
            c.font = `500 ${dim * 0.82}px Poppins, system-ui, sans-serif`;
            c.fillStyle = 'rgba(255,255,255,0.82)';
            c.fillText(sotto, bx + largo / 2, by + dim * 1.65);
        }
    }

    // ---------------------------------------------------------- il lettore

    function apri(partita, anagrafica, giornata, titolo) {
        const scena = costruisciScena(partita, anagrafica, giornata);

        const velo = document.createElement('div');
        velo.className = 'rigiocala-velo';
        velo.innerHTML = `
            <div class="rigiocala" role="dialog" aria-modal="true" aria-label="Rigioca ${partita.homeTeam} contro ${partita.awayTeam}">
                <div class="rigiocala-testa">
                    <div class="rigiocala-squadre">
                        <span class="rigiocala-casa">${partita.homeTeam}</span>
                        <strong class="rigiocala-risultato">${titolo}</strong>
                        <span class="rigiocala-fuori">${partita.awayTeam}</span>
                    </div>
                    <button class="rigiocala-chiudi" aria-label="Chiudi">&times;</button>
                </div>
                <canvas class="rigiocala-campo"></canvas>
                <div class="rigiocala-punti">
                    <div><span class="rigiocala-pallino casa"></span>${partita.homeTeam}: <b data-punti="casa">0</b> punti dai voti</div>
                    <div><span class="rigiocala-pallino fuori"></span>${partita.awayTeam}: <b data-punti="fuori">0</b> punti dai voti</div>
                </div>
                <div class="rigiocala-barra"><div class="rigiocala-avanzamento"></div></div>
                <div class="rigiocala-comandi">
                    <button class="rigiocala-via" aria-label="Pausa">&#10073;&#10073;</button>
                    <button class="rigiocala-daccapo">Daccapo</button>
                    <span class="rigiocala-minuto">0'</span>
                    <label class="rigiocala-velocita">
                        <input type="range" min="0.5" max="3" step="0.5" value="1" aria-label="Velocità">
                        <span>1x</span>
                    </label>
                </div>
                <ol class="rigiocala-diario" aria-live="polite"></ol>
            </div>`;
        document.body.appendChild(velo);
        document.body.style.overflow = 'hidden';

        const tela = velo.querySelector('.rigiocala-campo');
        const c = tela.getContext('2d');
        const diario = velo.querySelector('.rigiocala-diario');
        const avanzamento = velo.querySelector('.rigiocala-avanzamento');
        const minuto = velo.querySelector('.rigiocala-minuto');
        const via = velo.querySelector('.rigiocala-via');
        const cursore = velo.querySelector('.rigiocala-velocita input');
        const etichettaVel = velo.querySelector('.rigiocala-velocita span');

        let L = 0, H = 0;
        function dimensiona() {
            const larghezza = tela.clientWidth || 320;
            // Proporzione da campo, ma non più alto di mezza finestra: su
            // telefono un 2:3 mangerebbe tutto lo schermo
            const altezza = Math.min(larghezza * 0.62, window.innerHeight * 0.52);
            const dpr = window.devicePixelRatio || 1;
            tela.width = Math.round(larghezza * dpr);
            tela.height = Math.round(altezza * dpr);
            tela.style.height = altezza + 'px';
            c.setTransform(dpr, 0, 0, dpr, 0, 0);
            L = larghezza; H = altezza;
        }
        dimensiona();

        let tempo = 0;
        let inPausa = false;
        let velocita = 1;
        let ultimo = performance.now();
        let coriandoli = [];
        let vistiFinora = -1;

        const bordo = () => Math.min(L, H) * 0.028;

        function posizionaTutti() {
            for (const squadra of [scena.casa, scena.fuori]) {
                for (const g of squadra.titolari.concat(squadra.entranti)) {
                    g.px = L * 0.02 + g.x * (L * 0.96);
                    g.py = H * 0.04 + g.y * (H * 0.92);
                }
            }
        }

        // Rimette la scena allo stato che le compete al tempo dato: serve sia
        // per andare avanti sia per trascinare la barra indietro, e per questo
        // si ricostruisce da zero invece di accumulare.
        function statoAl(t) {
            for (const squadra of [scena.casa, scena.fuori]) {
                squadra.inCampo = squadra.titolari.slice();
                for (const g of squadra.titolari.concat(squadra.entranti)) {
                    g.ammonito = false;
                    g.fuoriCampo = false;
                }
            }
            let punti = { casa: scena.casa.puntiIniziali, fuori: scena.fuori.puntiIniziali };
            const accaduti = [];

            for (const passo of scena.passi) {
                if (passo.tipo !== 'evento' || passo.a > t) continue;
                const ev = passo.evento;
                accaduti.push(ev);
                if (PUNTI[ev.tipo] !== undefined) punti[ev.lato] += PUNTI[ev.tipo];
                // L'assist non ha un momento suo: è il passaggio che porta al
                // gol, quindi il suo punto si somma lì.
                if (ev.assistDi) punti[ev.lato] += PUNTI.assist;

                const squadra = ev.lato === 'casa' ? scena.casa : scena.fuori;
                if (ev.tipo === 'ammonizione') ev.chi.ammonito = true;
                if (ev.tipo === 'espulsione') {
                    ev.chi.fuoriCampo = true;
                    squadra.inCampo = squadra.inCampo.filter(g => g.pid !== ev.chi.pid);
                }
                if (ev.tipo === 'cambio') {
                    ev.chi.x = ev.esce.x; ev.chi.y = ev.esce.y;
                    ev.esce.fuoriCampo = true;
                    squadra.inCampo = squadra.inCampo.filter(g => g.pid !== ev.esce.pid).concat([ev.chi]);
                    punti[ev.lato] += base(ev.chi);
                }
            }
            return { punti, accaduti };
        }

        function scriviDiario(accaduti) {
            if (accaduti.length === vistiFinora) return;
            vistiFinora = accaduti.length;
            diario.innerHTML = accaduti.map(ev => {
                const delta = PUNTI[ev.tipo];
                const segno = delta === undefined ? '' : `<span class="${delta >= 0 ? 'su' : 'giu'}">${delta > 0 ? '+' : ''}${delta}</span>`;
                const chi = ev.tipo === 'cambio' ? `${nomeBreve(ev.esce.nome)} &rarr; ${nomeBreve(ev.chi.nome)}` : nomeBreve(ev.chi.nome);
                return `<li class="${ev.lato}"><span class="min">${ev.minuto}'</span> <b>${ETICHETTA[ev.tipo]}</b> ${chi} ${segno}</li>`;
            }).reverse().join('');
        }

        function passoAl(t) {
            for (const p of scena.passi) if (t >= p.da && t < p.a) return p;
            return scena.passi[scena.passi.length - 1];
        }

        function fotogramma(ora) {
            const dt = Math.min(64, ora - ultimo);
            ultimo = ora;
            if (!inPausa) tempo = Math.min(scena.durata, tempo + dt * velocita);

            // Prima lo stato, poi le posizioni: il cambio assegna al giocatore
            // che entra il posto di quello che esce, e senza quest'ordine per
            // un fotogramma lo disegneremmo ancora fuori dal campo.
            const { punti, accaduti } = statoAl(tempo);
            posizionaTutti();
            const passo = passoAl(tempo);
            const avanti = (tempo - passo.da) / Math.max(1, passo.a - passo.da);

            c.clearRect(0, 0, L, H);
            disegnaCampo(c, L, H);

            const raggio = bordo();
            const protagonista = passo.tipo === 'evento' ? passo.evento.chi
                : passo.tipo === 'passaggio' ? passo.al : null;

            for (const squadra of [scena.casa, scena.fuori]) {
                for (const g of squadra.inCampo) {
                    if (g.fuoriCampo) continue;
                    disegnaDischetto(c, g, raggio, protagonista && g.pid === protagonista.pid);
                }
            }

            // La palla: in viaggio durante un passaggio, addosso al
            // protagonista durante un evento, in porta su gol e autogol.
            let bx, by;
            if (passo.tipo === 'passaggio') {
                const e = avanti * avanti * (3 - 2 * avanti); // ammorbidita
                bx = passo.dal.px + (passo.al.px - passo.dal.px) * e;
                by = passo.dal.py + (passo.al.py - passo.dal.py) * e - Math.sin(Math.PI * e) * raggio * 1.6;
            } else if (passo.tipo === 'evento' && (passo.evento.tipo === 'gol' || passo.evento.tipo === 'autogol')) {
                const g = passo.evento.chi;
                // La squadra di casa attacca a destra: il suo gol finisce
                // nella porta di destra, il suo autogol in quella di casa.
                const versoDestra = passo.evento.tipo === 'gol' ? g.casa : !g.casa;
                const meta = versoDestra ? L * 0.985 : L * 0.015;
                const e = Math.min(1, avanti * 1.8);
                bx = g.px + (meta - g.px) * e;
                by = g.py + (H / 2 - g.py) * e;
            } else {
                const g = protagonista || scena.casa.inCampo[0];
                bx = g ? g.px : L / 2;
                by = g ? g.py : H / 2;
            }
            disegnaPalla(c, bx, by, raggio * 0.42);

            if (passo.tipo === 'evento') {
                const ev = passo.evento;
                const delta = PUNTI[ev.tipo];
                const sotto = delta === undefined
                    ? `${nomeBreve(ev.esce.nome)} esce`
                    : `${nomeBreve(ev.chi.nome)}  ${delta > 0 ? '+' : ''}${delta}`;
                const alta = altezzaEtichetta(c, ETICHETTA[ev.tipo], sotto, L);
                const sopra = ev.chi.py - raggio * 2.4 - alta;
                disegnaEtichetta(c, ETICHETTA[ev.tipo], sotto,
                    ev.chi.px, sopra >= 6 ? sopra : ev.chi.py + raggio * 2.4, L);

                if (ev.tipo === 'gol' && avanti < 0.12 && coriandoli.length === 0) {
                    for (let i = 0; i < 90; i++) {
                        coriandoli.push({
                            x: bx, y: by,
                            vx: (Math.random() - 0.5) * 7,
                            vy: -Math.random() * 7 - 1.5,
                            col: ['#facc15', '#f87171', '#34d399', '#60a5fa', '#ffffff'][i % 5],
                            vita: 1
                        });
                    }
                }
            } else if (passo.tipo === 'fine') {
                disegnaEtichetta(c, 'Fine', titolo, L / 2, H * 0.1, L);
            }

            if (coriandoli.length) {
                for (const p of coriandoli) {
                    p.x += p.vx * velocita; p.y += p.vy * velocita;
                    p.vy += 0.26 * velocita; p.vita -= 0.012 * velocita;
                    c.globalAlpha = Math.max(0, p.vita);
                    c.fillStyle = p.col;
                    c.fillRect(p.x, p.y, raggio * 0.32, raggio * 0.32);
                }
                c.globalAlpha = 1;
                coriandoli = coriandoli.filter(p => p.vita > 0);
            }

            velo.querySelector('[data-punti="casa"]').textContent = punti.casa.toFixed(1);
            velo.querySelector('[data-punti="fuori"]').textContent = punti.fuori.toFixed(1);
            avanzamento.style.width = (tempo / scena.durata * 100) + '%';
            minuto.textContent = `${passo.minuto}'`;
            scriviDiario(accaduti);

            if (tempo >= scena.durata) {
                inPausa = true;
                via.innerHTML = '&#9654;';
                via.setAttribute('aria-label', 'Riproduci');
            }
            if (velo.isConnected) requestAnimationFrame(fotogramma);
        }

        function chiudi() {
            velo.remove();
            document.body.style.overflow = '';
            window.removeEventListener('resize', dimensiona);
            document.removeEventListener('keydown', tasti);
        }

        function tasti(e) {
            if (e.key === 'Escape') chiudi();
            if (e.key === ' ' || e.code === 'Space') {
                e.preventDefault();
                alterna();
            }
        }

        function alterna() {
            if (tempo >= scena.durata) { tempo = 0; coriandoli = []; vistiFinora = -1; }
            inPausa = !inPausa;
            via.innerHTML = inPausa ? '&#9654;' : '&#10073;&#10073;';
            via.setAttribute('aria-label', inPausa ? 'Riproduci' : 'Pausa');
        }

        via.addEventListener('click', alterna);
        velo.querySelector('.rigiocala-daccapo').addEventListener('click', () => {
            tempo = 0; coriandoli = []; vistiFinora = -1; inPausa = false;
            via.innerHTML = '&#10073;&#10073;';
        });
        velo.querySelector('.rigiocala-chiudi').addEventListener('click', chiudi);
        velo.addEventListener('click', e => { if (e.target === velo) chiudi(); });
        cursore.addEventListener('input', () => {
            velocita = Number(cursore.value);
            etichettaVel.textContent = velocita + 'x';
        });
        velo.querySelector('.rigiocala-barra').addEventListener('click', e => {
            const r = e.currentTarget.getBoundingClientRect();
            tempo = Math.max(0, Math.min(scena.durata, (e.clientX - r.left) / r.width * scena.durata));
            coriandoli = []; vistiFinora = -1;
        });
        window.addEventListener('resize', dimensiona);
        document.addEventListener('keydown', tasti);

        requestAnimationFrame(fotogramma);
    }

    window.Rigiocala = { apri, costruisciScena };
})();

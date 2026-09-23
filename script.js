// ============================================
// SERVICE WORKER REGISTRATION & CACHE MANAGEMENT
// ============================================

// Registra il Service Worker se supportato
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then((registration) => {
                console.log('Service Worker registrato con successo:', registration.scope);
                
                // Controlla aggiornamenti ogni 5 minuti
                setInterval(() => {
                    registration.update();
                }, 5 * 60 * 1000);
                
                // Gestisce gli aggiornamenti del service worker
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            // Nuovo contenuto disponibile, notifica l'utente
                            showUpdateNotification();
                        }
                    });
                });
            })
            .catch((error) => {
                console.log('Registrazione Service Worker fallita:', error);
            });
    });
}

// Funzione per mostrare notifica di aggiornamento
function showUpdateNotification() {
    const notification = document.createElement('div');
    notification.className = 'update-notification';
    notification.innerHTML = `
        <div class="update-content">
            <i class="fas fa-sync-alt"></i>
            <span>Nuova versione disponibile!</span>
            <button onclick="updateApp()" class="update-btn">Aggiorna</button>
            <button onclick="dismissUpdate()" class="dismiss-btn">Più tardi</button>
        </div>
    `;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.add('show');
    }, 100);
}

// Funzione per aggiornare l'app
function updateApp() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistration().then((registration) => {
            if (registration && registration.waiting) {
                registration.waiting.postMessage({ type: 'SKIP_WAITING' });
            }
        });
    }
    // Ricarica la pagina forzando il bypass della cache
    window.location.reload(true);
}

// Funzione per dismissare la notifica
function dismissUpdate() {
    const notification = document.querySelector('.update-notification');
    if (notification) {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }
}

// Manual cache-clear button removed — cache management handled via service worker update flow and
// the trophy reload (reloadDataOnly) which refreshes JSON without forcing a full page reload.

// ============================================
// ALGORITMI DI CALCOLO GOL
// ============================================

// Algoritmo per calcolare i gol dal punteggio fantacalcio
function calculateGoalsFromScore(score) {
    // Il primo gol si ottiene a 66 punti, poi ogni 6 punti in più
    // 66 punti = 1 gol, 72 punti = 2 gol, 78 punti = 3 gol
    if (score < 66) {
        return 0;
    }
    return Math.floor((score - 60) / 6);
}

// Funzione per calcolare i gol di una partita considerando la regola del bonus
function calculateMatchGoals(homeScore, awayScore) {
    let homeGoals = calculateGoalsFromScore(homeScore);
    let awayGoals = calculateGoalsFromScore(awayScore);
    
    // Se i gol sono uguali, verifica la differenza di punti
    // Se la differenza è >= 4 punti, chi ha il punteggio maggiore riceve 1 gol in più
    if (homeGoals === awayGoals) {
        const scoreDifference = Math.abs(homeScore - awayScore);
        if (scoreDifference >= 4) {
            if (homeScore > awayScore) {
                homeGoals += 1;
            } else if (awayScore > homeScore) {
                awayGoals += 1;
            }
        }
    }
    
    return { homeGoals, awayGoals };
}

// Algoritmo per calcolare i gol ideali con bonus casa
function calculateIdealGoalsFromScore(score, isHome = false) {
    // Applica il bonus di +1 punto solo per la squadra di casa nei punteggi ideali
    const adjustedScore = isHome ? score + 1 : score;
    return calculateGoalsFromScore(adjustedScore);
}

// Funzione per determinare il risultato del match
function getMatchResult(homeScore, awayScore) {
    const { homeGoals, awayGoals } = calculateMatchGoals(homeScore, awayScore);
    
    if (homeGoals > awayGoals) return "home";
    if (awayGoals > homeGoals) return "away";
    return "draw";
}

// Funzione per calcolare il risultato considerando i gol ideali con bonus casa
function getIdealMatchResult(homeScore, awayScore) {
    const homeGoals = calculateIdealGoalsFromScore(homeScore, true);
    const awayGoals = calculateIdealGoalsFromScore(awayScore, false);
    
    if (homeGoals > awayGoals) return "home";
    if (awayGoals > homeGoals) return "away";
    
    // In caso di pareggio, verifica la differenza di punti
    // Se la differenza è >= 4 punti, chi ha il punteggio maggiore riceve 1 gol in più
    const homeScoreWithBonus = homeScore + 1; // Bonus casa
    const scoreDifference = Math.abs(homeScoreWithBonus - awayScore);
    
    if (scoreDifference >= 4) {
        if (homeScoreWithBonus > awayScore) return "home";
        if (awayScore > homeScoreWithBonus) return "away";
    }
    
    return "draw";
}

// Funzione per calcolare la classifica dai risultati
function calculateStandingsFromResults() {
    console.log('Calcolo classifica - dati disponibili:', fantacalcioData);
    
    if (!fantacalcioData || !fantacalcioData.teams || !fantacalcioData.rounds) {
        console.error('Dati mancanti per il calcolo della classifica');
        return [];
    }
    
    // Inizializza le statistiche per ogni squadra
    const standings = {};
    fantacalcioData.teams.forEach(team => {
        standings[team.name] = {
            id: team.id,
            name: team.name,
            // Il risultato di questa funzione sostituisce fantacalcioData.teams:
            // senza riportare owner, il proprietario andrebbe perso
            owner: team.owner,
            points: 0,
            wins: 0,
            draws: 0,
            losses: 0,
            totalScore: 0,
            matchesPlayed: 0,
            avgScore: 0,
            goalsFor: 0,
            goalsAgainst: 0,
            goalDifference: 0
        };
    });
    
    // Calcola statistiche dai risultati
    fantacalcioData.rounds.forEach(round => {
        round.matches.forEach(match => {
            const homeTeam = match.homeTeam;
            const awayTeam = match.awayTeam;
            const result = getMatchResult(match.homeScore, match.awayScore);
            const { homeGoals, awayGoals } = calculateMatchGoals(match.homeScore, match.awayScore);
            
            // Aggiorna statistiche squadra casa
            standings[homeTeam].totalScore += match.homeScore;
            standings[homeTeam].matchesPlayed += 1;
            standings[homeTeam].goalsFor += homeGoals;
            standings[homeTeam].goalsAgainst += awayGoals;
            
            // Aggiorna statistiche squadra ospite
            standings[awayTeam].totalScore += match.awayScore;
            standings[awayTeam].matchesPlayed += 1;
            standings[awayTeam].goalsFor += awayGoals;
            standings[awayTeam].goalsAgainst += homeGoals;
            
            // Assegna punti
            if (result === "home") {
                standings[homeTeam].points += 3;
                standings[homeTeam].wins += 1;
                standings[awayTeam].losses += 1;
            } else if (result === "away") {
                standings[awayTeam].points += 3;
                standings[awayTeam].wins += 1;
                standings[homeTeam].losses += 1;
            } else {
                standings[homeTeam].points += 1;
                standings[awayTeam].points += 1;
                standings[homeTeam].draws += 1;
                standings[awayTeam].draws += 1;
            }
        });
    });
    
    // Calcola le medie e differenza reti
    Object.values(standings).forEach(team => {
        if (team.matchesPlayed > 0) {
            team.avgScore = parseFloat((team.totalScore / team.matchesPlayed).toFixed(1));
        }
        team.goalDifference = team.goalsFor - team.goalsAgainst;
    });
    
    // Converte in array e ordina per punti, poi per totale punti
    return Object.values(standings).sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        return b.totalScore - a.totalScore;
    });
}

// Funzione per calcolare la classifica ideale
function calculateIdealStandingsFromResults() {
    console.log('Calcolo classifica ideale - dati disponibili:', fantacalcioData);
    
    if (!fantacalcioData || !fantacalcioData.teams || !fantacalcioData.rounds) {
        console.error('Dati mancanti per il calcolo della classifica ideale');
        return [];
    }
    
    // Inizializza le statistiche per ogni squadra
    const standings = {};
    fantacalcioData.teams.forEach(team => {
        standings[team.name] = {
            id: team.id,
            name: team.name,
            points: 0,
            wins: 0,
            draws: 0,
            losses: 0,
            totalScore: 0,
            matchesPlayed: 0,
            avgScore: 0,
            goalsFor: 0,
            goalsAgainst: 0,
            goalDifference: 0
        };
    });
    
    // Calcola statistiche dai risultati ideali
    fantacalcioData.rounds.forEach(round => {
        round.matches.forEach(match => {
            // Usa i punteggi ideali se disponibili, altrimenti i reali
            const homeScore = match.homeIdealScore || match.homeScore;
            const awayScore = match.awayIdealScore || match.awayScore;
            
            // Applica il bonus casa al punteggio ideale della squadra di casa
            const homeScoreWithBonus = homeScore + 1;
            
            const homeTeam = match.homeTeam;
            const awayTeam = match.awayTeam;
            const result = getIdealMatchResult(homeScore, awayScore);
            const homeGoals = calculateIdealGoalsFromScore(homeScore, true);
            const awayGoals = calculateIdealGoalsFromScore(awayScore, false);
            
            // Aggiorna statistiche squadra casa (usa punteggio con bonus per la media)
            standings[homeTeam].totalScore += homeScoreWithBonus;
            standings[homeTeam].matchesPlayed += 1;
            standings[homeTeam].goalsFor += homeGoals;
            standings[homeTeam].goalsAgainst += awayGoals;
            
            // Aggiorna statistiche squadra ospite
            standings[awayTeam].totalScore += awayScore;
            standings[awayTeam].matchesPlayed += 1;
            standings[awayTeam].goalsFor += awayGoals;
            standings[awayTeam].goalsAgainst += homeGoals;
            
            // Assegna punti
            if (result === "home") {
                standings[homeTeam].points += 3;
                standings[homeTeam].wins += 1;
                standings[awayTeam].losses += 1;
            } else if (result === "away") {
                standings[awayTeam].points += 3;
                standings[awayTeam].wins += 1;
                standings[homeTeam].losses += 1;
            } else {
                standings[homeTeam].points += 1;
                standings[awayTeam].points += 1;
                standings[homeTeam].draws += 1;
                standings[awayTeam].draws += 1;
            }
        });
    });
    
    // Calcola le medie e differenza reti
    Object.values(standings).forEach(team => {
        if (team.matchesPlayed > 0) {
            team.avgScore = parseFloat((team.totalScore / team.matchesPlayed).toFixed(1));
        }
        team.goalDifference = team.goalsFor - team.goalsAgainst;
    });
    
    // Converte in array e ordina per punti, poi per totale punti
    return Object.values(standings).sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        return b.totalScore - a.totalScore;
    });
}

// Funzione per formattare il risultato come stringa
function formatMatchScore(homeScore, awayScore) {
    const { homeGoals, awayGoals } = calculateMatchGoals(homeScore, awayScore);
    return `${homeGoals}-${awayGoals}`;
}

// Variabile globale per i dati del fantacalcio (stagione attualmente visualizzata)
let fantacalcioData = null;

// Indice delle stagioni disponibili e id della stagione a video
let seasonsIndex = null;
let currentSeasonId = null;

const SEASONS_INDEX_PATH = 'data/seasons.json';
const SEASON_STORAGE_KEY = 'fantacalcio-season';
const SEASON_URL_PARAM = 'stagione';

// Scarica un JSON bypassando ogni cache: i dati devono essere sempre freschi
async function fetchJsonNoCache(path) {
    // Cache busting: aggiungi timestamp per forzare il reload
    const timestamp = new Date().getTime();
    const separator = path.includes('?') ? '&' : '?';
    const url = `${path}${separator}t=${timestamp}`;

    const response = await fetch(url, {
        cache: 'no-store', // Forza il bypass della cache del browser
        headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
        }
    });

    if (!response.ok) {
        throw new Error(`Errore HTTP su ${path}! Status: ${response.status}`);
    }

    return response.json();
}

// Funzione per caricare l'indice delle stagioni disponibili
async function loadSeasonsIndex() {
    try {
        seasonsIndex = await fetchJsonNoCache(SEASONS_INDEX_PATH);

        if (!seasonsIndex || !Array.isArray(seasonsIndex.seasons) || seasonsIndex.seasons.length === 0) {
            throw new Error(`L'indice ${SEASONS_INDEX_PATH} non contiene nessuna stagione`);
        }

        console.log('Indice stagioni caricato:', seasonsIndex);
        return seasonsIndex;
    } catch (error) {
        console.error('Impossibile caricare l\'indice delle stagioni:', error.message);
        throw error;
    }
}

// Cerca una stagione nell'indice, null se l'id non esiste
function getSeasonById(seasonId) {
    if (!seasonsIndex || !seasonId) return null;
    return seasonsIndex.seasons.find(season => season.id === seasonId) || null;
}

// Legge la stagione salvata in localStorage (che può non essere disponibile)
function readStoredSeasonId() {
    try {
        return localStorage.getItem(SEASON_STORAGE_KEY);
    } catch (error) {
        console.warn('localStorage non accessibile:', error.message);
        return null;
    }
}

// Determina quale stagione mostrare: parametro URL > scelta salvata > stagione corrente
function resolveInitialSeasonId() {
    const fromUrl = new URLSearchParams(window.location.search).get(SEASON_URL_PARAM);
    if (getSeasonById(fromUrl)) return fromUrl;

    const stored = readStoredSeasonId();
    if (getSeasonById(stored)) return stored;

    if (getSeasonById(seasonsIndex.currentSeason)) return seasonsIndex.currentSeason;

    return seasonsIndex.seasons[0].id;
}

// Ricorda la stagione scelta, sia in localStorage che nell'URL (link condivisibile)
function persistSeasonChoice(seasonId) {
    try {
        localStorage.setItem(SEASON_STORAGE_KEY, seasonId);
    } catch (error) {
        console.warn('Impossibile salvare la stagione scelta:', error.message);
    }

    const url = new URL(window.location.href);
    url.searchParams.set(SEASON_URL_PARAM, seasonId);
    window.history.replaceState({}, '', url);
}

// Funzione per caricare i dati di una singola stagione dal file JSON
async function loadSeasonData(seasonId) {
    const season = getSeasonById(seasonId);

    if (!season) {
        throw new Error(`Stagione "${seasonId}" non presente in ${SEASONS_INDEX_PATH}`);
    }

    try {
        fantacalcioData = await fetchJsonNoCache(season.file);
        currentSeasonId = season.id;
        console.log(`Dati della stagione ${season.id} caricati con successo:`, fantacalcioData);
        return fantacalcioData;
    } catch (error) {
        console.error(`Impossibile caricare i dati della stagione ${seasonId}:`, error.message);
        // Rilanciamo l'errore per gestirlo nell'inizializzazione
        throw error;
    }
}

// Mostra un indicatore di caricamento a schermo e ne restituisce il riferimento
function showLoadingIndicator(message) {
    const loadingIndicator = document.createElement('div');
    loadingIndicator.className = 'loading-indicator';
    loadingIndicator.innerHTML = `
        <div class="loading-content">
            <i class="fas fa-sync-alt fa-spin"></i>
            <span>${message}</span>
        </div>
    `;
    document.body.appendChild(loadingIndicator);
    setTimeout(() => loadingIndicator.classList.add('show'), 10);
    return loadingIndicator;
}

function hideLoadingIndicator(loadingIndicator) {
    if (!loadingIndicator) return;
    setTimeout(() => {
        loadingIndicator.classList.remove('show');
        setTimeout(() => loadingIndicator.remove(), 300);
    }, 500);
}

// Ricalcola la classifica dai risultati e ridisegna tutte le sezioni
function renderAllSections() {
    if (fantacalcioData && fantacalcioData.teams && fantacalcioData.rounds) {
        fantacalcioData.teams = calculateStandingsFromResults();
    }

    displayStandings();
    displayIdealStandings();
    displayMeritStandings();
    displayHeatmap();
    displayStatistics();
    setupRoundSelector();
    updateLastUpdate();
    updateSeasonLabels();

    // Aggiorna la giornata corrente se siamo nella tab giornate
    const activeTab = document.querySelector('.tab-content.active');
    if (activeTab && activeTab.id === 'giornate') {
        const roundSelect = document.getElementById('giornata-select');
        if (roundSelect && roundSelect.value) {
            displayRoundResults(parseInt(roundSelect.value));
        }
    } else if (activeTab && activeTab.id === 'rose') {
        displayRosters();
    } else if (activeTab && activeTab.id === 'formazione') {
        displayFormazione();
    }
}

// Funzione per ricaricare solo i dati JSON senza refresh completo
async function reloadDataOnly() {
    const loadingIndicator = showLoadingIndicator('Aggiornamento dati in corso...');

    try {
        console.log('Ricaricamento dati in corso...');

        await loadSeasonData(currentSeasonId);
        renderAllSections();

        hideLoadingIndicator(loadingIndicator);
        console.log('Dati aggiornati con successo!');

        // Mostra notifica di successo
        showSuccessNotification('Dati aggiornati!');

    } catch (error) {
        hideLoadingIndicator(loadingIndicator);
        console.error('Errore durante il ricaricamento dei dati:', error);
        showErrorNotification('Errore nell\'aggiornamento. Ricarica la pagina.');
    }
}

// Cambia la stagione visualizzata ricaricando il JSON corrispondente
async function switchSeason(seasonId) {
    if (!seasonId || seasonId === currentSeasonId) return;

    const previousSeasonId = currentSeasonId;
    const season = getSeasonById(seasonId);
    const loadingIndicator = showLoadingIndicator(`Caricamento stagione ${season ? season.label : seasonId}...`);

    try {
        await loadSeasonData(seasonId);
        persistSeasonChoice(seasonId);
        renderAllSections();

        hideLoadingIndicator(loadingIndicator);
        showSuccessNotification(`Stagione ${season.label}`);

    } catch (error) {
        hideLoadingIndicator(loadingIndicator);
        console.error('Errore durante il cambio stagione:', error);
        showErrorNotification('Impossibile caricare la stagione selezionata.');

        // Riporta il selettore sulla stagione effettivamente a video
        const select = document.getElementById('season-select');
        if (select) select.value = previousSeasonId;
    }
}

// Popola il selettore stagione nell'header e ne gestisce il cambio
function setupSeasonSelector() {
    const select = document.getElementById('season-select');
    if (!select || !seasonsIndex) return;

    select.innerHTML = seasonsIndex.seasons
        .map(season => `<option value="${season.id}">${season.label}</option>`)
        .join('');
    select.value = currentSeasonId;

    select.addEventListener('change', () => switchSeason(select.value));
}

// Allinea al nome della stagione attiva le scritte fisse di header e footer
function updateSeasonLabels() {
    const season = getSeasonById(currentSeasonId);
    if (!season) return;

    document.title = `Fantacalcio Novamont & Friends ${season.label}`;

    const footerSeason = document.getElementById('footer-season');
    if (footerSeason) {
        footerSeason.textContent = season.label.replace('-', '/');
    }
}

// Funzione per mostrare notifica di successo
function showSuccessNotification(message) {
    showNotification(message, 'success-notification', 'fa-check-circle');
}

// Funzione per mostrare notifica di errore
function showErrorNotification(message) {
    showNotification(message, 'error-notification', 'fa-exclamation-circle', 4000);
}

function showNotification(message, className, iconClass, duration = 2000) {
    const notification = document.createElement('div');
    notification.className = className;
    notification.innerHTML = `
        <i class="fas ${iconClass}"></i>
        <span>${message}</span>
    `;
    document.body.appendChild(notification);

    setTimeout(() => notification.classList.add('show'), 10);
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, duration);
}

// Inizializzazione dell'applicazione
document.addEventListener('DOMContentLoaded', async function() {
    await initializeApp();
});

// Funzione per mostrare un messaggio d'errore all'utente
function showErrorMessage(error) {
    const mainContent = document.querySelector('main') || document.body;
    
    const errorContainer = document.createElement('div');
    errorContainer.className = 'error-message';
    errorContainer.innerHTML = `
        <i class="fas fa-exclamation-triangle"></i>
        <h2>Errore nel Caricamento dei Dati</h2>
        <p>Non è stato possibile caricare i dati del fantacalcio. Verifica che i file nella cartella "data/" (a partire da "seasons.json") siano presenti e accessibili.</p>
        <div class="error-details">
            <strong>Dettagli tecnici:</strong><br>
            ${error.message}
        </div>
        <p>Ricarica la pagina per riprovare.</p>
    `;
    
    // Rimuovi tutto il contenuto esistente e mostra solo l'errore
    mainContent.innerHTML = '';
    mainContent.appendChild(errorContainer);
}

async function initializeApp() {
    try {
        // Carica l'elenco delle stagioni e i dati di quella da mostrare
        await loadSeasonsIndex();
        await loadSeasonData(resolveInitialSeasonId());
        await loadProbabiliFormazioni();

        setupNavigationTabs();
        setupSeasonSelector();

        // Verifica che i dati siano caricati correttamente
        if (!fantacalcioData) {
            throw new Error('Nessun dato disponibile dopo il caricamento');
        }

        console.log('Dati disponibili:', fantacalcioData);
        console.log('Teams:', fantacalcioData.teams);
        console.log('Rounds:', fantacalcioData.rounds);

        // Lo stesso disegno di un cambio stagione o di un ricarico dati: una
        // lista sola. Quando stava scritta due volte, la copia qui dentro
        // restava indietro a ogni sezione nuova — la heatmap non compariva al
        // primo caricamento ma solo tornando sulla scheda.
        renderAllSections();

    } catch (error) {
        console.error('Errore durante l\'inizializzazione:', error);
        // Mostra un messaggio di errore visibile all'utente
        showErrorMessage(error);
    }
}

// Gestione delle tab di navigazione
function setupNavigationTabs() {
    const navButtons = document.querySelectorAll('.nav-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    navButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTab = button.getAttribute('data-tab');

            // Rimuovi active da tutti i bottoni e contenuti
            navButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));

            // Aggiungi active al bottone cliccato e al contenuto corrispondente
            button.classList.add('active');
            document.getElementById(targetTab).classList.add('active');
            
            // Aggiorna contenuti specifici dei tab
            if (targetTab === 'classifica-ideale') {
                displayIdealStandings();
            } else if (targetTab === 'classifica-merito') {
                displayMeritStandings();
            } else if (targetTab === 'classifica') {
                displayStandings();
                displayHeatmap();
            } else if (targetTab === 'rose') {
                displayRosters();
            } else if (targetTab === 'formazione') {
                displayFormazione();
            }
        });
    });
}

// Stato dell'ordinamento
let sortState = {
    column: 'points',
    direction: 'desc'
};

// Stato dell'ordinamento classifica ideale
let idealSortState = {
    column: 'points',
    direction: 'desc'
};

// Funzione per ordinare i team
function sortTeams(teams, column, direction) {
    return teams.slice().sort((a, b) => {
        let valueA, valueB;
        
        switch(column) {
            case 'name':
                valueA = a.name.toLowerCase();
                valueB = b.name.toLowerCase();
                break;
            case 'points':
            case 'wins':
            case 'draws':
            case 'losses':
            case 'avgScore':
            case 'matchesPlayed':
            case 'goalsFor':
            case 'goalsAgainst':
            case 'goalDifference':
            case 'totalScore':
            case 'positionDifference':
            case 'pointsDifference':
            case 'scoreDifference':
            case 'meritPoints':
            case 'primi':
            case 'podi':
            case 'avgPosition':
                valueA = a[column] || 0;
                valueB = b[column] || 0;
                break;
            case 'position':
                // Per posizione, usa l'indice attuale (non ordinabile realmente)
                return 0;
            default:
                return 0;
        }
        
        if (valueA === valueB) {
            if (column === 'points' || column === 'meritPoints') {
                return direction === 'asc' ? a.totalScore - b.totalScore : b.totalScore - a.totalScore;
            }
            return 0;
        }
        
        if (direction === 'asc') {
            return valueA > valueB ? 1 : -1;
        } else {
            return valueA < valueB ? 1 : -1;
        }
    });
}

// ============================================================
// Classifica di merito
// ============================================================

// La scala della Formula 1 dal 2010 in poi. Premia il vertice senza azzerare
// chi arriva in fondo, e su otto squadre arriva fino a 4 punti: ogni giornata
// muove la classifica anche per chi non è salito sul podio. Oltre la decima
// piazza si prende zero, così la scala regge anche leghe più numerose.
const PUNTI_MERITO = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];

// Quante piazze del podio contano come podio
const PIAZZE_PODIO = 3;

// Assegna i punti di una singola giornata. Il punteggio è il voto grezzo della
// squadra, quello che il JSON già riporta: il bonus casa non c'entra, perché
// entra solo nella conversione in gol ed è un vantaggio del calendario, non un
// merito di chi ha schierato la formazione.
//
// A pari punteggio le piazze contese valgono la loro media: due squadre
// appaiate al secondo posto prendono (18 + 15) / 2 = 16,5 a testa. Così il
// monte punti della giornata è sempre lo stesso, comunque finisca, e nessuno
// guadagna dal fatto che un'altra squadra lo abbia raggiunto.
function puntiMeritoDiGiornata(punteggi) {
    const ordinati = punteggi.slice().sort((a, b) => b.score - a.score);
    const assegnati = new Map();

    let i = 0;
    while (i < ordinati.length) {
        let ultimo = i;
        while (ultimo + 1 < ordinati.length && ordinati[ultimo + 1].score === ordinati[i].score) ultimo += 1;

        let monte = 0;
        for (let k = i; k <= ultimo; k += 1) monte += PUNTI_MERITO[k] || 0;
        const quota = monte / (ultimo - i + 1);

        for (let k = i; k <= ultimo; k += 1) {
            assegnati.set(ordinati[k].team, { punti: quota, posizione: i + 1 });
        }
        i = ultimo + 1;
    }

    return assegnati;
}

// Classifica meritocratica: ogni giornata è una gara a sé, si guarda solo il
// voto e si distribuiscono i punti come in Formula 1. Chi fa il punteggio più
// alto vince la giornata anche se in campionato ha pescato l'avversario che
// quel giorno ha fatto ancora meglio.
// I punteggi di una giornata, pronti per essere ordinati. Una partita non
// ancora giocata non e' una gara: va saltata, non contata come uno zero che
// affosserebbe tutti allo stesso modo.
function punteggiDiGiornata(round) {
    const punteggi = [];
    (round.matches || []).forEach(match => {
        if (typeof match.homeScore !== 'number' || typeof match.awayScore !== 'number') return;
        punteggi.push({ team: match.homeTeam, score: match.homeScore });
        punteggi.push({ team: match.awayTeam, score: match.awayScore });
    });
    return punteggi;
}

// Giornata per giornata, com'e' andata a una squadra nella gara di quel turno.
// I punti persi sono la distanza dal massimo in palio: chi vince la giornata
// non perde niente, chi arriva ottavo lascia sul piatto 21 dei 25 punti.
function meritoPerGiornata(teamName) {
    const perGiornata = new Map();
    (fantacalcioData.rounds || []).forEach(round => {
        const punteggi = punteggiDiGiornata(round);
        if (punteggi.length === 0) return;
        const mio = punteggi.find(p => p.team === teamName);
        if (!mio) return;

        const esito = puntiMeritoDiGiornata(punteggi).get(teamName);
        const massimo = PUNTI_MERITO[0] || 0;
        perGiornata.set(round.round, {
            punti: Math.round(esito.punti * 10) / 10,
            posizione: esito.posizione,
            persi: Math.round((massimo - esito.punti) * 10) / 10,
            inGara: punteggi.length,
            punteggio: mio.score
        });
    });
    return perGiornata;
}

function calculateMeritStandings() {
    if (!fantacalcioData || !fantacalcioData.teams || !fantacalcioData.rounds) {
        console.error('Dati mancanti per il calcolo della classifica di merito');
        return [];
    }

    const merito = {};
    fantacalcioData.teams.forEach(team => {
        merito[team.name] = {
            name: team.name,
            meritPoints: 0,
            primi: 0,
            podi: 0,
            giornate: 0,
            sommaPosizioni: 0,
            avgPosition: 0,
            miglioreGiornata: null,
            totalScore: 0,
            avgScore: 0
        };
    });

    fantacalcioData.rounds.forEach(round => {
        const punteggi = punteggiDiGiornata(round);
        if (punteggi.length === 0) return;

        const assegnati = puntiMeritoDiGiornata(punteggi);
        punteggi.forEach(({ team, score }) => {
            const s = merito[team];
            if (!s) return;
            const esito = assegnati.get(team);
            s.meritPoints += esito.punti;
            s.giornate += 1;
            s.sommaPosizioni += esito.posizione;
            s.totalScore += score;
            if (esito.posizione === 1) s.primi += 1;
            if (esito.posizione <= PIAZZE_PODIO) s.podi += 1;
            if (s.miglioreGiornata === null || score > s.miglioreGiornata) s.miglioreGiornata = score;
        });
    });

    Object.values(merito).forEach(s => {
        s.meritPoints = Math.round(s.meritPoints * 10) / 10;
        s.avgPosition = s.giornate > 0 ? Math.round((s.sommaPosizioni / s.giornate) * 100) / 100 : 0;
        s.avgScore = s.giornate > 0 ? Math.round((s.totalScore / s.giornate) * 100) / 100 : 0;
        s.totalScore = Math.round(s.totalScore * 10) / 10;
    });

    // A pari punti di merito decide chi ha fatto più punteggio: è la stessa
    // grandezza che la classifica misura, solo senza la scala a gradini
    return Object.values(merito).sort((a, b) => b.meritPoints - a.meritPoints || b.totalScore - a.totalScore);
}

// ============================================================
// Heatmap giornata x squadra
// ============================================================

// La media di una squadra nasconde tutto quello che conta: chi fa 70 ogni
// domenica e chi alterna 90 e 50 hanno la stessa media e due stagioni opposte.
// La heatmap mostra la costanza, che nessuna tabella del sito racconta.

// Le soglie sono percentili della stagione mostrata, non valori assoluti: i
// punteggi reali stanno quasi sempre fra 55 e 90, e una scala fissa 0-100 li
// schiaccerebbe tutti nella stessa tinta. La banda centrale contiene la
// mediana, che e' il punto in cui la scala diverge.
function percentile(ordinati, q) {
    if (ordinati.length === 0) return null;
    const posizione = (ordinati.length - 1) * q;
    const sotto = Math.floor(posizione);
    const sopra = Math.ceil(posizione);
    if (sotto === sopra) return ordinati[sotto];
    return ordinati[sotto] + (ordinati[sopra] - ordinati[sotto]) * (posizione - sotto);
}

function calcolaHeatmap() {
    if (!fantacalcioData || !fantacalcioData.teams || !fantacalcioData.rounds) return null;

    const giornate = [];
    const perSquadra = {};
    fantacalcioData.teams.forEach(t => { perSquadra[t.name] = new Map(); });

    const tutti = [];
    fantacalcioData.rounds.forEach(round => {
        const punteggi = punteggiDiGiornata(round);
        if (punteggi.length === 0) return;
        giornate.push(round.round);
        punteggi.forEach(({ team, score }) => {
            if (!perSquadra[team]) perSquadra[team] = new Map();
            perSquadra[team].set(round.round, score);
            tutti.push(score);
        });
    });

    if (giornate.length === 0) return null;

    const ordinati = tutti.slice().sort((a, b) => a - b);
    const soglie = [0.2, 0.4, 0.6, 0.8].map(q => percentile(ordinati, q));
    // Con tutti i punteggi uguali le soglie coincidono e non c'e' niente da
    // distinguere: le caselle restano neutre invece di dividersi a caso
    const piatta = soglie[0] === soglie[3];

    const livello = (score) => {
        if (piatta) return 'neutro';
        if (score < soglie[0]) return 'bassa-2';
        if (score < soglie[1]) return 'bassa-1';
        if (score < soglie[2]) return 'neutro';
        if (score < soglie[3]) return 'alta-1';
        return 'alta-2';
    };

    const squadre = Object.entries(perSquadra)
        .filter(([, punteggi]) => punteggi.size > 0)
        .map(([nome, punteggi]) => {
            const valori = [...punteggi.values()];
            const media = valori.reduce((a, b) => a + b, 0) / valori.length;
            // Deviazione standard di popolazione: e' la classifica della
            // costanza, e non esiste da nessun'altra parte nel sito
            const varianza = valori.reduce((somma, v) => somma + (v - media) ** 2, 0) / valori.length;
            return {
                nome,
                media: Math.round(media * 100) / 100,
                totale: Math.round(valori.reduce((a, b) => a + b, 0) * 10) / 10,
                deviazione: valori.length > 1 ? Math.round(Math.sqrt(varianza) * 100) / 100 : null,
                celle: giornate.map(g => {
                    const score = punteggi.has(g) ? punteggi.get(g) : null;
                    return { round: g, score, livello: score === null ? null : livello(score) };
                })
            };
        });

    return { giornate, squadre, soglie, piatta, minimo: ordinati[0], massimo: ordinati[ordinati.length - 1] };
}

// Come sono ordinate le righe: per punteggio totale, o per costanza
let ordineHeatmap = 'totale';

function displayHeatmap() {
    const contenitore = document.getElementById('heatmap-punteggi');
    if (!contenitore) return;

    const dati = calcolaHeatmap();
    if (!dati || dati.squadre.length === 0) {
        contenitore.innerHTML = '';
        return;
    }

    // Sotto le due giornate non c'e' un andamento da guardare
    if (dati.giornate.length < 2) {
        contenitore.innerHTML = `
            <div class="heatmap-blocco">
                <p class="nessun-dato">La heatmap parte dalla seconda giornata: con una sola non c'è un andamento da mostrare.</p>
            </div>
        `;
        return;
    }

    const righe = dati.squadre.slice().sort((a, b) => {
        // Deviazione bassa vuol dire piu' costante, quindi in cima
        if (ordineHeatmap === 'costanza') return (a.deviazione ?? Infinity) - (b.deviazione ?? Infinity);
        return b.totale - a.totale;
    });

    const intestazione = dati.giornate
        .map(g => `<span class="hm-giornata" title="Giornata ${g}">${g}</span>`)
        .join('');

    const corpo = righe.map(sq => `
        <span class="hm-squadra" title="${sq.nome}: ${sq.totale} punti in ${dati.giornate.length} giornate, media ${sq.media}${sq.deviazione !== null ? `, scarto tipico ${sq.deviazione}` : ''}">${sq.nome}</span>
        ${sq.celle.map(c => c.score === null
            ? `<span class="hm-cella vuota" title="Giornata ${c.round}: ${sq.nome} non ha giocato"></span>`
            : `<span class="hm-cella ${c.livello}" title="Giornata ${c.round} — ${sq.nome}: ${c.score} punti">${c.score}</span>`
        ).join('')}
    `).join('');

    const legenda = dati.piatta
        ? '<span class="hm-nota">Tutti i punteggi sono uguali: non c\'è una scala da mostrare.</span>'
        : `
            <span class="hm-nota">Fasce di punteggio della stagione, dalla più bassa alla più alta. La banda centrale contiene la mediana.</span>
            <span class="hm-scala">
                <span class="hm-estremo">${dati.minimo}</span>
                <span class="hm-cella bassa-2" title="Sotto ${Math.round(dati.soglie[0] * 10) / 10} punti"></span>
                <span class="hm-cella bassa-1" title="Fra ${Math.round(dati.soglie[0] * 10) / 10} e ${Math.round(dati.soglie[1] * 10) / 10}"></span>
                <span class="hm-cella neutro" title="Fra ${Math.round(dati.soglie[1] * 10) / 10} e ${Math.round(dati.soglie[2] * 10) / 10}: la fascia della mediana"></span>
                <span class="hm-cella alta-1" title="Fra ${Math.round(dati.soglie[2] * 10) / 10} e ${Math.round(dati.soglie[3] * 10) / 10}"></span>
                <span class="hm-cella alta-2" title="Sopra ${Math.round(dati.soglie[3] * 10) / 10} punti"></span>
                <span class="hm-estremo">${dati.massimo}</span>
            </span>
        `;

    contenitore.innerHTML = `
        <div class="heatmap-blocco">
            <div class="heatmap-testa">
                <h3><i class="fas fa-table-cells"></i> Punteggi giornata per giornata</h3>
                <div class="heatmap-ordine">
                    <button type="button" class="hm-ordine-btn ${ordineHeatmap === 'totale' ? 'attivo' : ''}" data-ordine="totale">Per punteggio</button>
                    <button type="button" class="hm-ordine-btn ${ordineHeatmap === 'costanza' ? 'attivo' : ''}" data-ordine="costanza">Per costanza</button>
                </div>
            </div>
            <p class="heatmap-nota">
                La media dice dove sei arrivato, non come: qui si vede chi tiene lo stesso passo
                tutte le domeniche e chi alterna exploit e tonfi${ordineHeatmap === 'costanza' ? '. In cima i più regolari' : ''}.
            </p>
            <div class="heatmap-scroll">
                <div class="heatmap-griglia" style="--giornate: ${dati.giornate.length}">
                    <span class="hm-angolo"></span>
                    ${intestazione}
                    ${corpo}
                </div>
            </div>
            <div class="heatmap-legenda">${legenda}</div>
        </div>
    `;

    contenitore.querySelectorAll('.hm-ordine-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            ordineHeatmap = btn.dataset.ordine;
            displayHeatmap();
        });
    });
}

// Visualizzazione della classifica con ordinamento
function displayStandings() {
    const standingsTable = document.getElementById('standings-table');
    
    console.log('DisplayStandings chiamata con dati:', fantacalcioData);
    
    if (!fantacalcioData || !fantacalcioData.teams || fantacalcioData.teams.length === 0) {
        console.error('Nessun team disponibile per la visualizzazione');
        standingsTable.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: #666;">
                <p>Nessuna squadra trovata. Caricamento in corso...</p>
            </div>
        `;
        return;
    }
    
    // Calcola la classifica dai risultati
    const standings = calculateStandingsFromResults();
    console.log('Classifica calcolata:', standings);
    
    // Ordina i team secondo lo stato attuale
    const sortedTeams = sortTeams(standings, sortState.column, sortState.direction);
    console.log('Teams ordinati:', sortedTeams);
    
    // Trova i punteggi totali più alti e più bassi
    let maxTotalScore = -Infinity;
    let minTotalScore = Infinity;
    
    standings.forEach(team => {
        if (team.totalScore > maxTotalScore) maxTotalScore = team.totalScore;
        if (team.totalScore < minTotalScore) minTotalScore = team.totalScore;
    });

    let html = `
        <table class="standings-table" id="main-standings-table">
            <thead>
                <tr class="table-header">
                    <th class="sortable-header" data-column="position" data-table="main">
                        Pos. <i class="fas fa-sort"></i>
                    </th>
                    <th class="sortable-header" data-column="name" data-table="main">
                        Squadra <i class="fas fa-sort ${sortState.column === 'name' ? (sortState.direction === 'asc' ? 'fa-sort-up' : 'fa-sort-down') : ''}"></i>
                    </th>
                    <th class="sortable-header" data-column="points" data-table="main">
                        Pt <i class="fas fa-sort ${sortState.column === 'points' ? (sortState.direction === 'asc' ? 'fa-sort-up' : 'fa-sort-down') : ''}"></i>
                    </th>
                    <th class="sortable-header mobile-hide" data-column="wins" data-table="main">
                        V <i class="fas fa-sort ${sortState.column === 'wins' ? (sortState.direction === 'asc' ? 'fa-sort-up' : 'fa-sort-down') : ''}"></i>
                    </th>
                    <th class="sortable-header mobile-hide" data-column="draws" data-table="main">
                        P <i class="fas fa-sort ${sortState.column === 'draws' ? (sortState.direction === 'asc' ? 'fa-sort-up' : 'fa-sort-down') : ''}"></i>
                    </th>
                    <th class="sortable-header mobile-hide" data-column="losses" data-table="main">
                        S <i class="fas fa-sort ${sortState.column === 'losses' ? (sortState.direction === 'asc' ? 'fa-sort-up' : 'fa-sort-down') : ''}"></i>
                    </th>
                    <th class="sortable-header mobile-hide" data-column="goalsFor" data-table="main">
                        GF <i class="fas fa-sort ${sortState.column === 'goalsFor' ? (sortState.direction === 'asc' ? 'fa-sort-up' : 'fa-sort-down') : ''}"></i>
                    </th>
                    <th class="sortable-header mobile-hide" data-column="goalsAgainst" data-table="main">
                        GS <i class="fas fa-sort ${sortState.column === 'goalsAgainst' ? (sortState.direction === 'asc' ? 'fa-sort-up' : 'fa-sort-down') : ''}"></i>
                    </th>
                    <th class="sortable-header mobile-hide" data-column="goalDifference" data-table="main">
                        DR <i class="fas fa-sort ${sortState.column === 'goalDifference' ? (sortState.direction === 'asc' ? 'fa-sort-up' : 'fa-sort-down') : ''}"></i>
                    </th>
                    <th class="sortable-header mobile-hide" data-column="totalScore" data-table="main">
                        Totale <i class="fas fa-sort ${sortState.column === 'totalScore' ? (sortState.direction === 'asc' ? 'fa-sort-up' : 'fa-sort-down') : ''}"></i>
                    </th>
                    <th class="sortable-header mobile-hide" data-column="avgScore" data-table="main">
                        Media <i class="fas fa-sort ${sortState.column === 'avgScore' ? (sortState.direction === 'asc' ? 'fa-sort-up' : 'fa-sort-down') : ''}"></i>
                    </th>
                </tr>
            </thead>
            <tbody>
    `;

    sortedTeams.forEach((team, index) => {
        const position = index + 1;
        let positionClass = 'other';
        
        if (position === 1) positionClass = 'first';
        else if (position === 2) positionClass = 'second';
        else if (position === 3) positionClass = 'third';

        // Check for best/worst total score
        let totalScoreClass = '';
        if (team.totalScore === maxTotalScore) totalScoreClass = 'best-score';
        if (team.totalScore === minTotalScore) totalScoreClass = 'worst-score';

        html += `
            <tr class="team-row ${positionClass}" style="animation-delay: ${index * 0.1}s">
                <td class="position">${position}</td>
                <td class="team-name">${team.name}</td>
                <td class="points">${team.points}</td>
                <td class="wins mobile-hide">${team.wins}</td>
                <td class="draws mobile-hide">${team.draws}</td>
                <td class="losses mobile-hide">${team.losses}</td>
                <td class="goals-for mobile-hide">${team.goalsFor || 0}</td>
                <td class="goals-against mobile-hide">${team.goalsAgainst || 0}</td>
                <td class="goal-difference mobile-hide ${team.goalDifference >= 0 ? 'positive' : 'negative'}">${team.goalDifference >= 0 ? '+' : ''}${team.goalDifference || 0}</td>
                <td class="total-score mobile-hide ${totalScoreClass}">${team.totalScore || 0}</td>
                <td class="avg-score mobile-hide">${team.avgScore}</td>
            </tr>
        `;
    });

    html += `
            </tbody>
        </table>
    `;

    standingsTable.innerHTML = html;
    
    // Aggiungi event listeners per l'ordinamento
    setupSortableHeaders('main');
    
    // Aggiungi listener su ogni riga per mostrare i dettagli della squadra
    const rows = standingsTable.querySelectorAll('.team-row');
    rows.forEach(row => {
        row.style.cursor = 'pointer';
        row.addEventListener('click', () => {
            const teamName = row.querySelector('.team-name').innerText;
            showTeamMatches(teamName, row);
        });
    });
}

// Toglie il pannello tenendo ferma sotto gli occhi la riga da cui è nato.
// Il pannello è alto quanto un paio di schermate: se sparisce e basta la pagina
// si accorcia di colpo, il browser tronca lo scroll a fondo pagina e si finisce
// in un punto a caso, con l'aria di un layout andato in pezzi.
function chiudiPannelloPartite(pannello, rigaDiRiferimento) {
    const riga = rigaDiRiferimento || pannello.previousElementSibling;
    const primaY = riga ? riga.getBoundingClientRect().top : null;
    pannello.remove();
    if (primaY === null) return;
    const dopoY = riga.getBoundingClientRect().top;
    if (dopoY !== primaY) window.scrollBy(0, dopoY - primaY);
}

// La griglia dei punti di merito, una casella per giornata. In classifica di
// merito la domanda non e' com'e' finita la singola partita ma come e' andata
// la stagione a colpo d'occhio: 25 10 3 25 si legge in un istante, un elenco
// di trentaquattro righe no. L'avversario e il punteggio restano nel title.
function grigliaMerito(teamName, matches) {
    const perGiornata = meritoPerGiornata(teamName);
    if (perGiornata.size === 0) {
        return '<div class="team-match-item">Nessuna giornata giocata.</div>';
    }

    const avversari = new Map();
    matches.forEach(item => {
        const m = item.match;
        avversari.set(item.round, m.homeTeam === teamName ? m.awayTeam : m.homeTeam);
    });

    const caselle = [...perGiornata.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([round, g]) => {
            // Il livello segue la piazza, non il punteggio: cosi' la scala di
            // colore resta la stessa anche se un domani cambia la scala dei punti
            const livello = g.posizione === 1 ? 1 : g.posizione <= 3 ? 2 : g.posizione <= 5 ? 3 : 4;
            const avversario = avversari.get(round);
            const titolo = `Giornata ${round}`
                + (avversario ? ` contro ${avversario}` : '')
                + ` — ${g.punteggio} punti, ${g.posizione}º su ${g.inGara}, ${g.punti} punti di merito`;
            return `
                <div class="merito-casella liv${livello}" title="${titolo}">
                    <span class="mc-giornata">G${round}</span>
                    <span class="mc-punti">${g.punti}</span>
                </div>
            `;
        }).join('');

    return `<div class="merito-griglia">${caselle}</div>`;
}

// Mostra dettaglio partite per una squadra (toggle)
// showTeamMatches: create a table row inserted after the clicked row with match-only data
function showTeamMatches(teamName, clickedRow, modo = 'reale') {
    const tabella = clickedRow.closest('table');

    // Il pannello aperto va cercato nella stessa tabella: classifica e
    // classifica ideale ne hanno una ciascuna e non devono interferire
    const existingRow = (tabella || document).querySelector('.team-details-row');
    if (existingRow) {
        const existingTeam = existingRow.getAttribute('data-team');
        chiudiPannelloPartite(existingRow);
        if (existingTeam === teamName) return; // toggle off
    }

    // Collect matches for the team
    const matches = [];
    (fantacalcioData.rounds || []).forEach(round => {
        (round.matches || []).forEach(match => {
            if (match.homeTeam === teamName || match.awayTeam === teamName) {
                matches.push({ round: round.round, date: round.date, match });
            }
        });
    });

    // Build a details table row to insert after clickedRow
    const table = tabella;
    const colCount = table ? table.querySelectorAll('thead th').length : 11;
    const detailsRow = document.createElement('tr');
    detailsRow.className = 'team-details-row';
    detailsRow.setAttribute('data-team', teamName);

    const td = document.createElement('td');
    td.setAttribute('colspan', colCount);
    td.style.padding = '0';

    // In classifica di merito il conto in testa riassume la stagione, perche'
    // la griglia sotto e' fatta per essere guardata, non sommata a mente
    let sottotitolo = `${matches.length} giornat${matches.length === 1 ? 'a' : 'e'}`;
    if (modo === 'merito') {
        const perGiornata = meritoPerGiornata(teamName);
        const giocate = perGiornata.size;
        const totale = Math.round([...perGiornata.values()].reduce((somma, g) => somma + g.punti, 0) * 10) / 10;
        const vinte = [...perGiornata.values()].filter(g => g.posizione === 1).length;
        sottotitolo = giocate === 0
            ? 'nessuna giornata giocata'
            : `${totale} punti in ${giocate} giornat${giocate === 1 ? 'a' : 'e'}`
              + (vinte > 0 ? ` — ${vinte} vint${vinte === 1 ? 'a' : 'e'}` : '');
    }

    // Panel content (only real match data, team vs opponent and realtime score)
    let content = `
        <div class="team-details-panel">
            <div class="team-details-header">
                <strong>Partite di ${teamName}${modo === "ideale" ? " — formazioni ideali" : modo === "merito" ? " — merito di giornata" : ""}</strong>
                <span class="team-details-conto">${sottotitolo}</span>
                <button class="team-details-close" title="Chiudi">✖</button>
            </div>
            <div class="team-matches-list">
    `;

    if (modo === 'merito') {
        content += grigliaMerito(teamName, matches);
    } else if (matches.length === 0) {
        content += `<div class="team-match-item">Nessuna partita trovata.</div>`;
    } else {
        matches.forEach(item => {
            const m = item.match;
            const isHome = m.homeTeam === teamName;

            // In modalità ideale si usano i punteggi delle formazioni perfette;
            // il bonus casa +1 va applicato qui, perché nel JSON non c'è
            const ideale = modo === 'ideale' && m.homeIdealScore !== undefined;
            const puntiCasa = ideale ? m.homeIdealScore + 1 : m.homeScore;
            const puntiFuori = ideale ? m.awayIdealScore : m.awayScore;

            const golCasa = calculateGoalsFromScore(puntiCasa);
            const golFuori = calculateGoalsFromScore(puntiFuori);

            // L'esito è quello della squadra aperta, non della squadra di casa
            const golPropri = isHome ? golCasa : golFuori;
            const golSubiti = isHome ? golFuori : golCasa;
            const esito = golPropri > golSubiti ? 'vinta' : golPropri < golSubiti ? 'persa' : 'pari';
            const espandibile = Boolean(m.lineups);
            const idDettaglio = `tm-${modo}-${item.round}`;

            // Una riga sola per partita, letta come nel calendario: casa a
            // sinistra, trasferta a destra, punteggi nello stesso ordine. Il
            // colore del risultato però resta dal punto di vista della squadra
            // aperta, che è di chi è l'elenco, e il suo nome è in grassetto.
            content += `
                <div class="team-match-item ${espandibile ? 'espandibile' : ''}"
                     ${espandibile ? `data-dettaglio="${idDettaglio}" role="button" tabindex="0"` : ''}
                     title="Giornata ${item.round}: ${m.homeTeam} - ${m.awayTeam}">
                    <span class="tmi-giornata">G${item.round}</span>
                    <span class="tmi-sfida">
                        <span class="tmi-squadra ${isHome ? 'propria' : ''}">${m.homeTeam}</span>
                        <span class="tmi-sep">-</span>
                        <span class="tmi-squadra ${isHome ? '' : 'propria'}">${m.awayTeam}</span>
                    </span>
                    <span class="tmi-risultato ${esito}" title="${esito === 'vinta' ? 'Vinta' : esito === 'persa' ? 'Persa' : 'Pareggiata'} da ${teamName}">${golCasa}-${golFuori}</span>
                    <span class="tmi-punti">${puntiCasa} - ${puntiFuori}</span>
                    ${espandibile ? '<i class="fas fa-chevron-down tmi-chevron"></i>' : ''}
                </div>
                ${espandibile ? `
                    <div class="team-match-lineups" id="${idDettaglio}" hidden>
                        ${ideale ? colonnaFormazioneIdeale(m.homeTeam, m.lineups.home) : colonnaFormazione(m.homeTeam, m.lineups.home)}
                        ${ideale ? colonnaFormazioneIdeale(m.awayTeam, m.lineups.away) : colonnaFormazione(m.awayTeam, m.lineups.away)}
                    </div>
                ` : ''}
            `;
        });
    }

    content += `</div></div>`;
    td.innerHTML = content;
    detailsRow.appendChild(td);

    // Insert the details row after the clicked row
    clickedRow.parentNode.insertBefore(detailsRow, clickedRow.nextSibling);

    // Wire up close button
    const closeBtn = detailsRow.querySelector('.team-details-close');
    if (closeBtn) closeBtn.addEventListener('click', () => chiudiPannelloPartite(detailsRow, clickedRow));

    // Ogni partita apre il dettaglio con tutti i giocatori
    detailsRow.querySelectorAll('.team-match-item.espandibile').forEach(riga => {
        const apri = () => {
            const dettaglio = detailsRow.querySelector(`#${riga.dataset.dettaglio}`);
            if (!dettaglio) return;
            const apriamo = dettaglio.hidden;
            dettaglio.hidden = !apriamo;
            riga.classList.toggle('aperta', apriamo);
        };
        riga.addEventListener('click', apri);
        riga.addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); apri(); }
        });
    });
}

// Funzione per calcolare le statistiche complessive degli allenatori
function calculateOverallCoachStats() {
    if (!fantacalcioData || !fantacalcioData.rounds) return [];
    
    const teamStats = {};
    
    // Inizializza le statistiche per ogni team
    fantacalcioData.teams.forEach(team => {
        teamStats[team.name] = {
            team: team.name,
            totalPointsLost: 0,
            totalRealScore: 0,
            totalIdealScore: 0,
            matchesPlayed: 0,
            avgPointsLost: 0,
            efficiency: 0
        };
    });
    
    // Calcola i punti persi per ogni giornata
    fantacalcioData.rounds.forEach(round => {
        round.matches.forEach(match => {
            // Squadra di casa
            if (match.homeIdealScore !== undefined) {
                const homeIdealScoreWithBonus = match.homeIdealScore + 1; // Bonus casa
                const homePointsLost = homeIdealScoreWithBonus - match.homeScore;
                teamStats[match.homeTeam].totalPointsLost += homePointsLost;
                teamStats[match.homeTeam].totalRealScore += match.homeScore;
                teamStats[match.homeTeam].totalIdealScore += homeIdealScoreWithBonus;
                teamStats[match.homeTeam].matchesPlayed += 1;
            }
            
            // Squadra in trasferta
            if (match.awayIdealScore !== undefined) {
                const awayPointsLost = match.awayIdealScore - match.awayScore;
                teamStats[match.awayTeam].totalPointsLost += awayPointsLost;
                teamStats[match.awayTeam].totalRealScore += match.awayScore;
                teamStats[match.awayTeam].totalIdealScore += match.awayIdealScore;
                teamStats[match.awayTeam].matchesPlayed += 1;
            }
        });
    });
    
    // Calcola medie ed efficienza
    Object.values(teamStats).forEach(stat => {
        if (stat.matchesPlayed > 0) {
            stat.avgPointsLost = stat.totalPointsLost / stat.matchesPlayed;
            // Efficienza: stessa formula della giornata singola (realScore / idealScore * 100)
            const efficiencyRaw = (stat.totalRealScore / stat.totalIdealScore) * 100;
            stat.efficiency = parseFloat(efficiencyRaw.toFixed(2));
        }
    });
    
    // Ordina per media punti persi (meno punti persi = miglior allenatore)
    return Object.values(teamStats)
        .filter(stat => stat.matchesPlayed > 0)
        .sort((a, b) => a.avgPointsLost - b.avgPointsLost);
}

// Funzione per visualizzare la classifica ideale
function displayIdealStandings() {
    const idealStandingsTable = document.getElementById('ideal-standings-table');
    
    console.log('DisplayIdealStandings chiamata con dati:', fantacalcioData);
    
    if (!fantacalcioData || !fantacalcioData.teams || fantacalcioData.teams.length === 0) {
        console.error('Nessun team disponibile per la visualizzazione ideale');
        idealStandingsTable.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: #666;">
                <p>Nessuna squadra trovata. Caricamento in corso...</p>
            </div>
        `;
        return;
    }
    
    // Calcola la classifica ideale
    const idealStandings = calculateIdealStandingsFromResults();
    console.log('Classifica ideale calcolata:', idealStandings);
    
    // Calcola la classifica reale per confronto
    const realStandings = calculateStandingsFromResults();
    
    // Ordina i team secondo lo stato attuale della classifica ideale
    const sortedIdealTeams = sortTeams(idealStandings, idealSortState.column, idealSortState.direction);

    // Calcola statistiche allenatore (media punti persi per tutte le giornate)
    const coachStats = calculateOverallCoachStats();
    
    // Trova i punteggi totali più alti e più bassi
    let maxTotalScore = -Infinity;
    let minTotalScore = Infinity;
    
    sortedIdealTeams.forEach(team => {
        if (team.totalScore > maxTotalScore) maxTotalScore = team.totalScore;
        if (team.totalScore < minTotalScore) minTotalScore = team.totalScore;
    });
    
    // Aggiungi le differenze alla classifica ideale
    sortedIdealTeams.forEach((idealTeam, idealIndex) => {
        const realTeamIndex = realStandings.findIndex(realTeam => realTeam.name === idealTeam.name);
        const realTeam = realStandings[realTeamIndex];
        
        // Calcola la posizione reale basata su sortedIdealTeams (posizione visualizzata nella tabella)
        // Ma qui stiamo iterando sui team ordinati, quindi idealIndex+1 è la posizione visualizzata
        // Tuttavia, per positionDifference vogliamo confrontare con la classifica reale.
        // La posizione reale è realTeamIndex + 1 (assumendo realStandings ordinato correttamente)
        
        idealTeam.positionDifference = (realTeamIndex + 1) - (idealIndex + 1); // Positivo = peggioramento nella reale?
        // Se reale è 5° e ideale è 3°, diff = 5-3 = 2 (positivo). Ha perso 2 posizioni.
        // Se reale è 1° e ideale è 3°, diff = 1-3 = -2 (negativo). Ha guadagnato 2 posizioni.
        
        idealTeam.pointsDifference = (realTeam ? realTeam.points : 0) - idealTeam.points;
        idealTeam.scoreDifference = (realTeam ? realTeam.totalScore : 0) - idealTeam.totalScore;
    });
    
    // Genera HTML per la statistica del miglior allenatore
    let coachStatsHtml = '';
    if (coachStats && coachStats.length > 0) {
        coachStatsHtml = `
            <div class="coach-stats-ideal">
                <div class="coach-stats-header">
                    <h3><i class="fas fa-medal"></i> Miglior Allenatore (Media Globale)</h3>
                    <p class="coach-stats-subtitle">Basato sulla media dei punti persi in tutte le giornate</p>
                </div>
                <div class="coach-stats-podium">
                    ${coachStats.slice(0, 3).map((coach, index) => `
                        <div class="coach-podium-item ${index === 0 ? 'gold' : index === 1 ? 'silver' : 'bronze'}">
                            <div class="podium-position">${index + 1}°</div>
                            <div class="podium-team">${coach.team}</div>
                            <div class="podium-stats">
                                <div class="stat-item">
                                    <i class="fas fa-chart-line"></i>
                                    <span>${coach.avgPointsLost.toFixed(1)} pt persi/giornata</span>
                                </div>
                                <div class="stat-item">
                                    <i class="fas fa-percentage"></i>
                                    <span>${coach.efficiency}% efficienza</span>
                                </div>
                                <div class="stat-item">
                                    <i class="fas fa-calendar-alt"></i>
                                    <span>${coach.matchesPlayed} giornate</span>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
                <details class="coach-full-ranking">
                    <summary><i class="fas fa-list"></i> Vedi classifica completa allenatori</summary>
                    <table class="coach-ranking-table">
                        <thead>
                            <tr>
                                <th>Pos</th>
                                <th>Squadra</th>
                                <th>Media Pt Persi</th>
                                <th>Efficienza</th>
                                <th>Giornate</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${coachStats.map((coach, index) => `
                                <tr class="${index < 3 ? 'top-three' : ''}">
                                    <td>${index + 1}</td>
                                    <td>${coach.team}</td>
                                    <td>${coach.avgPointsLost.toFixed(1)}</td>
                                    <td>${coach.efficiency}%</td>
                                    <td>${coach.matchesPlayed}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </details>
            </div>
        `;
    }

    let html = coachStatsHtml + `
          <table class="standings-table ideal-standings-table" id="ideal-standings-table">
            <thead>
                <tr class="table-header">
                    <th class="sortable-header" data-column="position" data-table="ideal">
                        Pos. <i class="fas fa-sort"></i>
                    </th>
                    <th class="sortable-header" data-column="name" data-table="ideal">
                        Squadra <i class="fas fa-sort ${idealSortState.column === 'name' ? (idealSortState.direction === 'asc' ? 'fa-sort-up' : 'fa-sort-down') : ''}"></i>
                    </th>
                    <th class="sortable-header" data-column="points" data-table="ideal">
                        Pt <i class="fas fa-sort ${idealSortState.column === 'points' ? (idealSortState.direction === 'asc' ? 'fa-sort-up' : 'fa-sort-down') : ''}"></i>
                    </th>
                    <th class="sortable-header mobile-hide" data-column="wins" data-table="ideal">
                        V <i class="fas fa-sort ${idealSortState.column === 'wins' ? (idealSortState.direction === 'asc' ? 'fa-sort-up' : 'fa-sort-down') : ''}"></i>
                    </th>
                    <th class="sortable-header mobile-hide" data-column="draws" data-table="ideal">
                        P <i class="fas fa-sort ${idealSortState.column === 'draws' ? (idealSortState.direction === 'asc' ? 'fa-sort-up' : 'fa-sort-down') : ''}"></i>
                    </th>
                    <th class="sortable-header mobile-hide" data-column="losses" data-table="ideal">
                        S <i class="fas fa-sort ${idealSortState.column === 'losses' ? (idealSortState.direction === 'asc' ? 'fa-sort-up' : 'fa-sort-down') : ''}"></i>
                    </th>
                    <th class="sortable-header mobile-hide" data-column="goalsFor" data-table="ideal">
                        GF <i class="fas fa-sort ${idealSortState.column === 'goalsFor' ? (idealSortState.direction === 'asc' ? 'fa-sort-up' : 'fa-sort-down') : ''}"></i>
                    </th>
                    <th class="sortable-header mobile-hide" data-column="goalsAgainst" data-table="ideal">
                        GS <i class="fas fa-sort ${idealSortState.column === 'goalsAgainst' ? (idealSortState.direction === 'asc' ? 'fa-sort-up' : 'fa-sort-down') : ''}"></i>
                    </th>
                    <th class="sortable-header mobile-hide" data-column="goalDifference" data-table="ideal">
                        DR <i class="fas fa-sort ${idealSortState.column === 'goalDifference' ? (idealSortState.direction === 'asc' ? 'fa-sort-up' : 'fa-sort-down') : ''}"></i>
                    </th>
                    <th class="sortable-header mobile-hide" data-column="totalScore" data-table="ideal">
                        Totale <i class="fas fa-sort ${idealSortState.column === 'totalScore' ? (idealSortState.direction === 'asc' ? 'fa-sort-up' : 'fa-sort-down') : ''}"></i>
                    </th>
                    <th class="sortable-header mobile-hide" data-column="avgScore" data-table="ideal">
                        Media <i class="fas fa-sort ${idealSortState.column === 'avgScore' ? (idealSortState.direction === 'asc' ? 'fa-sort-up' : 'fa-sort-down') : ''}"></i>
                    </th>
                    <th class="sortable-header mobile-hide" data-column="positionDifference" data-table="ideal">
                        Diff Pos <i class="fas fa-sort ${idealSortState.column === 'positionDifference' ? (idealSortState.direction === 'asc' ? 'fa-sort-up' : 'fa-sort-down') : ''}"></i>
                    </th>
                    <th class="sortable-header mobile-hide" data-column="pointsDifference" data-table="ideal">
                        Diff Pt <i class="fas fa-sort ${idealSortState.column === 'pointsDifference' ? (idealSortState.direction === 'asc' ? 'fa-sort-up' : 'fa-sort-down') : ''}"></i>
                    </th>
                </tr>
            </thead>
            <tbody>
    `;

    sortedIdealTeams.forEach((team, index) => {
        const position = index + 1;
        let positionClass = 'other';
        
        if (position === 1) positionClass = 'first';
        else if (position === 2) positionClass = 'second';
        else if (position === 3) positionClass = 'third';

        // Check for best/worst total score
        let totalScoreClass = '';
        if (team.totalScore === maxTotalScore) totalScoreClass = 'best-score';
        if (team.totalScore === minTotalScore) totalScoreClass = 'worst-score';

        html += `
            <tr class="team-row ${positionClass}" style="animation-delay: ${index * 0.1}s">
                <td class="position">${position}</td>
                <td class="team-name">${team.name}</td>
                <td class="points">${team.points}</td>
                <td class="wins mobile-hide">${team.wins}</td>
                <td class="draws mobile-hide">${team.draws}</td>
                <td class="losses mobile-hide">${team.losses}</td>
                <td class="goals-for mobile-hide">${team.goalsFor}</td>
                <td class="goals-against mobile-hide">${team.goalsAgainst}</td>
                <td class="goal-difference mobile-hide ${team.goalDifference >= 0 ? 'positive' : 'negative'}">${team.goalDifference >= 0 ? '+' : ''}${team.goalDifference}</td>
                <td class="total-score mobile-hide ${totalScoreClass}">${team.totalScore}</td>
                <td class="avg-score mobile-hide">${team.avgScore}</td>
                <td class="position-difference mobile-hide ${team.positionDifference > 0 ? 'worse' : team.positionDifference < 0 ? 'better' : 'same'}">
                    ${team.positionDifference > 0 ? '+' : ''}${team.positionDifference || 0}
                </td>
                <td class="points-difference mobile-hide ${team.pointsDifference > 0 ? 'worse' : team.pointsDifference < 0 ? 'better' : 'same'}">
                    ${team.pointsDifference > 0 ? '+' : ''}${team.pointsDifference || 0}
                </td>
            </tr>
        `;
    });

    html += `
            </tbody>
        </table>
    `;

    idealStandingsTable.innerHTML = html;

    // Aggiungi event listeners per l'ordinamento
    setupSortableHeaders('ideal');

    // Come nella classifica reale, ma con i punteggi delle formazioni ideali
    idealStandingsTable.querySelectorAll('.team-row').forEach(row => {
        row.style.cursor = 'pointer';
        row.addEventListener('click', () => {
            const teamName = row.querySelector('.team-name').innerText;
            showTeamMatches(teamName, row, 'ideale');
        });
    });
}

// Setup event listeners per le colonne ordinabili
// Imposta i listener per gli header sortabili
// Stato dell'ordinamento classifica di merito
let meritSortState = {
    column: 'meritPoints',
    direction: 'desc'
};

// Visualizzazione della classifica di merito
function displayMeritStandings() {
    const container = document.getElementById('merit-standings-table');
    if (!container) return;

    if (!fantacalcioData || !fantacalcioData.teams || fantacalcioData.teams.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: #666;">
                <p>Nessuna squadra trovata. Caricamento in corso...</p>
            </div>
        `;
        return;
    }

    const merito = calculateMeritStandings();
    if (merito.length === 0 || merito.every(t => t.giornate === 0)) {
        container.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: #666;">
                <p>Nessuna giornata giocata: la classifica di merito parte dalla prima.</p>
            </div>
        `;
        return;
    }

    // La posizione di merito va confrontata con quella vera del campionato:
    // è lo scarto che dice chi ha raccolto meno di quanto ha seminato
    const reale = calculateStandingsFromResults();
    const ordineReale = sortTeams(reale, 'points', 'desc');
    merito.forEach((squadra, indiceMerito) => {
        const indiceReale = ordineReale.findIndex(t => t.name === squadra.name);
        squadra.positionDifference = indiceReale >= 0 ? (indiceReale + 1) - (indiceMerito + 1) : 0;
    });

    const ordinate = sortTeams(merito, meritSortState.column, meritSortState.direction);

    let html = `
        <table class="standings-table" id="merit-table">
            <thead>
                <tr class="table-header">
                    <th class="sortable-header" data-column="position" data-table="merito">
                        Pos. <i class="fas fa-sort ${meritSortState.column === 'position' ? (meritSortState.direction === 'asc' ? 'fa-sort-up' : 'fa-sort-down') : ''}"></i>
                    </th>
                    <th class="sortable-header" data-column="name" data-table="merito">
                        Squadra <i class="fas fa-sort ${meritSortState.column === 'name' ? (meritSortState.direction === 'asc' ? 'fa-sort-up' : 'fa-sort-down') : ''}"></i>
                    </th>
                    <th class="sortable-header" data-column="meritPoints" data-table="merito">
                        Pt <i class="fas fa-sort ${meritSortState.column === 'meritPoints' ? (meritSortState.direction === 'asc' ? 'fa-sort-up' : 'fa-sort-down') : ''}"></i>
                    </th>
                    <th class="sortable-header mobile-hide" data-column="primi" data-table="merito">
                        1° <i class="fas fa-sort ${meritSortState.column === 'primi' ? (meritSortState.direction === 'asc' ? 'fa-sort-up' : 'fa-sort-down') : ''}"></i>
                    </th>
                    <th class="sortable-header mobile-hide" data-column="podi" data-table="merito">
                        Podi <i class="fas fa-sort ${meritSortState.column === 'podi' ? (meritSortState.direction === 'asc' ? 'fa-sort-up' : 'fa-sort-down') : ''}"></i>
                    </th>
                    <th class="sortable-header mobile-hide" data-column="avgPosition" data-table="merito">
                        Media Pos <i class="fas fa-sort ${meritSortState.column === 'avgPosition' ? (meritSortState.direction === 'asc' ? 'fa-sort-up' : 'fa-sort-down') : ''}"></i>
                    </th>
                    <th class="sortable-header mobile-hide" data-column="totalScore" data-table="merito">
                        Punteggio <i class="fas fa-sort ${meritSortState.column === 'totalScore' ? (meritSortState.direction === 'asc' ? 'fa-sort-up' : 'fa-sort-down') : ''}"></i>
                    </th>
                    <th class="sortable-header mobile-hide" data-column="avgScore" data-table="merito">
                        Media <i class="fas fa-sort ${meritSortState.column === 'avgScore' ? (meritSortState.direction === 'asc' ? 'fa-sort-up' : 'fa-sort-down') : ''}"></i>
                    </th>
                    <th class="sortable-header mobile-hide" data-column="positionDifference" data-table="merito">
                        Δ Pos <i class="fas fa-sort ${meritSortState.column === 'positionDifference' ? (meritSortState.direction === 'asc' ? 'fa-sort-up' : 'fa-sort-down') : ''}"></i>
                    </th>
                </tr>
            </thead>
            <tbody>
    `;

    ordinate.forEach((team, index) => {
        const position = index + 1;
        let positionClass = 'other';
        if (position === 1) positionClass = 'first';
        else if (position === 2) positionClass = 'second';
        else if (position === 3) positionClass = 'third';

        const delta = team.positionDifference || 0;
        const deltaTesto = delta > 0 ? `+${delta}` : `${delta}`;
        const deltaClasse = delta > 0 ? 'positive' : delta < 0 ? 'negative' : '';
        const deltaTitolo = delta > 0
            ? `In campionato sta ${delta} ${delta === 1 ? 'posizione' : 'posizioni'} più in basso di quanto meriti`
            : delta < 0
                ? `In campionato sta ${-delta} ${delta === -1 ? 'posizione' : 'posizioni'} più in alto di quanto meriti`
                : 'Il campionato lo mette dove merita';

        html += `
            <tr class="team-row ${positionClass}">
                <td class="position">${position}</td>
                <td class="team-name">${team.name}</td>
                <td class="points">${team.meritPoints}</td>
                <td class="wins mobile-hide">${team.primi}</td>
                <td class="draws mobile-hide">${team.podi}</td>
                <td class="avg-score mobile-hide">${team.avgPosition}</td>
                <td class="total-score mobile-hide">${team.totalScore}</td>
                <td class="avg-score mobile-hide">${team.avgScore}</td>
                <td class="position-difference mobile-hide ${deltaClasse}" title="${deltaTitolo}">${deltaTesto}</td>
            </tr>
        `;
    });

    html += `
            </tbody>
        </table>
    `;

    container.innerHTML = html;
    setupSortableHeaders('merito');

    container.querySelectorAll('.team-row').forEach(row => {
        row.style.cursor = 'pointer';
        row.addEventListener('click', () => {
            showTeamMatches(row.querySelector('.team-name').innerText, row, 'merito');
        });
    });
}

function setupSortableHeaders(tableType = 'main') {
    const tabelle = {
        main: '#main-standings-table .sortable-header',
        ideale: '#ideal-standings-table .sortable-header',
        merito: '#merit-standings-table .sortable-header'
    };
    const selector = tabelle[tableType] || tabelle.ideale;

    const headers = document.querySelectorAll(selector);
    
    headers.forEach(header => {
        header.addEventListener('click', () => {
            const column = header.getAttribute('data-column');

            if (tableType === 'merito') {
                if (meritSortState.column === column) {
                    meritSortState.direction = meritSortState.direction === 'asc' ? 'desc' : 'asc';
                } else {
                    meritSortState.column = column;
                    // Nella media posizione il numero piccolo è il risultato
                    // migliore, quindi si parte dal basso e non dall'alto
                    meritSortState.direction = (column === 'name' || column === 'avgPosition') ? 'asc' : 'desc';
                }
                displayMeritStandings();
                return;
            }

            if (tableType === 'main') {
                // Se è la stessa colonna, inverti la direzione
                if (sortState.column === column) {
                    sortState.direction = sortState.direction === 'asc' ? 'desc' : 'asc';
                } else {
                    // Nuova colonna, imposta direzione predefinita
                    sortState.column = column;
                    sortState.direction = column === 'name' ? 'asc' : 'desc';
                }
                // Rigenera la tabella principale
                displayStandings();
            } else {
                // Classifica ideale
                if (idealSortState.column === column) {
                    idealSortState.direction = idealSortState.direction === 'asc' ? 'desc' : 'asc';
                } else {
                    idealSortState.column = column;
                    idealSortState.direction = column === 'name' ? 'asc' : 'desc';
                }
                // Rigenera la tabella ideale
                displayIdealStandings();
            }
        });
    });
}

// Visualizzazione delle statistiche
function displayStatistics() {
    const leaderName = document.getElementById('leader-name');
    const highestScore = document.getElementById('highest-score');
    const totalTeams = document.getElementById('total-teams');
    const currentRound = document.getElementById('current-round');
    const worstPointsLost = document.getElementById('worst-points-lost');

    if (!fantacalcioData || !fantacalcioData.teams || fantacalcioData.teams.length === 0) {
        return;
    }

    // Calcola le statistiche
    const leader = fantacalcioData.teams[0];
    const maxAvgScore = Math.max(...fantacalcioData.teams.map(team => team.avgScore));
    const totalTeamsCount = fantacalcioData.teams.length;
    const currentRoundNumber = fantacalcioData.rounds.length;

    if (leaderName) leaderName.textContent = leader.name;
    if (highestScore) highestScore.textContent = maxAvgScore.toFixed(1);
    if (totalTeams) totalTeams.textContent = totalTeamsCount;
    if (currentRound) currentRound.textContent = `Giornata ${currentRoundNumber}`;

    // Calcola i maggiori punti persi
    let maxPointsLost = 0;
    let worstTeam = '';
    
    if (fantacalcioData.rounds && fantacalcioData.rounds.length > 0) {
        fantacalcioData.rounds.forEach(round => {
            if (round.matches) {
                round.matches.forEach(match => {
                    if (match.homeIdealScore !== undefined && match.awayIdealScore !== undefined) {
                        const homePointsLost = Math.max(0, match.homeIdealScore - match.homeScore);
                        const awayPointsLost = Math.max(0, match.awayIdealScore - match.awayScore);
                        
                        if (homePointsLost > maxPointsLost) {
                            maxPointsLost = homePointsLost;
                            worstTeam = match.homeTeam;
                        }
                        
                        if (awayPointsLost > maxPointsLost) {
                            maxPointsLost = awayPointsLost;
                            worstTeam = match.awayTeam;
                        }
                    }
                });
            }
        });
    }
    
    if (worstPointsLost) {
        if (maxPointsLost > 0) {
            worstPointsLost.textContent = `${maxPointsLost.toFixed(1)} (${worstTeam})`;
        } else {
            worstPointsLost.textContent = 'Nessuno';
        }
    }

    // Genera il confronto reale vs ideale solo se siamo nella sezione statistiche
    const statisticsSection = document.getElementById('statistiche');
    if (statisticsSection && statisticsSection.classList.contains('active')) {
        displayIdealVsRealComparison();
    }
}

// Visualizzazione confronto reale vs ideale
function displayIdealVsRealComparison() {
    const comparisonGrid = document.getElementById('comparison-grid');
    if (!comparisonGrid) return;
    
    // Controlla se ci sono dati validi
    if (!fantacalcioData || !fantacalcioData.rounds || fantacalcioData.rounds.length === 0) {
        comparisonGrid.innerHTML = '';
        return;
    }

    let html = '';
    let hasIdealData = false;
    
    fantacalcioData.rounds.forEach(round => {
        if (round.matches) {
            round.matches.forEach(match => {
                if (match.homeIdealScore !== undefined && 
                    match.awayIdealScore !== undefined && 
                    match.homeScore !== undefined && 
                    match.awayScore !== undefined) {
                    
                    hasIdealData = true;
                    const realDiff = Math.abs(match.homeScore - match.awayScore);
                    const idealDiff = Math.abs(match.homeIdealScore - match.awayIdealScore);
                    const improvement = idealDiff - realDiff;
                    
                    html += `
                        <div class="comparison-card">
                            <div class="comparison-header">
                                ${match.homeTeam} vs ${match.awayTeam}
                            </div>
                            <div class="comparison-scores">
                                <div class="real-score">
                                    <span class="label">Reale:</span>
                                    <span class="score">${match.homeScore} - ${match.awayScore}</span>
                                </div>
                                <div class="ideal-score">
                                    <span class="label">Ideale:</span>
                                    <span class="score">${match.homeIdealScore} - ${match.awayIdealScore}</span>
                                </div>
                            </div>
                            <div class="improvement ${improvement > 0 ? 'positive' : improvement < 0 ? 'negative' : 'neutral'}">
                                ${improvement > 0 ? '↗️' : improvement < 0 ? '↘️' : '➡️'} 
                                ${improvement > 0 ? '+' : ''}${improvement.toFixed(1)} pt differenza
                            </div>
                        </div>
                    `;
                }
            });
        }
    });

    // Se non ci sono dati ideali, nascondi la sezione
    if (!hasIdealData) {
        const comparisonSection = document.querySelector('.ideal-vs-real-comparison');
        if (comparisonSection) {
            comparisonSection.style.display = 'none';
        }
        return;
    } else {
        const comparisonSection = document.querySelector('.ideal-vs-real-comparison');
        if (comparisonSection) {
            comparisonSection.style.display = 'block';
        }
    }

    comparisonGrid.innerHTML = html;
}

// Setup del selettore delle giornate
function setupRoundSelector() {
    const roundSelect = document.getElementById('giornata-select');
    const rounds = (fantacalcioData && fantacalcioData.rounds) || [];

    // Svuota il selettore: la funzione viene richiamata ad ogni cambio stagione
    roundSelect.innerHTML = '';

    // Popola il selettore delle giornate
    rounds.forEach(round => {
        const option = document.createElement('option');
        option.value = round.round;
        option.textContent = `Giornata ${round.round}`;
        roundSelect.appendChild(option);
    });

    roundSelect.disabled = rounds.length === 0;

    // Imposta la giornata più recente come default
    if (rounds.length > 0) {
        roundSelect.value = rounds[rounds.length - 1].round;
        displayRoundResults(rounds[rounds.length - 1].round);
    } else {
        displayNoRoundsMessage();
    }

    // Event listener per il cambio di giornata, registrato una sola volta
    if (!roundSelect.dataset.listenerAttached) {
        roundSelect.addEventListener('change', (e) => {
            displayRoundResults(parseInt(e.target.value));
        });
        roundSelect.dataset.listenerAttached = 'true';
    }
}

// Stato mostrato quando una stagione è nel calendario ma non ha ancora giornate
function displayNoRoundsMessage() {
    const commentary = document.getElementById('match-commentary');
    if (commentary) commentary.style.display = 'none';

    const coachRanking = document.getElementById('coach-ranking-container');
    if (coachRanking) coachRanking.innerHTML = '';

    const roundResults = document.getElementById('giornata-results');
    if (roundResults) {
        roundResults.innerHTML = `
            <div class="empty-season">
                <i class="fas fa-hourglass-start"></i>
                <h3>Stagione non ancora iniziata</h3>
                <p>Nessuna giornata disponibile per questa stagione. Torna dopo il primo turno!</p>
            </div>
        `;
    }
}

// Visualizzazione dei risultati per giornata
function displayRoundResults(roundNumber) {
    const roundResults = document.getElementById('giornata-results');
    const round = fantacalcioData.rounds.find(r => r.round === roundNumber);
    
    // Mostra il commento per la giornata selezionata
    displayMatchCommentary(roundNumber);

    if (!round) {
        roundResults.innerHTML = '<p>Nessun risultato disponibile per questa giornata.</p>';
        return;
    }

    let html = '';
    
    // Inserisci la classifica del miglior allenatore nel contenitore dedicato
    const coachRankingContainer = document.getElementById('coach-ranking-container');
    // Mostra il commento generale della giornata (se presente) prima della classifica del miglior allenatore
    if (coachRankingContainer) {
        let generalHtml = '';
        if (round && round.generalComment) {
            generalHtml = `
                <div class="round-general-comment">
                    <h4>Commento Generale Giornata ${round.round}</h4>
                    <p>${round.generalComment}</p>
                </div>
            `;
        }

        const coachRankingHtml = generateCoachRanking(round);
        coachRankingContainer.innerHTML = generalHtml + (coachRankingHtml || '');
    }
    round.matches.forEach((match, index) => {
        let resultClass = '';
        let resultText = '';
        
        // Calcola il risultato dinamicamente
        const matchResult = getMatchResult(match.homeScore, match.awayScore);

        if (matchResult === 'home') {
            resultClass = 'win';
            resultText = `Vittoria ${match.homeTeam}`;
        } else if (matchResult === 'away') {
            resultClass = 'win';
            resultText = `Vittoria ${match.awayTeam}`;
        } else {
            resultClass = 'draw';
            resultText = 'Pareggio';
        }

        // Calcola i gol se non sono già presenti
        let homeGoals, awayGoals;
        if (match.homeGoals !== undefined && match.awayGoals !== undefined) {
            homeGoals = match.homeGoals;
            awayGoals = match.awayGoals;
        } else {
            const goals = calculateMatchGoals(match.homeScore, match.awayScore);
            homeGoals = goals.homeGoals;
            awayGoals = goals.awayGoals;
        }
        const goalScore = `${homeGoals}-${awayGoals}`;

        // Punteggi ideali se disponibili
        const hasIdealScores = match.homeIdealScore !== undefined && match.awayIdealScore !== undefined;
        let idealSection = '';
        
        if (hasIdealScores) {
            const homeIdealGoals = match.homeIdealGoals !== undefined ? match.homeIdealGoals : calculateIdealGoalsFromScore(match.homeIdealScore, true);
            const awayIdealGoals = match.awayIdealGoals !== undefined ? match.awayIdealGoals : calculateIdealGoalsFromScore(match.awayIdealScore, false);
            
            // Debug logging per match 2
            if (match.homeTeam === "Real Ichnusa") {
                console.log('DEBUG Match 2:');
                console.log('homeIdealScore:', match.homeIdealScore);
                console.log('awayIdealScore:', match.awayIdealScore);
                console.log('homeIdealGoals calculated:', homeIdealGoals);
                console.log('awayIdealGoals calculated:', awayIdealGoals);
            }
            
            const idealGoalScore = `${homeIdealGoals}-${awayIdealGoals}`;
            
            // Calcola i punteggi ideali con bonus casa per la visualizzazione
            const homeIdealScoreWithBonus = match.homeIdealScore + 1; // Bonus casa
            const awayIdealScoreWithBonus = match.awayIdealScore; // Nessun bonus per trasferta
            
            // Calcola differenze e confronti (usando i punteggi con bonus per la casa)
            const homeDifference = homeIdealScoreWithBonus - match.homeScore;
            const awayDifference = awayIdealScoreWithBonus - match.awayScore;
            const homeGoalsDiff = homeIdealGoals - homeGoals;
            const awayGoalsDiff = awayIdealGoals - awayGoals;
            
            // Determina il risultato reale e ideale
            const realResult = homeGoals > awayGoals ? match.homeTeam : 
                             awayGoals > homeGoals ? match.awayTeam : 'Pareggio';
            const idealResult = homeIdealGoals > awayIdealGoals ? match.homeTeam : 
                              awayIdealGoals > homeIdealGoals ? match.awayTeam : 'Pareggio';
            
            const sameResult = realResult === idealResult;

            // Scegli testo insight in base allo scarto reale vs ideale (soglia 3 punti)
            let insightText = '';
            const absHomeDiff = Math.abs(homeDifference);
            const absAwayDiff = Math.abs(awayDifference);
            const maxDiff = Math.max(absHomeDiff, absAwayDiff);

            if (homeDifference > 0 && awayDifference > 0) {
                // Entrambe sotto l'ideale
                if (maxDiff > 3) {
                    insightText = 'Entrambe le squadre potevano fare meglio con scelte diverse.';
                } else {
                    insightText = 'Entrambe le squadre hanno perso qualche punto rispetto all\'ideale; la partita è stata decisa da dettagli piuttosto che da un netto divario.';
                }
            } else if (homeDifference > awayDifference) {
                if (homeDifference > 3) {
                    insightText = `${match.homeTeam} ha sprecato più potenziale (${homeDifference.toFixed(1)} pt) — avrebbe potuto fare di più rispetto a quanto mostrato.`;
                } else {
                    insightText = `${match.homeTeam} ha lasciato qualche punto per strada (${homeDifference.toFixed(1)} pt), ma lo scarto non è eccessivo.`;
                }
            } else if (awayDifference > homeDifference) {
                if (awayDifference > 3) {
                    insightText = `${match.awayTeam} ha sprecato più potenziale (${awayDifference.toFixed(1)} pt) — avrebbe potuto fare di più rispetto a quanto mostrato.`;
                } else {
                    insightText = `${match.awayTeam} ha lasciato qualche punto per strada (${awayDifference.toFixed(1)} pt), ma lo scarto non è eccessivo.`;
                }
            } else {
                insightText = 'Entrambe le squadre hanno fatto scelte simili alle ideali.';
            }

            idealSection = `
                <div class="ideal-scores">
                    <div class="ideal-header">
                        <h4><i class="fas fa-star"></i> Reale vs Ideale</h4>
                        <div class="match-comparison-status ${sameResult ? 'same-result' : 'different-result'}">
                            ${sameResult ? 'Stesso risultato' : 'Risultato diverso'}
                        </div>
                    </div>

                    <div class="confronto-griglia">
                        <span class="confronto-etichetta"></span>
                        <span class="confronto-squadra">${match.homeTeam}</span>
                        <span class="confronto-squadra">${match.awayTeam}</span>

                        <span class="confronto-etichetta">Reale</span>
                        <span class="confronto-valore">${homeGoals} <small>(${match.homeScore})</small></span>
                        <span class="confronto-valore">${awayGoals} <small>(${match.awayScore})</small></span>

                        <span class="confronto-etichetta">
                            Ideale <i class="fas fa-house bonus-casa" title="Bonus casa +1"></i>
                        </span>
                        <span class="confronto-valore ideale">${homeIdealGoals} <small>(${homeIdealScoreWithBonus})</small></span>
                        <span class="confronto-valore ideale">${awayIdealGoals} <small>(${match.awayIdealScore})</small></span>

                        <span class="confronto-etichetta">Persi</span>
                        <span class="confronto-valore ${homeDifference > 0 ? 'persi' : 'nessun-perso'}">${homeDifference > 0 ? '-' + homeDifference.toFixed(1) : '0'}</span>
                        <span class="confronto-valore ${awayDifference > 0 ? 'persi' : 'nessun-perso'}">${awayDifference > 0 ? '-' + awayDifference.toFixed(1) : '0'}</span>
                    </div>

                    <p class="ideal-insight">${insightText}</p>
                </div>
            `;
        }

        // Sezione commento se disponibile
        let commentarySection = '';
        if (match.commentary) {
            // Read threshold from settings (fallback to 3)
            const threshold = (fantacalcioData && fantacalcioData.settings && typeof fantacalcioData.settings.insightThreshold === 'number') ? fantacalcioData.settings.insightThreshold : 3;

            // Compute differences (reuse previously calculated values)
            const homeIdealScoreWithBonus = match.homeIdealScore + 1;
            const awayIdealScoreWithBonus = match.awayIdealScore;
            const homeDifferenceForComment = homeIdealScoreWithBonus - match.homeScore;
            const awayDifferenceForComment = awayIdealScoreWithBonus - match.awayScore;

            // Build subtle auto-insight sentences without mentioning the threshold
            let autoInsightCaressa = '';
            let autoInsightBergomi = '';

            // If both underperformed
            if (homeDifferenceForComment > 0 && awayDifferenceForComment > 0) {
                const maxDiff = Math.max(Math.abs(homeDifferenceForComment), Math.abs(awayDifferenceForComment));
                if (maxDiff > threshold) {
                    autoInsightCaressa = ' Clamoroso flop! Entrambe le squadre HANNO DELUSO: c\'era molto di più in campo e lo hanno buttato via!';
                    autoInsightBergomi = ' Un vero spreco di qualità: tattiche confuse e scelte sbagliate hanno tradito il potenziale mostrato sulla carta.';
                } else {
                    autoInsightCaressa = ' Partita al cardiopalma: decisa dai dettagli, con errori e scelte che hanno fatto esplodere la tensione fino alla fine!';
                    autoInsightBergomi = ' Match tiratissimo, risolto dai particolari — qualche scelta ha inciso in modo decisivo sul risultato.';
                }
            } else if (homeDifferenceForComment > awayDifferenceForComment) {
                if (homeDifferenceForComment > threshold) {
                    autoInsightCaressa = ` Scandaloso! ${match.homeTeam} ha sprecato punti pesanti — una prova sotto le aspettative e dai contorni drammatici!`;
                    autoInsightBergomi = ` Grave passo falso: la gestione di ${match.homeTeam} è stata discutibile, con scelte che non si spiegano alla luce del potenziale.`;
                } else if (homeDifferenceForComment > 0) {
                    autoInsightCaressa = ` ${match.homeTeam} ha lasciato qualche punto per strada: non catastrofico, ma certo c\'è rammarico in panchina.`;
                    autoInsightBergomi = ` Qualche scelta infelice da parte di ${match.homeTeam}, sì, ma la partita è stata combattuta e tutto si è deciso per dettagli.`;
                }
            } else if (awayDifferenceForComment > homeDifferenceForComment) {
                if (awayDifferenceForComment > threshold) {
                    autoInsightCaressa = ` Incredibile: ${match.awayTeam} ha tradito le attese e ha buttato via punti pesanti — esplode il rammarico tra i tifosi!`;
                    autoInsightBergomi = ` Un rovescio tecnico per ${match.awayTeam}: le scelte tattiche non hanno reso giustizia alla rosa disponibile.`;
                } else if (awayDifferenceForComment > 0) {
                    autoInsightCaressa = ` ${match.awayTeam} ha perso qualche punto per strada: non è stata una débâcle, ma certo c\'è spazio per rimpianti.`;
                    autoInsightBergomi = ` Poche scelte decisive da parte di ${match.awayTeam}; la partita si è decisa su dettagli più che su un netto dominio.`;
                }
            }

            commentarySection = `
                <div class="match-commentary-inline">
                    <div class="commentary-title">
                        <i class="fas fa-microphone"></i> Commento Match
                    </div>
                    <div class="commentary-dialogue-inline">
                        <span class="speaker">Caressa:</span> "${match.commentary.caressa}${autoInsightCaressa}"
                    </div>
                    <div class="commentary-dialogue-inline">
                        <span class="speaker bergomi">Bergomi:</span> "${match.commentary.bergomi}${autoInsightBergomi}"
                    </div>
                </div>
            `;
        }

        html += `
            <div class="match-card" style="animation-delay: ${index * 0.1}s">
                <div class="match-header">Match ${index + 1}</div>
                <div class="match-teams">
                    <div class="team">
                        <div class="team-name-match">${match.homeTeam}</div>
                        <div class="team-score">${homeGoals}</div>
                        <div class="fantasy-score">(${match.homeScore} pt)</div>
                    </div>
                    <div class="vs">VS</div>
                    <div class="team">
                        <div class="team-name-match">${match.awayTeam}</div>
                        <div class="team-score">${awayGoals}</div>
                        <div class="fantasy-score">(${match.awayScore} pt)</div>
                    </div>
                </div>
                <div class="match-score-display">
                    <strong>Risultato: ${goalScore}</strong>
                </div>
                <div class="match-result ${resultClass}">
                    ${resultText}
                </div>
                ${idealSection}
                ${commentarySection}
                ${generateLineupSection(match, index)}
            </div>
        `;
    });

    roundResults.innerHTML = html;
    setupLineupToggles();
}

// ============================================================
// Formazioni: dettaglio di una singola partita
// ============================================================

// Un giocatore è "sceso in campo" se titolare o subentrato
const SCHIERATO = new Set(['s', 'in']);

// Quanto toglie al fantavoto ogni malus, secondo il regolamento Fantacalcio.
// I gol subiti restano fuori di proposito: sono il mestiere del portiere, non
// un errore di condotta, e da soli riempirebbero la classifica di portieri.
const MALUS = { amm: 0.5, esp: 1, autogol: 2, rigSbagliato: 3 };

const ETICHETTE_MALUS = {
    amm: ['ammonizione', 'ammonizioni'],
    esp: ['espulsione', 'espulsioni'],
    autogol: ['autogol', 'autogol'],
    rigSbagliato: ['rigore sbagliato', 'rigori sbagliati']
};

const EVENTI_UI = {
    gol: { icona: 'fa-futbol', label: 'gol', classe: 'evento-gol' },
    assist: { icona: 'fa-shoe-prints', label: 'assist', classe: 'evento-assist' },
    amm: { icona: 'fa-square', label: 'ammonizione', classe: 'evento-amm' },
    esp: { icona: 'fa-square', label: 'espulsione', classe: 'evento-esp' },
    rigParato: { icona: 'fa-hand-paper', label: 'rigore parato', classe: 'evento-rigparato' },
    rigSbagliato: { icona: 'fa-times-circle', label: 'rigore sbagliato', classe: 'evento-rigsbagliato' },
    autogol: { icona: 'fa-futbol', label: 'autogol', classe: 'evento-autogol' },
    golSubiti: { icona: 'fa-hands', label: 'gol subito', classe: 'evento-golsubiti' }
};

// Anagrafica di un giocatore dal dizionario globale della stagione
function anagraficaGiocatore(pid) {
    const players = (fantacalcioData && fantacalcioData.players) || {};
    return players[pid] || { name: `#${pid}`, role: '?', serieA: '' };
}

function badgeEventi(eventi) {
    if (!eventi) return '';
    return Object.entries(eventi)
        .filter(([chiave]) => EVENTI_UI[chiave])
        .map(([chiave, quante]) => {
            const def = EVENTI_UI[chiave];
            const titolo = quante > 1 ? `${quante} ${def.label}` : def.label;
            const conteggio = quante > 1 ? `<span class="evento-conteggio">${quante}</span>` : '';
            return `<span class="evento ${def.classe}" title="${titolo}"><i class="fas ${def.icona}"></i>${conteggio}</span>`;
        })
        .join('');
}

function rigaGiocatore(giocatore, marcatore = '') {
    const info = anagraficaGiocatore(giocatore.p);
    const senzaVoto = giocatore.b === undefined;
    const voto = senzaVoto ? (giocatore.sv ? 's.v.' : '—') : giocatore.b;
    const scarto = senzaVoto ? '' : giocatore.b - giocatore.v;

    let classeVoto = 'voto-neutro';
    if (!senzaVoto) classeVoto = scarto > 0 ? 'voto-bonus' : scarto < 0 ? 'voto-malus' : 'voto-neutro';

    const stato = giocatore.t === 'in' ? '<i class="fas fa-arrow-up entrato" title="Entrato"></i>'
        : giocatore.t === 'out' ? '<i class="fas fa-arrow-down uscito" title="Sostituito"></i>'
        : '';

    return `
        <div class="lineup-row">
            <span class="lineup-ruolo ruolo-${info.role}">${info.role}</span>
            <span class="lineup-nome">${info.name} ${stato}${marcatore}</span>
            <span class="lineup-serieA">${info.serieA || ''}</span>
            <span class="lineup-eventi">${badgeEventi(giocatore.e)}</span>
            <span class="lineup-voto ${classeVoto}">${voto}</span>
        </div>
    `;
}

function colonnaFormazione(titolo, lineup) {
    const titolari = lineup.filter(g => g.t !== 'b');
    const panchina = lineup.filter(g => g.t === 'b');

    return `
        <div class="lineup-team">
            <h5 class="lineup-team-name">${titolo}</h5>
            <div class="lineup-group">${titolari.map(g => rigaGiocatore(g)).join('')}</div>
            <div class="lineup-group-title">Panchina</div>
            <div class="lineup-group panchina">${panchina.map(g => rigaGiocatore(g)).join('')}</div>
        </div>
    `;
}

// Miglior undici possibile fra chi ha preso un voto, senza guardare chi il
// fantallenatore avesse schierato: è la formazione che spiega il punteggio
// ideale. Stesso algoritmo di calcola-giornata.mjs, che ha prodotto i punteggi
// scritti nel JSON — se divergesse, la pagina mostrerebbe un undici che non
// somma il numero che le sta accanto.
function formazioneIdeale(lineup) {
    const perRuolo = { P: [], D: [], C: [], A: [] };
    for (const g of lineup) {
        if (g.b === undefined) continue; // senza voto non è selezionabile
        const ruolo = anagraficaGiocatore(g.p).role;
        if (perRuolo[ruolo]) perRuolo[ruolo].push(g);
    }
    for (const ruolo of Object.keys(perRuolo)) perRuolo[ruolo].sort((a, b) => b.b - a.b);

    if (perRuolo.P.length === 0) return null;

    let migliore = null;
    for (const [d, c, a] of MODULI) {
        if (perRuolo.D.length < d || perRuolo.C.length < c || perRuolo.A.length < a) continue;

        const undici = [
            perRuolo.P[0],
            ...perRuolo.D.slice(0, d),
            ...perRuolo.C.slice(0, c),
            ...perRuolo.A.slice(0, a)
        ];
        const punti = undici.reduce((somma, g) => somma + g.b, 0);

        if (!migliore || punti > migliore.punti) {
            migliore = { modulo: `${d}-${c}-${a}`, undici, punti: Math.round(punti * 10) / 10 };
        }
    }
    return migliore;
}

// La stessa colonna, ma con l'undici che si sarebbe dovuto schierare. Chi era
// in panchina ed entra nell'ideale è il rimpianto della giornata, e va marcato:
// è l'unica informazione che la classifica ideale non dà già come numero.
function colonnaFormazioneIdeale(titolo, lineup) {
    const ideale = formazioneIdeale(lineup);
    if (!ideale) return colonnaFormazione(titolo, lineup);

    const scelti = new Set(ideale.undici.map(g => g.p));
    const esclusi = lineup.filter(g => !scelti.has(g.p));

    const marcatore = (g) => g.t === 'b'
        ? ' <i class="fas fa-circle-exclamation mancato" title="Era in panchina: punti che il fantallenatore non ha preso"></i>'
        : '';

    return `
        <div class="lineup-team">
            <h5 class="lineup-team-name">
                ${titolo}
                <span class="lineup-modulo" title="Modulo dell'undici ideale">${ideale.modulo}</span>
                <span class="lineup-ideale-somma">${ideale.punti}</span>
            </h5>
            <div class="lineup-group">${ideale.undici.map(g => rigaGiocatore(g, marcatore(g))).join('')}</div>
            <div class="lineup-group-title">Fuori dall'undici ideale</div>
            <div class="lineup-group panchina">${esclusi.map(g => rigaGiocatore(g)).join('')}</div>
        </div>
    `;
}

function generateLineupSection(match, index) {
    if (!match.lineups) return '';

    return `
        <div class="lineup-section">
            <button class="lineup-toggle" data-lineup="${index}" aria-expanded="false">
                <i class="fas fa-users"></i> Formazioni e voti
                <i class="fas fa-chevron-down chevron"></i>
            </button>
            <div class="lineup-detail" id="lineup-${index}" hidden>
                ${colonnaFormazione(match.homeTeam, match.lineups.home)}
                ${colonnaFormazione(match.awayTeam, match.lineups.away)}
            </div>
        </div>
    `;
}

function setupLineupToggles() {
    document.querySelectorAll('.lineup-toggle').forEach(bottone => {
        bottone.addEventListener('click', () => {
            const detail = document.getElementById(`lineup-${bottone.dataset.lineup}`);
            if (!detail) return;
            const apriamo = detail.hidden;
            detail.hidden = !apriamo;
            bottone.setAttribute('aria-expanded', String(apriamo));
            bottone.classList.toggle('aperto', apriamo);
        });
    });
}

// ============================================================
// Statistiche giocatore sulla stagione
// ============================================================

// Aggrega tutte le formazioni della stagione per giocatore.
// Gol, assist e cartellini contano SOLO quando il giocatore è sceso in campo:
// quello che combina mentre è in panchina non è del suo fantallenatore.
function calcolaStatisticheGiocatori() {
    const stats = {};

    const nuovo = (pid, team) => ({
        pid: Number(pid),
        team,
        presenze: 0,
        panchine: 0,
        sv: 0,
        sommaVoto: 0,
        sommaBonus: 0,
        puntiInPanchina: 0,
        gol: 0,
        assist: 0,
        golPanchina: 0,
        assistPanchina: 0,
        bonusPanchina: 0,
        amm: 0,
        esp: 0,
        rigParato: 0,
        rigSbagliato: 0,
        autogol: 0,
        golSubiti: 0
    });

    for (const round of (fantacalcioData.rounds || [])) {
        for (const match of round.matches) {
            if (!match.lineups) continue;

            for (const [lato, team] of [['home', match.homeTeam], ['away', match.awayTeam]]) {
                for (const g of match.lineups[lato]) {
                    // L'ultima squadra vista vince: segue i trasferimenti di stagione
                    const s = (stats[g.p] ||= nuovo(g.p, team));
                    s.team = team;

                    if (g.sv) s.sv += 1;

                    if (SCHIERATO.has(g.t)) {
                        if (g.b === undefined) continue; // schierato ma senza voto
                        s.presenze += 1;
                        s.sommaVoto += g.v;
                        s.sommaBonus += g.b;
                        for (const chiave of ['gol', 'assist', 'amm', 'esp', 'rigParato', 'rigSbagliato', 'autogol', 'golSubiti']) {
                            if (g.e && g.e[chiave]) s[chiave] += g.e[chiave];
                        }
                    } else if (g.t === 'b') {
                        s.panchine += 1;
                        if (g.b !== undefined) s.puntiInPanchina += g.b;
                        // Quel che ha combinato in Serie A mentre il fantallenatore
                        // lo teneva fuori. Il rimpianto si misura in punti, non in
                        // episodi: b è il fantavoto e v il voto puro, quindi b - v
                        // è il saldo di bonus e malus, che mette sullo stesso piano
                        // un gol, un assist e un rigore parato e sconta le ammonizioni.
                        if (g.b !== undefined && g.v !== undefined) s.bonusPanchina += g.b - g.v;
                        if (g.e && g.e.gol) s.golPanchina += g.e.gol;
                        if (g.e && g.e.assist) s.assistPanchina += g.e.assist;
                    }
                }
            }
        }
    }

    for (const s of Object.values(stats)) {
        s.mediaVoto = s.presenze > 0 ? s.sommaVoto / s.presenze : null;
        s.mediaFanta = s.presenze > 0 ? s.sommaBonus / s.presenze : null;
        s.puntiInPanchina = Math.round(s.puntiInPanchina * 10) / 10;
        s.incompreso = Math.round(s.bonusPanchina * 10) / 10;

        // Punti persi in malus stando in campo: un'espulsione non vale come
        // un'ammonizione, quindi si sommano i punti e non gli episodi
        const persi = Object.entries(MALUS).reduce((somma, [chiave, peso]) => somma + s[chiave] * peso, 0);
        s.malus = Math.round(persi * 10) / 10;
        s.episodiMalus = Object.keys(MALUS).reduce((somma, chiave) => somma + s[chiave], 0);
    }

    return stats;
}

// Rosa di una squadra alla giornata indicata (default: l'ultima disponibile)
function rosaDellaSquadra(team, round = Infinity) {
    const storico = (fantacalcioData.rosterHistory || []).filter(s => s.fromRound <= round);
    const ultimo = storico[storico.length - 1];
    return (ultimo && ultimo.teams && ultimo.teams[team]) || [];
}

// ============================================================
// Suggerimento formazione
// ============================================================

// Moduli ammessi: difensori, centrocampisti, attaccanti (il portiere è sempre
// uno). L'ordine è una preferenza: prima più attaccanti, poi più centrocampisti.
// A parità sostanziale di punteggio atteso vince il primo di questa lista.
const MODULI = [
    [3, 4, 3], [4, 3, 3], [3, 5, 2], [4, 4, 2], [5, 3, 2], [4, 5, 1], [5, 4, 1]
];

// Di quanto un modulo più arretrato deve battere uno più offensivo per essere
// preferito. L'atteso è una media, e gli attaccanti hanno la coda destra più
// lunga: gol e bonus stanno lì, quindi una media li sottovaluta rispetto ai
// difensori. Un punto sull'undici è meno di 0,1 per slot.
const EPS_MODULO = 1.0;

// Quanto pesa la forma recente rispetto alla media di stagione
const PESO_FORMA = 0.4;

// Resa presunta di chi non ha ancora un voto: leggermente sotto la media,
// perché un giocatore ignoto è una scommessa, non una certezza
const ATTESO_SENZA_DATI = { P: 5, D: 5, C: 5, A: 5 };

// Quanto vale uno slot occupato da chi non scende in campo. Non è zero — un
// cambio dalla panchina lo rimpiazza — ma deve restare sotto una prestazione
// vera anche mediocre: altrimenti "non gioca" batterebbe "gioca male", che è
// l'opposto di quello che deve consigliare il modello. Il cambio inoltre non
// sempre scatta: oltre tre sostituzioni, o senza un pari ruolo che ha giocato,
// il posto resta scoperto.
const VOTO_RIPIEGO = 4.5;

// Chi non compare affatto nelle probabili formazioni è quasi certamente fuori
// (infortunio, squalifica, fuori lista): resta una possibilità minima
const PROB_FUORI_LISTA = 0.15;

// Chi è nell'elenco infortunati e non compare nelle probabili: 15% è troppo
// generoso per un lungo stop, ma non si azzera perché l'elenco non dice quando
// rientra e un recupero in extremis capita
const PROB_INFORTUNATO = 0.03;

// Quanto vale a partita battere i rigori della propria squadra. Il primo
// rigorista ne calcia dai 5 ai 10 in una stagione: su una trentina di partite
// giocate fanno ~0,22 rigori a partita, e ogni rigore vale in media
// 0,76 × 3 − 0,24 × 3 ≈ 1,56 di fantavoto fra realizzato e sbagliato.
// Il prodotto è ~0,35, e non è uno spareggio: è punteggio vero che la media dei
// fantavoto non vede arrivare, quindi entra direttamente nel valore atteso.
const BONUS_RIGORE_PARTITA = 0.35;

// Quanto pesa ciascuna delle tre voci di contesto: campo, differenza di
// classifica e forma recente della squadra di Serie A. Al massimo ±9% in tutto,
// cioè meno di ±0,6 di fantavoto su una resa da 6,5: un leggero vantaggio, che
// riordina due giocatori quasi pari senza ribaltare uno scarto vero.
const PESO_CONTESTO = 0.03;

// Probabili formazioni di Serie A, caricate a parte perché cambiano ogni
// settimana e non fanno parte dello storico della stagione
let probabiliFormazioni = null;

async function loadProbabiliFormazioni() {
    try {
        probabiliFormazioni = await fetchJsonNoCache('data/probabili.json');
        console.log('Probabili formazioni caricate:', probabiliFormazioni.squadre, 'squadre');
    } catch (error) {
        // Non è un errore bloccante: senza probabili il suggeritore ripiega
        // sulla continuità storica
        console.warn('Probabili formazioni non disponibili:', error.message);
        probabiliFormazioni = null;
    }
    return probabiliFormazioni;
}

// Nomi e squadre arrivano da due fonti diverse (l'API della lega e le pagine di
// fantacalcio.it) che usano la stessa convenzione ma non sempre la stessa
// punteggiatura: il confronto va fatto su una forma ridotta.
function normalizzaNome(testo) {
    return (testo || '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z]/g, '');
}

// L'elenco infortunati non porta gli id: si abbina per nome e squadra di Serie A
// sull'anagrafica della lega, che il browser ha già. L'indice si costruisce una
// volta sola e si butta quando cambiano i dati caricati.
let indiceInfortunati = null;
let indiceInfortunatiPer = null;

function costruisciIndiceInfortunati() {
    if (indiceInfortunatiPer === probabiliFormazioni) return indiceInfortunati;

    indiceInfortunatiPer = probabiliFormazioni;
    indiceInfortunati = new Map();

    for (const voce of (probabiliFormazioni && probabiliFormazioni.infortunati) || []) {
        const squadra = normalizzaNome(voce.squadra);
        indiceInfortunati.set(`${normalizzaNome(voce.nome)}|${squadra}`, voce);
        // Ripiego sul solo cognome: serve quando una fonte scrive "Zambo Anguissa"
        // e l'altra "Anguissa". Non sovrascrive mai un abbinamento esatto.
        const cognome = normalizzaNome(voce.nome.replace(/\s+[A-Z]\.$/, ''));
        const chiaveRipiego = `~${cognome}|${squadra}`;
        if (!indiceInfortunati.has(chiaveRipiego)) indiceInfortunati.set(chiaveRipiego, voce);
    }
    return indiceInfortunati;
}

function infortunioPer(nomeGiocatore, squadraSerieA) {
    const indice = costruisciIndiceInfortunati();
    if (!indice || indice.size === 0) return null;

    const squadra = normalizzaNome(squadraSerieA);
    const nome = normalizzaNome(nomeGiocatore);

    return indice.get(`${nome}|${squadra}`)
        || indice.get(`~${nome}|${squadra}`)
        || null;
}

// La voce di infortunio di un giocatore della lega, se c'è
function infortunioDi(pid) {
    const info = anagraficaGiocatore(pid);
    return infortunioPer(info.name, info.serieA);
}

// Probabilità che un giocatore scenda in campo nella prossima giornata.
// Viene dalle probabili formazioni quando ci sono, altrimenti da quante volte
// ha preso un voto finora.
function probabilitaDiGiocare(pid, continuitaStorica) {
    const voce = probabiliFormazioni && probabiliFormazioni.giocatori
        ? probabiliFormazioni.giocatori[pid]
        : null;

    if (!probabiliFormazioni) {
        return { p: continuitaStorica, fonte: 'storico', voce: null, infortunio: null };
    }

    const infortunio = infortunioDi(pid);

    // Chi è nelle probabili con una percentuale ha già il giudizio più
    // aggiornato: l'elenco infortunati sa dell'acciacco, le probabili sanno
    // anche se il rientro è previsto per domenica
    if (voce) {
        return { p: voce.probabilita / 100, fonte: 'probabili', voce, infortunio };
    }
    if (infortunio) {
        return { p: PROB_INFORTUNATO, fonte: 'infortunato', voce: null, infortunio };
    }
    return { p: PROB_FUORI_LISTA, fonte: 'fuori-lista', voce: null, infortunio: null };
}

// Indice dei rigoristi: pid -> squadra di Serie A e posto nella gerarchia.
// I dati arrivano per squadra perché per pesare il secondo bisogna sapere chi
// ha davanti, non solo che è secondo.
let indiceRigoristi = null;
let indiceRigoristiPer = null;

function costruisciIndiceRigoristi() {
    if (indiceRigoristiPer === probabiliFormazioni) return indiceRigoristi;

    indiceRigoristiPer = probabiliFormazioni;
    indiceRigoristi = new Map();

    const perSquadra = (probabiliFormazioni && probabiliFormazioni.rigoristi) || {};
    for (const [squadra, voci] of Object.entries(perSquadra)) {
        voci.forEach((voce, i) => {
            if (!indiceRigoristi.has(voce.pid)) {
                indiceRigoristi.set(voce.pid, { squadra, ordine: i + 1, voci });
            }
        });
    }
    return indiceRigoristi;
}

// Probabilità che un rigorista scenda in campo. Può non essere in nessuna rosa
// della lega, quindi non ha anagrafica locale: nome e squadra vengono dalla
// pagina dei rigoristi e servono a riconoscerlo fra gli infortunati.
function probabilitaRigorista(voce, squadra) {
    const inProbabili = (probabiliFormazioni.giocatori || {})[voce.pid];
    if (inProbabili) return inProbabili.probabilita / 100;
    return infortunioPer(voce.nome, squadra) ? PROB_INFORTUNATO : PROB_FUORI_LISTA;
}

// Quanti rigori della squadra ci si aspetta che calci questo giocatore.
// Il primo rigorista li batte tutti quando gioca; il secondo solo quando il
// primo non c'è; il terzo quando mancano entrambi. È il motivo per cui una
// gerarchia va letta intera: se il rigorista designato è infortunato, il suo
// vice vale quanto lui.
function quotaRigori(pid) {
    const indice = costruisciIndiceRigoristi();
    const voce = indice.get(Number(pid));
    if (!voce) return null;

    let quota = 1;
    const davanti = [];
    for (const precedente of voce.voci.slice(0, voce.ordine - 1)) {
        const p = probabilitaRigorista(precedente, voce.squadra);
        quota *= (1 - p);
        davanti.push({ nome: precedente.nome, p });
    }

    return { ordine: voce.ordine, quota, bonus: quota * BONUS_RIGORE_PARTITA, davanti };
}

// Contesto della partita di Serie A: giocare in casa, contro chi, e con che
// forma ci si arriva. Tre leggeri vantaggi che moltiplicano la resa — non la
// probabilità di giocare, che dipende dalle scelte dell'allenatore e non
// dall'avversario.
const contestiPartita = new Map();
let contestiPartitaPer = null;

function contestoPartita(squadraSerieA) {
    if (contestiPartitaPer !== probabiliFormazioni) {
        contestiPartitaPer = probabiliFormazioni;
        contestiPartita.clear();
    }
    if (contestiPartita.has(squadraSerieA)) return contestiPartita.get(squadraSerieA);

    const contesto = calcolaContestoPartita(squadraSerieA);
    contestiPartita.set(squadraSerieA, contesto);
    return contesto;
}

function calcolaContestoPartita(squadraSerieA) {
    const neutro = { fattore: 1, noto: false };
    if (!squadraSerieA || !probabiliFormazioni) return neutro;

    const turno = probabiliFormazioni.prossimoTurno;
    const partita = turno && (turno.partite || []).find(p => p.casa === squadraSerieA || p.fuori === squadraSerieA);

    // Squadra che riposa, o dati di contesto non scaricati: nessun aggiustamento
    if (!partita) return neutro;

    const casa = partita.casa === squadraSerieA;
    const avversario = casa ? partita.fuori : partita.casa;

    const classifica = probabiliFormazioni.classificaSerieA || {};
    const posizione = classifica[squadraSerieA] || null;
    const posizioneAvversario = classifica[avversario] || null;

    const forma = (probabiliFormazioni.formaSerieA || {})[squadraSerieA] || null;

    const campo = casa ? PESO_CONTESTO : -PESO_CONTESTO;

    // Proporzionale alla distanza in classifica: fra squadre vicine tende a zero
    // da sé, che è giusto anche a inizio stagione quando la classifica dice poco
    const graduatoria = posizione && posizioneAvversario
        ? PESO_CONTESTO * (posizioneAvversario - posizione) / 19
        : 0;

    // Media punti delle ultime giornate contate, riportata sull'intervallo
    // [-1, +1]: 3 punti a partita in alto, zero in basso, 1,5 al centro
    const andamento = forma && forma.partite > 0
        ? PESO_CONTESTO * ((forma.punti / forma.partite) - 1.5) / 1.5
        : 0;

    return {
        fattore: 1 + campo + graduatoria + andamento,
        noto: true,
        squadra: squadraSerieA,
        casa,
        avversario,
        posizione,
        posizioneAvversario,
        punti: forma ? forma.punti : null,
        partite: forma ? forma.partite : null,
        esiti: forma ? forma.esiti : ''
    };
}

// Quanto sono vecchie le probabili formazioni caricate. L'errore che questo
// evita è silenzioso: un file della settimana scorsa continua a produrre
// percentuali dall'aria credibile, ma riferite a una giornata già giocata.
function freschezzaProbabili() {
    if (!probabiliFormazioni || !probabiliFormazioni.aggiornato) {
        return { stato: 'mancanti' };
    }

    const aggiornato = new Date(probabiliFormazioni.aggiornato);
    if (isNaN(aggiornato.getTime())) return { stato: 'mancanti' };

    // Giorni di calendario, non millisecondi divisi: altrimenti "ieri sera"
    // diventa oggi o due giorni fa secondo l'ora in cui si guarda la pagina
    const aMezzanotte = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const giorni = Math.round((aMezzanotte(new Date()) - aMezzanotte(aggiornato)) / 86400000);

    const data = aggiornato.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' });
    const quando = giorni <= 0 ? 'oggi' : (giorni === 1 ? 'ieri' : `${giorni} giorni fa`);

    return {
        stato: giorni > 2 ? 'vecchie' : 'fresche',
        giorni,
        data,
        quando
    };
}

// Storico dei voti con bonus di un giocatore, dalla giornata più vecchia.
//
// A differenza delle classifiche marcatori, qui contano anche le giornate in
// cui era in panchina: per prevedere come renderà conta se ha giocato in Serie
// A e quanto ha fatto, non se il suo fantallenatore lo aveva schierato.
function storicoVoti(pid) {
    const voti = [];
    for (const round of (fantacalcioData.rounds || [])) {
        for (const match of round.matches) {
            if (!match.lineups) continue;
            for (const lato of ['home', 'away']) {
                const g = match.lineups[lato].find(x => x.p === Number(pid));
                if (g && g.b !== undefined) {
                    voti.push({ round: round.round, voto: g.b, schierato: SCHIERATO.has(g.t) });
                }
            }
        }
    }
    return voti.sort((a, b) => a.round - b.round);
}

// Media pesata delle ultime giornate: più recente, più pesa
function mediaForma(voti, quante = 5) {
    const ultimi = voti.slice(-quante);
    if (ultimi.length === 0) return null;

    let somma = 0, pesi = 0;
    ultimi.forEach((v, i) => {
        const peso = i + 1;
        somma += v.voto * peso;
        pesi += peso;
    });
    return somma / pesi;
}

// Stima del rendimento atteso di un giocatore alla prossima giornata.
// Tiene conto di media di stagione, forma recente e continuità di impiego:
// un fuoriclasse che non prende mai un voto vale meno di un titolare fisso.
function punteggioAtteso(pid, stats, giornateGiocate) {
    const info = anagraficaGiocatore(pid);
    const voti = storicoVoti(pid);

    // Continuità = quante volte ha preso un voto in Serie A, non quante volte
    // è stato schierato: misura la disponibilità del giocatore, non le scelte
    // del fantallenatore
    const votiPresi = voti.length;
    const affidabilita = giornateGiocate > 0 ? votiPresi / giornateGiocate : 0;

    const senzaDati = votiPresi === 0;

    // Qualità = quanto rende QUANDO gioca, senza ancora considerare se giocherà
    const media = senzaDati ? null : voti.reduce((somma, v) => somma + v.voto, 0) / votiPresi;
    const forma = senzaDati ? null : mediaForma(voti);
    const qualita = senzaDati
        ? ATTESO_SENZA_DATI[info.role]
        : (forma === null ? media : media * (1 - PESO_FORMA) + forma * PESO_FORMA);

    const { p, fonte, voce, infortunio } = probabilitaDiGiocare(pid, affidabilita);

    // Prima di stimare cosa farà il giocatore si guarda la partita che lo
    // aspetta: campo, avversario e forma della sua squadra di Serie A
    const squadraSerieA = voce ? voce.squadra : info.serieA;
    const contesto = contestoPartita(squadraSerieA);
    const resa = qualita * contesto.fattore;

    // I rigori sono punteggio in più che arriva solo se scende in campo, quindi
    // stanno dentro la parentesi con la resa e non fuori
    const rigori = quotaRigori(pid);
    const bonusRigori = rigori ? rigori.bonus : 0;

    // Valore atteso: se gioca rende `resa` più i rigori che ci si aspetta calci,
    // se non gioca il posto lo prende un cambio che vale `VOTO_RIPIEGO`
    const atteso = p * (resa + bonusRigori) + (1 - p) * VOTO_RIPIEGO;

    return {
        pid: Number(pid),
        atteso,
        qualita: resa,
        qualitaBase: qualita,
        contesto,
        media,
        forma,
        probabilita: p,
        fonteProbabilita: fonte,
        rigorista: rigori ? rigori.ordine : null,
        rigori,
        infortunio: infortunio ? infortunio.nota : null,
        titolareProbabile: voce ? voce.titolare : null,
        squadraSerieA,
        affidabilita,
        presenze: votiPresi,
        schierato: stats[pid] ? stats[pid].presenze : 0,
        senzaDati
    };
}

// Ordina due candidati per valore atteso. I rigori non hanno bisogno di uno
// spareggio a parte: sono già dentro l'atteso, pesati per quanti se ne aspetta
// davvero ciascuno.
function confrontaCandidati(a, b) {
    return b.atteso - a.atteso;
}

// Miglior 11 fra i giocatori disponibili, provando tutti i moduli
function miglioreFormazione(candidati) {
    const perRuolo = { P: [], D: [], C: [], A: [] };
    for (const c of candidati) {
        const ruolo = anagraficaGiocatore(c.pid).role;
        if (perRuolo[ruolo]) perRuolo[ruolo].push(c);
    }
    for (const ruolo of Object.keys(perRuolo)) {
        perRuolo[ruolo].sort(confrontaCandidati);
    }

    if (perRuolo.P.length === 0) return null;

    let migliore = null;
    let massimo = null;
    for (const [d, c, a] of MODULI) {
        if (perRuolo.D.length < d || perRuolo.C.length < c || perRuolo.A.length < a) continue;

        const undici = [
            perRuolo.P[0],
            ...perRuolo.D.slice(0, d),
            ...perRuolo.C.slice(0, c),
            ...perRuolo.A.slice(0, a)
        ];
        const totale = undici.reduce((somma, g) => somma + g.atteso, 0);

        // MODULI è in ordine di preferenza, dal più offensivo: un assetto più
        // arretrato entra solo se guadagna più di EPS_MODULO, altrimenti a
        // parità sostanziale resta quello sbilanciato in avanti
        if (!migliore || totale > migliore.totale + EPS_MODULO) {
            migliore = { modulo: `${d}-${c}-${a}`, undici, totale };
        }
        // Il massimo puro serve solo a dire in pagina quando la scelta è stata
        // fatta per sbilanciamento e non per totale
        if (!massimo || totale > massimo.totale) {
            massimo = { modulo: `${d}-${c}-${a}`, totale };
        }
    }

    if (!migliore) return null;

    // Se esisteva un assetto che somma di più, la scelta è stata la preferenza
    // per l'attacco: la pagina lo dice, invece di far sembrare il modulo il
    // massimo aritmetico
    migliore.sbilanciato = massimo && massimo.modulo !== migliore.modulo
        ? { modulo: massimo.modulo, totale: massimo.totale }
        : null;

    // La panchina va letta come ordine di sostituzione: prima per ruolo, poi
    // per chi ha più probabilità di scendere in campo, perché un cambio serve
    // solo se il giocatore gioca davvero
    const titolari = new Set(migliore.undici.map(g => g.pid));
    migliore.panchina = candidati
        .filter(c => !titolari.has(c.pid))
        .sort((a, b) => {
            const ruoloA = ORDINE_RUOLI[anagraficaGiocatore(a.pid).role] ?? 9;
            const ruoloB = ORDINE_RUOLI[anagraficaGiocatore(b.pid).role] ?? 9;
            if (ruoloA !== ruoloB) return ruoloA - ruoloB;
            if (b.probabilita !== a.probabilita) return b.probabilita - a.probabilita;
            return confrontaCandidati(a, b);
        });

    return migliore;
}

// Suggerisce la formazione per una squadra alla prossima giornata
function suggerisciFormazione(team) {
    const stats = calcolaStatisticheGiocatori();
    const giornateGiocate = (fantacalcioData.rounds || []).length;
    const rosa = rosaDellaSquadra(team);

    if (rosa.length === 0) return null;

    const candidati = rosa.map(pid => punteggioAtteso(pid, stats, giornateGiocate));
    const formazione = miglioreFormazione(candidati);

    return formazione ? { ...formazione, giornateGiocate, prossima: giornateGiocate + 1 } : null;
}

// ============================================================
// Sezione Rose
// ============================================================

const ORDINE_RUOLI = { P: 0, D: 1, C: 2, A: 3 };

function numero(valore, decimali = 2) {
    return valore === null || valore === undefined ? '—' : valore.toFixed(decimali);
}

function cellaConteggio(valore, classe = '', titolo = '') {
    const attributo = titolo ? ` title="${titolo}"` : '';
    return `<span class="rosa-cella ${classe} ${valore ? '' : 'zero'}"${attributo}>${valore || '—'}</span>`;
}

// La colonna dei cartellini è una sola per non allargare la griglia, ma gialli
// e rossi non pesano uguale: la distinzione vive nel title e nel colore
function dettaglioCartellini(s) {
    const pezzi = [];
    if (s.amm) pezzi.push(`${s.amm} ammonizion${s.amm === 1 ? 'e' : 'i'}`);
    if (s.esp) pezzi.push(`${s.esp} espulsion${s.esp === 1 ? 'e' : 'i'}`);
    return pezzi.join(', ');
}

// Le sigle tengono stretta la colonna Serie A: il nome intero resta nel title
function siglaSerieA(nome) {
    return nome ? nome.slice(0, 3).toUpperCase() : '';
}

function rigaRosa(pid, stats, peggiori) {
    const info = anagraficaGiocatore(pid);
    const s = stats[pid];

    // La pastiglia del ruolo si borda quando il giocatore e' fra i due peggiori
    // del suo reparto: il motivo sta nel title, perche' un bordo da solo non
    // spiega se e' per le presenze o per la fantamedia
    const motivo = peggiori && peggiori.get(pid);
    const pastiglia = `<span class="rosa-ruolo ruolo-${info.role}${motivo ? ' peggiore' : ''}"${motivo ? ` title="${motivo}"` : ''}>${info.role}</span>`;

    if (!s) {
        return `
            <div class="rosa-row mai-visto">
                ${pastiglia}
                <span class="rosa-nome">${info.name}</span>
                <span class="rosa-serieA" title="${info.serieA || ''}">${siglaSerieA(info.serieA)}</span>
                <span class="rosa-cella zero">—</span><span class="rosa-cella zero">—</span>
                <span class="rosa-cella zero">—</span><span class="rosa-cella zero">—</span>
                <span class="rosa-cella zero">—</span><span class="rosa-cella zero">—</span>
                <span class="rosa-cella zero">—</span><span class="rosa-cella zero">—</span>
            </div>
        `;
    }

    return `
        <div class="rosa-row">
            ${pastiglia}
            <span class="rosa-nome">${info.name}</span>
            <span class="rosa-serieA" title="${info.serieA || ''}">${siglaSerieA(info.serieA)}</span>
            <span class="rosa-cella">${s.presenze || '—'}</span>
            <span class="rosa-cella panchina-cella">${s.panchine || '—'}</span>
            <span class="rosa-cella">${numero(s.mediaVoto)}</span>
            <span class="rosa-cella forte">${numero(s.mediaFanta)}</span>
            ${cellaConteggio(s.gol, 'gol-cella')}
            ${cellaConteggio(s.assist, 'assist-cella')}
            ${cellaConteggio(s.amm + s.esp, `cartellini-cella${s.esp ? ' con-rosso' : ''}`, dettaglioCartellini(s))}
            <span class="rosa-cella panchina-persi ${s.puntiInPanchina ? '' : 'zero'}">${s.puntiInPanchina || '—'}</span>
        </div>
    `;
}

// Quante giornate sono state effettivamente giocate: serve come base per la
// soglia di presenze, che altrimenti non vorrebbe dire niente
function giornateGiocate() {
    return (fantacalcioData.rounds || []).filter(r => punteggiDiGiornata(r).length > 0).length;
}

// I due peggiori di ogni reparto, secondo la regola della lega: chi sta sotto
// meta' delle giornate e' peggiore comunque, perche' una fantamedia costruita
// su tre partite non dice niente; fra chi ha giocato abbastanza decide la
// fantamedia. I portieri restano fuori: in rosa sono tre e il confronto fra
// loro e' un'altra cosa.
const RUOLI_DA_GIUDICARE = ['D', 'C', 'A'];
const SOGLIA_PRESENZE = 0.5;

function peggioriPerRuolo(pids, stats) {
    const giornate = giornateGiocate();
    const peggiori = new Map();
    if (giornate === 0) return peggiori;

    for (const ruolo of RUOLI_DA_GIUDICARE) {
        const delReparto = pids.filter(pid => anagraficaGiocatore(pid).role === ruolo);

        // Con due soli giocatori in un reparto, dire "i due peggiori" non
        // aggiunge niente: sono tutti
        if (delReparto.length <= 2) continue;

        const voci = delReparto.map(pid => {
            const s = stats[pid];
            const presenze = s ? s.presenze : 0;
            const quota = presenze / giornate;
            return {
                pid,
                presenze,
                quota,
                scarso: quota < SOGLIA_PRESENZE,
                // Chi non ha mai giocato non ha fantamedia: vale meno di
                // qualunque voto vero, non piu' di tutti
                fanta: s && s.mediaFanta !== null ? s.mediaFanta : -Infinity
            };
        });

        voci.sort((a, b) => {
            if (a.scarso !== b.scarso) return a.scarso ? -1 : 1;
            if (a.scarso) return a.presenze - b.presenze || a.fanta - b.fanta;
            return a.fanta - b.fanta;
        });

        voci.slice(0, 2).forEach(v => {
            const percentuale = Math.round(v.quota * 100);
            peggiori.set(v.pid, v.scarso
                ? `Fra i due peggiori ${ruolo === 'D' ? 'difensori' : ruolo === 'C' ? 'centrocampisti' : 'attaccanti'}: ${v.presenze} presenze su ${giornate} (${percentuale}%), sotto la meta' delle giornate`
                : `Fra i due peggiori ${ruolo === 'D' ? 'difensori' : ruolo === 'C' ? 'centrocampisti' : 'attaccanti'}: fantamedia ${numero(v.fanta)} con ${v.presenze} presenze su ${giornate}`);
        });
    }

    return peggiori;
}

function schedaRosa(team, stats) {
    const squadra = fantacalcioData.teams.find(t => t.name === team);
    const pids = rosaDellaSquadra(team).slice().sort((a, b) => {
        const ia = anagraficaGiocatore(a), ib = anagraficaGiocatore(b);
        const diff = (ORDINE_RUOLI[ia.role] ?? 9) - (ORDINE_RUOLI[ib.role] ?? 9);
        return diff !== 0 ? diff : ia.name.localeCompare(ib.name);
    });

    const inPanchina = pids.reduce((somma, pid) => somma + (stats[pid]?.puntiInPanchina || 0), 0);
    const peggiori = peggioriPerRuolo(pids, stats);

    return `
        <div class="rosa-card">
            <div class="rosa-card-header">
                <h3>${team}</h3>
                <span class="rosa-owner">${squadra ? squadra.owner : ''}</span>
                <span class="rosa-panchina-totale" title="Punti totali presi dai giocatori lasciati in panchina">
                    <i class="fas fa-chair"></i> ${Math.round(inPanchina * 10) / 10} pt in panchina
                </span>
            </div>
            <div class="rosa-table">
                <div class="rosa-row rosa-header">
                    <span>R</span><span>Giocatore</span><span>Team</span>
                    <span title="Presenze da schierato">Pres</span>
                    <span title="Volte in panchina">Panc</span>
                    <span title="Media voto">MV</span>
                    <span title="Media fantavoto">MF</span>
                    <span title="Gol">G</span>
                    <span title="Assist">A</span>
                    <span title="Cartellini">Cart</span>
                    <span title="Punti presi mentre era in panchina">Panca</span>
                </div>
                ${pids.map(pid => rigaRosa(pid, stats, peggiori)).join('')}
            </div>
        </div>
    `;
}

// Classifiche individuali: contano solo i giocatori realmente schierati
function classificaIndividuale(stats, chiave, titolo, icona, opzioni = {}) {
    const { limite = 10, dettaglio = null, sottotitolo = '' } = opzioni;
    const righe = Object.values(stats)
        .filter(s => s[chiave] > 0)
        .sort((a, b) => b[chiave] - a[chiave] || (b.mediaFanta || 0) - (a.mediaFanta || 0))
        .slice(0, limite);

    const intestazione = `<h4><i class="fas ${icona}"></i> ${titolo}</h4>`
        + (sottotitolo ? `<p class="classifica-sottotitolo">${sottotitolo}</p>` : '');

    if (righe.length === 0) {
        return `
            <div class="classifica-individuale">
                ${intestazione}
                <p class="nessun-dato">Nessun dato ancora.</p>
            </div>
        `;
    }

    return `
        <div class="classifica-individuale">
            ${intestazione}
            <ol class="classifica-lista">
                ${righe.map((s, i) => {
                    const info = anagraficaGiocatore(s.pid);
                    const titolo = dettaglio ? ` title="${dettaglio(s)}"` : '';
                    return `
                        <li class="${i === 0 ? 'primo' : ''}"${titolo}>
                            <span class="pos">${i + 1}</span>
                            <span class="nome">${info.name}</span>
                            <span class="squadra">${s.team}</span>
                            <span class="valore">${s[chiave]}</span>
                        </li>
                    `;
                }).join('')}
            </ol>
        </div>
    `;
}

// ============================================================
// Vista "Formazione consigliata"
// ============================================================

const SQUADRA_STORAGE_KEY = 'fantacalcio-squadra';

function frecciaForma(g) {
    if (g.forma === null || g.media === null) return '';
    const delta = g.forma - g.media;
    if (delta > 0.4) return '<i class="fas fa-arrow-trend-up forma-su" title="In crescita"></i>';
    if (delta < -0.4) return '<i class="fas fa-arrow-trend-down forma-giu" title="In calo"></i>';
    return '<i class="fas fa-minus forma-stabile" title="Stabile"></i>';
}

// Come la partita di Serie A pesa sulla resa: una freccia con il conto intero
// nel title, perché la tabella non ha spazio per un'altra colonna
function glifoContesto(contesto) {
    if (!contesto || !contesto.noto) return '';

    const scarto = contesto.fattore - 1;
    const partita = contesto.casa
        ? `${contesto.squadra}-${contesto.avversario}`
        : `${contesto.avversario}-${contesto.squadra}`;

    const pezzi = [partita, contesto.casa ? 'in casa' : 'in trasferta'];
    if (contesto.posizione) pezzi.push(`${contesto.posizione}° in classifica`);
    if (contesto.posizioneAvversario) pezzi.push(`avversario ${contesto.posizioneAvversario}°`);
    if (contesto.partite) pezzi.push(`${contesto.punti} punti nelle ultime ${contesto.partite} (${contesto.esiti})`);
    pezzi.push(`contesto ${scarto > 0 ? '+' : ''}${Math.round(scarto * 100)}%`);

    const su = scarto > 0.005;
    const giu = scarto < -0.005;
    const classe = su ? 'contesto-su' : (giu ? 'contesto-giu' : 'contesto-pari');
    const glifo = su ? '↑' : (giu ? '↓' : '=');

    return `<span class="consiglio-contesto ${classe}" title="${pezzi.join(' · ')}">${glifo}</span>`;
}

// Il pallone accanto al nome dice anche quanto pesa: un secondo rigorista con il
// titolare sano vale quasi nulla, lo stesso con il titolare infortunato vale
// quanto un primo. Il title mostra il conto, l'opacità lo fa vedere da lontano.
const GRADI_RIGORE = ['Primo', 'Secondo', 'Terzo'];

function badgeRigorista(rigori) {
    const grado = GRADI_RIGORE[rigori.ordine - 1] || `${rigori.ordine}º`;
    const pezzi = [`${grado} rigorista`];

    for (const davanti of rigori.davanti) {
        pezzi.push(`${davanti.nome} gioca al ${Math.round(davanti.p * 100)}%`);
    }
    pezzi.push(`rigori attesi ${Math.round(rigori.quota * 100)}%, +${rigori.bonus.toFixed(2)}`);

    // Sotto un ventesimo di punto il pallone c'è ma non deve attirare l'occhio
    const classe = rigori.bonus >= 0.05 ? 'consiglio-rigorista' : 'consiglio-rigorista tenue';
    return `<i class="fas fa-futbol ${classe}" title="${pezzi.join(' · ')}"></i>`;
}

function rigaConsiglio(g, titolare) {
    const info = anagraficaGiocatore(g.pid);
    const perc = Math.round(g.probabilita * 100);

    let classeProb = 'prob-bassa';
    if (perc >= 70) classeProb = 'prob-alta';
    else if (perc >= 40) classeProb = 'prob-media';

    // L'infortunio viene prima di tutto: è il motivo per cui non schierarlo, e
    // spiega da solo anche l'assenza dalle probabili
    let nota = '';
    let titoloNota = '';
    if (g.infortunio) {
        nota = 'infortunato';
        titoloNota = g.infortunio;
    } else if (g.fonteProbabilita === 'fuori-lista') nota = 'fuori dalle probabili';
    else if (g.titolareProbabile === false) nota = 'in panchina in Serie A';
    else if (g.senzaDati) nota = 'nessun voto finora';
    else if (titolare && g.schierato === 0) nota = 'era in panchina';

    const qualita = g.senzaDati ? '—' : g.qualita.toFixed(2);

    const rigori = g.rigori ? badgeRigorista(g.rigori) : '';

    return `
        <div class="consiglio-row ${titolare ? 'titolare' : 'panca'}${g.infortunio ? ' infortunato' : ''}">
            <span class="ruolo-${info.role}">${info.role}</span>
            <span class="consiglio-nome">${info.name}${rigori}</span>
            <span class="consiglio-serieA">${siglaSerieA(g.squadraSerieA)}${glifoContesto(g.contesto)}</span>
            <span class="consiglio-forma">${frecciaForma(g)}</span>
            <span class="consiglio-nota"${titoloNota ? ` title="${titoloNota.replace(/"/g, '&quot;')}"` : ''}>${nota}</span>
            <span class="consiglio-qualita" title="Rendimento medio quando gioca, corretto per il contesto della partita">${qualita}</span>
            <span class="consiglio-prob ${classeProb}" title="Probabilità di scendere in campo">${perc}%</span>
            <span class="consiglio-atteso" title="Valore atteso: probabilità x rendimento">${g.atteso.toFixed(2)}</span>
        </div>
    `;
}

function displayFormazione() {
    const contenitore = document.getElementById('formazione-container');
    if (!contenitore) return;

    if (!fantacalcioData || !fantacalcioData.players || !fantacalcioData.rosterHistory) {
        contenitore.innerHTML = `
            <div class="empty-season">
                <i class="fas fa-wand-magic-sparkles"></i>
                <h3>Suggerimenti non disponibili</h3>
                <p>Servono i dati per giocatore, presenti dalla stagione 2026-2027.</p>
            </div>
        `;
        return;
    }

    const squadre = fantacalcioData.teams
        .map(t => t.name)
        .filter(nome => rosaDellaSquadra(nome).length > 0);

    if (squadre.length === 0) {
        contenitore.innerHTML = '<div class="empty-season"><h3>Nessuna rosa disponibile</h3></div>';
        return;
    }

    let scelta = null;
    try { scelta = localStorage.getItem(SQUADRA_STORAGE_KEY); } catch (e) { /* non disponibile */ }
    if (!squadre.includes(scelta)) scelta = squadre[0];

    const f = suggerisciFormazione(scelta);
    const giornate = (fantacalcioData.rounds || []).length;

    const avvisoDati = giornate < 4
        ? `<div class="consiglio-avviso attenzione">
               <i class="fas fa-triangle-exclamation"></i>
               Solo ${giornate} giornat${giornate === 1 ? 'a' : 'e'} disputat${giornate === 1 ? 'a' : 'e'}:
               con così pochi dati il suggerimento vale poco. Diventa attendibile dopo qualche giornata.
           </div>`
        : '';

    // Da quando sono ferme le probabili formazioni. Senza questa riga un file
    // vecchio consiglia sulla giornata sbagliata senza dare alcun segnale.
    const fresche = freschezzaProbabili();
    const avvisoProbabili = fresche.stato === 'mancanti'
        ? `<div class="consiglio-avviso attenzione">
               <i class="fas fa-triangle-exclamation"></i>
               Probabili formazioni non disponibili: la colonna Gioca usa la continuità storica,
               non le probabili di Serie A.
           </div>`
        : (fresche.stato === 'vecchie'
            ? `<div class="consiglio-avviso attenzione">
                   <i class="fas fa-triangle-exclamation"></i>
                   Probabili formazioni del ${fresche.data}, ${fresche.quando}: potrebbero riferirsi
                   alla giornata già giocata.
               </div>`
            : `<div class="consiglio-avviso nota">
                   <i class="fas fa-clock-rotate-left"></i>
                   Probabili formazioni del ${fresche.data}, aggiornate ${fresche.quando}.
               </div>`);

    const corpo = !f
        ? '<div class="empty-season"><h3>Rosa insufficiente</h3><p>Non ci sono abbastanza giocatori per comporre un modulo valido.</p></div>'
        : `
            <div class="consiglio-card">
                <div class="consiglio-header">
                    <h3>${scelta}</h3>
                    <span class="consiglio-modulo"${f.sbilanciato ? ` title="Scelto per sbilanciamento in avanti: ${f.sbilanciato.modulo} sommerebbe ${f.sbilanciato.totale.toFixed(1)}"` : ''}>${f.modulo}</span>
                    <span class="consiglio-totale" title="Somma dei punteggi attesi">
                        ${f.totale.toFixed(1)} pt attesi
                    </span>
                </div>
                <div class="consiglio-lista">
                    <div class="consiglio-row intestazione">
                        <span>R</span><span>Giocatore</span><span>Team</span>
                        <span title="Forma recente rispetto alla media">Forma</span>
                        <span></span>
                        <span title="Rendimento medio quando gioca">Resa</span>
                        <span title="Probabilità di scendere in campo">Gioca</span>
                        <span title="Valore atteso">Atteso</span>
                    </div>
                    ${f.undici.map(g => rigaConsiglio(g, true)).join('')}
                    <div class="consiglio-separatore">
                        Panchina, per ruolo e probabilità di giocare (${f.panchina.length} giocatori)
                    </div>
                    ${f.panchina.map(g => rigaConsiglio(g, false)).join('')}
                </div>
            </div>
        `;

    contenitore.innerHTML = `
        <div class="consiglio-barra">
            <label for="squadra-select">Squadra</label>
            <select id="squadra-select" class="squadra-select">
                ${squadre.map(s => `<option value="${s}" ${s === scelta ? 'selected' : ''}>${s}</option>`).join('')}
            </select>
            <span class="consiglio-giornata">Giornata ${giornate + 1}</span>
        </div>
        ${avvisoDati}
        ${avvisoProbabili}
        ${corpo}
        <details class="consiglio-spiegazione">
            <summary><i class="fas fa-circle-info"></i> Come nasce questo suggerimento</summary>
            <div class="spiegazione-corpo">
                <p>
                    Per ogni giocatore si stima un <strong>valore atteso</strong>, poi si prova ogni
                    modulo ammesso e si tiene la combinazione che somma di più. Il valore atteso è:
                </p>
                <p class="formula">
                    atteso = <em>gioca</em> × <em>resa</em> + (1 − <em>gioca</em>) × 4,5
                </p>
                <dl>
                    <dt>Resa</dt>
                    <dd>
                        Quanto rende <em>quando gioca</em>: media fantavoto di stagione (60%) più forma
                        delle ultime 5 giornate (40%), pesata verso le più recenti. Contano anche i voti
                        presi stando in panchina — per prevedere il rendimento conta che il giocatore
                        abbia giocato in Serie A, non che il fantallenatore lo avesse schierato.
                    </dd>
                    <dt>Contesto della partita</dt>
                    <dd>
                        Prima di stimare cosa farà il giocatore si guarda la partita che lo aspetta.
                        Tre leggeri vantaggi correggono la resa, fino a un massimo del 9% in tutto:
                        giocare <strong>in casa</strong>, affrontare un avversario <strong>più in
                        basso in classifica</strong> (tanto più quanto è distante), e arrivarci con
                        <strong>punti nelle ultime tre giornate</strong>. La freccia accanto alla
                        sigla di Serie A riassume il conto, con il dettaglio nel suggerimento.
                    </dd>
                    <dt>Gioca</dt>
                    <dd>
                        Probabilità di scendere in campo, presa dalle
                        <a href="https://www.fantacalcio.it/probabili-formazioni-serie-a" target="_blank" rel="noopener noreferrer">probabili formazioni di Serie A</a>.
                        Chi non compare affatto nell'elenco (squalificato, fuori lista) scende al 15%,
                        e chi è anche fra gli
                        <a href="https://www.fantacalcio.it/infortunati-serie-a" target="_blank" rel="noopener noreferrer">infortunati</a>
                        al 3%, con il motivo scritto in riga. Chi invece è infortunato ma compare nelle
                        probabili tiene la sua percentuale: quella sa già dei rientri in dubbio.
                    </dd>
                    <dt>Il termine di ripiego</dt>
                    <dd>
                        Se il giocatore non scende in campo non prende zero: il suo posto lo occupa un
                        cambio. Ma vale meno di una prestazione vera anche modesta, perché il cambio non
                        sempre scatta — oltre tre sostituzioni, o senza un pari ruolo che abbia giocato,
                        il posto resta scoperto. Per questo un fuoriclasse in dubbio può valere meno di
                        un titolare fisso mediocre.
                    </dd>
                    <dt>I rigori</dt>
                    <dd>
                        Chi batte i
                        <a href="https://www.fantacalcio.it/rigoristi-serie-a" target="_blank" rel="noopener noreferrer">rigori</a>
                        (⚽ accanto al nome) si porta dentro punteggio che la media dei fantavoto non
                        vede arrivare: il primo rigorista ne calcia 5-10 a stagione, che valgono
                        circa <strong>+0,35 a partita</strong>. Secondo e terzo però li tirano solo
                        quando chi li precede non gioca, quindi il bonus è moltiplicato per la
                        probabilità che il posto si liberi: con il titolare sano vale quasi nulla,
                        con il titolare infortunato vale quanto il suo.
                    </dd>
                    <dt>A parità, l'attacco</dt>
                    <dd>
                        Fra due moduli che sommano quasi lo stesso vince quello con più attaccanti, poi
                        quello con più centrocampisti. L'atteso è una media, e gol e bonus stanno nella
                        coda: una media sottovaluta gli attaccanti rispetto ai difensori.
                    </dd>
                </dl>
                <p class="spiegazione-limiti">
                    <strong>Cosa non considera:</strong> i ballottaggi oltre alla percentuale, la forza
                    reale dell'avversario al di là della posizione in classifica, e il fatto che i primi
                    tre cambi in panchina hanno più probabilità di entrare degli altri.
                </p>
            </div>
        </details>
    `;

    const select = document.getElementById('squadra-select');
    if (select) {
        select.addEventListener('change', () => {
            try { localStorage.setItem(SQUADRA_STORAGE_KEY, select.value); } catch (e) { /* non disponibile */ }
            displayFormazione();
        });
    }
}

function displayRosters() {
    const contenitore = document.getElementById('rose-container');
    if (!contenitore) return;

    if (!fantacalcioData || !fantacalcioData.players || !fantacalcioData.rosterHistory) {
        contenitore.innerHTML = `
            <div class="empty-season">
                <i class="fas fa-users-slash"></i>
                <h3>Rose non disponibili</h3>
                <p>Questa stagione non ha i dati delle rose. Sono disponibili dalla stagione 2026-2027.</p>
            </div>
        `;
        return;
    }

    const stats = calcolaStatisticheGiocatori();

    // Gialli e rossi separati: sommarli metteva sullo stesso piano
    // un'ammonizione da mezzo punto e un'espulsione da un punto pieno
    const plurale = (quanti, singolare, plurale) => `${quanti} ${quanti === 1 ? singolare : plurale}`;

    const classifiche = `
        <div class="classifiche-individuali">
            ${classificaIndividuale(stats, 'gol', 'Marcatori', 'fa-futbol')}
            ${classificaIndividuale(stats, 'assist', 'Assist', 'fa-shoe-prints')}
            ${classificaIndividuale(stats, 'amm', 'Ammonizioni', 'fa-square evento-amm')}
            ${classificaIndividuale(stats, 'esp', 'Espulsioni', 'fa-square evento-esp')}
            ${classificaIndividuale(stats, 'malus', 'Malus', 'fa-thumbs-down', {
                sottotitolo: 'Punti persi in campo. I gol subiti dai portieri non contano',
                dettaglio: (s) => Object.entries(ETICHETTE_MALUS)
                    .filter(([chiave]) => s[chiave] > 0)
                    .map(([chiave, etichette]) => plurale(s[chiave], etichette[0], etichette[1]))
                    .join(', ')
            })}
            ${classificaIndividuale(stats, 'incompreso', 'Incompresi', 'fa-face-frown', {
                sottotitolo: 'Bonus e malus accumulati mentre erano in panchina',
                dettaglio: (s) => [
                    s.golPanchina ? plurale(s.golPanchina, 'gol', 'gol') : '',
                    s.assistPanchina ? plurale(s.assistPanchina, 'assist', 'assist') : ''
                ].filter(Boolean).join(' e ') + ` in ${plurale(s.panchine, 'panchina', 'panchine')}`
            })}
        </div>
    `;

    const squadre = fantacalcioData.teams
        .map(t => t.name)
        .filter(nome => rosaDellaSquadra(nome).length > 0);

    contenitore.innerHTML = classifiche + `
        <div class="rose-griglia">
            ${squadre.map(team => schedaRosa(team, stats)).join('')}
        </div>
    `;
}

// Funzione per generare la classifica del miglior allenatore
function generateCoachRanking(round) {
    if (!round || !round.matches) return '';
    
    // Controlla se ci sono punteggi ideali disponibili
    let hasIdealData = false;
    const coachData = [];
    
    round.matches.forEach(match => {
        if (match.homeIdealScore !== undefined && match.awayIdealScore !== undefined) {
            hasIdealData = true;
            
            // Calcola punti persi per squadra casa (con bonus casa +1)
            const homeIdealScoreWithBonus = match.homeIdealScore + 1;
            const homePointsLost = Math.max(0, homeIdealScoreWithBonus - match.homeScore);
            coachData.push({
                team: match.homeTeam,
                realScore: match.homeScore,
                idealScore: homeIdealScoreWithBonus, // Usa punteggio con bonus
                pointsLost: homePointsLost,
                efficiency: ((match.homeScore / homeIdealScoreWithBonus) * 100).toFixed(1)
            });
            
            // Calcola punti persi per squadra trasferta (nessun bonus)
            const awayPointsLost = Math.max(0, match.awayIdealScore - match.awayScore);
            coachData.push({
                team: match.awayTeam,
                realScore: match.awayScore,
                idealScore: match.awayIdealScore,
                pointsLost: awayPointsLost,
                efficiency: ((match.awayScore / match.awayIdealScore) * 100).toFixed(1)
            });
        }
    });
    
    if (!hasIdealData || coachData.length === 0) return '';
    
    // Ordina per punti persi (meno punti persi = miglior allenatore)
    coachData.sort((a, b) => a.pointsLost - b.pointsLost);
    
    let html = `
        <div class="coach-ranking-section">
            <div class="coach-ranking-header">
                <h3><i class="fas fa-chess-king"></i> Classifica Miglior Allenatore</h3>
                <p class="coach-ranking-subtitle">Basata sui punti persi rispetto alla formazione ideale - Chi perde meno è il migliore!</p>
            </div>
            <div class="coach-ranking-table">
                <div class="coach-ranking-headers">
                    <div class="pos-header">Pos</div>
                    <div class="team-header">Squadra</div>
                    <div class="real-header">Reale</div>
                    <div class="ideal-header">Ideale</div>
                    <div class="lost-header">Persi</div>
                    <div class="efficiency-header">Efficienza</div>
                    <div class="award-header">Premio</div>
                </div>
    `;
    
    coachData.forEach((coach, index) => {
        let positionClass = '';
        let award = '';
        
        if (index === 0) {
            positionClass = 'gold';
            award = '🏆 Miglior Allenatore';
        } else if (index === 1) {
            positionClass = 'silver';
            award = '🥈 Secondo posto';
        } else if (index === 2) {
            positionClass = 'bronze';
            award = '🥉 Terzo posto';
        } else if (index === coachData.length - 1) {
            positionClass = 'worst';
            award = '😅 Da rivedere';
        }
        
        const lostPointsDisplay = coach.pointsLost === 0 ? '0 (perfetto!)' : coach.pointsLost.toFixed(1);
        
        html += `
            <div class="coach-ranking-row ${positionClass}">
                <div class="coach-pos">${index + 1}°</div>
                <div class="coach-team">${coach.team}</div>
                <div class="coach-real">${coach.realScore.toFixed(1)}</div>
                <div class="coach-ideal">${coach.idealScore.toFixed(1)}</div>
                <div class="coach-lost ${coach.pointsLost === 0 ? 'perfect' : ''}">${lostPointsDisplay}</div>
                <div class="coach-efficiency">${coach.efficiency}%</div>
                <div class="coach-award">${award}</div>
            </div>
        `;
    });
    
    html += `
            </div>
            <div class="coach-ranking-insights">
                <div class="insight-perfect">
                    <i class="fas fa-star"></i>
                    <span><strong>Formazione Perfetta:</strong> ${coachData.filter(c => c.pointsLost === 0).length} squadre hanno fatto le scelte ideali!</span>
                </div>
                <div class="insight-avg">
                    <i class="fas fa-calculator"></i>
                    <span><strong>Media punti persi:</strong> ${(coachData.reduce((sum, c) => sum + c.pointsLost, 0) / coachData.length).toFixed(1)} punti</span>
                </div>
                <div class="insight-best">
                    <i class="fas fa-trophy"></i>
                    <span><strong>Miglior allenatore:</strong> ${coachData[0].team} (solo ${coachData[0].pointsLost.toFixed(1)} punti persi, ${coachData[0].efficiency}% di efficienza)</span>
                </div>
            </div>
        </div>
    `;
    
    return html;
}

// Funzione per mostrare il commento della giornata (ora non serve più, commenti inline)
function displayMatchCommentary(roundNumber) {
    // I commenti sono ora mostrati inline dentro ogni match card
    // Questa funzione viene mantenuta per retrocompatibilità ma nasconde la sezione
    const commentarySection = document.getElementById('match-commentary');
    if (commentarySection) {
        commentarySection.style.display = 'none';
    }
}

// Aggiornamento dell'ultimo update
function updateLastUpdate() {
    const lastUpdateElement = document.getElementById('last-update');
    const lastUpdateIdealElement = document.getElementById('last-update-ideal');
    
    if (lastUpdateElement) {
        lastUpdateElement.textContent = fantacalcioData.lastUpdate;
    }
    if (lastUpdateIdealElement) {
        lastUpdateIdealElement.textContent = fantacalcioData.lastUpdate;
    }
}

// Funzioni per aggiungere nuovi dati (per future implementazioni)
function addNewRound(roundData) {
    fantacalcioData.rounds.push(roundData);
    setupRoundSelector();
    updateLastUpdate();
}

function updateTeamStandings(newStandings) {
    fantacalcioData.teams = newStandings;
    displayStandings();
    displayStatistics();
    updateLastUpdate();
}

// Animazioni al caricamento
function animateOnLoad() {
    const elements = document.querySelectorAll('.team-row, .match-card, .stat-card');
    elements.forEach((element, index) => {
        element.style.opacity = '0';
        element.style.transform = 'translateY(20px)';
        
        setTimeout(() => {
            element.style.transition = 'all 0.5s ease';
            element.style.opacity = '1';
            element.style.transform = 'translateY(0)';
        }, index * 100);
    });
}

// Esegui animazioni dopo che la pagina è caricata
window.addEventListener('load', () => {
    setTimeout(animateOnLoad, 500);
});

// Il responsive della classifica è tutto nei media query di styles.css: la
// colonna Media e le altre di contorno spariscono con .avg-score { display: none }.
// Qui c'era una handleResponsive() agganciata a resize che cercava .table-header div
// e .team-row div, selettori che non pescano nulla perché le righe sono th e td:
// su desktop non faceva niente e su mobile moriva subito su tableHeaders[4].style.
// Sul telefono il resize scatta a ogni comparsa della barra URL, cioè in continuazione
// mentre si scorre l'elenco partite aperto, riempiendo la console di TypeError.

// Funzione di test per l'algoritmo dei gol
function testGoalCalculation() {
    console.log("=== TEST ALGORITMO CALCOLO GOL ===");
    console.log("Regola: Primo gol a 66 punti, poi ogni 6 punti un gol in più");
    console.log("");
    
    const testScores = [60, 64, 66, 67.5, 69, 70, 72, 75.5, 77.5, 78, 84];
    
    testScores.forEach(score => {
        const goals = calculateGoalsFromScore(score);
        console.log(`${score} punti = ${goals} gol`);
    });
    
    console.log("");
    console.log("=== RISULTATI PRIMA GIORNATA ===");
    if (fantacalcioData && fantacalcioData.rounds && fantacalcioData.rounds[0]) {
        const round1 = fantacalcioData.rounds[0];
        round1.matches.forEach((match, index) => {
            const goals = calculateMatchGoals(match.homeScore, match.awayScore);
            console.log(`Match ${index + 1}: ${match.homeTeam} ${goals.homeGoals}-${goals.awayGoals} ${match.awayTeam}`);
            console.log(`  Punteggi: ${match.homeScore} - ${match.awayScore}`);
        });
    }
}

// Esporta le funzioni per uso futuro
window.FantacalcioApp = {
    loadSeasonsIndex,
    loadSeasonData,
    switchSeason,
    getSeasons: () => seasonsIndex,
    getCurrentSeasonId: () => currentSeasonId,
    addNewRound,
    updateTeamStandings,
    displayStandings,
    displayRoundResults,
    displayIdealVsRealComparison,
    calculateGoalsFromScore,
    calculateMatchGoals,
    calculateIdealGoalsFromScore,
    getMatchResult,
    formatMatchScore,
    testGoalCalculation,
    getData: () => fantacalcioData
};

// Theme Management
// Due soli stati: chiaro e scuro. Senza una scelta salvata si segue il sistema,
// e lo si continua a seguire dal vivo; al primo click la scelta dell'utente vince.
class ThemeManager {
    constructor() {
        this.storedTheme = this.getStoredTheme();
        this.themeToggle = document.getElementById('theme-toggle');

        this.init();
    }

    init() {
        this.applyTheme();
        this.addEventListeners();

        // Finché l'utente non sceglie, il tema segue il sistema anche a pagina aperta
        if (window.matchMedia) {
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
                if (!this.storedTheme) this.applyTheme();
            });
        }
    }

    addEventListeners() {
        this.themeToggle.addEventListener('click', () => this.toggleTheme());
    }

    // Tema del sistema, usato finché non c'è una scelta esplicita
    systemTheme() {
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        return prefersDark ? 'dark' : 'light';
    }

    // Tema effettivamente a video
    currentTheme() {
        return this.storedTheme || this.systemTheme();
    }

    toggleTheme() {
        this.storedTheme = this.currentTheme() === 'dark' ? 'light' : 'dark';
        this.storeTheme(this.storedTheme);
        this.applyTheme();
    }

    applyTheme() {
        const html = document.documentElement;
        html.setAttribute('data-theme', this.currentTheme());
        this.updateToggleIcon();

        // Add animation class
        html.classList.add('theme-transition');
        setTimeout(() => {
            html.classList.remove('theme-transition');
        }, 300);
    }

    // L'icona mostra dove porta il click, non il tema corrente
    updateToggleIcon() {
        const icon = this.themeToggle.querySelector('i');
        const vaAScuro = this.currentTheme() === 'light';

        icon.className = vaAScuro ? 'fas fa-moon' : 'fas fa-sun';
        this.themeToggle.title = vaAScuro ? 'Passa al tema scuro' : 'Passa al tema chiaro';
    }

    getStoredTheme() {
        try {
            const stored = localStorage.getItem('fantacalcio-theme');
            // 'auto' è il vecchio terzo stato: va letto come "nessuna scelta",
            // altrimenti chi ce l'ha salvato resta bloccato su un tema inesistente
            return stored === 'light' || stored === 'dark' ? stored : null;
        } catch (e) {
            return null;
        }
    }

    storeTheme(theme) {
        try {
            localStorage.setItem('fantacalcio-theme', theme);
        } catch (e) {
            console.warn('Could not save theme preference');
        }
    }
}

// Initialize theme manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.themeManager = new ThemeManager();
    
    // Add trophy reload functionality - ricarica solo i dati JSON
    const trophyReload = document.getElementById('trophy-reload');
    if (trophyReload) {
        trophyReload.addEventListener('click', async (e) => {
            e.preventDefault();
            // La coppa si svuota e si riempie di nuovo mentre arrivano i dati.
            // Va tolta e rimessa la classe, altrimenti al secondo clic
            // l'animazione è già in corso e il browser non la fa ripartire.
            trophyReload.classList.remove('ricarica');
            void trophyReload.offsetWidth;
            trophyReload.classList.add('ricarica');

            await reloadDataOnly();
        });
        
        // Tooltip migliorato
        trophyReload.title = 'Aggiorna dati (senza ricaricare la pagina)';
    }
});
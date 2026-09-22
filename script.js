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

        // Calcola la classifica automaticamente dai risultati
        if (fantacalcioData && fantacalcioData.teams && fantacalcioData.rounds) {
            fantacalcioData.teams = calculateStandingsFromResults();
            console.log('Classifica calcolata:', fantacalcioData.teams);
        }

        displayStandings();
        displayStatistics();
        setupRoundSelector();
        updateLastUpdate();
        updateSeasonLabels();

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
            } else if (targetTab === 'classifica') {
                displayStandings();
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
            if (column === 'points') {
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
                        Pt <i class="fas fa-sort ${sortState.column === 'totalScore' ? (sortState.direction === 'asc' ? 'fa-sort-up' : 'fa-sort-down') : ''}"></i>
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

// Mostra dettaglio partite per una squadra (toggle)
// showTeamMatches: create a table row inserted after the clicked row with match-only data
function showTeamMatches(teamName, clickedRow, modo = 'reale') {
    const tabella = clickedRow.closest('table');

    // Il pannello aperto va cercato nella stessa tabella: classifica e
    // classifica ideale ne hanno una ciascuna e non devono interferire
    const existingRow = (tabella || document).querySelector('.team-details-row');
    if (existingRow) {
        const existingTeam = existingRow.getAttribute('data-team');
        existingRow.remove();
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

    // Panel content (only real match data, team vs opponent and realtime score)
    let content = `
        <div class="team-details-panel">
            <div class="team-details-header">
                <strong>Partite di ${teamName}${modo === "ideale" ? " — formazioni ideali" : ""}</strong>
                <button class="team-details-close" title="Chiudi">✖</button>
            </div>
            <div class="team-matches-list">
    `;

    if (matches.length === 0) {
        content += `<div class="team-match-item">Nessuna partita trovata.</div>`;
    } else {
        matches.forEach(item => {
            const m = item.match;
            const isHome = m.homeTeam === teamName;
            const opponent = isHome ? m.awayTeam : m.homeTeam;

            // In modalità ideale si usano i punteggi delle formazioni perfette;
            // il bonus casa +1 va applicato qui, perché nel JSON non c'è
            const ideale = modo === 'ideale' && m.homeIdealScore !== undefined;
            const puntiCasa = ideale ? m.homeIdealScore + 1 : m.homeScore;
            const puntiFuori = ideale ? m.awayIdealScore : m.awayScore;

            const teamPoints = isHome ? puntiCasa : puntiFuori;
            const oppPoints = isHome ? puntiFuori : puntiCasa;

            const golCasa = calculateGoalsFromScore(puntiCasa);
            const golFuori = calculateGoalsFromScore(puntiFuori);
            const teamGoals = isHome ? golCasa : golFuori;
            const oppGoals = isHome ? golFuori : golCasa;

            const esito = teamGoals > oppGoals ? 'vinta' : teamGoals < oppGoals ? 'persa' : 'pari';
            const espandibile = Boolean(m.lineups);
            const idDettaglio = `tm-${modo}-${item.round}`;

            // Una riga sola: giornata, avversario, risultato e punti
            content += `
                <div class="team-match-item ${espandibile ? 'espandibile' : ''}"
                     ${espandibile ? `data-dettaglio="${idDettaglio}" role="button" tabindex="0"` : ''}>
                    <span class="tmi-giornata">G${item.round}</span>
                    <span class="tmi-casa">${isHome ? '<i class="fas fa-house" title="In casa"></i>' : '<i class="fas fa-plane" title="In trasferta"></i>'}</span>
                    <span class="tmi-avversario">${opponent}</span>
                    <span class="tmi-risultato ${esito}">${teamGoals}-${oppGoals}</span>
                    <span class="tmi-punti">${teamPoints} - ${oppPoints}</span>
                    ${espandibile ? '<i class="fas fa-chevron-down tmi-chevron"></i>' : ''}
                </div>
                ${espandibile ? `
                    <div class="team-match-lineups" id="${idDettaglio}" hidden>
                        ${colonnaFormazione(m.homeTeam, m.lineups.home)}
                        ${colonnaFormazione(m.awayTeam, m.lineups.away)}
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
    if (closeBtn) closeBtn.addEventListener('click', () => detailsRow.remove());

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
                        Pt <i class="fas fa-sort ${idealSortState.column === 'totalScore' ? (idealSortState.direction === 'asc' ? 'fa-sort-up' : 'fa-sort-down') : ''}"></i>
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
function setupSortableHeaders(tableType = 'main') {
    const selector = tableType === 'main' 
        ? '#main-standings-table .sortable-header' 
        : '#ideal-standings-table .sortable-header';
        
    const headers = document.querySelectorAll(selector);
    
    headers.forEach(header => {
        header.addEventListener('click', () => {
            const column = header.getAttribute('data-column');
            
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

function rigaGiocatore(giocatore) {
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
            <span class="lineup-nome">${info.name} ${stato}</span>
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
            <div class="lineup-group">${titolari.map(rigaGiocatore).join('')}</div>
            <div class="lineup-group-title">Panchina</div>
            <div class="lineup-group panchina">${panchina.map(rigaGiocatore).join('')}</div>
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
                    }
                }
            }
        }
    }

    for (const s of Object.values(stats)) {
        s.mediaVoto = s.presenze > 0 ? s.sommaVoto / s.presenze : null;
        s.mediaFanta = s.presenze > 0 ? s.sommaBonus / s.presenze : null;
        s.puntiInPanchina = Math.round(s.puntiInPanchina * 10) / 10;
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

// Moduli ammessi: difensori, centrocampisti, attaccanti (il portiere è sempre uno)
const MODULI = [
    [3, 4, 3], [3, 5, 2], [4, 3, 3], [4, 4, 2], [4, 5, 1], [5, 3, 2], [5, 4, 1]
];

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

// Probabilità che un giocatore scenda in campo nella prossima giornata.
// Viene dalle probabili formazioni quando ci sono, altrimenti da quante volte
// ha preso un voto finora.
function probabilitaDiGiocare(pid, continuitaStorica) {
    const voce = probabiliFormazioni && probabiliFormazioni.giocatori
        ? probabiliFormazioni.giocatori[pid]
        : null;

    if (!probabiliFormazioni) {
        return { p: continuitaStorica, fonte: 'storico', voce: null };
    }
    if (!voce) {
        return { p: PROB_FUORI_LISTA, fonte: 'fuori-lista', voce: null };
    }
    return { p: voce.probabilita / 100, fonte: 'probabili', voce };
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

    const { p, fonte, voce } = probabilitaDiGiocare(pid, affidabilita);

    // Valore atteso: se gioca rende `qualita`, se non gioca il posto lo prende
    // un cambio che vale `VOTO_RIPIEGO`
    const atteso = p * qualita + (1 - p) * VOTO_RIPIEGO;

    return {
        pid: Number(pid),
        atteso,
        qualita,
        media,
        forma,
        probabilita: p,
        fonteProbabilita: fonte,
        titolareProbabile: voce ? voce.titolare : null,
        squadraSerieA: voce ? voce.squadra : info.serieA,
        affidabilita,
        presenze: votiPresi,
        schierato: stats[pid] ? stats[pid].presenze : 0,
        senzaDati
    };
}

// Miglior 11 fra i giocatori disponibili, provando tutti i moduli
function miglioreFormazione(candidati) {
    const perRuolo = { P: [], D: [], C: [], A: [] };
    for (const c of candidati) {
        const ruolo = anagraficaGiocatore(c.pid).role;
        if (perRuolo[ruolo]) perRuolo[ruolo].push(c);
    }
    for (const ruolo of Object.keys(perRuolo)) {
        perRuolo[ruolo].sort((a, b) => b.atteso - a.atteso);
    }

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
        const totale = undici.reduce((somma, g) => somma + g.atteso, 0);

        if (!migliore || totale > migliore.totale) {
            migliore = { modulo: `${d}-${c}-${a}`, undici, totale };
        }
    }

    if (!migliore) return null;

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
            return b.atteso - a.atteso;
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

function cellaConteggio(valore, classe = '') {
    return `<span class="rosa-cella ${classe} ${valore ? '' : 'zero'}">${valore || '—'}</span>`;
}

// Le sigle tengono stretta la colonna Serie A: il nome intero resta nel title
function siglaSerieA(nome) {
    return nome ? nome.slice(0, 3).toUpperCase() : '';
}

function rigaRosa(pid, stats) {
    const info = anagraficaGiocatore(pid);
    const s = stats[pid];

    if (!s) {
        return `
            <div class="rosa-row mai-visto">
                <span class="rosa-ruolo ruolo-${info.role}">${info.role}</span>
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
            <span class="rosa-ruolo ruolo-${info.role}">${info.role}</span>
            <span class="rosa-nome">${info.name}</span>
            <span class="rosa-serieA" title="${info.serieA || ''}">${siglaSerieA(info.serieA)}</span>
            <span class="rosa-cella">${s.presenze || '—'}</span>
            <span class="rosa-cella panchina-cella">${s.panchine || '—'}</span>
            <span class="rosa-cella">${numero(s.mediaVoto)}</span>
            <span class="rosa-cella forte">${numero(s.mediaFanta)}</span>
            ${cellaConteggio(s.gol, 'gol-cella')}
            ${cellaConteggio(s.assist, 'assist-cella')}
            ${cellaConteggio(s.amm + s.esp, 'cartellini-cella')}
            <span class="rosa-cella panchina-persi ${s.puntiInPanchina ? '' : 'zero'}">${s.puntiInPanchina || '—'}</span>
        </div>
    `;
}

function schedaRosa(team, stats) {
    const squadra = fantacalcioData.teams.find(t => t.name === team);
    const pids = rosaDellaSquadra(team).slice().sort((a, b) => {
        const ia = anagraficaGiocatore(a), ib = anagraficaGiocatore(b);
        const diff = (ORDINE_RUOLI[ia.role] ?? 9) - (ORDINE_RUOLI[ib.role] ?? 9);
        return diff !== 0 ? diff : ia.name.localeCompare(ib.name);
    });

    const inPanchina = pids.reduce((somma, pid) => somma + (stats[pid]?.puntiInPanchina || 0), 0);

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
                ${pids.map(pid => rigaRosa(pid, stats)).join('')}
            </div>
        </div>
    `;
}

// Classifiche individuali: contano solo i giocatori realmente schierati
function classificaIndividuale(stats, chiave, titolo, icona, limite = 10) {
    const righe = Object.values(stats)
        .filter(s => s[chiave] > 0)
        .sort((a, b) => b[chiave] - a[chiave] || (b.mediaFanta || 0) - (a.mediaFanta || 0))
        .slice(0, limite);

    if (righe.length === 0) {
        return `
            <div class="classifica-individuale">
                <h4><i class="fas ${icona}"></i> ${titolo}</h4>
                <p class="nessun-dato">Nessun dato ancora.</p>
            </div>
        `;
    }

    return `
        <div class="classifica-individuale">
            <h4><i class="fas ${icona}"></i> ${titolo}</h4>
            <ol class="classifica-lista">
                ${righe.map((s, i) => {
                    const info = anagraficaGiocatore(s.pid);
                    return `
                        <li class="${i === 0 ? 'primo' : ''}">
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

function rigaConsiglio(g, titolare) {
    const info = anagraficaGiocatore(g.pid);
    const perc = Math.round(g.probabilita * 100);

    let classeProb = 'prob-bassa';
    if (perc >= 70) classeProb = 'prob-alta';
    else if (perc >= 40) classeProb = 'prob-media';

    let nota = '';
    if (g.fonteProbabilita === 'fuori-lista') nota = 'fuori dalle probabili';
    else if (g.titolareProbabile === false) nota = 'in panchina in Serie A';
    else if (g.senzaDati) nota = 'nessun voto finora';
    else if (titolare && g.schierato === 0) nota = 'era in panchina';

    const qualita = g.senzaDati ? '—' : g.qualita.toFixed(2);

    return `
        <div class="consiglio-row ${titolare ? 'titolare' : 'panca'}">
            <span class="ruolo-${info.role}">${info.role}</span>
            <span class="consiglio-nome">${info.name}</span>
            <span class="consiglio-serieA">${siglaSerieA(g.squadraSerieA)}</span>
            <span class="consiglio-forma">${frecciaForma(g)}</span>
            <span class="consiglio-nota">${nota}</span>
            <span class="consiglio-qualita" title="Rendimento medio quando gioca">${qualita}</span>
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

    const corpo = !f
        ? '<div class="empty-season"><h3>Rosa insufficiente</h3><p>Non ci sono abbastanza giocatori per comporre un modulo valido.</p></div>'
        : `
            <div class="consiglio-card">
                <div class="consiglio-header">
                    <h3>${scelta}</h3>
                    <span class="consiglio-modulo">${f.modulo}</span>
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
                    <dt>Gioca</dt>
                    <dd>
                        Probabilità di scendere in campo, presa dalle
                        <a href="https://www.fantacalcio.it/probabili-formazioni-serie-a" target="_blank" rel="noopener noreferrer">probabili formazioni di Serie A</a>.
                        Chi non compare affatto nell'elenco (infortunato, squalificato, fuori lista)
                        scende al 15%.
                    </dd>
                    <dt>Il termine di ripiego</dt>
                    <dd>
                        Se il giocatore non scende in campo non prende zero: il suo posto lo occupa un
                        cambio. Ma vale meno di una prestazione vera anche modesta, perché il cambio non
                        sempre scatta — oltre tre sostituzioni, o senza un pari ruolo che abbia giocato,
                        il posto resta scoperto. Per questo un fuoriclasse in dubbio può valere meno di
                        un titolare fisso mediocre.
                    </dd>
                </dl>
                <p class="spiegazione-limiti">
                    <strong>Cosa non considera:</strong> l'avversario di Serie A e la difficoltà della
                    partita, i ballottaggi oltre alla percentuale, e il fatto che i primi tre cambi in
                    panchina hanno più probabilità di entrare degli altri.
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
    const cartellini = { ...stats };
    for (const s of Object.values(cartellini)) s.cartellini = s.amm + s.esp;

    const classifiche = `
        <div class="classifiche-individuali">
            ${classificaIndividuale(stats, 'gol', 'Marcatori', 'fa-futbol')}
            ${classificaIndividuale(stats, 'assist', 'Assist', 'fa-shoe-prints')}
            ${classificaIndividuale(cartellini, 'cartellini', 'Cartellini', 'fa-square')}
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

// Gestione responsive per mobile
function handleResponsive() {
    const isMobile = window.innerWidth <= 768;
    const tableHeaders = document.querySelectorAll('.table-header div');
    const teamRows = document.querySelectorAll('.team-row div');

    if (isMobile) {
        // Nascondi la colonna "Media" su mobile
        tableHeaders[4].style.display = 'none';
        teamRows.forEach((row, index) => {
            if ((index + 1) % 5 === 0) {
                row.style.display = 'none';
            }
        });
    } else {
        // Mostra tutte le colonne su desktop
        tableHeaders.forEach(header => header.style.display = 'block');
        teamRows.forEach(row => row.style.display = 'block');
    }
}

// Event listener per il ridimensionamento della finestra
window.addEventListener('resize', handleResponsive);

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
            // Aggiungi animazione di rotazione
            trophyReload.style.animation = 'rotate 1s linear';
            
            // Ricarica solo i dati
            await reloadDataOnly();
            
            // Rimuovi animazione
            setTimeout(() => {
                trophyReload.style.animation = '';
            }, 1000);
        });
        
        // Tooltip migliorato
        trophyReload.title = 'Aggiorna dati (senza ricaricare la pagina)';
    }
});
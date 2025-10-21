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

// Funzione per svuotare manualmente la cache
function clearAllCache() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistration().then((registration) => {
            if (registration) {
                registration.active.postMessage({ type: 'CLEAR_CACHE' });
            }
        });
    }
    
    if ('caches' in window) {
        caches.keys().then((names) => {
            names.forEach((name) => {
                caches.delete(name);
            });
        });
    }
    
    console.log('Cache svuotata!');
    alert('Cache svuotata! La pagina verrà ricaricata.');
    window.location.reload(true);
}

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

// Algoritmo per calcolare i gol ideali con bonus casa
function calculateIdealGoalsFromScore(score, isHome = false) {
    // Applica il bonus di +1 punto solo per la squadra di casa nei punteggi ideali
    const adjustedScore = isHome ? score + 1 : score;
    return calculateGoalsFromScore(adjustedScore);
}

// Funzione per determinare il risultato del match
function getMatchResult(homeScore, awayScore) {
    const homeGoals = calculateGoalsFromScore(homeScore);
    const awayGoals = calculateGoalsFromScore(awayScore);
    
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
            const homeGoals = calculateGoalsFromScore(match.homeScore);
            const awayGoals = calculateGoalsFromScore(match.awayScore);
            
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
    
    // Converte in array e ordina per punti, differenza reti, poi per media
    return Object.values(standings).sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
        return b.avgScore - a.avgScore;
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
    
    // Converte in array e ordina per punti, differenza reti, poi per media
    return Object.values(standings).sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
        return b.avgScore - a.avgScore;
    });
}

// Funzione per formattare il risultato come stringa
function formatMatchScore(homeScore, awayScore) {
    const homeGoals = calculateGoalsFromScore(homeScore);
    const awayGoals = calculateGoalsFromScore(awayScore);
    return `${homeGoals}-${awayGoals}`;
}

// Variabile globale per i dati del fantacalcio
let fantacalcioData = null;

// Funzione per caricare i dati dal file JSON
async function loadFantacalcioData() {
    try {
        // Cache busting: aggiungi timestamp per forzare il reload
        const timestamp = new Date().getTime();
        const url = `fantacalcio_data.json?t=${timestamp}`;
        
        const response = await fetch(url, {
            cache: 'no-store', // Forza il bypass della cache del browser
            headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            }
        });
        
        if (!response.ok) {
            throw new Error(`Errore HTTP! Status: ${response.status}`);
        }
        
        fantacalcioData = await response.json();
        console.log('Dati caricati dal JSON con successo:', fantacalcioData);
        console.log('Timestamp caricamento:', new Date(timestamp).toLocaleString());
        return fantacalcioData;
    } catch (error) {
        console.error('Impossibile caricare il file JSON:', error.message);
        // Rilanciamo l'errore per gestirlo nell'inizializzazione
        throw error;
    }
}

// Funzione per ricaricare solo i dati JSON senza refresh completo
async function reloadDataOnly() {
    try {
        console.log('Ricaricamento dati in corso...');
        
        // Mostra un indicatore di caricamento
        const loadingIndicator = document.createElement('div');
        loadingIndicator.className = 'loading-indicator';
        loadingIndicator.innerHTML = `
            <div class="loading-content">
                <i class="fas fa-sync-alt fa-spin"></i>
                <span>Aggiornamento dati in corso...</span>
            </div>
        `;
        document.body.appendChild(loadingIndicator);
        setTimeout(() => loadingIndicator.classList.add('show'), 10);
        
        // Ricarica i dati
        await loadFantacalcioData();
        
        // Ricalcola tutto
        if (fantacalcioData && fantacalcioData.teams && fantacalcioData.rounds) {
            fantacalcioData.teams = calculateStandingsFromResults();
        }
        
        // Aggiorna le visualizzazioni
        displayStandings();
        displayIdealStandings();
        displayStatistics();
        setupRoundSelector();
        updateLastUpdate();
        
        // Aggiorna la giornata corrente se siamo nella tab giornate
        const activeTab = document.querySelector('.tab-content.active');
        if (activeTab && activeTab.id === 'giornate') {
            const roundSelect = document.getElementById('giornata-select');
            if (roundSelect) {
                displayRoundResults(parseInt(roundSelect.value));
            }
        }
        
        // Nascondi l'indicatore
        setTimeout(() => {
            loadingIndicator.classList.remove('show');
            setTimeout(() => loadingIndicator.remove(), 300);
        }, 500);
        
        console.log('Dati aggiornati con successo!');
        
        // Mostra notifica di successo
        showSuccessNotification('Dati aggiornati!');
        
    } catch (error) {
        console.error('Errore durante il ricaricamento dei dati:', error);
        alert('Errore durante l\'aggiornamento dei dati. Ricarica la pagina.');
    }
}

// Funzione per mostrare notifica di successo
function showSuccessNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'success-notification';
    notification.innerHTML = `
        <i class="fas fa-check-circle"></i>
        <span>${message}</span>
    `;
    document.body.appendChild(notification);
    
    setTimeout(() => notification.classList.add('show'), 10);
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 2000);
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
        <p>Non è stato possibile caricare i dati del fantacalcio. Verifica che il file "fantacalcio_data.json" sia presente e accessibile.</p>
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
        // Carica i dati dal file JSON
        await loadFantacalcioData();
        
        setupNavigationTabs();
        
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
            }
        });
    });
}

// Stato dell'ordinamento
let sortState = {
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
        
        if (direction === 'asc') {
            return valueA > valueB ? 1 : valueA < valueB ? -1 : 0;
        } else {
            return valueA < valueB ? 1 : valueA > valueB ? -1 : 0;
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
    
    let html = `
        <table class="standings-table">
            <thead>
                <tr class="table-header">
                    <th class="sortable-header" data-column="position">
                        Pos. <i class="fas fa-sort"></i>
                    </th>
                    <th class="sortable-header" data-column="name">
                        Squadra <i class="fas fa-sort ${sortState.column === 'name' ? (sortState.direction === 'asc' ? 'fa-sort-up' : 'fa-sort-down') : ''}"></i>
                    </th>
                    <th class="sortable-header" data-column="points">
                        Pt <i class="fas fa-sort ${sortState.column === 'points' ? (sortState.direction === 'asc' ? 'fa-sort-up' : 'fa-sort-down') : ''}"></i>
                    </th>
                    <th class="sortable-header mobile-hide" data-column="wins">
                        V <i class="fas fa-sort ${sortState.column === 'wins' ? (sortState.direction === 'asc' ? 'fa-sort-up' : 'fa-sort-down') : ''}"></i>
                    </th>
                    <th class="sortable-header mobile-hide" data-column="draws">
                        P <i class="fas fa-sort ${sortState.column === 'draws' ? (sortState.direction === 'asc' ? 'fa-sort-up' : 'fa-sort-down') : ''}"></i>
                    </th>
                    <th class="sortable-header mobile-hide" data-column="losses">
                        S <i class="fas fa-sort ${sortState.column === 'losses' ? (sortState.direction === 'asc' ? 'fa-sort-up' : 'fa-sort-down') : ''}"></i>
                    </th>
                    <th class="sortable-header mobile-hide" data-column="goalsFor">
                        GF <i class="fas fa-sort ${sortState.column === 'goalsFor' ? (sortState.direction === 'asc' ? 'fa-sort-up' : 'fa-sort-down') : ''}"></i>
                    </th>
                    <th class="sortable-header mobile-hide" data-column="goalsAgainst">
                        GS <i class="fas fa-sort ${sortState.column === 'goalsAgainst' ? (sortState.direction === 'asc' ? 'fa-sort-up' : 'fa-sort-down') : ''}"></i>
                    </th>
                    <th class="sortable-header mobile-hide" data-column="goalDifference">
                        DR <i class="fas fa-sort ${sortState.column === 'goalDifference' ? (sortState.direction === 'asc' ? 'fa-sort-up' : 'fa-sort-down') : ''}"></i>
                    </th>
                    <th class="sortable-header mobile-hide" data-column="totalScore">
                        Pt <i class="fas fa-sort ${sortState.column === 'totalScore' ? (sortState.direction === 'asc' ? 'fa-sort-up' : 'fa-sort-down') : ''}"></i>
                    </th>
                    <th class="sortable-header mobile-hide" data-column="avgScore">
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
                <td class="total-score mobile-hide">${team.totalScore || 0}</td>
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
    setupSortableHeaders();
    
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
function showTeamMatches(teamName, clickedRow) {
    // Remove existing detail row if present
    const existingRow = document.querySelector('.team-details-row');
    if (existingRow) {
        const existingTeam = existingRow.getAttribute('data-team');
        if (existingTeam === teamName) {
            existingRow.remove();
            return; // toggle off
        }
        existingRow.remove();
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
    const table = clickedRow.closest('table');
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
                <strong>Partite di ${teamName}</strong>
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
            const teamPoints = isHome ? m.homeScore : m.awayScore;
            const oppPoints = isHome ? m.awayScore : m.homeScore;
            const teamGoals = calculateGoalsFromScore(teamPoints);
            const oppGoals = calculateGoalsFromScore(oppPoints);

            // Show: TeamName vs Opponent — Risultato: teamGoals - oppGoals (teamPoints pt - oppPoints pt)
            content += `
                <div class="team-match-item">
                    <div class="match-meta">Giornata ${item.round} — ${item.date}</div>
                    <div class="match-teams">${teamName} <span class="match-score">${teamGoals}</span> - <span class="match-score">${oppGoals}</span> ${opponent}</div>
                    <div class="match-points">(${teamPoints} pt - ${oppPoints} pt)</div>
                </div>
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
    
    // Calcola statistiche allenatore (media punti persi per tutte le giornate)
    const coachStats = calculateOverallCoachStats();
    
    // Aggiungi le differenze alla classifica ideale
    idealStandings.forEach((idealTeam, idealIndex) => {
        const realTeamIndex = realStandings.findIndex(realTeam => realTeam.name === idealTeam.name);
        const realTeam = realStandings[realTeamIndex];
        
        idealTeam.positionDifference = realTeamIndex - idealIndex; // Positivo = peggioramento nella reale
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
        <table class="standings-table ideal-standings-table">
            <thead>
                <tr class="table-header">
                    <th>
                        Pos.
                    </th>
                    <th>
                        Squadra
                    </th>
                    <th>
                        Pt
                    </th>
                    <th class="mobile-hide">
                        V
                    </th>
                    <th class="mobile-hide">
                        P
                    </th>
                    <th class="mobile-hide">
                        S
                    </th>
                    <th class="mobile-hide">
                        GF
                    </th>
                    <th class="mobile-hide">
                        GS
                    </th>
                    <th class="mobile-hide">
                        DR
                    </th>
                    <th class="mobile-hide">
                        Pt
                    </th>
                    <th class="mobile-hide">
                        Media
                    </th>
                    <th class="mobile-hide">
                        Diff Pos
                    </th>
                    <th class="mobile-hide">
                        Diff Pt
                    </th>
                </tr>
            </thead>
            <tbody>
    `;

    idealStandings.forEach((team, index) => {
        const position = index + 1;
        let positionClass = 'other';
        
        if (position === 1) positionClass = 'first';
        else if (position === 2) positionClass = 'second';
        else if (position === 3) positionClass = 'third';

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
                <td class="total-score mobile-hide">${team.totalScore}</td>
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
}

// Setup event listeners per le colonne ordinabili
function setupSortableHeaders() {
    const headers = document.querySelectorAll('.sortable-header');
    headers.forEach(header => {
        header.addEventListener('click', () => {
            const column = header.getAttribute('data-column');
            
            // Se è la stessa colonna, inverti la direzione
            if (sortState.column === column) {
                sortState.direction = sortState.direction === 'asc' ? 'desc' : 'asc';
            } else {
                // Nuova colonna, imposta direzione predefinita
                sortState.column = column;
                sortState.direction = column === 'name' ? 'asc' : 'desc';
            }
            
            // Rigenera la tabella
            displayStandings();
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
    const roundResults = document.getElementById('giornata-results');

    // Popola il selettore delle giornate
    fantacalcioData.rounds.forEach(round => {
        const option = document.createElement('option');
        option.value = round.round;
        option.textContent = `Giornata ${round.round}`;
        roundSelect.appendChild(option);
    });

    // Imposta la giornata più recente come default
    if (fantacalcioData.rounds.length > 0) {
        roundSelect.value = fantacalcioData.rounds[fantacalcioData.rounds.length - 1].round;
        displayRoundResults(fantacalcioData.rounds[fantacalcioData.rounds.length - 1].round);
    }

    // Event listener per il cambio di giornata
    roundSelect.addEventListener('change', (e) => {
        displayRoundResults(parseInt(e.target.value));
    });
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
        const homeGoals = match.homeGoals !== undefined ? match.homeGoals : calculateGoalsFromScore(match.homeScore);
        const awayGoals = match.awayGoals !== undefined ? match.awayGoals : calculateGoalsFromScore(match.awayScore);
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
                        <h4><i class="fas fa-star"></i> Formazioni Ideali vs Reali</h4>
                        <div class="match-comparison-status ${sameResult ? 'same-result' : 'different-result'}">
                            ${sameResult ? '✓ Stesso risultato' : '⚠️ Risultato diverso'}
                        </div>
                    </div>
                    
                    <div class="ideal-comparison-grid">
                        <div class="comparison-team">
                            <div class="team-name-ideal">${match.homeTeam}</div>
                            <div class="scores-comparison">
                                <div class="score-real">
                                    <span class="label">Reale:</span>
                                    <span class="value">${homeGoals} gol (${match.homeScore} pt)</span>
                                </div>
                                <div class="score-ideal">
                                    <span class="label">Ideale:</span>
                                    <span class="value">${homeIdealGoals} gol (${homeIdealScoreWithBonus} pt)</span>
                                    <span class="bonus-indicator">+1</span>
                                </div>
                                <div class="score-difference ${homeDifference >= 0 ? 'positive' : 'negative'}">
                                    <span class="label">Differenza:</span>
                                    <span class="value">
                                        ${homeDifference >= 0 ? '+' : ''}${homeDifference.toFixed(1)} pt
                                        ${homeGoalsDiff !== 0 ? `(${homeGoalsDiff >= 0 ? '+' : ''}${homeGoalsDiff} gol)` : ''}
                                    </span>
                                </div>
                            </div>
                        </div>
                        
                        <div class="vs-ideal-section">
                            <div class="vs-label">VS</div>
                            <div class="result-comparison">
                                <div class="real-result">Reale: ${goalScore}</div>
                                <div class="ideal-result">Ideale: ${idealGoalScore}</div>
                            </div>
                        </div>
                        
                        <div class="comparison-team">
                            <div class="team-name-ideal">${match.awayTeam}</div>
                            <div class="scores-comparison">
                                <div class="score-real">
                                    <span class="label">Reale:</span>
                                    <span class="value">${awayGoals} gol (${match.awayScore} pt)</span>
                                </div>
                                <div class="score-ideal">
                                    <span class="label">Ideale:</span>
                                    <span class="value">${awayIdealGoals} gol (${awayIdealScoreWithBonus} pt)</span>
                                </div>
                                <div class="score-difference ${awayDifference >= 0 ? 'positive' : 'negative'}">
                                    <span class="label">Differenza:</span>
                                    <span class="value">
                                        ${awayDifference >= 0 ? '+' : ''}${awayDifference.toFixed(1)} pt
                                        ${awayGoalsDiff !== 0 ? `(${awayGoalsDiff >= 0 ? '+' : ''}${awayGoalsDiff} gol)` : ''}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="ideal-insights">
                        <div class="insight-item">
                            <i class="fas fa-lightbulb"></i>
                            <span>${insightText}</span>
                        </div>
                        ${!sameResult ? `
                        <div class="insight-item alert">
                            <i class="fas fa-exclamation-triangle"></i>
                            <span>Con le formazioni ideali il risultato sarebbe stato: <strong>${idealResult === 'Pareggio' ? 'Pareggio' : 'Vittoria ' + idealResult}</strong></span>
                        </div>
                        ` : ''}
                    </div>
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
            </div>
        `;
    });

    roundResults.innerHTML = html;
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
            const homeGoals = calculateGoalsFromScore(match.homeScore);
            const awayGoals = calculateGoalsFromScore(match.awayScore);
            console.log(`Match ${index + 1}: ${match.homeTeam} ${homeGoals}-${awayGoals} ${match.awayTeam}`);
            console.log(`  Punteggi: ${match.homeScore} - ${match.awayScore}`);
        });
    }
}

// Esporta le funzioni per uso futuro
window.FantacalcioApp = {
    loadFantacalcioData,
    addNewRound,
    updateTeamStandings,
    displayStandings,
    displayRoundResults,
    displayIdealVsRealComparison,
    calculateGoalsFromScore,
    calculateIdealGoalsFromScore,
    getMatchResult,
    formatMatchScore,
    testGoalCalculation,
    getData: () => fantacalcioData
};

// Theme Management
class ThemeManager {
    constructor() {
        this.themes = ['auto', 'light', 'dark'];
        this.currentTheme = this.getStoredTheme() || 'auto';
        this.themeToggle = document.getElementById('theme-toggle');
        
        this.init();
    }
    
    init() {
        this.setTheme(this.currentTheme);
        this.updateToggleIcon();
        this.addEventListeners();
        
        // Listen for system theme changes
        if (window.matchMedia) {
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
                if (this.currentTheme === 'auto') {
                    this.applyTheme();
                }
            });
        }
    }
    
    addEventListeners() {
        this.themeToggle.addEventListener('click', () => {
            this.cycleTheme();
        });
    }
    
    cycleTheme() {
        const currentIndex = this.themes.indexOf(this.currentTheme);
        const nextIndex = (currentIndex + 1) % this.themes.length;
        const nextTheme = this.themes[nextIndex];
        
        this.setTheme(nextTheme);
        this.storeTheme(nextTheme);
    }
    
    setTheme(theme) {
        this.currentTheme = theme;
        this.applyTheme();
        this.updateToggleIcon();
    }
    
    applyTheme() {
        const html = document.documentElement;
        
        if (this.currentTheme === 'auto') {
            // Use system preference
            const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
            html.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
        } else {
            html.setAttribute('data-theme', this.currentTheme);
        }
        
        // Add animation class
        html.classList.add('theme-transition');
        setTimeout(() => {
            html.classList.remove('theme-transition');
        }, 300);
    }
    
    updateToggleIcon() {
        const icon = this.themeToggle.querySelector('i');
        
        switch (this.currentTheme) {
            case 'light':
                icon.className = 'fas fa-sun';
                this.themeToggle.title = 'Tema: Chiaro (click per Scuro)';
                break;
            case 'dark':
                icon.className = 'fas fa-moon';
                this.themeToggle.title = 'Tema: Scuro (click per Auto)';
                break;
            case 'auto':
                icon.className = 'fas fa-adjust';
                this.themeToggle.title = 'Tema: Auto (click per Chiaro)';
                break;
        }
    }
    
    getStoredTheme() {
        try {
            return localStorage.getItem('fantacalcio-theme');
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
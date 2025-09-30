// Algoritmo per calcolare i gol dal punteggio fantacalcio
function calculateGoalsFromScore(score) {
    // Il primo gol si ottiene a 66 punti, poi ogni 6 punti in più
    // 66 punti = 1 gol, 72 punti = 2 gol, 78 punti = 3 gol
    if (score < 66) {
        return 0;
    }
    return Math.floor((score - 60) / 6);
}

// Funzione per determinare il risultato del match
function getMatchResult(homeScore, awayScore) {
    const homeGoals = calculateGoalsFromScore(homeScore);
    const awayGoals = calculateGoalsFromScore(awayScore);
    
    if (homeGoals > awayGoals) return "home";
    if (awayGoals > homeGoals) return "away";
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
            
            const homeTeam = match.homeTeam;
            const awayTeam = match.awayTeam;
            const result = getMatchResult(homeScore, awayScore);
            const homeGoals = calculateGoalsFromScore(homeScore);
            const awayGoals = calculateGoalsFromScore(awayScore);
            
            // Aggiorna statistiche squadra casa
            standings[homeTeam].totalScore += homeScore;
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

// Dati di fallback integrati nel caso il JSON non si carichi
const fallbackData = {
    lastUpdate: "30 Settembre 2025, 18:30",
    season: "2025-2026",
    currentRound: 1,
    teams: [
        {
            id: 1,
            name: "Cambra City",
            owner: "Manager 1"
        },
        {
            id: 2,
            name: "Shakhtar Donuts",
            owner: "Manager 2"
        },
        {
            id: 3,
            name: "SM Frattese",
            owner: "Manager 3"
        },
        {
            id: 4,
            name: "CORTOMUSO",
            owner: "Manager 4"
        },
        {
            id: 5,
            name: "CUSIANA",
            owner: "Manager 5"
        },
        {
            id: 6,
            name: "Real Ichnusa",
            owner: "Manager 6"
        },
        {
            id: 7,
            name: "Ultimo",
            owner: "Manager 7"
        },
        {
            id: 8,
            name: "PARTIZAN TIRANA",
            owner: "Manager 8"
        }
    ],
    rounds: [
        {
            round: 1,
            date: "Settembre 2025",
            matches: [
                {
                    id: 1,
                    homeTeam: "CUSIANA",
                    awayTeam: "CORTOMUSO",
                    homeScore: 69.0,
                    awayScore: 70.0,
                    homeIdealScore: 70.0,
                    awayIdealScore: 74.0,
                    homeGoals: 1, // 69 punti = 1 gol (69-60)/6 = 1.5 -> 1
                    awayGoals: 1, // 70 punti = 1 gol (70-60)/6 = 1.66 -> 1
                    homeIdealGoals: 1, // 70 punti = 1 gol
                    awayIdealGoals: 2, // 74 punti = 2 gol (74-60)/6 = 2.33 -> 2
                    result: "draw", // Stesso numero di gol
                    idealResult: "away"
                },
                {
                    id: 2,
                    homeTeam: "Real Ichnusa",
                    awayTeam: "Cambra City",
                    homeScore: 77.5,
                    awayScore: 78.0,
                    homeIdealScore: 83.0,
                    awayIdealScore: 84.5,
                    homeGoals: 2, // 77.5 punti = 2 gol (77.5-60)/6 = 2.91 -> 2
                    awayGoals: 3, // 78 punti = 3 gol (78-60)/6 = 3 -> 3
                    homeIdealGoals: 3, // 83 punti = 3 gol (83-60)/6 = 3.83 -> 3
                    awayIdealGoals: 4, // 84.5 punti = 4 gol (84.5-60)/6 = 4.08 -> 4
                    result: "away",
                    idealResult: "away"
                },
                {
                    id: 3,
                    homeTeam: "Shakhtar Donuts",
                    awayTeam: "Ultimo",
                    homeScore: 75.5,
                    awayScore: 69.5,
                    homeIdealScore: 82.5,
                    awayIdealScore: 80.0,
                    homeGoals: 2, // 75.5 punti = 2 gol (75.5-60)/6 = 2.58 -> 2
                    awayGoals: 1, // 69.5 punti = 1 gol (69.5-60)/6 = 1.58 -> 1
                    homeIdealGoals: 3, // 82.5 punti = 3 gol (82.5-60)/6 = 3.75 -> 3
                    awayIdealGoals: 3, // 80 punti = 3 gol (80-60)/6 = 3.33 -> 3
                    result: "home",
                    idealResult: "draw"
                },
                {
                    id: 4,
                    homeTeam: "PARTIZAN TIRANA",
                    awayTeam: "SM Frattese",
                    homeScore: 64.0,
                    awayScore: 67.5,
                    homeIdealScore: 72.0,
                    awayIdealScore: 72.0,
                    homeGoals: 0, // 64 punti = 0 gol (sotto i 66)
                    awayGoals: 1, // 67.5 punti = 1 gol (67.5-60)/6 = 1.25 -> 1
                    homeIdealGoals: 2, // 72 punti = 2 gol (72-60)/6 = 2 -> 2
                    awayIdealGoals: 2, // 72 punti = 2 gol (72-60)/6 = 2 -> 2
                    result: "away",
                    idealResult: "draw"
                }
            ]
        }
    ],
    settings: {
        pointsForWin: 3,
        pointsForDraw: 1,
        pointsForLoss: 0,
        leagueFormat: "Girone all'italiana",
        totalRounds: 14,
        goalCalculation: {
            pointsPerGoal: 6,
            description: "Ogni 6 punti fantacalcio = 1 gol"
        }
    }
};

// Funzione per caricare i dati dal file JSON
async function loadFantacalcioData() {
    try {
        const response = await fetch('fantacalcio_data.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        fantacalcioData = await response.json();
        console.log('Dati caricati dal JSON con successo:', fantacalcioData);
        return fantacalcioData;
    } catch (error) {
        console.warn('Impossibile caricare il file JSON, uso dati integrati:', error.message);
        // Usa i dati di fallback integrati
        fantacalcioData = JSON.parse(JSON.stringify(fallbackData)); // Deep copy
        console.log('Dati di fallback caricati:', fantacalcioData);
        return fantacalcioData;
    }
}

// Inizializzazione dell'applicazione
document.addEventListener('DOMContentLoaded', async function() {
    await initializeApp();
});

async function initializeApp() {
    try {
        // Carica i dati dal file JSON
        await loadFantacalcioData();
        
        setupNavigationTabs();
        
        // Verifica che i dati siano caricati correttamente
        if (!fantacalcioData) {
            console.error('Nessun dato disponibile');
            return;
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
        // Mostra un messaggio di errore all'utente
        const standingsTable = document.getElementById('standings-table');
        if (standingsTable) {
            standingsTable.innerHTML = `
                <div style="text-align: center; padding: 2rem; color: #666;">
                    <i class="fas fa-exclamation-triangle" style="font-size: 2rem; margin-bottom: 1rem;"></i>
                    <p>Errore nel caricamento dei dati. Ricarica la pagina.</p>
                </div>
            `;
        }
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
        <div class="table-header">
            <div class="sortable-header" data-column="position">
                Pos. <i class="fas fa-sort"></i>
            </div>
            <div class="sortable-header" data-column="name">
                Squadra <i class="fas fa-sort ${sortState.column === 'name' ? (sortState.direction === 'asc' ? 'fa-sort-up' : 'fa-sort-down') : ''}"></i>
            </div>
            <div class="sortable-header" data-column="points">
                Pt <i class="fas fa-sort ${sortState.column === 'points' ? (sortState.direction === 'asc' ? 'fa-sort-up' : 'fa-sort-down') : ''}"></i>
            </div>
            <div class="sortable-header" data-column="wins">
                V <i class="fas fa-sort ${sortState.column === 'wins' ? (sortState.direction === 'asc' ? 'fa-sort-up' : 'fa-sort-down') : ''}"></i>
            </div>
            <div class="sortable-header" data-column="draws">
                P <i class="fas fa-sort ${sortState.column === 'draws' ? (sortState.direction === 'asc' ? 'fa-sort-up' : 'fa-sort-down') : ''}"></i>
            </div>
            <div class="sortable-header" data-column="losses">
                S <i class="fas fa-sort ${sortState.column === 'losses' ? (sortState.direction === 'asc' ? 'fa-sort-up' : 'fa-sort-down') : ''}"></i>
            </div>
            <div class="sortable-header" data-column="goalsFor">
                GF <i class="fas fa-sort ${sortState.column === 'goalsFor' ? (sortState.direction === 'asc' ? 'fa-sort-up' : 'fa-sort-down') : ''}"></i>
            </div>
            <div class="sortable-header" data-column="goalsAgainst">
                GS <i class="fas fa-sort ${sortState.column === 'goalsAgainst' ? (sortState.direction === 'asc' ? 'fa-sort-up' : 'fa-sort-down') : ''}"></i>
            </div>
            <div class="sortable-header" data-column="goalDifference">
                DR <i class="fas fa-sort ${sortState.column === 'goalDifference' ? (sortState.direction === 'asc' ? 'fa-sort-up' : 'fa-sort-down') : ''}"></i>
            </div>
            <div class="sortable-header" data-column="totalScore">
                Tot Pt <i class="fas fa-sort ${sortState.column === 'totalScore' ? (sortState.direction === 'asc' ? 'fa-sort-up' : 'fa-sort-down') : ''}"></i>
            </div>
            <div class="sortable-header" data-column="avgScore">
                Media <i class="fas fa-sort ${sortState.column === 'avgScore' ? (sortState.direction === 'asc' ? 'fa-sort-up' : 'fa-sort-down') : ''}"></i>
            </div>
        </div>
    `;

    sortedTeams.forEach((team, index) => {
        const position = index + 1;
        let positionClass = 'other';
        
        if (position === 1) positionClass = 'first';
        else if (position === 2) positionClass = 'second';
        else if (position === 3) positionClass = 'third';

        html += `
            <div class="team-row" style="animation-delay: ${index * 0.1}s">
                <div class="position ${positionClass}">${position}</div>
                <div class="team-name">${team.name}</div>
                <div class="points">${team.points}</div>
                <div class="wins">${team.wins}</div>
                <div class="draws">${team.draws}</div>
                <div class="losses">${team.losses}</div>
                <div class="goals-for">${team.goalsFor || 0}</div>
                <div class="goals-against">${team.goalsAgainst || 0}</div>
                <div class="goal-difference ${team.goalDifference >= 0 ? 'positive' : 'negative'}">${team.goalDifference >= 0 ? '+' : ''}${team.goalDifference || 0}</div>
                <div class="total-score">${team.totalScore || 0}</div>
                <div class="avg-score">${team.avgScore}</div>
            </div>
        `;
    });

    standingsTable.innerHTML = html;
    
    // Aggiungi event listeners per l'ordinamento
    setupSortableHeaders();
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
    
    // Aggiungi le differenze alla classifica ideale
    idealStandings.forEach((idealTeam, idealIndex) => {
        const realTeamIndex = realStandings.findIndex(realTeam => realTeam.name === idealTeam.name);
        const realTeam = realStandings[realTeamIndex];
        
        idealTeam.positionDifference = realTeamIndex - idealIndex; // Positivo = peggioramento nella reale
        idealTeam.pointsDifference = (realTeam ? realTeam.points : 0) - idealTeam.points;
        idealTeam.scoreDifference = (realTeam ? realTeam.totalScore : 0) - idealTeam.totalScore;
    });
    
    let html = `
        <div class="table-header">
            <div class="sortable-header">
                Pos. <i class="fas fa-sort"></i>
            </div>
            <div class="sortable-header">
                Squadra <i class="fas fa-sort"></i>
            </div>
            <div class="sortable-header">
                Pt <i class="fas fa-sort"></i>
            </div>
            <div class="sortable-header">
                V <i class="fas fa-sort"></i>
            </div>
            <div class="sortable-header">
                P <i class="fas fa-sort"></i>
            </div>
            <div class="sortable-header">
                S <i class="fas fa-sort"></i>
            </div>
            <div class="sortable-header">
                GF <i class="fas fa-sort"></i>
            </div>
            <div class="sortable-header">
                GS <i class="fas fa-sort"></i>
            </div>
            <div class="sortable-header">
                DR <i class="fas fa-sort"></i>
            </div>
            <div class="sortable-header">
                Tot Pt <i class="fas fa-sort"></i>
            </div>
            <div class="sortable-header">
                Media <i class="fas fa-sort"></i>
            </div>
            <div class="sortable-header">
                Diff Pos <i class="fas fa-sort"></i>
            </div>
            <div class="sortable-header">
                Diff Pt <i class="fas fa-sort"></i>
            </div>
        </div>
    `;

    idealStandings.forEach((team, index) => {
        const position = index + 1;
        let positionClass = 'other';
        
        if (position === 1) positionClass = 'first';
        else if (position === 2) positionClass = 'second';
        else if (position === 3) positionClass = 'third';

        html += `
            <div class="team-row" style="animation-delay: ${index * 0.1}s">
                <div class="position ${positionClass}">${position}</div>
                <div class="team-name">${team.name}</div>
                <div class="points">${team.points}</div>
                <div class="wins">${team.wins}</div>
                <div class="draws">${team.draws}</div>
                <div class="losses">${team.losses}</div>
                <div class="goals-for">${team.goalsFor}</div>
                <div class="goals-against">${team.goalsAgainst}</div>
                <div class="goal-difference ${team.goalDifference >= 0 ? 'positive' : 'negative'}">${team.goalDifference >= 0 ? '+' : ''}${team.goalDifference}</div>
                <div class="total-score">${team.totalScore}</div>
                <div class="avg-score">${team.avgScore}</div>
                <div class="position-difference ${team.positionDifference > 0 ? 'worse' : team.positionDifference < 0 ? 'better' : 'same'}">
                    ${team.positionDifference > 0 ? '+' : ''}${team.positionDifference || 0}
                </div>
                <div class="points-difference ${team.pointsDifference > 0 ? 'worse' : team.pointsDifference < 0 ? 'better' : 'same'}">
                    ${team.pointsDifference > 0 ? '+' : ''}${team.pointsDifference || 0}
                </div>
            </div>
        `;
    });

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

    if (!round) {
        roundResults.innerHTML = '<p>Nessun risultato disponibile per questa giornata.</p>';
        return;
    }

    let html = '';
    round.matches.forEach((match, index) => {
        let resultClass = '';
        let resultText = '';

        if (match.result === 'home') {
            resultClass = 'win';
            resultText = `Vittoria ${match.homeTeam}`;
        } else if (match.result === 'away') {
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
            const homeIdealGoals = match.homeIdealGoals !== undefined ? match.homeIdealGoals : calculateGoalsFromScore(match.homeIdealScore);
            const awayIdealGoals = match.awayIdealGoals !== undefined ? match.awayIdealGoals : calculateGoalsFromScore(match.awayIdealScore);
            const idealGoalScore = `${homeIdealGoals}-${awayIdealGoals}`;
            
            idealSection = `
                <div class="ideal-scores">
                    <h4><i class="fas fa-star"></i> Punteggi Ideali</h4>
                    <div class="ideal-match-teams">
                        <div class="ideal-team">
                            <div class="ideal-score">${homeIdealGoals}</div>
                            <div class="ideal-fantasy-score">(${match.homeIdealScore} pt)</div>
                        </div>
                        <div class="vs-ideal">VS</div>
                        <div class="ideal-team">
                            <div class="ideal-score">${awayIdealGoals}</div>
                            <div class="ideal-fantasy-score">(${match.awayIdealScore} pt)</div>
                        </div>
                    </div>
                    <div class="ideal-result">
                        Risultato ideale: <strong>${idealGoalScore}</strong>
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
            </div>
        `;
    });

    roundResults.innerHTML = html;
    
    // Mostra il confronto reale vs ideale per questa giornata
    displayRoundComparison(roundNumber);
    
    // Mostra il commento se è la prima giornata
    if (roundNumber === 1) {
        displayMatchCommentary(roundNumber);
    }
}

// Funzione per mostrare il confronto reale vs ideale per una giornata specifica
function displayRoundComparison(roundNumber) {
    const comparisonSection = document.getElementById('giornata-comparison');
    const comparisonContent = document.getElementById('giornata-comparison-content');
    
    const round = fantacalcioData.rounds.find(r => r.round === roundNumber);
    
    if (!round || !round.matches.some(m => m.homeIdealScore && m.awayIdealScore)) {
        comparisonSection.style.display = 'none';
        return;
    }
    
    let html = '';
    round.matches.forEach(match => {
        if (match.homeIdealScore && match.awayIdealScore) {
            const realHomeGoals = calculateGoalsFromScore(match.homeScore);
            const realAwayGoals = calculateGoalsFromScore(match.awayScore);
            const idealHomeGoals = calculateGoalsFromScore(match.homeIdealScore);
            const idealAwayGoals = calculateGoalsFromScore(match.awayIdealScore);
            
            const realResult = realHomeGoals > realAwayGoals ? match.homeTeam : 
                             realAwayGoals > realHomeGoals ? match.awayTeam : 'Pareggio';
            const idealResult = idealHomeGoals > idealAwayGoals ? match.homeTeam : 
                              idealAwayGoals > idealHomeGoals ? match.awayTeam : 'Pareggio';
            
            const sameResult = realResult === idealResult;
            
            html += `
                <div class="comparison-match">
                    <div class="match-teams-comparison">
                        <span class="team-name">${match.homeTeam}</span>
                        <span class="vs-text">vs</span>
                        <span class="team-name">${match.awayTeam}</span>
                    </div>
                    <div class="results-comparison">
                        <div class="result-column">
                            <h4>Reale</h4>
                            <div class="score">${realHomeGoals}-${realAwayGoals}</div>
                            <div class="result">${realResult}</div>
                        </div>
                        <div class="result-column">
                            <h4>Ideale</h4>
                            <div class="score">${idealHomeGoals}-${idealAwayGoals}</div>
                            <div class="result">${idealResult}</div>
                        </div>
                        <div class="result-status ${sameResult ? 'same' : 'different'}">
                            ${sameResult ? '✓ Stesso risultato' : '✗ Risultato diverso'}
                        </div>
                    </div>
                </div>
            `;
        }
    });
    
    comparisonContent.innerHTML = html;
    comparisonSection.style.display = 'block';
}

// Funzione per mostrare il commento della giornata
function displayMatchCommentary(roundNumber) {
    const commentarySection = document.getElementById('match-commentary');
    const commentaryContent = document.getElementById('commentary-content');
    
    if (roundNumber === 1) {
        const commentary = `
            <div class="commentary-dialogue">
                <span class="speaker">Caressa:</span> "Beppe, che bella prima giornata di Fantacalcio! Partiamo subito con un match che ha fatto discutere: CUSIANA contro CORTOMUSO, un classico 1-1 che non ha lasciato soddisfatto nessuno!"
            </div>
            
            <div class="commentary-dialogue">
                <span class="speaker bergomi">Bergomi:</span> "Eh sì Fabio, ma guarda che se avessero schierato le formazioni ideali sarebbe finita 1-2 per il CORTOMUSO! Qui si vede la differenza tra chi sa gestire la rosa e chi si affida solo al feeling..."
            </div>
            
            <div class="commentary-dialogue">
                <span class="speaker">Caressa:</span> "Assolutamente! E che dire di Real Ichnusa-Cambra City? Un 2-3 spettacolare! Ma sai cosa mi colpisce? Anche con le formazioni ideali il risultato sarebbe stato lo stesso: 3-4 per il Cambra City!"
            </div>
            
            <div class="commentary-dialogue">
                <span class="speaker bergomi">Bergomi:</span> "Questo dimostra che il Cambra City ha una rosa profonda, Fabio. Non è un caso che sia in testa alla classifica! E poi guarda Shakhtar Donuts: 2-1 all'Ultimo, ma con la formazione ideale sarebbe stato un pareggio 3-3..."
            </div>
            
            <div class="commentary-dialogue">
                <span class="speaker">Caressa:</span> "L'Ultimo sta vivendo un momento difficile, si vede che la preparazione estiva non è stata delle migliori! E PARTIZAN TIRANA? Sconfitto 0-1 dall'SM Frattese, ma con le scelte giuste poteva pareggiare 2-2!"
            </div>
            
            <div class="commentary-dialogue">
                <span class="speaker bergomi">Bergomi:</span> "La cosa che mi preoccupa di più, Fabio, è che troppe squadre stanno lasciando punti per strada con scelte sbagliate. In un campionato così equilibrato, ogni formazione conta!"
            </div>
            
            <div class="commentary-dialogue">
                <span class="speaker">Caressa:</span> "Hai ragione Beppe! E ora tutti gli occhi sono puntati sulla prossima giornata. Chi saprà fare le scelte giuste? Lo scopriremo solo... giocando!"
            </div>
        `;
        
        commentaryContent.innerHTML = commentary;
        commentarySection.style.display = 'block';
    } else {
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
    getMatchResult,
    formatMatchScore,
    testGoalCalculation,
    getData: () => fantacalcioData
};
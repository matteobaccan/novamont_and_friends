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
            const result = getIdealMatchResult(homeScore, awayScore);
            const homeGoals = calculateIdealGoalsFromScore(homeScore, true);
            const awayGoals = calculateIdealGoalsFromScore(awayScore, false);
            
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

// Funzione per caricare i dati dal file JSON
async function loadFantacalcioData() {
    try {
        const response = await fetch('fantacalcio_data.json');
        if (!response.ok) {
            throw new Error(`Errore HTTP! Status: ${response.status}`);
        }
        fantacalcioData = await response.json();
        console.log('Dati caricati dal JSON con successo:', fantacalcioData);
        return fantacalcioData;
    } catch (error) {
        console.error('Impossibile caricare il file JSON:', error.message);
        // Rilanciamo l'errore per gestirlo nell'inizializzazione
        throw error;
    }
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
        <table class="standings-table ideal-standings-table">
            <thead>
                <tr class="table-header">
                    <th class="sortable-header" data-column="position">
                        Pos. <i class="fas fa-sort"></i>
                    </th>
                    <th class="sortable-header" data-column="name">
                        Squadra <i class="fas fa-sort"></i>
                    </th>
                    <th class="sortable-header" data-column="points">
                        Pt <i class="fas fa-sort"></i>
                    </th>
                    <th class="sortable-header mobile-hide" data-column="wins">
                        V <i class="fas fa-sort"></i>
                    </th>
                    <th class="sortable-header mobile-hide" data-column="draws">
                        P <i class="fas fa-sort"></i>
                    </th>
                    <th class="sortable-header mobile-hide" data-column="losses">
                        S <i class="fas fa-sort"></i>
                    </th>
                    <th class="sortable-header mobile-hide" data-column="goalsFor">
                        GF <i class="fas fa-sort"></i>
                    </th>
                    <th class="sortable-header mobile-hide" data-column="goalsAgainst">
                        GS <i class="fas fa-sort"></i>
                    </th>
                    <th class="sortable-header mobile-hide" data-column="goalDifference">
                        DR <i class="fas fa-sort"></i>
                    </th>
                    <th class="sortable-header mobile-hide" data-column="totalScore">
                        Pt <i class="fas fa-sort"></i>
                    </th>
                    <th class="sortable-header mobile-hide" data-column="avgScore">
                        Media <i class="fas fa-sort"></i>
                    </th>
                    <th class="sortable-header mobile-hide" data-column="positionDifference">
                        Diff Pos <i class="fas fa-sort"></i>
                    </th>
                    <th class="sortable-header mobile-hide" data-column="pointsDifference">
                        Diff Pt <i class="fas fa-sort"></i>
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
    
    // Mostra il commento se è la prima giornata (all'inizio)
    if (roundNumber === 1) {
        displayMatchCommentary(roundNumber);
    }

    if (!round) {
        roundResults.innerHTML = '<p>Nessun risultato disponibile per questa giornata.</p>';
        return;
    }

    let html = '';
    
    // Inserisci la classifica del miglior allenatore nel contenitore dedicato
    const coachRankingContainer = document.getElementById('coach-ranking-container');
    const coachRankingHtml = generateCoachRanking(round);
    if (coachRankingContainer) {
        coachRankingContainer.innerHTML = coachRankingHtml || '';
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
            
            // Calcola differenze e confronti
            const homeDifference = match.homeIdealScore - match.homeScore;
            const awayDifference = match.awayIdealScore - match.awayScore;
            const homeGoalsDiff = homeIdealGoals - homeGoals;
            const awayGoalsDiff = awayIdealGoals - awayGoals;
            
            // Determina il risultato reale e ideale
            const realResult = homeGoals > awayGoals ? match.homeTeam : 
                             awayGoals > homeGoals ? match.awayTeam : 'Pareggio';
            const idealResult = homeIdealGoals > awayIdealGoals ? match.homeTeam : 
                              awayIdealGoals > homeIdealGoals ? match.awayTeam : 'Pareggio';
            
            const sameResult = realResult === idealResult;
            
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
                                    <span class="value">${homeIdealGoals} gol (${match.homeIdealScore} pt)</span>
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
                                    <span class="value">${awayIdealGoals} gol (${match.awayIdealScore} pt)</span>
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
                            <span>
                                ${homeDifference > 0 && awayDifference > 0 ? 
                                    'Entrambe le squadre potevano fare meglio con scelte diverse' :
                                homeDifference > awayDifference ? 
                                    `${match.homeTeam} ha sprecato più potenziale (${homeDifference.toFixed(1)} pt)` :
                                awayDifference > homeDifference ?
                                    `${match.awayTeam} ha sprecato più potenziale (${awayDifference.toFixed(1)} pt)` :
                                    'Entrambe le squadre hanno fatto scelte simili alle ideali'
                                }
                            </span>
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
            
            // Calcola punti persi per squadra casa
            const homePointsLost = Math.max(0, match.homeIdealScore - match.homeScore);
            coachData.push({
                team: match.homeTeam,
                realScore: match.homeScore,
                idealScore: match.homeIdealScore,
                pointsLost: homePointsLost,
                efficiency: ((match.homeScore / match.homeIdealScore) * 100).toFixed(1)
            });
            
            // Calcola punti persi per squadra trasferta
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
                <span class="speaker">Caressa:</span> "Assolutamente! E che dire di Real Ichnusa-Cambra City? Un 2-3 spettacolare per gli ospiti! Ma sai cosa mi colpisce? Con le formazioni ideali sarebbe finita 4-4, un pareggio pirotecnico! Cambra City ha lasciato solo 0.5 punti in panchina!"
            </div>
            
            <div class="commentary-dialogue">
                <span class="speaker bergomi">Bergomi:</span> "Esatto Fabio! Entrambe le squadre hanno fatto ottime scelte! E poi guarda Shakhtar Donuts: 2-1 all'Ultimo, ma con la formazione ideale sarebbe stato un pareggio 3-3. Occasione sprecata dall'Ultimo!"
            </div>
            
            <div class="commentary-dialogue">
                <span class="speaker">Caressa:</span> "L'Ultimo sta vivendo un momento difficile, si vede che la preparazione estiva non è stata delle migliori! E PARTIZAN TIRANA? Sconfitto 0-1 dall'SM Frattese, ma con le scelte giuste poteva pareggiare 2-2! Due punti buttati via!"
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
    
    // Add trophy reload functionality
    const trophyReload = document.getElementById('trophy-reload');
    if (trophyReload) {
        trophyReload.addEventListener('click', () => {
            location.reload();
        });
    }
});
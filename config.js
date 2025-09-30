// Configurazione del sito Fantacalcio Novamont & Friends
// Modifica questi valori per personalizzare il sito

const CONFIG = {
    // Informazioni generali
    leagueName: "Novamont & Friends",
    season: "2025-2026",
    
    // Impostazioni punteggi
    scoring: {
        win: 3,
        draw: 1,
        loss: 0
    },
    
    // Colori del tema (CSS custom properties)
    colors: {
        primary: "#667eea",
        secondary: "#764ba2",
        gold: "#ffd700",
        success: "#28a745",
        warning: "#ffc107",
        danger: "#dc3545",
        info: "#17a2b8"
    },
    
    // Impostazioni tabella classifica
    standings: {
        showAverageScore: true,
        showTotalMatches: false,
        showGoalDifference: false,
        animationDelay: 100 // millisecondi tra ogni riga
    },
    
    // Impostazioni risultati
    matches: {
        showFormations: false,
        showMatchDate: true,
        showMatchTime: false,
        highlightWinner: true
    },
    
    // Impostazioni responsive
    responsive: {
        mobileBreakpoint: 768,
        tabletBreakpoint: 1024,
        hideColumnsOnMobile: ["avgScore"] // colonne da nascondere su mobile
    },
    
    // Animazioni
    animations: {
        enabled: true,
        duration: 500, // millisecondi
        easing: "ease-in-out"
    },
    
    // Aggiornamenti automatici (futuro sviluppo)
    autoUpdate: {
        enabled: false,
        interval: 300000, // 5 minuti in millisecondi
        source: "fantacalcio_data.json"
    },
    
    // Social links (footer)
    social: {
        facebook: "#",
        twitter: "#",
        whatsapp: "#",
        instagram: "#"
    },
    
    // Messaggi personalizzabili
    messages: {
        noData: "Nessun dato disponibile",
        loading: "Caricamento...",
        lastUpdate: "Ultimo aggiornamento",
        selectRound: "Seleziona Giornata",
        currentLeader: "Primo in classifica",
        highestScore: "Punteggio più alto",
        totalTeams: "Squadre partecipanti",
        currentRound: "Giornata attuale"
    },
    
    // Formati data
    dateFormats: {
        lastUpdate: "DD MMMM YYYY, HH:mm",
        matchDate: "DD MMMM YYYY"
    }
};

// Applica i colori del tema come CSS custom properties
function applyThemeColors() {
    const root = document.documentElement;
    Object.entries(CONFIG.colors).forEach(([key, value]) => {
        root.style.setProperty(`--color-${key}`, value);
    });
}

// Applica la configurazione quando il DOM è caricato
document.addEventListener('DOMContentLoaded', function() {
    applyThemeColors();
});

// Esporta la configurazione per l'uso in altri file
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
} else if (typeof window !== 'undefined') {
    window.CONFIG = CONFIG;
}
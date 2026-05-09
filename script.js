// Storage key
const STORAGE_KEY = 'boardgame-tierlist';

// BGG API
const BGG_API = 'https://boardgamegeek.com/xmlapi2/search?query=';

// DOM Elements
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const searchResults = document.getElementById('searchResults');
const clearBtn = document.getElementById('clearBtn');
const tierlist = document.getElementById('tierlist');

// Dropdown for suggestions
let suggestionsDropdown = null;
let allGames = []; // Cache of all games from search

// Event Listeners
searchBtn.addEventListener('click', performSearch);
searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') performSearch();
});
searchInput.addEventListener('input', handleInputChange);
clearBtn.addEventListener('click', clearTierlist);

// Load tierlist on page load
window.addEventListener('load', loadTierlist);

// Handle input change to show suggestions
async function handleInputChange() {
    const query = searchInput.value.trim();
    
    if (query.length < 2) {
        removeSuggestions();
        return;
    }

    try {
        const response = await fetch(`${BGG_API}${encodeURIComponent(query)}`);
        const xmlText = await response.text();
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

        const games = xmlDoc.querySelectorAll('item');
        allGames = [];

        games.forEach((game) => {
            const id = game.getAttribute('id');
            const name = game.querySelector('name')?.textContent || 'Unknown';
            const imageElement = game.querySelector('image');
            const image = imageElement?.textContent || `https://cf.geekdo-images.com/images/pic${id}_t.jpg`;
            
            allGames.push({ id, name, image });
        });

        if (allGames.length > 0) {
            showSuggestions(allGames);
        } else {
            removeSuggestions();
        }
    } catch (error) {
        console.error('Search error:', error);
        removeSuggestions();
    }
}

// Show dropdown suggestions
function showSuggestions(games) {
    removeSuggestions();

    suggestionsDropdown = document.createElement('div');
    suggestionsDropdown.className = 'suggestions-dropdown';

    const limitedGames = games.slice(0, 10); // Show top 10

    limitedGames.forEach((game) => {
        const suggestion = document.createElement('div');
        suggestion.className = 'suggestion-item';
        suggestion.innerHTML = `
            <img src="${game.image}" alt="${game.name}" class="suggestion-image" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2240%22 height=%2240%22%3E%3Crect fill=%22%23ddd%22 width=%2240%22 height=%2240%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%23999%22 font-size=%228%22%3ENo Img%3C/text%3E%3C/svg%3E'">
            <div class="suggestion-text">
                <div class="suggestion-name">${game.name}</div>
                <div class="suggestion-id">BGG ID: ${game.id}</div>
            </div>
        `;

        suggestion.addEventListener('click', () => {
            selectGame(game);
        });

        suggestionsDropdown.appendChild(suggestion);
    });

    searchInput.parentElement.style.position = 'relative';
    searchInput.parentElement.appendChild(suggestionsDropdown);
}

// Remove suggestions dropdown
function removeSuggestions() {
    if (suggestionsDropdown) {
        suggestionsDropdown.remove();
        suggestionsDropdown = null;
    }
}

// Select a game from suggestions
function selectGame(game) {
    searchInput.value = game.name;
    removeSuggestions();
    allGames = [game]; // Set to just this game
    displayResults([game]);
}

// Perform search for boardgames
async function performSearch() {
    if (allGames.length === 0) {
        const query = searchInput.value.trim();
        if (!query) return;

        searchResults.innerHTML = '<div class="loading"><div class="spinner"></div> Searching...</div>';

        try {
            const response = await fetch(`${BGG_API}${encodeURIComponent(query)}`);
            const xmlText = await response.text();
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

            const games = xmlDoc.querySelectorAll('item');
            
            if (games.length === 0) {
                searchResults.innerHTML = '<p class="placeholder">No games found. Try a different search.</p>';
                return;
            }

            displayResults(Array.from(games).map(game => ({
                id: game.getAttribute('id'),
                name: game.querySelector('name')?.textContent || 'Unknown',
                image: game.querySelector('image')?.textContent || `https://cf.geekdo-images.com/images/pic${game.getAttribute('id')}_t.jpg`
            })));
        } catch (error) {
            console.error('Search error:', error);
            searchResults.innerHTML = '<p class="placeholder">Error searching. Please try again.</p>';
        }
    } else {
        displayResults(allGames);
    }
}

// Display search results
function displayResults(games) {
    removeSuggestions();
    searchResults.innerHTML = '';
    
    games.forEach((game) => {
        const gameCard = document.createElement('div');
        gameCard.className = 'game-card';
        gameCard.draggable = true;
        gameCard.innerHTML = `
            <img src="${game.image}" alt="${game.name}" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22100%22%3E%3Crect fill=%22%23ddd%22 width=%22100%22 height=%22100%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%23999%22 font-size=%2214%22%3ENo Image%3C/text%3E%3C/svg%3E'">
            <div class="name">${game.name}</div>
        `;

        // Store game data in the element
        gameCard.dataset.gameId = game.id;
        gameCard.dataset.gameName = game.name;
        gameCard.dataset.gameImage = game.image;

        gameCard.addEventListener('dragstart', dragStart);
        gameCard.addEventListener('click', () => {
            // Allow clicking to add game too
            const tierGamesElements = document.querySelectorAll('.tier-games');
            if (tierGamesElements.length > 0) {
                addGameToTier(game.id, game.name, game.image, tierGamesElements[0]);
                saveTierlist();
            }
        });
        
        searchResults.appendChild(gameCard);
    });
}

// Drag and drop handlers
let draggedElement = null;

function dragStart(e) {
    draggedElement = this;
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('text/html', this.innerHTML);
}

const tierGames = document.querySelectorAll('.tier-games');

tierGames.forEach((tier) => {
    tier.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        tier.classList.add('drag-over');
    });

    tier.addEventListener('dragleave', () => {
        tier.classList.remove('drag-over');
    });

    tier.addEventListener('drop', (e) => {
        e.preventDefault();
        tier.classList.remove('drag-over');

        if (draggedElement) {
            const gameId = draggedElement.dataset.gameId;
            const gameName = draggedElement.dataset.gameName;
            const gameImage = draggedElement.dataset.gameImage;

            // Check if game already in tierlist
            if (document.querySelector(`[data-game-id="${gameId}"]`)) {
                return; // Don't add duplicates
            }

            addGameToTier(gameId, gameName, gameImage, tier);
            saveTierlist();
        }
    });
});

// Add game to tier
function addGameToTier(gameId, gameName, gameImage, tierElement) {
    const gameElement = document.createElement('div');
    gameElement.className = 'tier-game';
    gameElement.draggable = true;
    gameElement.dataset.gameId = gameId;
    gameElement.dataset.gameName = gameName;
    gameElement.dataset.gameImage = gameImage;
    gameElement.innerHTML = `
        <img src="${gameImage}" alt="${gameName}" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2280%22 height=%2280%22%3E%3Crect fill=%22%23ddd%22 width=%2280%22 height=%2280%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%23999%22 font-size=%2212%22%3ENo Image%3C/text%3E%3C/svg%3E'">
        <div class="name">${gameName}</div>
        <button class="remove-btn">×</button>
    `;

    const removeBtn = gameElement.querySelector('.remove-btn');
    removeBtn.addEventListener('click', () => {
        gameElement.remove();
        saveTierlist();
    });

    gameElement.addEventListener('dragstart', (e) => {
        draggedElement = gameElement;
        e.dataTransfer.effectAllowed = 'move';
    });

    tierElement.appendChild(gameElement);
}

// Clear tierlist
function clearTierlist() {
    if (confirm('Are you sure you want to clear your entire tierlist?')) {
        tierGames.forEach((tier) => {
            tier.innerHTML = '';
        });
        saveTierlist();
    }
}

// Save tierlist to localStorage
function saveTierlist() {
    const tierData = {};
    document.querySelectorAll('[data-tier]').forEach((tier) => {
        const tierName = tier.dataset.tier;
        const games = [];
        tier.querySelectorAll('.tier-game').forEach((game) => {
            games.push({
                id: game.dataset.gameId,
                name: game.dataset.gameName,
                image: game.dataset.gameImage,
            });
        });
        tierData[tierName] = games;
    });

    localStorage.setItem(STORAGE_KEY, JSON.stringify(tierData));
}

// Load tierlist from localStorage
function loadTierlist() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;

    try {
        const tierData = JSON.parse(saved);
        Object.keys(tierData).forEach((tierName) => {
            const tierElement = document.querySelector(`.tier-games[data-tier="${tierName}"]`);
            if (tierElement) {
                tierData[tierName].forEach((game) => {
                    addGameToTier(game.id, game.name, game.image, tierElement);
                });
            }
        });
    } catch (error) {
        console.error('Error loading tierlist:', error);
    }
}

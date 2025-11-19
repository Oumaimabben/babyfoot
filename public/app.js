let parties = [];
let ws = null;

document.addEventListener('DOMContentLoaded', () => {
  loadParties();
  connectWebSocket();
  setupEventListeners();
});

// Charger les parties depuis l'API
async function loadParties() {
  try {
    const response = await fetch('/api/parties');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    
    if (Array.isArray(data)) {
      parties = data;
    } else {
      console.error('Les données des parties ne sont pas un tableau:', data);
      parties = [];
    }
    updateUI();
  } catch (error) {
    console.error('Erreur lors du chargement des parties:', error);
    parties = [];
  }
}

// Connexion WebSocket pour les parties
function connectWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${protocol}//${window.location.host}`);

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type && data.type.includes('partie')) {
      handleWebSocketMessage(data);
    }
  };

  ws.onerror = (error) => {
    console.error('Erreur WebSocket parties:', error);
  };

  ws.onclose = () => {
    console.log('WebSocket parties fermé, reconnexion en 3s...');
    setTimeout(() => connectWebSocket(), 3000);
  };
}

// Gérer les messages WebSocket parties
function handleWebSocketMessage(data) {
  if (!Array.isArray(parties)) {
    console.error('⚠️ parties n\'est pas un tableau, réinitialisation:', parties);
    parties = [];
  }
  
  switch (data.type) {
    case 'partie_created':
      if (data.partie && typeof data.partie === 'object') {
        if (!parties.some(p => p.id === data.partie.id)) {
          parties.push(data.partie);
          updateUI();
        }
      }
      break;
      
    case 'partie_updated':
      if (data.partie && typeof data.partie === 'object') {
        const index = parties.findIndex(p => p.id === data.partie.id);
        if (index !== -1) {
          parties[index] = data.partie;
        } else {
          parties.push(data.partie);
        }
        updateUI();
      }
      break;
      
    case 'partie_deleted':
      if (data.id) {
        parties = parties.filter(p => p.id !== data.id);
        updateUI();
      }
      break;
      
    default:
      console.log('Type de message WebSocket inconnu:', data.type);
  }
}

// Modifier updateUI pour inclure la validation
function updateUI() {
  if (!validatePartiesArray()) {
    console.warn('Rechargement des données en cours...');
    return;
  }
  
  updateStats();
  renderPartiesActives();
  renderPartiesTerminees();
}

// Mettre à jour les statistiques
function updateStats() {
  const active = parties.filter(p => p.statut === 'en_cours').length;
  const total = parties.length;

  document.getElementById('countPartiesActive').textContent = active;
  document.getElementById('countPartiesTotal').textContent = total;
}

// Afficher les parties en cours
function renderPartiesActives() {
  const actives = parties.filter(p => p.statut === 'en_cours');
  const container = document.getElementById('partiesActives');

  if (actives.length === 0) {
    container.innerHTML = '<p class="empty">Aucune partie en cours</p>';
    return;
  }

  container.innerHTML = actives.map(partie => createPartieCard(partie)).join('');
  attachPartieEventListeners();
}

// Afficher les parties terminées
function renderPartiesTerminees() {
  const terminees = parties.filter(p => p.statut === 'termine');
  const container = document.getElementById('partiesTerminees');

  if (terminees.length === 0) {
    container.innerHTML = '<p class="empty">Aucune partie terminée</p>';
    return;
  }

  container.innerHTML = terminees.map(partie => createPartieCard(partie, true)).join('');
  attachPartieEventListeners();
}

// Créer une carte de partie
function createPartieCard(partie, isTerminee = false) {
  const dateFormatted = new Date(partie.date_creation).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const cardClass = isTerminee ? 'partie-card termine' : 'partie-card';
  const badgeClass = isTerminee ? 'badge-termine' : 'badge-en-cours';
  const badgeText = isTerminee ? 'Terminée' : 'En cours';

  return `
    <div class="${cardClass}" data-id="${partie.id}">
      <div class="partie-header">
        <div class="partie-nom">${partie.nom}</div>
        <span class="badge ${badgeClass}">${badgeText}</span>
      </div>

      ${!isTerminee ? `
        <div class="partie-scores">
          <div class="score-input">
            <label>Équipe 1</label>
            <input 
              type="number" 
              class="score-equipe1" 
              value="${partie.equipe1_score || 0}" 
              min="0"
            >
          </div>
          <div class="score-input">
            <label>Équipe 2</label>
            <input 
              type="number" 
              class="score-equipe2" 
              value="${partie.equipe2_score || 0}" 
              min="0"
            >
          </div>
        </div>
      ` : `
        <div class="partie-scores">
          <div><strong>Équipe 1:</strong> ${partie.equipe1_score || 0}</div>
          <div><strong>Équipe 2:</strong> ${partie.equipe2_score || 0}</div>
        </div>
      `}

      <p style="font-size: 12px; color: #999; margin-bottom: 10px;">${dateFormatted}</p>

      <div class="partie-actions">
        ${!isTerminee ? `
          <button class="btn btn-success btn-terminer">Terminer</button>
          <button class="btn btn-danger btn-supprimer">Supprimer</button>
        ` : `
          <button class="btn btn-danger btn-supprimer">Supprimer</button>
        `}
      </div>
    </div>
  `;
}

// Attacher les événements aux cartes
function attachPartieEventListeners() {
  document.querySelectorAll('.partie-card').forEach(card => {
    const id = card.dataset.id;

    // Mises à jour de score
    const input1 = card.querySelector('.score-equipe1');
    const input2 = card.querySelector('.score-equipe2');

    if (input1 && input2) {
      [input1, input2].forEach(input => {
        input.addEventListener('change', async (e) => {
          const equipe1_score = parseInt(input1.value) || 0;
          const equipe2_score = parseInt(input2.value) || 0;

          try {
            await fetch(`/api/parties/${id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ equipe1_score, equipe2_score })
            });
          } catch (error) {
            console.error('Erreur lors de la mise à jour des scores:', error);
          }
        });
      });
    }

    // Terminer la partie
    const btnTerminer = card.querySelector('.btn-terminer');
    if (btnTerminer) {
      btnTerminer.addEventListener('click', async () => {
        try {
          await fetch(`/api/parties/${id}/terminer`, { method: 'PUT' });
        } catch (error) {
          console.error('Erreur lors de la terminaison:', error);
        }
      });
    }

    // Supprimer la partie
    const btnSupprimer = card.querySelector('.btn-supprimer');
    if (btnSupprimer) {
      btnSupprimer.addEventListener('click', async () => {
        if (confirm('Êtes-vous sûr de vouloir supprimer cette partie ?')) {
          try {
            await fetch(`/api/parties/${id}`, { method: 'DELETE' });
          } catch (error) {
            console.error('Erreur lors de la suppression:', error);
          }
        }
      });
    }
  });
}

// Événements du formulaire
function setupEventListeners() {
  document.getElementById('createForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const nom = document.getElementById('nomPartie').value.trim();
    if (!nom) return;

    try {
      await fetch('/api/parties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nom })
      });

      document.getElementById('nomPartie').value = '';
    } catch (error) {
      console.error('Erreur lors de la création:', error);
    }
  });
}

// Fonction de vérification de l'intégrité des données
function validatePartiesArray() {
  if (!Array.isArray(parties)) {
    console.error('CORRUPTION DÉTECTÉE : parties n\'est pas un tableau');
    console.trace('Stack trace:');
    parties = [];
    loadParties(); 
    return false;
  }
  return true;
}
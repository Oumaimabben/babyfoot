import express from 'express';
import { WebSocketServer } from 'ws';
import http from 'http';
import pg from 'pg';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { setupPartiesHandler, broadcastPartiesUpdate } from './websockets/parties-handler.js';
import { setupChatHandler } from './websockets/chat-handler.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Configuration PostgreSQL
const pool = new pg.Pool({
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '12345',
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'babyfoot',
});

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Base de données - Initialisation
async function initDatabase() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS parties (
        id UUID PRIMARY KEY,
        nom VARCHAR(255) NOT NULL,
        statut VARCHAR(50) DEFAULT 'en_cours',
        date_creation TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        date_fin TIMESTAMP NULL,
        equipe1_score INTEGER DEFAULT 0,
        equipe2_score INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        contenu TEXT NOT NULL,
        user_name VARCHAR(100) DEFAULT 'Anonyme',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('✓ Base de données initialisée');
  } catch (err) {
    console.error('Erreur lors de l\'initialisation de la BD:', err);
  }
}

const { clients } = setupPartiesHandler(wss);
setupChatHandler(wss, pool);

// API Routes

// GET - Récupérer toutes les parties
app.get('/api/parties', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM parties ORDER BY date_creation DESC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Erreur GET /api/parties:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET - Récupérer toutes les messages
app.get('/api/messages', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, contenu, user_name, created_at FROM messages ORDER BY created_at ASC LIMIT 100'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Erreur GET /api/messages:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST - Créer une nouvelle partie
app.post('/api/parties', async (req, res) => {
  try {
    const { nom, equipe1_score = 0, equipe2_score = 0 } = req.body;
    const id = uuidv4();

    const result = await pool.query(
      `INSERT INTO parties (id, nom, statut, equipe1_score, equipe2_score) 
       VALUES ($1, $2, 'en_cours', $3, $4) RETURNING *`,
      [id, nom, equipe1_score, equipe2_score]
    );

    const partie = result.rows[0];
    broadcastPartiesUpdate(clients, { type: 'partie_created', partie });
    res.status(201).json(partie);
  } catch (err) {
    console.error('Erreur POST /api/parties:', err);
    res.status(500).json({ error: 'Erreur lors de la création' });
  }
});

// PUT - Terminer une partie
app.put('/api/parties/:id/terminer', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `UPDATE parties SET statut = 'termine', date_fin = CURRENT_TIMESTAMP 
       WHERE id = $1 RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Partie non trouvée' });
    }

    const partie = result.rows[0];
    broadcastPartiesUpdate(clients, { type: 'partie_updated', partie });
    res.json(partie);
  } catch (err) {
    console.error('Erreur PUT /api/parties/:id/terminer:', err);
    res.status(500).json({ error: 'Erreur lors de la mise à jour' });
  }
});

// PUT - Mettre à jour les scores
app.put('/api/parties/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { equipe1_score, equipe2_score } = req.body;

    const result = await pool.query(
      `UPDATE parties SET equipe1_score = $1, equipe2_score = $2 
       WHERE id = $3 RETURNING *`,
      [equipe1_score, equipe2_score, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Partie non trouvée' });
    }

    const partie = result.rows[0];
    broadcastPartiesUpdate(clients, { type: 'partie_updated', partie });
    res.json(partie);
  } catch (err) {
    console.error('Erreur PUT /api/parties/:id:', err);
    res.status(500).json({ error: 'Erreur lors de la mise à jour' });
  }
});

// DELETE - Supprimer une partie
app.delete('/api/parties/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM parties WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Partie non trouvée' });
    }

    broadcastPartiesUpdate(clients, { type: 'partie_deleted', id });
    res.json({ message: 'Partie supprimée' });
  } catch (err) {
    console.error('Erreur DELETE /api/parties/:id:', err);
    res.status(500).json({ error: 'Erreur lors de la suppression' });
  }
});

// Démarrer le serveur
const PORT = process.env.PORT || 3000;
initDatabase().then(() => {
  server.listen(PORT, () => {
    console.log(` Serveur lancé sur http://localhost:${PORT}`);
  });
}).catch((err) => {
  console.error('Erreur lors du démarrage:', err);
  process.exit(1);
});
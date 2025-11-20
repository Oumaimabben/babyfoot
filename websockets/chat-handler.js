export function setupChatHandler(wss, pool) {
  const chatClients = new Set();

  wss.on('connection', (ws) => {
    chatClients.add(ws);

    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message);
        
        if (data.type === 'chat_message') {
          const result = await pool.query(
  `INSERT INTO messages (contenu, user_name, created_at) 
   VALUES ($1, $2, CURRENT_TIMESTAMP) RETURNING *`,
  [data.contenu, data.user_name || 'Anonyme']
);
          const messageToSend = {
  ...result.rows[0]
};
          broadcastChatMessage(chatClients, {
            type: 'chat_message_received',
            message: messageToSend
          });
        }
      } catch (err) {
        console.error('Erreur traitement message chat:', err);
        console.error('Données reçues:', message.toString());
      }
    });

    ws.on('close', () => {
      chatClients.delete(ws);
    });
    
    ws.on('error', (error) => {
      console.error('Erreur WebSocket chat:', error);
      chatClients.delete(ws);
    });
  });

  return { chatClients };
}

export function broadcastChatMessage(chatClients, data) {
  const message = JSON.stringify(data);
  chatClients.forEach((ws) => {
    if (ws.readyState === 1) { 
      try {
        ws.send(message);
      } catch (err) {
        console.error('Erreur lors de l\'envoi du message:', err);
      }
    }
  });
}

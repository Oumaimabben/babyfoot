export function setupWebSocketHandler(wss) {
  const clients = new Set();

  wss.on('connection', (ws) => {
    console.log('✓ Client connecté');
    clients.add(ws);

    ws.on('close', () => {
      clients.delete(ws);
      console.log('✗ Client déconnecté');
    });

    ws.on('error', (err) => {
      console.error('Erreur WebSocket:', err);
    });
  });

  return { clients };
}

export function broadcastUpdate(clients, data) {
  clients.forEach((ws) => {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(data));
    }
  });
}

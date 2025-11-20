# BabyFoot Manager

Collaborative real-time foosball game management application with integrated chat, without page reload.

## Features

- Create a game
- Delete a game
- End a game
- Differentiate completed games
- Counter for ongoing games
- Real-time synchronization across all clients
- Integrated chat with persistent messages

## Prerequisites

- Node.js = v20.19.4
- PostgreSQL = 16.10

## Installation

### 1. Clone the project
```bash
git clone https://github.com/Oumaimabben/babyfoot.git
cd babyfoot-manager
```

### 2. Install dependencies
```bash
npm install
```

### 3. Configure PostgreSQL
```bash
# Create the database
createdb babyfoot

# Or if you're using a password
psql -U postgres -c "CREATE DATABASE babyfoot;"
```

### 4. Configure environment variables
Create a `.env` file at the project root:
```bash
DB_USER=postgres
DB_PASSWORD=12345
DB_HOST=localhost
DB_PORT=5432
DB_NAME=babyfoot
PORT=3000
```

### 5. Run the application
```bash
npm run dev
```

The application is accessible at `http://localhost:3000`

## Architecture

### Backend (Node.js + Express)
- **server.js**: Express server with WebSocket and REST API
- **websockets/**: Directory containing separate WebSocket handlers
  - `handler.js`: Generic WebSocket handler that centralizes connections/disconnections and allows sending global notifications.
  - `parties-handler.js`: Manages WebSocket connections related to games and broadcasts real-time updates of rooms or game states.
  - `chat-handler.js`: Manages chat message reception, saves them to PostgreSQL database (raw SQL queries) and broadcasts them in real-time to all connected clients.

### Frontend (Vanilla JavaScript)
- **public/index.html**: HTML structure with game and chat sections
- **public/styles.css**: Responsive styling with flexbox layout
- **public/app.js**: Client logic with WebSocket and chat management

### Database (PostgreSQL)

#### `parties` Table
- `id` (UUID, primary key)
- `nom` (VARCHAR)
- `statut` (en_cours / termine)
- `date_creation` (TIMESTAMP)
- `date_fin` (TIMESTAMP)
- `equipe1_score` (INTEGER)
- `equipe2_score` (INTEGER)
- `created_at` (TIMESTAMP)

#### `messages` Table (Chat)
- `id` (UUID, primary key)
- `contenu` (TEXT)
- `user_name` (VARCHAR)
- `created_at` (TIMESTAMP)

## Usage

### Managing games
1. Enter a game name and click "Create"
2. Update both teams' scores in real-time
3. Click "End" to finish the game
4. Changes synchronize in real-time across all browsers
5. Click "Delete" to remove a game

### Using the chat
1. Enter your name (optional, "Anonymous" by default)
2. Write your message in the chat field
3. Click "Send"
4. The message displays instantly for all connected users
5. Messages are persistent in the database

## Technologies Used

- **Backend:** Node.js, Express, WebSocket
- **Frontend:** Vanilla JavaScript (no framework)
- **Database:** PostgreSQL
- **Communication:** REST API + WebSocket
- **No ORM:** Direct SQL queries

## Folder Structure

```
babyfoot_manager/
├── server.js                 # Server entry point
├── websockets/
│   ├── chat-handler.js       # WebSocket chat management
│   ├── parties-handler.js    # WebSocket game management
│   └── handler.js            # Generic WebSocket handler
├── public/
│   ├── index.html            # User interface
│   ├── app.js                # Client-side logic
│   └── styles.css            # Application styles
├── package.json              # NPM dependencies + scripts
├── package-lock.json         # Dependencies lock file
├── .env                      # Environment variables
├── .gitignore                # Files ignored by Git
└── README.md                 # Documentation
```

## Real-Time Synchronization

Synchronization is managed by two WebSocket connections:

1. **Games**: Any game creation, modification, or deletion is instantly propagated to all clients
2. **Chat**: All messages are sent in real-time and saved to the database


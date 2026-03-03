# E2EE Chat

A **full-stack End-to-End Encrypted chat application** with real-time messaging, group chats, message delivery/read receipts, and a WhatsApp-style UI.

---

## Features

- 🔐 **End-to-End Encryption** — RSA-OAEP + AES-GCM hybrid encryption. Messages are encrypted in the browser; the server never sees plaintext.
- 👤 **Auth** — Username + password (bcrypt-hashed). Unique username enforcement with live availability check and auto-suggestions.
- 💬 **Direct Messages** — Real-time encrypted 1-on-1 chat.
- 👥 **Group Chats** — Encrypted group messaging where each member gets their own wrapped AES key.
- ✅ **Message Status** — Sent → Delivered → Read ticks (like WhatsApp).
- 🔴 **Unread Badges** — Green count bubble on sidebar contacts for unread messages.
- 📦 **Offline Message Delivery** — Messages stored in MongoDB; fetched and decrypted on next login.
- 🟢 **Online Status** — Live online/offline indicator per contact.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite |
| Styling | Vanilla CSS (WhatsApp-style) |
| Encryption | Web Crypto API (RSA-OAEP + AES-GCM) |
| Backend | Node.js + Express + Socket.io |
| Database | MongoDB (via Mongoose) |
| Cache / Pub-Sub | Redis (via ioredis) |
| Job Queue | BullMQ |
| Auth | JWT + bcrypt |
| Infrastructure | Docker + Docker Compose |

---

## Project Structure

```
E2ee-chat/
├── backend/
│   ├── src/
│   │   ├── api/
│   │   │   └── server.js          # Express + Socket.io server
│   │   ├── worker/
│   │   │   └── worker.js          # BullMQ worker (message persistence)
│   │   ├── models/
│   │   │   ├── user.model.js      # User schema (username, password hash, publicKey)
│   │   │   ├── message.model.js   # Message schema (encrypted payload, status)
│   │   │   └── group.model.js     # Group schema (members, groupId)
│   │   └── config/
│   │       ├── redis.js           # Redis connection
│   │       └── queue.js           # BullMQ queue setup
│   ├── Dockerfile.api
│   ├── Dockerfile.worker
│   ├── docker-compose.yml
│   └── package.json
│
└── frontend/
    ├── src/
    │   ├── App.jsx                # Root component — state & logic only
    │   ├── components/
    │   │   ├── AuthScreen.jsx     # Login / Register form
    │   │   ├── Sidebar.jsx        # Contact list + unread badges
    │   │   └── ChatPane.jsx       # Messages + compose bar
    │   ├── utils/
    │   │   └── crypto.js          # All E2EE crypto functions
    │   ├── App.css                # WhatsApp-style layout
    │   └── main.jsx
    └── package.json
```

---

## Running Locally

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- [Node.js 18+](https://nodejs.org/)

### 1. Start backend (Redis + MongoDB + API + Worker)
```bash
cd backend
docker-compose up -d
```

### 2. Start frontend
```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173** in your browser.

---

## How Encryption Works

1. On registration, the browser generates an **RSA-2048 key pair**. The public key is uploaded to the server; the private key stays in `localStorage`.
2. When sending a message, the browser generates a random **AES-256-GCM key**, encrypts the message with it, then encrypts the AES key with the **recipient's RSA public key**.
3. The server stores and forwards only the encrypted ciphertext — it cannot read any messages.
4. The recipient decrypts the AES key with their **RSA private key**, then decrypts the message.

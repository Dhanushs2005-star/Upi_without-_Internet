# 📦 UPI Offline Mesh (MERN Stack)

> **An offline‑first, delay‑tolerant peer‑to‑peer payment routing engine built on the MERN stack.**  
> Enables UPI‑style transactions when there is **zero network connectivity** (basements, underground parking, disaster zones, remote villages) by routing encrypted payment packets through an ad‑hoc Bluetooth mesh simulation and settling them only when a device regains internet access.

---  

## 🎯 What Problem Does This Solve?

- **UPI processes > 14 billion transactions/month** but requires an active internet connection on both ends.  
- In connectivity‑dead zones the payment flow stalls, locking users out of digital commerce.  

**UPI Offline Mesh** decouples **payment origination** from **settlement**:

1. **Offline Origination** – Sender creates a payment instruction, encrypts it with **Hybrid RSA‑OAEP + AES‑256‑GCM**, and injects it into a simulated Bluetooth mesh.  
2. **Delay‑Tolerant Mesh (DTN)** – The packet hops peer‑to‑peer across strangers’ phones using an epidemic gossip protocol (TTL‑limited).  
3. **Bridge Uplink** – When any device exits the dead zone and gets 4G/Wi‑Fi, it POSTs the packet to the backend.  
4. **Exactly‑Once Settlement** – The server validates integrity, checks freshness, and atomically settles the payment in MongoDB, guaranteeing **no double‑spend** even under concurrent bridge uploads.  

All UI updates are streamed in real time via **Socket.IO**.

---  

## 📐 Architecture Overview  

```
┌─────────────────────────────────────────────────────────────────────┐
│                    SENDER PHONE (offline)                          │
│  1️⃣ Build PaymentInstruction {sender,receiver,amount,nonce,…}       │
│  2️⃣ Hybrid encrypt → [ RSA‑OAEP encrypted AES key ][ IV ][ AES‑GCM │
│       ciphertext + auth tag ] (Base64)                              │
│  3️⃣ Wrap into MeshPacket {packetId, ttl:5, createdAt, ciphertext}   │
└───────────────────────┬─────────────────────────────────────────────┘
                        │ BLE Epidemic Gossip (TTL‑decremented)
                        ▼
   ┌───────────────────┐   ┌───────────────────┐   ┌───────────────────┐
   │ Stranger Phone 1  │──▶│ Stranger Phone 2  │──▶│ Bridge Node (online)│
   └───────────────────┘   └───────────────────┘   └───────┬─────────────┘
                                                          │ HTTPS POST
                                                          ▼
                                 ┌─────────────────────────────────────┐
                                 │   NODE.JS / EXPRESS SETTLEMENT ENGINE │
                                 │   1️⃣ SHA‑256 hash of ciphertext        │
                                 │   2️⃣ Atomic CAS claim on hash (idempotency)│
                                 │   3️⃣ RSA‑OAEP decrypt AES key          │
                                 │   4️⃣ AES‑GCM decrypt & auth‑tag verify│
                                 │   5️⃣ Freshness (signedAt < 24 h)       │
                                 │   6️⃣ MongoDB atomic debit/credit +     │
                                 │      unique packetHash index           │
                                 │   7️⃣ Emit Socket.IO events (balances,│
                                 │      ledger, activity log)             │
                                 └─────────────────────────────────────┘
```


## 🛠️ Tech Stack

| Layer | Technology | Why |
|------|------------|-----|
| **Backend** | Node.js 18+, Express 4.21, Socket.IO 4.8, **MongoDB** (Mongoose) | Event‑driven I/O, easy WebSocket integration, atomic conditional updates (`$inc` with `$gte`) and unique indexes for idempotency |
| **Crypto** | Node `crypto` (RSA‑2048 OAEP, AES‑256‑GCM) | Hybrid encryption provides confidentiality + integrity while keeping payload size manageable |
| **Frontend** | React 19, Vite 8, Tailwind CSS v4, Lucide React, Socket.IO client | Fast dev server, utility‑first styling, real‑time UI updates without polling |
| **DevOps** | npm scripts, nodemon, Docker‑compatible `Dockerfile` (optional) | Simple one‑command dev experience |

---  

## 🚀 Quick Start (Local Development)

> **Prerequisites**  
> - **Node ≥ 18** (`node -v`)  
> - **MongoDB** running locally on port 27017  
>   - *Docker:* `docker run -d -p 27017:27017 --name upi-mongo mongo:latest`

### 1. Backend

```bash
# Clone the repo (if you haven't already)
git clone https://github.com/yourusername/upi-offline-mesh.git
cd upi-offline-mesh/mern-app/backend

# Install deps
npm install

# Start (development mode, hot‑reload)
npm run dev
# Server listens on http://localhost:5000
```

The backend seeds three demo accounts (`alice@demo`, `bob@demo`, `charlie@demo`) with a generous balance.

### 2. Frontend

Open a second terminal:

```bash
cd ../../frontend

npm install
npm run dev
```

Open **http://localhost:5173** in your browser.  
You’ll see the dark‑theme dashboard with controls:

- **Inject Payment** – creates an encrypted packet on the simulated “offline” device.  
- **Run Gossip** – triggers one epidemic round, spreading the packet across virtual devices.  
- **Flush Bridges** – forces any bridge node that has internet to upload its packets.  
- **Reset Mesh** – clears all buffers, balances, and idempotency cache.

### 3. Running the Test Suite

```bash
cd ../backend

# Full integration test (includes Socket.IO, mesh, settlement)
npm test

# Individual focused tests
npm run test:crypto      # Hybrid encryption round‑trip & tamper detection
npm run test:mesh        # Gossip propagation & duplicate‑storm handling
npm run test:settlement  # Atomic debit/credit + unique packetHash enforcement
npm run test:api         # Basic REST endpoint sanity checks
```

All tests should pass on a fresh machine.  

---  

## 📡 API Reference

| Method | Path | Body / Params | Description |
|--------|------|---------------|-------------|
| `GET` | `/api/server-key` | – | Returns the RSA‑2048 public key (Base64 PEM). |
| `GET` | `/api/accounts` | – | List all accounts with current balances. |
| `GET` | `/api/transactions` | – | Last 20 settled/rejected transactions (sorted newest first). |
| `GET` | `/api/mesh/state` | – | Current state of every virtual device (packet buffers, TTLs, cache size). |
| `POST` | `/api/demo/send` | `{senderVpa,receiverVpa,amount}` | Simulate an offline sender creating a payment; returns the generated packet ID. |
| `POST` | `/api/mesh/gossip` | – | Run **one** gossip round (epidemic broadcast). |
| `POST` | `/api/mesh/flush` | – | All bridge nodes upload held packets to `/api/bridge/ingest`. |
| `POST` | `/api/mesh/reset` | – | Clears device buffers, resets account balances, and empties the idempotency cache. |
| `POST` | `/api/bridge/ingest` | See *Bridge Ingestion Contract* below | Core settlement endpoint used by bridge devices. |

### Bridge Ingestion Contract (`POST /api/bridge/ingest`)

**Headers**

```http
Content-Type: application/json
X-Bridge-Node-Id: phone-bridge-42   # identifier of the uploading device
X-Hop-Count: 3                     # number of hops the packet traversed
```

**Payload**

```json
{
  "packetId": "d3b07384-d113-49d9-bb4b-3d607ebae3d8",
  "ttl": 2,
  "createdAt": 1727092800000,
  "ciphertext": "BASE64_ENCODED_RSA_AES_BLOB"
}
```

**Responses**

| Outcome | HTTP 200 body (JSON) |
|---------|----------------------|
| `SETTLED` | `{ "outcome":"SETTLED", "packetHash":"…", "transactionId":"…" }` |
| `DUPLICATE_DROPPED` | `{ "outcome":"DUPLICATE_DROPPED", "packetHash":"…" }` |
| `INVALID` (tampered, stale, malformed) | `{ "outcome":"INVALID", "reason":"<explanation>" }` |

---  

## 📦 Real‑Time Socket.IO Events (pushed from server)

| Event | Payload | Meaning |
|------|---------|---------|
| `mesh:state` | `{ devices:[...], idempotencyCacheSize:number }` | Updated mesh topology after each gossip/flush. |
| `accounts:update` | `{ accounts:[{vpa,balance},…] }` | Live balance changes. |
| `transactions:update` | `{ transactions:[…] }` | New ledger rows (settled or rejected). |
| `activity:log` | `{ ts, level, message, details? }` | Human‑readable audit trail displayed in the UI. |

---  

## 🧩 Core Engineering Challenges (and How We Solved Them)

| Challenge | Solution |
|-----------|----------|
| **Untrusted Intermediaries** – strangers’ phones must not read or modify the payment. | **Hybrid Cryptography**: AES‑256‑GCM (confidential + authenticated) + RSA‑2048 OAEP key‑wrap. Any bit flip fails GCM auth tag verification. |
| **Duplicate‑Storm (Concurrent Bridge Uploads)** – multiple devices may upload identical packets at the same millisecond. | **Pre‑decryption Idempotency Cache** (`SHA‑256(ciphertext)` claim via atomic `putIfAbsent`). Fallback: unique MongoDB index on `packetHash`. |
| **Replay Attacks** – captured packet replayed later. | **Nonce + Freshness Window**: each instruction embeds a UUID nonce and `signedAt` timestamp; backend rejects packets older than 24 h. |
| **Exactly‑Once Settlement with MongoDB** | **Atomic Conditional Debit** (`$gte` balance check) + **Version Increment** for optimistic concurrency; unique `packetHash` prevents DB‑level duplicates. |
| **Real‑Time Visibility** | **Socket.IO** pushes mesh state, balances, and ledger updates instantly to the React UI (no polling). |

---  

## 📄 Project Structure

```
UPI_Without_Internet/
├─ README.md                     ← **this file**
└─ mern-app/
   ├─ backend/
   │   ├─ src/
   │   │   ├─ config/            ← MongoDB connection
   │   │   ├─ crypto/
   │   │   │   ├─ hybridCrypto.js   ← Hybrid RSA‑OAEP + AES‑GCM
   │   │   │   └─ keyHolder.js      ← RSA‑2048 keypair generation
   │   │   ├─ models/
   │   │   │   ├─ Account.js
   │   │   │   └─ Transaction.js
   │   │   ├─ routes/
   │   │   │   └─ apiRoutes.js
   │   │   ├─ services/
   │   │   │   ├─ bridgeService.js   ← `/api/bridge/ingest` pipeline
   │   │   │   ├─ demoService.js
   │   │   │   ├─ idempotencyService.js
   │   │   │   ├─ meshService.js      ← Gossip & device buffers
   │   │   │   └─ settlementService.js
   │   │   ├─ sockets/
   │   │   │   └─ socketHandler.js   ← Socket.IO broadcast hub
   │   │   └─ server.js               ← Express + Socket.IO entry point
   │   ├─ test/
   │   │   ├─ testApiEndpoints.js
   │   │   ├─ testCrypto.js
   │   │   ├─ testFullApp.js
   │   │   ├─ testMeshAndIdempotency.js
   │   │   └─ testSettlementAndBridge.js
   │   ├─ package.json
   │   └─ .env
   └─ frontend/
       ├─ src/
       │   ├─ components/
       │   │   ├─ AccountBalances.jsx
       │   │   ├─ ActivityLog.jsx
       │   │   ├─ DemoControls.jsx
       │   │   ├─ MeshVisualizer.jsx
       │   │   ├─ Navbar.jsx
       │   │   └─ TransactionLedger.jsx
       │   ├─ App.jsx
       │   ├─ socket.js
       │   ├─ index.css
       │   └─ main.jsx
       ├─ package.json
       └─ vite.config.js
```

---  


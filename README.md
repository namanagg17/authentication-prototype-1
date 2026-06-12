# Unified Authentication System (Prototype 1)

This repository implements Prototype 1 for the research project on Unified Authentication Systems, demonstrating **Centralized Authentication** and **Distributed Authorization** using a Node.js/Express backend, React frontend, PostgreSQL database, and RS256 JWT signatures.

## Project Structure
```
├── idp/                       # Central Identity Provider (Port 3000)
│   ├── keys/                  # Auto-generated RSA Private/Public keys
│   ├── db.js                  # Database connection, table init, and seeding
│   ├── server.js              # Express backend exposing OIDC endpoints
│   └── frontend/              # React login and SSO session portal
│
├── shopping-service/          # Shopping Service (Port 3001)
│   ├── server.js              # Express backend verifying JWT signature
│   └── frontend/              # React catalog showing products
│
├── prime-service/             # Prime Service (Port 3002)
│   ├── server.js              # Express backend enforcing 'role = premium'
│   └── frontend/              # React streaming video player mock / paywall gate
│
├── music-service/             # Music Service (Port 3003)
│   ├── server.js              # Express backend filtering tracks dynamically
│   └── frontend/              # React player displaying locked/unlocked songs
│
└── install-and-build.sh       # Script to install packages and compile frontends
```

---

## Getting Started

### 1. Database Setup
Ensure that PostgreSQL is installed and running locally. The IdP server connects on default port `5432` with your system user credentials and will automatically check, create, and seed `unified_auth_db` with mock credentials.
* Start Postgres: `brew services start postgresql@16`

### 2. Automatic Dependency Setup & Compilation
Run the setup script from the root folder to download all dependencies and compile the frontend React single-page applications:
```bash
./install-and-build.sh
```

### 3. Running the Services
Open 4 terminal shells and start the respective servers inside their directories:
```bash
# Terminal 1
cd idp && node server.js

# Terminal 2
cd shopping-service && node server.js

# Terminal 3
cd prime-service && node server.js

# Terminal 4
cd music-service && node server.js
```

---

## Test Accounts (Seeded Automatically)
Use these credentials on the central login portal `http://localhost:3000` or when accessing any of the client services:

* **Premium Account:**
  * **Email:** `premium@email.com`
  * **Password:** `password123`
  * **Role:** `premium` (Allows access to Prime Service, premium tracks in Music, and Shopping)
* **Free Account:**
  * **Email:** `free@email.com`
  * **Password:** `password123`
  * **Role:** `free` (Denies access to Prime Service, locks premium tracks in Music, allows access to Shopping)

---

## Authentication Flow

1. User attempts to access a client application (Prime, Music, or Shopping).
2. Client redirects unauthenticated users to the Central Identity Provider (IdP).
3. User authenticates using credentials stored in PostgreSQL.
4. IdP creates a centralized session and stores a refresh token in the database.
5. IdP issues a short-lived authorization code.
6. Client exchanges the authorization code for RS256-signed JWT tokens.
7. Services validate JWT signatures using the IdP public key.
8. Authorization decisions are enforced independently by each service based on user role claims.


## Architecture Characteristics

### Centralized Authentication
- Single Identity Provider (IdP) manages login and session lifecycle.
- User credentials and sessions are maintained centrally.
- Single Sign-On (SSO) experience across all services.

### Distributed Authorization
- Each service independently validates JWT signatures.
- Services enforce their own authorization rules.
- No authorization lookups are required from the IdP after token issuance.

### Security Mechanisms
- RS256 asymmetric JWT signing.
- Public key distribution endpoint for signature verification.
- HTTP-only session cookies.
- Authorization Code flow using short-lived authorization codes.
- PostgreSQL-backed session persistence.

---

## Current Limitations

The current implementation is intended as a functional prototype for architectural evaluation and research.

Known limitations include:

- Authorization codes are stored in memory using a JavaScript Map and do not support horizontal scaling of the Identity Provider.
- Service discovery currently relies on localhost-based configuration.
- Redirect URIs are statically configured.
- CORS configuration is development-focused.
- Session cookies currently use secure: false for local development.
- Docker deployment and container orchestration are currently being implemented.
- Quantitative performance measurements and deployment benchmarking are still in progress.

---

## Future Improvements

- Containerize all services using Docker and Docker Compose.
- Replace in-memory authorization code storage with a shared datastore.
- Introduce environment-based service discovery.
- Improve production security settings and HTTPS support.
- Collect quantitative metrics for latency, scalability, and operational complexity.
- Compare Prototype 1 against alternative authentication architectures developed during the project.
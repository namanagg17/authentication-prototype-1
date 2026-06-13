# Unified Authentication System (Prototype 1)

## Overview

Prototype 1 demonstrates Centralized Authentication and Distributed Authorization using:

- Node.js + Express microservices
- React frontends
- PostgreSQL session storage
- RS256 JWT signing and verification
- Docker containerization
- Docker Compose orchestration

### Architecture

text                     PostgreSQL                          │                          ▼                Identity Provider (IdP)                          │       ┌──────────────────┼──────────────────┐       │                  │                  │       ▼                  ▼                  ▼  Prime Service      Music Service    Shopping Service 

### Authentication Model

- Authentication is centralized through the Identity Provider (IdP).
- User sessions are stored in PostgreSQL.
- Authorization codes are exchanged for JWTs signed using RS256.
- Services fetch and cache the IdP public key.
- Authorization decisions are made independently by each service.

### Services

| Service | Port | Purpose |
|----------|------|----------|
| IdP | 3000 | Authentication and token issuance |
| Shopping | 3001 | General authenticated shopping portal |
| Prime | 3002 | Premium-only content service |
| Music | 3003 | Role-based content filtering |

---

## Running with Docker

### Start Entire System

bash docker compose up --build 

### Stop System

bash docker compose down 

### View Running Containers

bash docker ps 

---

## Test Accounts

### Premium User

Email:
premium@email.com

Password:
password123

Role:
premium

### Free User

Email:
free@email.com

Password:
password123

Role:
free

---

## Key Deployment Findings

During containerization the following architectural issues were identified:

1. Localhost coupling between services.
2. Internal service URLs and browser-facing URLs required separation.
3. Hardcoded redirect URI assumptions reduced deployment flexibility.
4. In-memory authorization code storage prevents horizontal IdP scaling.
5. CORS configuration assumes localhost-based deployment.

These findings were documented as part of the deployment analysis for Prototype 1.
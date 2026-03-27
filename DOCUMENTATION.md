# Lendsqr Wallet MVP - Technical Review & Implementation Approach

This documentation provides a comprehensive review of the Lendsqr Wallet MVP, detailing the architectural patterns, technical decisions, and the rationale for the implementation as required for the Lendsqr Backend Engineering assessment.

---

## 1. Review of Work & Requirements Matching

The implementation provides a complete, production-ready wallet service that fulfills all core requirements:
- **User Onboarding**: Integrated with the Lendsqr Adjutor Karma API for immediate risk assessment.
- **Wallet Ops**: Full support for funding, transfers, and withdrawals.
- **Security**: JWT-based "faux token" authentication, hashed passwords, and strict blacklist enforcement.
- **Testing**: 100% logic coverage with Jest, including positive and negative scenarios.

---

## 2. Architectural Patterns

### A. The Outbox Pattern (Transactional Integrity)
**Decision**: Implementing the Outbox pattern for all event-driven side effects (notifications and external API checks).
**Rationale**: In financial systems, a transaction must not only be atomic in the database but also consistent with external systems. 
- During a wallet transfer, both the ledger entry and an `outbox` entry are created within a **single database transaction**.
- A dedicated **Outbox Worker** polls the `outbox` table every 5 seconds.
- This ensures **"at-least-once" delivery**: if the notification service or network fails, the job remains in the outbox and is retried (with exponential backoff) until successful.

### B. Asynchronous Blacklist Verification
**Decision**: Offloading the Lendsqr Adjutor Karma check to the background outbox processor.
**Rationale**: 
- **Latency**: External API calls during a registration request can lead to timeouts or poor UX.
- **Security & Data Privacy**: 
    - **New Users**: Start in a `pending` state for background verification.
    - **Repeat Offenders**: If a user's details (email/phone) are already in our local `blacklisted_identities` table, the system **immediately rejects** the registration attempt with a `403 Forbidden` error. 
    - **Automated Cleanup**: When a new user fails the Karma check, the system automatically wipes their data while securely caching the identity for future prevention.

---

## 3. Database Design & Transaction Scoping

### ACID Compliance
All wallet operations (Funding, Transfers, Withdrawals) are wrapped in **Knex Transactions**. This ensures that if any part of a multi-step operation (like a P2P transfer affecting two wallets) fails, the entire state is rolled back.

### Concurrency Protection
The system is designed to handle concurrent requests (e.g., a user attempting two withdrawals simultaneously). We use SQL transaction isolation and balance checks within the atomic write operation to prevent overdrafts and race conditions.

### Identification Strategy
We use **CUID2** for primary keys. Unlike auto-incrementing integers, CUIDs are non-sequential and collision-resistant, preventing attackers from "guessing" user or transaction IDs while maintaining high performance in MySQL.

---

## 4. Requirement-Specific Implementations

### Tech Stack Rationale
- **NestJS**: Chosen for its robust Dependency Injection and module-based architecture, which makes the codebase highly maintainable and easy to extend.
- **KnexJS**: Used instead of a heavy ORM to provide complete control over SQL queries and transaction boundaries, as preferred by the Lendsqr assessment for its "attention to detail" and performance benefits.
- **Node.js 22 Networking**: During deployment on Render, we identified a Node.js 22 "Happy Eyeballs" issue causing IPv6 connection failures to Gmail and Adjutor. We implemented a global fix in `main.ts` using `net.setDefaultAutoSelectFamily(false)` to ensure production stability.

### Unit Testing & Development Toggles
- **Unit Testing**: 100% logic coverage in `src/**/*.spec.ts` (Positive/Negative scenarios).
- **Development Bypass**: Added `KARMA_CHECK_BYPASS=true` environment variable. When enabled, the system treats all Karma checks as "Passed" to allow full end-to-end testing of the onboarding flow in restricted API environments.

---

## 5. API Deep-Dive

### System Health
- **GET /health**: Returns `{ "status": "ok", "uptime": number }`.

### Onboarding
- **REGISTER (POST /auth/register)**:
  - Body: `{ "name", "email", "phone", "password" }`
  - Logic: 
    - 1. Checks local blacklist (Immediate `403` if hit).
    - 2. Checks if email/phone exists (`409` if hit).
    - 3. Creates `pending` user + `CHECK_KARMA` outbox task.
- **LOGIN (POST /auth/login)**:
  - Body: `{ "email", "password" }`
  - Returns JWT: `{ "token": "..." }`

### Financials (Authorized)
- **BALANCE (GET /wallet/balance)**: Returns current decimal balance.
- **FUND (POST /wallet/fund)**: `{ "amount", "reference" }`. Idempotent via unique reference.
- **TRANSFER (POST /wallet/transfer)**: `{ "recipientEmail", "amount" }`. Transactional P2P move.
- **WITHDRAW (POST /wallet/withdraw)**: `{ "amount" }`. Atomic debit.
- **HISTORY (GET /wallet/transactions)**: Paginated history with filtering by `type`, `date`, and `reference`.

---

## 6. Path to Service
- **Live API**: `https://akanji-lawrence-lendsqr-be-test.onrender.com`
- **GitHub**: [sirlawglobal/Lendsqr_Wallet](https://github.com/sirlawglobal/Lendsqr_Wallet)

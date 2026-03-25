# Lendsqr Wallet MVP - Implementation Review & Technical Documentation

This document provides a detailed overview of the Lendsqr Wallet MVP implementation, explaining the architectural decisions, technology choices, and the rationale behind the final outcome.

## 1. Review of Work

The Lendsqr Wallet MVP is a robust, secure, and scalable wallet service built using NestJS. It implements core financial operations including account creation, funding, peer-to-peer transfers, and withdrawals. The project adheres to modern software engineering practices, ensuring high code quality, maintainability, and security.

### Key Accomplishments:
- **Scalable Architecture**: Modular NestJS design with clear separation of concerns.
- **Robust Security**: Hashed passwords (bcrypt), JWT-based authentication, and request throttling.
- **External Integration**: Parallel verification against the Lendsqr Adjutor Karma API for both phone and email.
- **Reliable Messaging**: Implementation of an **Outbox Pattern** to ensure that wallet-related events (like notifications or external syncs) are processed even if the primary transaction succeeded but the subsequent action failed.
- **Performance Optimization**: In-memory caching for blacklisted identities to reduce redundant API calls.

## 2. Tech Stack & Rationale

| Technology | Purpose | Rationale |
| :--- | :--- | :--- |
| **NestJS (v11)** | Backend Framework | Provides a structured, opinionated framework that promotes clean code, dependency injection, and easy testing. |
| **MySQL 8.0** | Relational Database | Reliable, industry-standard ACID-compliant database for financial transactions. |
| **KnexJS** | Query Builder | Offers fine-grained control over SQL queries compared to heavy ORMs, while providing a powerful migration system and type-safe query building. |
| **JWT** | Authentication | Stateless, secure way to handle user sessions across multiple requests. |
| **CUID2** | ID Generation | Provides secure, collision-resistant, and URL-friendly unique identifiers for users and entities, superior to standard UUIDs for database performance. |
| **Cache Manager** | Caching | Used to store Karma API results and blacklists, significantly improving registration speed and reducing external API load. |
| **Nodemailer** | Email | reliable way to send transaction notifications (via the outbox processor). |

## 3. Key Decisions & Rationale

### Outbox Pattern for Transactions
**Decision**: Every wallet transaction (fund, transfer, withdraw) triggers an entry in the `outbox` table within the same database transaction.
**Reason**: This ensures "at-least-once" delivery of events. If the server crashes after updating the balance but before sending a notification, the Outbox Processor (a background task) will find the pending event and retry it. This is a critical pattern for financial services.

### Karma API Caching & Parallel Verification
**Decision**: Verify both email and phone number against the Adjutor Karma API in parallel using `Promise.all`, and cache the results.
**Reason**: Parallelization reduces onboarding latency. Caching prevents repeatedly hitting the external API (and consuming credits/quota) for the same identity within a short window.

### CUIDs for User IDs
**Decision**: Using `@paralleldrive/cuid2` for primary keys instead of auto-incrementing integers.
**Reason**: CUIDs are non-sequential, making them more secure (users cannot guess another user's ID) and better for distributed systems where ID generation shouldn't rely on a central database counter.

### Unique Transaction References
**Decision**: Enforce a unique `reference` for every funding and transfer operation.
**Reason**: Prevents duplicate transactions (idempotency) and allows for easier auditing and reconciliation with external payment providers.

## 4. Path to Service

### Base URL
Open the project locally at: `http://localhost:3000`

### API Documentation Overview
The following core endpoints are available:

#### Auth & Onboarding
- `POST /auth/register`: Create a new account.
- `POST /auth/login`: Authenticate and receive a JWT.

#### Wallet Operations
- `GET /wallet/balance`: Check current balance.
- `POST /wallet/fund`: Add funds to your wallet.
- `POST /wallet/transfer`: Transfer funds to another user via email.
- `POST /wallet/withdraw`: Withdraw funds from your wallet.
- `GET /wallet/transactions`: View personal transaction history (supports filtering).
- `GET /wallet/admin/transactions`: View all system transactions (Admin only).

For a detailed list of request bodies and headers, refer to the [README.md](README.md#api-documentation) file.

<div align="center">

# OpsHub API

**The backend for OpsHub — QNSC's internal IT/HR operations orchestration platform.**

A modular NestJS monolith that orchestrates access requests, asset & license management,
workforce data, compliance, and security posture — with AI assistance and Microsoft Entra
integration.

![NestJS](https://img.shields.io/badge/NestJS-11-E0234E?style=flat-square&logo=nestjs&logoColor=white)
![Fastify](https://img.shields.io/badge/Fastify-5-000000?style=flat-square&logo=fastify&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?style=flat-square&logo=typescript&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-18-4169E1?style=flat-square&logo=postgresql&logoColor=white)
![Drizzle](https://img.shields.io/badge/Drizzle-ORM-C5F74F?style=flat-square&logo=drizzle&logoColor=black)
![License](https://img.shields.io/badge/License-Proprietary-red?style=flat-square)

</div>

---

## Overview

OpsHub API is the server-side of the OpsHub platform, consumed by
[`opshub-web`](https://github.com/QNSC-VN/opshub-web). It is a **pnpm + NestJS monorepo**
structured as a **modular monolith**, with two deployable apps — an HTTP **API** and a
background **worker** — over a set of shared libraries and bounded-context modules.

| | |
| :-- | :-- |
| **Framework** | NestJS 11 on Fastify 5 |
| **Language** | TypeScript (strict) |
| **Database** | PostgreSQL 18 + Drizzle ORM |
| **Cache** | Valkey / Redis (optional in dev) |
| **Auth** | ES256 JWT (jose) · Passport · Microsoft Entra ID (OIDC SSO) |
| **Microsoft integration** | Microsoft Graph + Azure Identity (security posture, profiles) |
| **AI** | Anthropic SDK (`@anthropic-ai/sdk`) |
| **Validation** | Zod (`nestjs-zod`, `drizzle-zod`) |
| **Messaging** | AWS SQS (transactional outbox) |
| **Storage / email** | AWS S3 (presigned uploads) · Resend / dev console |
| **Resilience** | Circuit breakers & retries (cockatiel) |
| **Observability** | OpenTelemetry (traces + metrics) · Pino logging · Terminus health checks |
| **API docs** | OpenAPI / Swagger (`@nestjs/swagger`) |
| **Testing** | Vitest + Supertest + Testcontainers |
| **Package manager** | pnpm |

---

## Getting Started

### Prerequisites

- **Node.js 22** (see [`.nvmrc`](./.nvmrc)); engines require Node ≥ 22, pnpm ≥ 9
- **pnpm** (`corepack enable`)
- **Docker** — for the local Postgres + Valkey stack

> **Note on ports:** the dev stack uses Postgres on **5433** and Valkey on **6380** (not the
> defaults) so OpsHub can run alongside other local services such as `rally-api`.

### Setup

```bash
# 1. Install dependencies
pnpm install

# 2. Configure environment
cp .env.example .env
#    Generate an ES256 JWT key pair:
#    openssl ecparam -name prime256v1 -genkey -noout \
#      | openssl pkcs8 -topk8 -nocrypt -out private.pem
#    openssl ec -in private.pem -pubout -out public.pem

# 3. Start infrastructure (Postgres + Valkey)
docker compose -f docker-compose.dev.yml up -d

# 4. Run migrations and seed data
pnpm db:migrate
pnpm db:seed

# 5. Start the API (and, in a second terminal, the worker)
pnpm start:dev
pnpm start:dev:worker
```

The API serves on **http://localhost:3000**. Interactive API docs are at `/api/docs`
(OpenAPI JSON at `/api/docs-json`).

> **Authentication.** In development, a dev-login endpoint issues tokens so you can work
> without SSO. In production, login is via **Microsoft Entra ID (OIDC)** — set `ENTRA_TENANT_ID`
> and `ENTRA_CLIENT_ID`. Azure **App Role** values must match OpsHub role keys
> (`admin`, `it-admin`, `security`, `hr`, `manager`, `helpdesk`, `auditor`).

---

## Available Scripts

| Script | Description |
| :----- | :---------- |
| `pnpm start:dev` | Run the **API** app in watch mode |
| `pnpm start:dev:worker` | Run the **worker** app in watch mode |
| `pnpm start:debug` | Run the API with the inspector attached |
| `pnpm build` | Build both `api` and `worker` apps |
| `pnpm lint` / `pnpm lint:fix` | Lint `apps`, `libs`, `db` |
| `pnpm format` | Format with Prettier |
| `pnpm typecheck` | Type-check without emitting |
| `pnpm test` / `pnpm test:watch` | Run unit tests (Vitest) |
| `pnpm test:cov` | Run tests with coverage |
| `pnpm test:e2e` | Run end-to-end tests (Testcontainers-backed) |
| `pnpm db:generate` | Generate a migration from schema changes (drizzle-kit) |
| `pnpm db:migrate` | Apply pending migrations |
| `pnpm db:seed` | Seed the database |
| `pnpm db:studio` | Open Drizzle Studio (DB browser) |

---

## Architecture

A NestJS **modular monolith** with two deployable applications over a shared library layer:

```
apps/
├── api/        # HTTP application (Fastify) — request handling, auth, REST endpoints
└── worker/     # Background application — cron jobs and outbox dispatch

libs/
├── modules/    # Bounded-context modules:
│               #   access-requests · ai · assets · audit · authz · catalog · compliance
│               #   identity · license · notifications · reports · requests
│               #   security-posture · webhooks · workforce
├── contracts/  # Shared API/event contracts and DTOs
├── platform/   # Cross-cutting infrastructure (db, messaging, storage, config, …)
└── shared-kernel/  # Shared domain primitives used across modules
```

### Event-driven flow

Domain changes are written with a **transactional outbox** and dispatched to **AWS SQS** by
the **worker**, decoupling write paths from side effects (notifications, webhooks, etc.).

### Security & auth

- **ES256 JWT** access tokens (jose), signed cookies, **CSRF protection**, and **Helmet**
  security headers — all via Fastify plugins.
- **Microsoft Entra ID (OIDC)** SSO in production; role-based access via Azure App Roles
  mapped to OpsHub role keys. **Single-tenant** by design.
- **Microsoft Graph** (via Azure Identity) powers security-posture and profile features.

### Database

Drizzle ORM with schema split per bounded context in [`db/schema/`](./db/schema), migrations
in `db/migrations/`. Generate migrations from schema changes with `pnpm db:generate`.

---

## Configuration

All configuration is via environment variables — see [`.env.example`](./.env.example) for the
full, documented list. Key groups: **App**, **Database**, **Auth/JWT**, **Entra SSO**,
**Cache**, **AWS**, **Observability**, **Email**.

> ⚠️ Never commit real secrets. In production, secrets are sourced from AWS Secrets Manager.

---

## Testing

- **Unit** — Vitest (`pnpm test`).
- **End-to-end** — Vitest + Supertest against **Testcontainers** (real Postgres per run) via
  `pnpm test:e2e`.

---

## Code Quality & Workflow

- **ESLint** + **Prettier** across `apps`, `libs`, `db`.
- **Husky + lint-staged** — pre-commit lint + format (`--max-warnings=0`).
- **commitlint** — [Conventional Commits](https://www.conventionalcommits.org/) required.

Open a Pull Request into the default branch; CI and at least one review are required before
merge. See the [organization contribution guidelines and templates](https://github.com/QNSC-VN/.github).

---

## Security

Found a vulnerability? **Do not open a public issue.** Follow [`SECURITY.md`](./SECURITY.md).

---

## License

Proprietary and confidential. © QNSC — Quy Nhon Semiconductor. See [`LICENSE`](./LICENSE).

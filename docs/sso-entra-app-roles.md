# OpsHub SSO — Microsoft Entra ID App Roles Setup

This document describes how to wire **Microsoft Entra ID (Azure AD)** SSO to OpsHub
and, critically, how to define the **Entra App Roles** so they map correctly to
OpsHub's authorization model.

> **TL;DR — the contract:** the Entra App Role **value** you assign to a user must
> be **exactly equal** to an OpsHub **role key**. Entra decides _which role_ a user
> has; the OpsHub database decides _what that role can do_.

---

## 1. Authorization model recap

OpsHub uses a single, database-driven authorization model that both login paths
share:

```
Identity (who you are)              Authorization (what you can do)
────────────────────               ──────────────────────────────
Entra SSO  ──┐                      OpsHub DB: roles → permissions
dev-login  ──┴──► JWT { roles[] } ──► PolicyGuard resolves effective
                                       permissions from role_permissions
```

- **Login** establishes identity and produces a JWT carrying a `roles` claim.
- **Permissions are never taken from the token.** On every request, `PolicyGuard`
  → `AuthzService.resolve()` computes the user's effective permissions from the
  `role_permissions` table in the database.
- The frontend mirrors this: `GET /v1/auth/me` returns the effective
  `permissions[]`, and the SPA gates its UI on that list (it never re-derives
  permissions from role names).

This means: **to grant a capability, you edit the role's permissions in the DB —
never in Azure and never in the frontend.** Azure only assigns _roles_ to people.

---

## 2. The roles (must match between Azure and the DB)

OpsHub ships these system roles (defined in `db/seed.ts`, table `roles.key`):

| Role key (Azure App Role **value** = DB **key**) | Display name           | Scope of authority |
|--------------------------------------------------|------------------------|--------------------|
| `admin`                                          | Platform Administrator | **Super-admin** — holds the `*` wildcard permission. Owns the OpsHub application: RBAC, audit, webhooks, FinOps, every module. Keep this to a small number of people. |
| `it-admin`                                       | IT Administrator       | Day-to-day IT ops: devices, access requests, provisioning. **Does not** control platform RBAC/billing. |
| `security`                                       | Security Officer       | Compliance, security posture, access approvals, audit read. |
| `hr`                                             | HR Manager             | Employee lifecycle, workforce approvals, onboarding/offboarding. |
| `manager`                                        | People Manager         | Team approvals (leave, OT, access step-1), reports. |
| `helpdesk`                                       | Help Desk              | Asset and request handling, directory read. |
| `auditor`                                        | Auditor (read-only)    | Read-only across audit, compliance, reports, directory. |
| `employee`                                       | Employee               | Base role — submit requests, view own data. **Default fallback.** |

> **Separation of duties:** `admin` and `it-admin` are intentionally distinct.
> The person who provisions laptops (`it-admin`) should not automatically be able
> to rewrite who-can-do-what or view billing (`admin`). Do not collapse them.

### Unmapped / unassigned users

If a user signs in via SSO with **no** matching App Role (or an App Role value
that is not one of the keys above), OpsHub assigns them `['employee']` — read-only
base access. This is fail-safe by design; it never grants elevated access on a
mismatch.

---

## 3. Azure Portal — create the App Registration

1. **Azure Portal → Microsoft Entra ID → App registrations → New registration.**
   - Name: `OpsHub`
   - Supported account types: _Accounts in this organizational directory only_
     (single tenant).
   - Redirect URI: **Single-page application (SPA)** →
     - Dev: `http://localhost:5173`
     - Prod: `https://<your-opshub-domain>`
2. Note the **Application (client) ID** and **Directory (tenant) ID** from the
   Overview page — you will need both.
3. **Authentication** → ensure the SPA platform is configured with the redirect
   URI(s). Enable **ID tokens** (implicit/hybrid) if prompted by the SPA flow.

---

## 4. Azure Portal — define the App Roles

**App registration → App roles → Create app role.** Create one role per OpsHub
role you intend to assign (you do **not** need `employee` — it is the fallback).

For each role, set:

| Field                | Value                                                        |
|----------------------|-------------------------------------------------------------|
| Display name         | e.g. `Platform Administrator`                                |
| Allowed member types | **Users/Groups**                                            |
| **Value**            | the OpsHub role key — e.g. `admin` (⚠️ exact, case-sensitive)|
| Description          | e.g. `OpsHub super-admin — full platform control`           |
| Enable this app role | ✅                                                          |

Repeat for: `admin`, `it-admin`, `security`, `hr`, `manager`, `helpdesk`, `auditor`.

> ⚠️ **The `Value` field is the contract.** It is what arrives in the token's
> `roles` claim and must equal the DB role key exactly. `Admin`, `IT-Admin`, or
> `platform_admin` will **not** match and the user will fall back to `employee`.

### Assign people to roles

**Microsoft Entra ID → Enterprise applications → OpsHub → Users and groups →
Add user/group.** Pick the user (or, preferably, a security group) and select the
App Role. Best practice: assign roles to **groups**, then manage membership in the
group — so role changes don't require touching the app.

When IT changes a user's App Role in Azure, it takes effect at the user's **next
sign-in** (OpsHub re-syncs roles from the token on every login).

---

## 5. Configure OpsHub

### Backend (`opshub-api/.env`)

```dotenv
# Microsoft Entra ID SSO (required in production)
ENTRA_TENANT_ID=<directory-tenant-id>
ENTRA_CLIENT_ID=<application-client-id>
# Only needed for Microsoft Graph calls (e.g. security posture, profile photos):
ENTRA_CLIENT_SECRET=<client-secret>
GRAPH_CLIENT_SECRET=<graph-secret-if-different>
```

The backend validates incoming Entra `id_token`s against
`https://login.microsoftonline.com/<tenant>/discovery/v2.0/keys`, checking issuer
and audience (`audience = ENTRA_CLIENT_ID`). See
`libs/modules/identity/src/application/auth.service.ts` → `entraLogin()`.

### Frontend (`opshub-web/.env.local`)

```dotenv
VITE_ENTRA_TENANT_ID=<directory-tenant-id>
VITE_ENTRA_CLIENT_ID=<application-client-id>
```

When **both** are set, the SPA uses the Microsoft redirect login (MSAL) and the
dev login form is never shown. When unset, the app falls back to the dev-login
bypass (see §6). Tenant/client IDs are non-secret and safe to embed in the SPA.

---

## 6. dev-login (local bypass only)

`POST /v1/auth/dev-login` accepts just `{ email }` (no password) and logs in a
**seeded** employee using the roles in `db/seed.ts`. It exists so the app runs
locally without an Azure tenant. It is gated by the absence of the `VITE_ENTRA_*`
vars on the frontend and should never be relied upon in production.

Seeded accounts (all `@opshub.local`, dev-login only): `admin`, `it.admin`,
`security`, `hr`, `manager`, `helpdesk`, `auditor`, and `alice`/`bob`/`carol`
(employees).

---

## 7. Adding or changing what a role can do

- **Change a role's _permissions_** (capabilities): edit `ROLES` in `db/seed.ts`
  (or via the Access Control UI / `authz` API), then it applies everywhere — the
  PolicyGuard and the frontend both read from the DB. Permission cache TTL is
  5 min; `AuthzService.invalidate(userId)` busts it immediately on assignment
  changes.
- **Add a brand-new role**: add it to `db/seed.ts`, create a matching Azure App
  Role with the same `Value`, and (if it should appear in persona UI) add it to
  `ROLE_PRIORITY` / dashboards in the frontend.
- **Never** hardcode role→permission logic in the frontend. The sidebar gates on
  backend permission keys (e.g. `asset.read`, `rbac.read`), not role names.

---

## 8. Checklist before enabling SSO in production

- [ ] App Registration created (single tenant), SPA redirect URI set for the prod domain.
- [ ] App Roles created with **values exactly** matching DB role keys (§2).
- [ ] Users/groups assigned to App Roles in the Enterprise Application.
- [ ] `ENTRA_TENANT_ID` / `ENTRA_CLIENT_ID` set on the API; `VITE_ENTRA_*` set on the web app.
- [ ] Verified a test user in each role lands on the correct dashboard and sees the correct nav.
- [ ] Confirmed an unassigned user falls back to `employee` (read-only), not an error.
- [ ] (If using Graph features) `ENTRA_CLIENT_SECRET` / `GRAPH_CLIENT_SECRET` set and rotated via a secret manager.
```

# Changelog

## [0.2.0](https://github.com/QNSC-VN/opshub-api/compare/opshub-apiv0.1.0...opshub-apiv0.2.0) (2026-06-29)


### ⚠ BREAKING CHANGES

* **authz:** enforce DB-driven permissions and governed role assignment

### ✨ Features

* **auth:** enterprise token lifecycle with Rally-grade refresh tokens ([9fa5f24](https://github.com/QNSC-VN/opshub-api/commit/9fa5f243e4939d00fe34b7837dffa4787cb5ce87))
* **auth:** Entra ID SSO via id_token exchange ([35330cc](https://github.com/QNSC-VN/opshub-api/commit/35330cc5eec2b6d637d68a9420d73cd95d73453d))
* **authz:** enforce DB-driven permissions and governed role assignment ([4714d68](https://github.com/QNSC-VN/opshub-api/commit/4714d683b542d4ecb3a22d84d8a80e33567480aa))
* **authz:** fine-grained RBAC with scoped permissions ([0aea181](https://github.com/QNSC-VN/opshub-api/commit/0aea181880e882d0ca9e7c1089c2a9ccd17ec5e0))
* **deploy:** enterprise-grade CI/CD pipeline ([066d18c](https://github.com/QNSC-VN/opshub-api/commit/066d18c8597573c41cd6fcd2bf89fb3b83fc7266))
* enterprise notification pipeline upgrade ([bf9037e](https://github.com/QNSC-VN/opshub-api/commit/bf9037ed3927f01bae45c6e3214cf1e1b0104ce2))
* **gap5+gap8:** onboarding/offboarding workflows + outbound webhooks ([a708aaf](https://github.com/QNSC-VN/opshub-api/commit/a708aaff0f18b6f5e7a9a3da336fa8f1887f9a66))
* **identity:** employee management CRUD — update profile, status, offboard ([a880c5d](https://github.com/QNSC-VN/opshub-api/commit/a880c5db099dfca5437243d7654a4b017e9a2023))
* initial opshub-api scaffold ([8938a23](https://github.com/QNSC-VN/opshub-api/commit/8938a23551d816297c6e2369abc21ff0f06aa23b))
* **notifications:** add request lifecycle notifications + admin role guard bypass ([db27cc8](https://github.com/QNSC-VN/opshub-api/commit/db27cc88951c660fc60d5fd1a517c4e8965569a5))
* **notifications:** full email + in-app notification system ([b55447f](https://github.com/QNSC-VN/opshub-api/commit/b55447fd39998b017753affbbef704c7ab3a8d7c))
* **platform:** enterprise-grade infra — rate limiting, idempotency, tracing, resilience, pagination ([57521bf](https://github.com/QNSC-VN/opshub-api/commit/57521bf97f318016345e40644eb6772704c31b12))
* **platform:** security posture RBAC, onboarding wizard, feature gates, nav fixes ([a361105](https://github.com/QNSC-VN/opshub-api/commit/a3611058d1e841856bfe1908910870ee50183f8d))
* **reports:** analytics API — request cycle-time, SLA compliance, queue, throughput + compliance + assets + workforce (Gap 7) ([6e9bb3a](https://github.com/QNSC-VN/opshub-api/commit/6e9bb3a9b50b41a5854e299f881e81ff2edaceab))
* **requests:** multi-step approval chains + discussion comments (Gap 4) ([bf887b9](https://github.com/QNSC-VN/opshub-api/commit/bf887b9145d38d390d5d4cc34644f54d3a17d96e))
* **requests:** SLA tracking + approval delegation (Gap 3) ([9365ddd](https://github.com/QNSC-VN/opshub-api/commit/9365ddd443d5a07ae9edb3cb8074dee7bd4845d7))
* **requests:** universal request engine + expiry cron + port access-requests + workforce leave/OT ([c73c5fb](https://github.com/QNSC-VN/opshub-api/commit/c73c5fb30bf47a2536923b07cf0f6829d77ba925))
* **security:** enterprise auth hardening — throttle, audit, revocation, observability ([38c76a6](https://github.com/QNSC-VN/opshub-api/commit/38c76a6f92e1855b1fc86af01219e8d3b3a87185))
* **security:** HS256 → ES256 asymmetric JWT signing ([e8a59d8](https://github.com/QNSC-VN/opshub-api/commit/e8a59d8d7a849112ff8b67b0bae68254d2c34d15))
* **security:** rally-inspired hardening — XSS sanitization, OTel log correlation, observability ([d46d139](https://github.com/QNSC-VN/opshub-api/commit/d46d139f966612843b3ec40ddaa8af3dce0ad972))


### 🐛 Bug Fixes

* **api:** fix RBAC decorator misuse, add env vars, rate limits, log sanitization ([3cf16f2](https://github.com/QNSC-VN/opshub-api/commit/3cf16f21ec6c61db0502c71a826eb34bd98b0bd3))
* **auth:** enterprise hardening — prod guard, config-driven cookie TTL, public logout ([114ee37](https://github.com/QNSC-VN/opshub-api/commit/114ee373563a2e83e83797dbb702706f1c5ab1a1))
* bootstrap CSRF cookie secret, Zod v4 date compat, docker-compose postgres 18 ([7441dbc](https://github.com/QNSC-VN/opshub-api/commit/7441dbcb957979f3b58b6f7930919653b12e68a2))
* **bootstrap:** remove broken schema pre-creation + fix z.coerce.date() for Zod v4 ([9be76da](https://github.com/QNSC-VN/opshub-api/commit/9be76da9c4dea266cbeba7272db47022faeb7e1b))
* **infra:** use port 5433/6380 to avoid conflicts with other local services ([231be46](https://github.com/QNSC-VN/opshub-api/commit/231be46e84e58b3aed1201c463714324f367d66f))
* **jwt:** return factory as any to bypass EdDSA type gap in @types/jsonwebtoken ([63bf3f4](https://github.com/QNSC-VN/opshub-api/commit/63bf3f4096536e40dacc7190fdfb6f7bc9b639e4))
* **jwt:** suppress @types/jsonwebtoken EdDSA gap with ts-expect-error ([b6e8c40](https://github.com/QNSC-VN/opshub-api/commit/b6e8c40aa96b724584c6a7d60ae2fd50d15594a3))
* **jwt:** use EdDSA/Ed25519 algorithm; fix husky PATH for non-interactive shell ([74c0760](https://github.com/QNSC-VN/opshub-api/commit/74c07601ea95355eb300f51b8a6772d9e655d904))
* **jwt:** use ts-ignore for EdDSA; ts-expect-error unused in Docker tsconfig ([98aa8c5](https://github.com/QNSC-VN/opshub-api/commit/98aa8c5fd458aa6f23d3f97b30f1a31d7e0adcc8))
* **notifications:** relay correctness + performance improvements ([4b34c0e](https://github.com/QNSC-VN/opshub-api/commit/4b34c0ef0c121bd47fe1f10d86b98c2184c3a14f))
* rename qncs → qnsc across all resource names ([e97ef25](https://github.com/QNSC-VN/opshub-api/commit/e97ef25504635bd9ecec81884af4309b3fdecfdd))
* replace qnsc.io with qnsc.vn in workflow comments ([89b6301](https://github.com/QNSC-VN/opshub-api/commit/89b6301c9ce5ec870a2e224b8b6e46abea8f9bfb))
* **security:** close 3 remaining gaps — health probe rate-limit bypass, bodyLimit, exact logout TTL ([bc0f314](https://github.com/QNSC-VN/opshub-api/commit/bc0f314bda6df805bafdb54ff7082719be478e02))
* wire missing schema exports, break auth circular dep, secure delegation routes ([a972fb5](https://github.com/QNSC-VN/opshub-api/commit/a972fb5e570a0adc2a8abceb35f21d09b5706f83))


### 🔒 Security

* add top-level permissions: {} to all workflows ([88410f2](https://github.com/QNSC-VN/opshub-api/commit/88410f2d58cd95ee8f93c8f9fef2183ad3d10637))

## Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

<!-- Release Please will automatically update this file on each release. -->

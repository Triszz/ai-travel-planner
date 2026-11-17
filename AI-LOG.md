# AI-LOG.md — PA#2 (CSC13114)

Team: 23127376 — Hồ Gia Huy · 23127503 — Trần Thanh Trí

### #1 <date> <short title>

- **Tool:**
- **Task:**
- **Changed:** what we edited or fixed in the AI output, and how we noticed
- **Rejected:** what we refused, and why
- **Rule added:** the line added to `AGENTS.md`, with commit hash (if any)

## 2026-11-16 — PA#2 rubric review and initial architecture

- **Tool:** ChatGPT
- **Asked for:** Monorepo architecture proposal.
- **Kept:** Separate Next.js, NestJS and Python applications.
- **Changed:** Chose internal REST communication instead of introducing a queue immediately.
- **Rejected:** Direct PostgreSQL access from Python Agent.
- **By hand:** Reviewed service boundaries and approved the architecture.

## 2026-11-17 — Monorepo and development environment setup

- **Tool:** ChatGPT.
- **Asked for:** Guidance on configuring npm workspaces, development scripts, Docker services, and environment variable examples.
- **Kept:** npm workspaces for the Node.js applications and Docker Compose for PostgreSQL and Redis.
- **Changed:** Consolidated the Node.js workspace setup at the repository root and adjusted the Prisma configuration to match the installed Prisma version.
- **Rejected:** Keeping conflicting Prisma configuration files for different major versions.
- **By hand:** Applied the configuration changes, ran npm workspace checks, and verified the local environment setup.

## 2026-11-17 — Quality checks and project documentation

- **Tool:** ChatGPT.
- **Asked for:** Review and guidance on root-level lint, format, type-check, test commands, README instructions, and AGENTS.md rules.
- **Kept:** Separate commands for lint, format checking, type checking, and tests, exposed through the root package scripts.
- **Changed:** Updated the README development instructions to distinguish dependency installation, infrastructure startup, and frontend/backend development servers.
- **Rejected:** Claiming that CI already runs the documented checks before a GitHub Actions workflow has been configured.
- **By hand:** Ran the available checks and reviewed their results. Formatting, type checking, and tests passed; API lint remained blocked by the local Windows application-control policy.

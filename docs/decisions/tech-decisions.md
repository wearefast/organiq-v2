# Technical Decisions

Key technology and architecture decisions made for this project.

## Drizzle ORM over Prisma

- **Decision**: Use Drizzle ORM instead of Prisma
- **Reason**: Lighter weight, SQL-like API, no generated client binary, better PostgreSQL native type support (jsonb, enums)
- **Trade-off**: Less automatic relation handling; manual joins needed

## Flat Repo over Monorepo (Turborepo)

- **Decision**: Flat `frontend/` + `server/` structure instead of Turborepo monorepo
- **Reason**: Simpler setup, no workspace dependency complexity, easier for small team
- **Trade-off**: No shared build caching; packages can't easily share code (shared types live in server for now)

## Feature-Based Folder Structure

- **Decision**: Organise by feature (`features/<name>/`) not by type (`components/`, `services/`)
- **Reason**: Co-locates related code, easier to navigate, scales better as features grow
- **Trade-off**: Some duplication of patterns across features

## BullMQ for Background Jobs

- **Decision**: BullMQ with Redis for async processing
- **Reason**: Audit pipeline has 11+ steps, keyword discovery is slow; can't block HTTP requests
- **Trade-off**: Requires Redis infrastructure

## Clerk for Authentication

- **Decision**: Clerk over Auth0 / NextAuth
- **Reason**: Drop-in UI components, built-in org support, webhook sync, minimal config
- **Trade-off**: Vendor lock-in, per-MAU pricing

## Removed Concerns (Deferred)

The following were explicitly deferred to reduce initial complexity:
- **CI/CD** — No GitHub Actions pipelines yet
- **AWS** — No S3, ECS, RDS, ElastiCache, CloudFront
- **Resend** — No transactional email service
- **PostHog / GA4** — No analytics/tracking

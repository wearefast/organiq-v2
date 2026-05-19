# Feature: Billing

## Overview

Stripe-powered billing system supporting subscription plans, one-time credit pack purchases, and a self-service customer portal. Webhook-driven — all state changes flow from Stripe events.

## Key Files

| File | Purpose |
|------|---------|
| `server/src/features/billing/billing.controller.ts` | REST API under `/billing` |
| `server/src/features/billing/billing.service.ts` | Stripe integration (checkout, portal, webhooks) |
| `server/src/features/billing/billing.module.ts` | NestJS module (imports CreditsModule) |
| `server/src/features/billing/plan-limit.guard.ts` | PlanLimitGuard + @PlanLimit() decorator |
| `frontend/src/features/billing/services/billing.service.ts` | Frontend API client |
| `frontend/src/app/(dashboard)/billing/page.tsx` | Plan cards + credit pack purchase UI |

## API Endpoints

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `POST` | `/billing/webhook` | Stripe webhook receiver | Stripe signature (no auth guard) |
| `POST` | `/billing/:organizationId/checkout` | Create subscription checkout session | ClerkGuard + OrgMembership |
| `POST` | `/billing/:organizationId/purchase-credits` | Create credit pack purchase session | ClerkGuard + OrgMembership |
| `POST` | `/billing/:organizationId/portal` | Open Stripe customer portal | ClerkGuard + OrgMembership |
| `GET` | `/billing/:organizationId/subscription` | Get current subscription details | ClerkGuard + OrgMembership |

## Subscription Plans

| Plan | Description | Price ID Env Var |
|------|-------------|-----------------|
| `pro` | Professional plan | `STRIPE_PRICE_PRO` |
| `agency` | Agency plan | `STRIPE_PRICE_AGENCY` |
| `enterprise` | Enterprise plan | `STRIPE_PRICE_ENTERPRISE` |

## Credit Packs

One-time purchases of credit bundles (50–50,000 credits per pack). Pricing is calculated at 1 credit = $0.01 (configurable in service).

## Webhook Flow

```
Stripe → POST /billing/webhook (signature verified)
       → Event routing:
         ├── checkout.session.completed
         │     ├── mode=subscription → Create subscription record
         │     └── mode=payment → Create purchase record + credit ledger entry
         ├── customer.subscription.updated → Sync plan/status/period
         ├── customer.subscription.deleted → Mark canceled
         └── invoice.paid → Credit monthly allocation to org ledger
```

## Data Model

### subscriptions table

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| organizationId | UUID | FK → organizations |
| stripeSubscriptionId | text | Stripe subscription ID (unique) |
| stripeCustomerId | text | Stripe customer ID |
| stripePriceId | text | Active price ID |
| plan | org_plan enum | pro, agency, enterprise |
| status | subscription_status | active, past_due, canceled, trialing, incomplete |
| currentPeriodStart | timestamp | Billing period start |
| currentPeriodEnd | timestamp | Billing period end |
| cancelAtPeriodEnd | boolean | Will cancel at period end |
| monthlyCredits | integer | Credits allocated per billing cycle |
| createdAt | timestamp | Record creation |
| updatedAt | timestamp | Last update |

### purchases table

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| organizationId | UUID | FK → organizations |
| stripePaymentIntentId | text | Stripe payment intent ID (unique) |
| stripeCustomerId | text | Stripe customer ID |
| amount | integer | Payment amount in cents |
| credits | integer | Credits purchased |
| currency | text | Payment currency (default: usd) |
| status | text | Payment status (default: succeeded) |
| createdAt | timestamp | Purchase timestamp |

## PlanLimitGuard

Guards controller routes against plan usage limits. Uses `@PlanLimit()` decorator.

```typescript
// Usage on a controller route:
@PlanLimit('projects')
@Post()
async createProject(...) { ... }
```

### Supported Limits

| Limit Key | Measurement | Default (Free) |
|-----------|------------|----------------|
| `projects` | COUNT of projects in org | 3 |
| `workflowsPerMonth` | COUNT of workflow runs this month | 10 |
| `agentRunsPerMonth` | COUNT of agent runs this month | 50 |

The guard queries actual DB counts and compares against plan-specific limits. Throws `ForbiddenException` when exceeded.

## Security

- **Webhook verification:** Stripe signature checked via `stripe.webhooks.constructEvent()`
- **Open redirect prevention:** `validateRedirectUrl()` checks that `successUrl`/`cancelUrl` match `FRONTEND_URL` origin
- **Auth:** All non-webhook routes require ClerkGuard + OrgMembershipGuard
- **Raw body:** Webhook route uses `@RawBodyRequest` for signature verification (enabled via `rawBody: true` in NestFactory)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `STRIPE_SECRET_KEY` | Yes | Stripe API secret key |
| `STRIPE_WEBHOOK_SECRET` | Yes | Stripe webhook signing secret |
| `STRIPE_PRICE_PRO` | Yes | Price ID for Pro plan |
| `STRIPE_PRICE_AGENCY` | Yes | Price ID for Agency plan |
| `STRIPE_PRICE_ENTERPRISE` | Yes | Price ID for Enterprise plan |
| `FRONTEND_URL` | Yes | Used for redirect URL validation |

## Frontend

The billing page (`/billing`) displays:
- Current plan status badge
- Plan comparison cards (Pro, Agency, Enterprise) with features and pricing
- Credit pack purchase section (preset amounts)
- "Manage Subscription" button → Stripe Customer Portal

Navigation: Accessible via side-nav "Billing" link (CreditCard icon) in bottom items.

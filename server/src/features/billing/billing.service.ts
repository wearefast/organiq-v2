import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq } from 'drizzle-orm';
import Stripe = require('stripe');
import { DatabaseService } from '../../shared/database/database.service';
import { CreditsService } from '../credits/credits.service';
import { organizations, subscriptions, purchases } from '../../db/schema';

/** Plan → Stripe price ID mapping + monthly credits allocation */
const PLAN_CONFIG = {
  starter: { monthlyCredits: 100 },
  pro: { monthlyCredits: 500 },
  agency: { monthlyCredits: 2000 },
  enterprise: { monthlyCredits: 10000 },
} as const;

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private readonly stripe: Stripe.Stripe;
  private readonly webhookSecret: string;

  constructor(
    private readonly config: ConfigService,
    private readonly db: DatabaseService,
    private readonly creditsService: CreditsService,
  ) {
    this.stripe = new Stripe(this.config.getOrThrow<string>('STRIPE_SECRET_KEY')) as unknown as Stripe.Stripe;
    this.webhookSecret = this.config.getOrThrow<string>('STRIPE_WEBHOOK_SECRET');
  }

  /**
   * Create a Stripe Checkout session for a subscription plan.
   */
  async createCheckoutSession(params: {
    organizationId: string;
    plan: 'pro' | 'agency' | 'enterprise';
    successUrl: string;
    cancelUrl: string;
  }) {
    this.validateRedirectUrl(params.successUrl);
    this.validateRedirectUrl(params.cancelUrl);

    const org = await this.db.db.query.organizations.findFirst({
      where: eq(organizations.id, params.organizationId),
    });
    if (!org) throw new BadRequestException('Organization not found');

    const priceId = this.config.getOrThrow<string>(`STRIPE_PRICE_${params.plan.toUpperCase()}`);

    // Find or create Stripe customer
    let customerId: string;
    const existingSub = await this.db.db.query.subscriptions.findFirst({
      where: eq(subscriptions.organizationId, params.organizationId),
    });

    if (existingSub) {
      customerId = existingSub.stripeCustomerId;
    } else {
      const customer = await this.stripe.customers.create({
        name: org.name,
        metadata: { organizationId: params.organizationId },
      });
      customerId = customer.id;
    }

    const session = await this.stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      metadata: {
        organizationId: params.organizationId,
        plan: params.plan,
      },
    });

    return { sessionId: session.id, url: session.url };
  }

  /**
   * Create a Stripe Checkout session for a one-time credit pack purchase.
   */
  async createCreditPurchaseSession(params: {
    organizationId: string;
    credits: number;
    successUrl: string;
    cancelUrl: string;
  }) {
    this.validateRedirectUrl(params.successUrl);
    this.validateRedirectUrl(params.cancelUrl);

    const org = await this.db.db.query.organizations.findFirst({
      where: eq(organizations.id, params.organizationId),
    });
    if (!org) throw new BadRequestException('Organization not found');

    const pricePerCredit = 10; // $0.10 per credit = 10 cents
    const amount = params.credits * pricePerCredit;

    // Find or create Stripe customer
    let customerId: string;
    const existingSub = await this.db.db.query.subscriptions.findFirst({
      where: eq(subscriptions.organizationId, params.organizationId),
    });

    if (existingSub) {
      customerId = existingSub.stripeCustomerId;
    } else {
      const customer = await this.stripe.customers.create({
        name: org.name,
        metadata: { organizationId: params.organizationId },
      });
      customerId = customer.id;
    }

    const session = await this.stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            unit_amount: amount,
            product_data: { name: `${params.credits} Credits` },
          },
          quantity: 1,
        },
      ],
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      metadata: {
        organizationId: params.organizationId,
        credits: String(params.credits),
        type: 'credit_purchase',
      },
    });

    return { sessionId: session.id, url: session.url };
  }

  /**
   * Get the billing portal URL for managing subscription.
   */
  async createPortalSession(organizationId: string, returnUrl: string) {
    const sub = await this.db.db.query.subscriptions.findFirst({
      where: eq(subscriptions.organizationId, organizationId),
    });
    if (!sub) throw new BadRequestException('No active subscription found');

    const session = await this.stripe.billingPortal.sessions.create({
      customer: sub.stripeCustomerId,
      return_url: returnUrl,
    });

    return { url: session.url };
  }

  /**
   * Get current subscription details.
   */
  async getSubscription(organizationId: string) {
    return this.db.db.query.subscriptions.findFirst({
      where: eq(subscriptions.organizationId, organizationId),
    });
  }

  /**
   * Handle incoming Stripe webhook events.
   */
  async handleWebhook(payload: Buffer, signature: string) {
    let event: any;
    try {
      event = this.stripe.webhooks.constructEvent(payload, signature, this.webhookSecret);
    } catch (err) {
      this.logger.error(`Webhook signature verification failed: ${(err as Error).message}`);
      throw new BadRequestException('Invalid webhook signature');
    }

    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutCompleted(event.data.object);
        break;
      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdated(event.data.object);
        break;
      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(event.data.object);
        break;
      case 'invoice.paid':
        await this.handleInvoicePaid(event.data.object);
        break;
      default:
        this.logger.debug(`Unhandled event type: ${event.type}`);
    }

    return { received: true };
  }

  private async handleCheckoutCompleted(session: any) {
    const organizationId = session.metadata?.organizationId;
    if (!organizationId) return;

    if (session.mode === 'subscription') {
      const plan = session.metadata?.plan as 'pro' | 'agency' | 'enterprise';
      const stripeSubscriptionId = session.subscription as string;

      const stripeSub: any = await this.stripe.subscriptions.retrieve(stripeSubscriptionId);
      const planConfig = PLAN_CONFIG[plan];

      await this.db.db.insert(subscriptions).values({
        organizationId,
        stripeSubscriptionId,
        stripeCustomerId: session.customer as string,
        stripePriceId: stripeSub.items.data[0].price.id,
        plan,
        status: 'active',
        currentPeriodStart: new Date(stripeSub.current_period_start * 1000),
        currentPeriodEnd: new Date(stripeSub.current_period_end * 1000),
        monthlyCredits: planConfig.monthlyCredits,
      });

      // Update org plan
      await this.db.db
        .update(organizations)
        .set({ plan, updatedAt: new Date() })
        .where(eq(organizations.id, organizationId));

      // Grant initial monthly credits
      await this.creditsService.credit({
        organizationId,
        amount: planConfig.monthlyCredits,
        type: 'bonus',
        description: `Monthly credits for ${plan} plan`,
      });

      this.logger.log(`Subscription created for org ${organizationId}: ${plan}`);
    } else if (session.mode === 'payment' && session.metadata?.type === 'credit_purchase') {
      const credits = parseInt(session.metadata.credits, 10);
      const paymentIntent = session.payment_intent as string;

      await this.db.db.insert(purchases).values({
        organizationId,
        stripePaymentIntentId: paymentIntent,
        stripeCustomerId: session.customer as string,
        amount: session.amount_total ?? 0,
        credits,
        currency: session.currency ?? 'usd',
        status: 'succeeded',
      });

      await this.creditsService.credit({
        organizationId,
        amount: credits,
        type: 'purchase',
        description: `Purchased ${credits} credits`,
      });

      this.logger.log(`Credit purchase completed for org ${organizationId}: ${credits} credits`);
    }
  }

  private async handleSubscriptionUpdated(stripeSub: any) {
    const existingSub = await this.db.db.query.subscriptions.findFirst({
      where: eq(subscriptions.stripeSubscriptionId, stripeSub.id),
    });
    if (!existingSub) return;

    const status = stripeSub.status as 'active' | 'past_due' | 'canceled' | 'trialing' | 'incomplete';

    await this.db.db
      .update(subscriptions)
      .set({
        status,
        currentPeriodStart: new Date(stripeSub.current_period_start * 1000),
        currentPeriodEnd: new Date(stripeSub.current_period_end * 1000),
        cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.stripeSubscriptionId, stripeSub.id));
  }

  private async handleSubscriptionDeleted(stripeSub: any) {
    const existingSub = await this.db.db.query.subscriptions.findFirst({
      where: eq(subscriptions.stripeSubscriptionId, stripeSub.id),
    });
    if (!existingSub) return;

    await this.db.db
      .update(subscriptions)
      .set({ status: 'canceled', updatedAt: new Date() })
      .where(eq(subscriptions.stripeSubscriptionId, stripeSub.id));

    // Downgrade org to starter
    await this.db.db
      .update(organizations)
      .set({ plan: 'starter', updatedAt: new Date() })
      .where(eq(organizations.id, existingSub.organizationId));

    this.logger.log(`Subscription canceled for org ${existingSub.organizationId}`);
  }

  private async handleInvoicePaid(invoice: any) {
    if (!invoice.subscription) return;

    const existingSub = await this.db.db.query.subscriptions.findFirst({
      where: eq(subscriptions.stripeSubscriptionId, invoice.subscription as string),
    });
    if (!existingSub) return;

    // Grant monthly credits on renewal
    await this.creditsService.credit({
      organizationId: existingSub.organizationId,
      amount: existingSub.monthlyCredits,
      type: 'bonus',
      description: `Monthly credit renewal (${existingSub.plan} plan)`,
    });

    this.logger.log(`Invoice paid — granted ${existingSub.monthlyCredits} credits to org ${existingSub.organizationId}`);
  }

  /**
   * Validate redirect URL against allowed frontend origin to prevent open redirects.
   */
  private validateRedirectUrl(url: string): void {
    const allowedOrigin = this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:3001';
    try {
      const parsed = new URL(url);
      const allowed = new URL(allowedOrigin);
      if (parsed.origin !== allowed.origin) {
        throw new BadRequestException(`Redirect URL must be on ${allowed.origin}`);
      }
    } catch (e) {
      if (e instanceof BadRequestException) throw e;
      throw new BadRequestException('Invalid redirect URL');
    }
  }
}

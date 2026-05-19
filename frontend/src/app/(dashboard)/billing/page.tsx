'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';

const PLANS = [
  {
    name: 'Starter',
    key: 'starter' as const,
    price: 'Free',
    credits: '100/mo',
    features: ['1 project', '5 workflows/month', '10 agent runs/month', 'Basic reports'],
  },
  {
    name: 'Pro',
    key: 'pro' as const,
    price: '$49/mo',
    credits: '500/mo',
    features: ['5 projects', '50 workflows/month', '100 agent runs/month', 'Full reports', 'Scheduled workflows'],
    popular: true,
  },
  {
    name: 'Agency',
    key: 'agency' as const,
    price: '$199/mo',
    credits: '2,000/mo',
    features: ['25 projects', '200 workflows/month', '500 agent runs/month', 'White-label reports', 'Priority support'],
  },
  {
    name: 'Enterprise',
    key: 'enterprise' as const,
    price: 'Custom',
    credits: '10,000/mo',
    features: ['Unlimited projects', 'Unlimited workflows', 'Unlimited agents', 'Dedicated support', 'Custom integrations'],
  },
];

export default function BillingPage() {
  const [currentPlan] = useState('starter');

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">Billing & Plans</h1>
        <p className="mt-1 text-sm text-zinc-500">Manage your subscription and purchase credits.</p>
      </div>

      {/* Plan cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {PLANS.map((plan) => (
          <div
            key={plan.key}
            className={`relative rounded-lg border p-6 ${
              plan.popular
                ? 'border-rose-500/50 bg-zinc-900/80'
                : 'border-zinc-800 bg-zinc-900/50'
            }`}
          >
            {plan.popular && (
              <span className="absolute -top-2.5 left-4 rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                Popular
              </span>
            )}
            <h3 className="text-lg font-semibold text-zinc-100">{plan.name}</h3>
            <p className="mt-1 text-2xl font-bold text-zinc-100">{plan.price}</p>
            <p className="text-xs text-zinc-500">{plan.credits} credits</p>
            <ul className="mt-4 space-y-2">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-center gap-2 text-sm text-zinc-400">
                  <Check className="h-3.5 w-3.5 text-rose-500" />
                  {feature}
                </li>
              ))}
            </ul>
            <button
              className={`mt-6 w-full rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                currentPlan === plan.key
                  ? 'cursor-default bg-zinc-800 text-zinc-500'
                  : 'bg-rose-600 text-white hover:bg-rose-700'
              }`}
              disabled={currentPlan === plan.key}
            >
              {currentPlan === plan.key ? 'Current Plan' : 'Upgrade'}
            </button>
          </div>
        ))}
      </div>

      {/* Credit packs */}
      <div>
        <h2 className="text-lg font-semibold text-zinc-100">Buy Credit Packs</h2>
        <p className="mt-1 text-sm text-zinc-500">One-time purchases — credits never expire.</p>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          {[
            { credits: 100, price: '$10' },
            { credits: 500, price: '$45' },
            { credits: 1000, price: '$80' },
          ].map((pack) => (
            <div key={pack.credits} className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
              <div>
                <p className="font-medium text-zinc-200">{pack.credits} credits</p>
                <p className="text-sm text-zinc-500">{pack.price}</p>
              </div>
              <button className="rounded-md bg-zinc-800 px-3 py-1.5 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-700">
                Buy
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

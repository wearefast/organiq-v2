const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

export async function getSubscription(organizationId: string, token: string) {
  const res = await fetch(`${API_BASE}/billing/${organizationId}/subscription`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  return res.json();
}

export async function createCheckoutSession(
  organizationId: string,
  plan: 'pro' | 'agency' | 'enterprise',
  token: string,
) {
  const res = await fetch(`${API_BASE}/billing/${organizationId}/checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      plan,
      successUrl: `${window.location.origin}/billing?success=true`,
      cancelUrl: `${window.location.origin}/billing?canceled=true`,
    }),
  });
  return res.json();
}

export async function createCreditPurchase(
  organizationId: string,
  credits: number,
  token: string,
) {
  const res = await fetch(`${API_BASE}/billing/${organizationId}/purchase-credits`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      credits,
      successUrl: `${window.location.origin}/billing?purchase=true`,
      cancelUrl: `${window.location.origin}/billing?canceled=true`,
    }),
  });
  return res.json();
}

export async function createPortalSession(organizationId: string, token: string) {
  const res = await fetch(`${API_BASE}/billing/${organizationId}/portal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ returnUrl: `${window.location.origin}/billing` }),
  });
  return res.json();
}

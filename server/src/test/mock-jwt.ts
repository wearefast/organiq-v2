/**
 * Mock JWT helper for testing authenticated endpoints.
 * Generates a Clerk-compatible JWT signed with a local RSA key pair.
 */
import { SignJWT, importPKCS8, importSPKI, exportJWK } from 'jose';
import { TEST_MEMBER, TEST_ORG } from './fixtures';

type JoseKey = Awaited<ReturnType<typeof importPKCS8>>;

// RSA 2048-bit test key pair (NOT for production use)
const TEST_PRIVATE_KEY_PEM = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC7o4qne60TB3aq
jVxBMy1YMQVR1aMBkPwF+Zf+MxK0lNVFcRPCavMqz7VfGLP3PUx9jemFzBaC2l6
lqBNq+PAFY+W5R0tQKFI/RDjccHUyUfN3d6PHDAIB8GEJpUQWkyU/4JiEHNVYHfu
X9m/LY3+C/sLmbeS8hPqulB0wDYr/7Jv4IV4Cj7l8azJFdGPVFwfHrTQCOT5Uh9M
nY8aBL8FXBaSX6O6S1ByTZ1UTr7KVxZ5PcNwA+zqfaaq7y1dPThMFJxa/bwNq0L0
X5poLXTrPNFay6Fhiz7SZJnvEfKOi7OxQk2qJi/9+t5Ct7fkQ6XJUM7I7+lXQkP
2i1P3B5VAgMBAAECggEAHDBqalCXqaM3c5i4w8AFLFaALpk4F2GvJbqzHc7XMXW4
Z0CqZnJGlIh5Y3ilmb7hSzRi8qkB3K7B5Lnl+H3oAdxu1bPXblXhFXOJ1CjVzFB
SdvIXVg0czjK8VNgcFi5DfP+0hBfsBQ5e24FHnvPEHfCHbXlMNSf8APj0Dx6dY5D
Y5RqRPmRtIqZWAn9+OJGu4K6e4FGt09C+w/9Z4M4j5YxJvz2OB/TfPOxQAS8L+k3
Ld30yHRa7P2Tb/m5mH3zV3FQf1TITcAlRu0Cz8ZOjLGfIqvz7O5ZjpMp/k7PJkl
X8m3GZW8umDTc3MnTrhBPF/XFvLkQOq/T0WpAkU7AQKBgQD5mONJMNbB/x3jh9t8
WW1hb9G5qB8XKOLALf4v5lSAtblV+JWCGvx3FZ1GWWPb3Kf9b8mj8FoW6jVIKK49
jTHZLOXbhRoUGMPy2JyUe4R7N9I8tJBh5EfIGH/ViH6+jaDQJPynpwf8KYMhMW6b
Z3L6CToV3bfHhCwIr2K/GaP1VQKBgQDA+hF7zfJI7bGkuyDXNnGLnQ2ZnMz/P6BX
KsG6FTgjDwFB96Q3JJM7J2J+S4H2O+BG/Ps2bV4tYz2J1ZL7gwN7J0ecf5RNOi+9
7FsB/dFSPKAvRf6g8MBj/HlWCjT5EgjR3b0RONxuLkf5PXtsTfbnMKXmdfFoKC1O
w9QKuFxEAQKBgFmQ5q8w2Kv8g0qjWB0t2WR2JqJO1MRxCL9pJVNrb/V5N5jBnPpd
q6BqHPGJUQ1EKfb8Z3bFl1W3v9rOYMKhb3Q5H8s5dCJeBfLbB5p0lExNaQq0Vu7d
jGMfJSIMMF5GWb6j3GHOeR/H3uDPJtjVGAGf8Jj5aO0av+l6nq/E5V9VAoGAP2Z1
T3KIxRH3u1P3BHC3qCaXEKJNh1vLj5YEr3P1f8GxHXjZm9cv9JUkZZTR3wvV8qv9
X8pIAnqfH1GF7lUBshIzA3rPHh3Kcr9Z6GbVT1DQf5C/Y6FEQX3tHOp+RLi9TNAB
J7yqxPfkI9rqT8rip9TXPdLx9QfvNwZy4yjPMAECgYEAhR5CR2F2FwREAI8rU+VJ
E3/RL+S1vHdH+cExr+y7MD+dp3OVChW9M/NVnO5Ue+yvB6x04cjZZq4zGTl03s6n
NeC8o81gS6fOJ/pg3TkvlXlSv0eaIX8PbNFVHQWexlTsO2rL/L9CHMJKL6ef5DLJ
qsLRpVzOL7/cPMwm5sa5zd0=
-----END PRIVATE KEY-----`;

const TEST_PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAu6OKp3utEwd2qo1cQTMt
WDEFU9WjAZD8BfmX/jMStJTVRXETwmrzKs+1Xxiz9z1MfY3phcwWgtpepagTavjw
BWPluUdLUChSP0Q43HB1MlHzd3egxwwgAYfBRCaVEFpMlP+CYhBzVWB37l/Zvy2N
/gv7C5m3kvIT6rpQdMA2K/+yb+CFeAo+5fGsyRXRj1RcHx600Ajk+VIfTJ2PGgS/
BVwWkl+juktQck2dVE6+ylcWeT3DcAPs6n2mqu8tXT04TBScWv28DatC9F+aaC106
zzRWsuhYYs+0mSZ7xHyjouzsUJNqiYv/freQre35EOlyVDOyO/pV0JD9otT9weVVQ
IDAQAB
-----END PUBLIC KEY-----`;

let _privateKey: JoseKey | null = null;
let _publicKey: JoseKey | null = null;

async function getTestPrivateKey(): Promise<JoseKey> {
  if (!_privateKey) {
    _privateKey = await importPKCS8(TEST_PRIVATE_KEY_PEM, 'RS256');
  }
  return _privateKey;
}

export async function getTestPublicKey(): Promise<JoseKey> {
  if (!_publicKey) {
    _publicKey = await importSPKI(TEST_PUBLIC_KEY_PEM, 'RS256');
  }
  return _publicKey;
}

export async function getTestJWK() {
  const pubKey = await getTestPublicKey();
  const jwk = await exportJWK(pubKey);
  return { ...jwk, kid: 'test-key-1', alg: 'RS256', use: 'sig' };
}

/**
 * Generate a signed JWT token for testing.
 * Mimics Clerk JWT structure.
 */
export async function generateTestJwt(overrides?: {
  sub?: string;
  orgId?: string;
  exp?: number;
}): Promise<string> {
  const privateKey = await getTestPrivateKey();
  const now = Math.floor(Date.now() / 1000);

  return new SignJWT({
    sub: overrides?.sub ?? TEST_MEMBER.clerkUserId,
    org_id: overrides?.orgId ?? TEST_ORG.clerkOrgId,
    org_role: 'org:admin',
    org_slug: TEST_ORG.slug,
  })
    .setProtectedHeader({ alg: 'RS256', kid: 'test-key-1' })
    .setIssuedAt(now)
    .setExpirationTime(overrides?.exp ?? now + 3600)
    .setIssuer('https://test.clerk.accounts.dev')
    .sign(privateKey);
}

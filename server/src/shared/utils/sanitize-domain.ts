/**
 * Sanitize a user-provided domain string.
 * Strips protocol, www prefix, trailing slashes, and path segments.
 * Returns a bare hostname like "example.com".
 */
export function sanitizeDomain(input: string): string {
  let domain = input.trim().toLowerCase();

  // Remove protocol
  domain = domain.replace(/^https?:\/\//, '');

  // Remove www. prefix
  domain = domain.replace(/^www\./, '');

  // Remove path, query, fragment
  domain = domain.split('/')[0].split('?')[0].split('#')[0];

  // Remove port
  domain = domain.split(':')[0];

  return domain;
}

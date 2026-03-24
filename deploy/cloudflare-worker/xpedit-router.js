/**
 * Cloudflare Worker: routes /xpedit/* to Cloud Run, everything else passes through.
 *
 * Environment variable CLOUD_RUN_URL must be set in wrangler.toml or CF dashboard.
 * Example: https://asciicker-xpedit-abc123-uc.a.run.app
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/xpedit' || url.pathname.startsWith('/xpedit/')) {
      const target = new URL(url.pathname + url.search, env.CLOUD_RUN_URL);

      const headers = new Headers(request.headers);
      headers.set('X-Forwarded-Host', url.hostname);
      headers.set('X-Forwarded-Proto', url.protocol.replace(':', ''));

      return fetch(target.toString(), {
        method: request.method,
        headers,
        body: request.body,
        redirect: 'follow',
      });
    }

    // Everything else: pass through to origin (GitHub Pages)
    return fetch(request);
  },
};

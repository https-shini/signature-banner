import { createServer } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { pathToFileURL } from 'node:url';

// Temporary transport for an official OAuth client running in a cloud machine.
// Tokens and PKCE verifiers never pass through this server. Disable the relay by
// restoring the application's start command after onboarding.
export function createOAuthRelay({ token, now = Date.now, hostname }) {
  if (typeof token !== 'string' || token.length < 32)
    throw new Error('A strong relay token is required.');
  let grant;
  const equal = (a, b) => {
    const left = Buffer.from(a ?? ''),
      right = Buffer.from(b ?? '');
    return left.length === right.length && timingSafeEqual(left, right);
  };
  return createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
    );
    const send = (status, body) => {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(body));
    };
    try {
      const host = new URL('http://' + req.headers.host).hostname;
      if (!['localhost', '127.0.0.1', '[::1]', hostname].includes(host))
        return send(421, { error: 'Invalid host.' });
      const url = new URL(req.url, 'https://' + req.headers.host);
      if (url.pathname.startsWith('/internal/')) {
        if (!equal(req.headers.authorization, 'Bearer ' + token))
          return send(401, { error: 'Unauthorized.' });
        if (req.headers.origin && new URL(req.headers.origin).host !== req.headers.host)
          return send(403, { error: 'Invalid origin.' });
      }
      if (req.method === 'GET' && url.pathname === '/healthz')
        return send(200, { status: 'awaiting_oauth', component: 'temporary-relay' });
      if (req.method === 'POST' && url.pathname === '/internal/begin') {
        if (req.headers['content-type'] !== 'application/json')
          return send(415, { error: 'JSON required.' });
        const chunks = [];
        let length = 0;
        for await (const chunk of req) {
          length += chunk.length;
          if (length > 2048) return send(413, { error: 'Request too large.' });
          chunks.push(chunk);
        }
        let body;
        try {
          body = JSON.parse(Buffer.concat(chunks).toString());
        } catch {
          return send(400, { error: 'Invalid request.' });
        }
        if (
          !body ||
          Object.keys(body).some((key) => key !== 'state') ||
          typeof body.state !== 'string' ||
          !/^[A-Za-z0-9_-]{16,128}$/.test(body.state)
        )
          return send(400, { error: 'Invalid state.' });
        grant = { state: body.state, expiresAt: now() + 600_000 };
        return send(201, { status: 'ready' });
      }
      if (req.method === 'GET' && url.pathname === '/callback') {
        if (!grant || now() >= grant.expiresAt) {
          grant = undefined;
          return send(410, { error: 'Authorization expired.' });
        }
        if (!equal(url.searchParams.get('state'), grant.state))
          return send(400, { error: 'Invalid state.' });
        if (grant.result) return send(409, { error: 'Callback already received.' });
        const code = url.searchParams.get('code');
        if (url.searchParams.has('error'))
          grant.result = { state: grant.state, error: 'access_denied' };
        else {
          if (!code || code.length > 4096 || /[\u0000-\u001f\u007f]/.test(code))
            return send(400, { error: 'Invalid callback.' });
          grant.result = { state: grant.state, code };
        }
        res.writeHead(303, { Location: '/authorized' });
        return res.end();
      }
      if (req.method === 'GET' && url.pathname === '/internal/result') {
        if (!grant || now() >= grant.expiresAt) {
          grant = undefined;
          return send(410, { error: 'Authorization expired.' });
        }
        if (!grant.result) return send(202, { status: 'pending' });
        const result = grant.result;
        grant = undefined;
        return send(200, result);
      }
      if (req.method === 'GET' && url.pathname === '/authorized') {
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end('Autorização recebida. Pode retornar ao Codex.');
      }
      return send(404, { error: 'Not found.' });
    } catch {
      return send(400, { error: 'Invalid request.' });
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const server = createOAuthRelay({
    token: process.env.OAUTH_RELAY_TOKEN,
    hostname: process.env.RENDER_EXTERNAL_HOSTNAME,
  });
  const port = Number(process.env.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid port.');
  server.listen(port, process.env.HOST ?? '127.0.0.1');
  for (const signal of ['SIGTERM', 'SIGINT'])
    process.once(signal, () => server.close(() => process.exit(0)));
}

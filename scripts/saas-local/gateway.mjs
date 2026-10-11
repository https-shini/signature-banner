// Local routing only. JWT verification and authorization live in the actual services.
import http from 'node:http';
const routes = [
  ['/auth/v1', 54326],
  ['/rest/v1', 54327],
  ['/storage/v1', 54328],
];
http
  .createServer((req, res) => {
    const route = routes.find(([prefix]) => req.url.startsWith(prefix));
    if (!route) {
      res.writeHead(404).end();
      return;
    }
    const origin = req.headers.origin;
    if (origin && !['http://127.0.0.1:3000', 'http://127.0.0.1:3080'].includes(origin)) {
      res.writeHead(403).end();
      return;
    }
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader(
        'Access-Control-Allow-Headers',
        'authorization,apikey,content-type,x-client-info,x-supabase-api-version,accept-profile,content-profile,prefer',
      );
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    }
    if (req.method === 'OPTIONS') {
      res.writeHead(204).end();
      return;
    }
    const upstream = http.request(
      {
        hostname: '127.0.0.1',
        port: route[1],
        method: req.method,
        path: req.url.slice(route[0].length) || '/',
        headers: { ...req.headers, host: '127.0.0.1:' + route[1] },
      },
      (r) => {
        const headers = { ...r.headers };
        delete headers['access-control-allow-origin'];
        delete headers['access-control-allow-headers'];
        delete headers['access-control-allow-methods'];
        res.writeHead(r.statusCode, headers);
        r.pipe(res);
      },
    );
    upstream.on('error', () => res.writeHead(503).end());
    req.pipe(upstream);
  })
  .listen(54321, '127.0.0.1');

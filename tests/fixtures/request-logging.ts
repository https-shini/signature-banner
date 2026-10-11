import assert from 'node:assert/strict';
import { createApp } from '../../server/app';
import type { Store } from '../../server/store';

// These routes exercise the real request logger without accessing persistence.
const app = createApp({} as Store, { logger: true, serveStatic: false });
app.get('/auth/callback', async () => ({ status: 'callback' }));
try {
  for (const path of ['/auth/callback', '/api/missing']) {
    const response = await app.inject({
      method: 'GET',
      url: `${path}?code=query-credential-marker&state=state-credential-marker`,
      headers: {
        authorization: 'Bearer header-credential-marker',
        cookie: 'session=cookie-credential-marker',
      },
    });
    assert.equal(response.statusCode, path === '/auth/callback' ? 200 : 404);
  }
} finally {
  await app.close();
}

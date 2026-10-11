import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createOAuthRelay } from '../tools/cloud-oauth-relay.mjs';

test('relay requires a strong token and protects both internal endpoints', async () => {
  assert.throws(() => createOAuthRelay({ token: 'weak' }));
  const server = createOAuthRelay({ token: 'test-token-for-relay-at-least-32-characters' });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const base = 'http://127.0.0.1:' + server.address().port;
    assert.equal((await fetch(base + '/internal/begin', { method: 'POST' })).status, 401);
    assert.equal((await fetch(base + '/internal/result')).status, 401);
    const health = await fetch(base + '/healthz');
    assert.equal((await health.json()).component, 'temporary-relay');
    assert.equal(health.headers.get('cache-control'), 'no-store');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('relay rejects unknown state and returns a callback only once to the authenticated client', async () => {
  const token = 'test-token-for-relay-at-least-32-characters';
  const server = createOAuthRelay({ token });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const base = 'http://127.0.0.1:' + server.address().port;
    const headers = { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' };
    const state = 'test-state-with-adequate-entropy';
    assert.equal(
      (
        await fetch(base + '/internal/begin', {
          method: 'POST',
          headers,
          body: JSON.stringify({ state }),
        })
      ).status,
      201,
    );
    assert.equal(
      (await fetch(base + '/callback?state=wrong&code=example-code', { redirect: 'manual' }))
        .status,
      400,
    );
    assert.equal((await fetch(base + '/internal/result', { headers })).status, 202);
    const callback = await fetch(base + '/callback?state=' + state + '&code=example-code', {
      redirect: 'manual',
    });
    assert.equal(callback.status, 303);
    assert.equal(callback.headers.get('location'), '/authorized');
    assert.equal(await callback.text(), '');
    assert.equal(
      (
        await fetch(base + '/callback?state=' + state + '&code=example-code', {
          redirect: 'manual',
        })
      ).status,
      409,
    );
    assert.equal((await fetch(base + '/internal/result')).status, 401);
    assert.deepEqual(await (await fetch(base + '/internal/result', { headers })).json(), {
      state,
      code: 'example-code',
    });
    assert.equal((await fetch(base + '/internal/result', { headers })).status, 410);
    assert.ok(!(await (await fetch(base + '/authorized')).text()).includes('example-code'));
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('relay expires unfinished grants and rejects cross-origin or oversized configuration', async () => {
  let clock = 0;
  const token = 'test-token-for-relay-at-least-32-characters';
  const server = createOAuthRelay({ token, now: () => clock });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const base = 'http://127.0.0.1:' + server.address().port;
    const headers = { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' };
    const state = 'test-state-with-adequate-entropy';
    assert.equal(
      (
        await fetch(base + '/internal/begin', {
          method: 'POST',
          headers: { ...headers, Origin: 'https://untrusted.example' },
          body: JSON.stringify({ state }),
        })
      ).status,
      403,
    );
    assert.equal(
      (await fetch(base + '/internal/begin', { method: 'POST', headers, body: 'x'.repeat(4096) }))
        .status,
      413,
    );
    assert.equal(
      (
        await fetch(base + '/internal/begin', {
          method: 'POST',
          headers,
          body: JSON.stringify({ state }),
        })
      ).status,
      201,
    );
    clock = 600_000;
    assert.equal(
      (await fetch(base + '/callback?state=' + state + '&code=example-code')).status,
      410,
    );
    assert.equal((await fetch(base + '/internal/result', { headers })).status, 410);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('relay preserves the verified authorization issuer and rejects missing or mismatched issuers', async () => {
  const token = 'test-token-for-relay-at-least-32-characters';
  const server = createOAuthRelay({ token });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const base = 'http://127.0.0.1:' + server.address().port;
    const headers = { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' };
    const state = 'test-state-with-adequate-entropy';
    const issuer = 'https://api.supabase.com';
    assert.equal(
      (
        await fetch(base + '/internal/begin', {
          method: 'POST',
          headers,
          body: JSON.stringify({ state, issuer }),
        })
      ).status,
      201,
    );
    for (const suffix of ['', '&iss=https%3A%2F%2Funtrusted.example']) {
      assert.equal(
        (
          await fetch(base + '/callback?state=' + state + '&code=example-code' + suffix, {
            redirect: 'manual',
          })
        ).status,
        400,
      );
      assert.equal((await fetch(base + '/internal/result', { headers })).status, 202);
    }
    assert.equal(
      (
        await fetch(
          base + '/callback?' + new URLSearchParams({ state, code: 'example-code', iss: issuer }),
          {
            redirect: 'manual',
          },
        )
      ).status,
      303,
    );
    assert.deepEqual(await (await fetch(base + '/internal/result', { headers })).json(), {
      state,
      code: 'example-code',
      iss: issuer,
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('real request logs preserve diagnostics without callback or header credentials', async () => {
  const { stdout } = await promisify(execFile)(
    process.execPath,
    ['--import', 'tsx', fileURLToPath(new URL('./fixtures/request-logging.ts', import.meta.url))],
    { timeout: 15000, maxBuffer: 1024 * 1024 },
  );
  const records = stdout
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
  const requests = records.filter((record) => record.msg === 'incoming request');
  assert.deepEqual(
    requests.map((record) => record.req.url),
    ['/auth/callback', '/api/missing'],
  );
  assert.ok(requests.every((record) => record.req.method === 'GET' && record.reqId));
  assert.deepEqual(
    records
      .filter((record) => record.msg === 'request completed')
      .map((record) => record.res.statusCode),
    [200, 404],
  );
  assert.doesNotMatch(stdout, /(?:query|state|header|cookie)-credential-marker/);
});

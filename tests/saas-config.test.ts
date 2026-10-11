import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateSaasConfiguration } from '../server/saas';
const key = (role: string) =>
  'eyJhbGciOiJIUzI1NiJ9.' +
  Buffer.from(JSON.stringify({ role })).toString('base64url') +
  '.signature';
test('public configuration rejects service-role/secret keys and unsafe Supabase endpoints', () => {
  assert.throws(() =>
    validateSaasConfiguration({ url: 'https://test.supabase.co', anonKey: key('service_role') }),
  );
  assert.throws(() =>
    validateSaasConfiguration({ url: 'https://test.supabase.co', anonKey: 'sb_secret_private' }),
  );
  assert.throws(() =>
    validateSaasConfiguration({ url: 'http://test.supabase.co', anonKey: key('anon') }),
  );
  assert.throws(() =>
    validateSaasConfiguration({
      url: 'https://user:password@test.supabase.co',
      anonKey: key('anon'),
    }),
  );
  assert.doesNotThrow(() =>
    validateSaasConfiguration({ url: 'https://test.supabase.co', anonKey: key('anon') }),
  );
  assert.doesNotThrow(() =>
    validateSaasConfiguration({ url: 'http://127.0.0.1:54321', anonKey: 'sb_publishable_public' }),
  );
});

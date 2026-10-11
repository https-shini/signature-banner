import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { Pool } from 'pg';
import { Store } from '../server/store';
import { MemoryStorage } from '../server/storage';

test('startup reuses a preprovisioned schema without database CREATE privileges', async () => {
  const connection = new URL(
    process.env.TEST_DATABASE_URL ?? 'postgresql://postgres@127.0.0.1:54329/identity_studio',
  );
  const suffix = randomBytes(10).toString('hex');
  const role = 'restricted_' + suffix;
  const schema = 'restricted_' + suffix;
  const password = randomBytes(24).toString('hex');
  const database = decodeURIComponent(connection.pathname.slice(1));
  assert.match(database, /^[a-zA-Z][a-zA-Z0-9_]*$/);
  const admin = new Pool({ connectionString: connection.toString() });
  let store: Store | undefined;
  try {
    await admin.query(
      `CREATE ROLE ${role} LOGIN PASSWORD '${password}' NOSUPERUSER NOCREATEDB NOCREATEROLE`,
    );
    await admin.query(`GRANT CONNECT ON DATABASE ${database} TO ${role}`);
    await admin.query(`CREATE SCHEMA ${schema} AUTHORIZATION ${role}`);
    connection.username = role;
    connection.password = password;
    const restricted = new Pool({ connectionString: connection.toString() });
    try {
      assert.equal(
        (
          await restricted.query(
            "SELECT has_database_privilege(current_user,current_database(),'CREATE') AS allowed",
          )
        ).rows[0].allowed,
        false,
      );
    } finally {
      await restricted.end();
    }
    store = await Store.open({
      connectionString: connection.toString(),
      schema,
      storage: new MemoryStorage(),
    });
    assert.equal((await store.profiles()).length, 1);
    assert.equal((await store.assets()).length, 3);
    await store.close();
    store = undefined;
    store = await Store.open({
      connectionString: connection.toString(),
      schema,
      storage: new MemoryStorage(),
    });
    assert.equal((await store.profiles()).length, 1);
    assert.equal((await store.assets()).length, 3);
  } finally {
    await store?.close();
    await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await admin.query(`REVOKE CONNECT ON DATABASE ${database} FROM ${role}`);
    await admin.query(`DROP ROLE IF EXISTS ${role}`);
    await admin.end();
  }
});

/** Explicit foundation provisioner. Runtime startup never calls this. */
import { readFile } from 'node:fs/promises';
import { Store } from '../server/store';
export async function provisionSaas(store: Store) {
  await store.transaction(async (tx) => {
    await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [store.schema]);
    if (
      (await tx.query(`SELECT 1 FROM ${store.schema}.schema_migrations WHERE version=2`)).rowCount
    )
      return;
    const sql = await readFile(
      new URL('../server/migrations/002_saas.sql', import.meta.url),
      'utf8',
    );
    await tx.query(sql.replaceAll('__SCHEMA__', store.schema));
  });
}

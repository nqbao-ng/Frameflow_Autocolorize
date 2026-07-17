import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function countApiFunctions(directory) {
  let total = 0;
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) total += await countApiFunctions(target);
    else if (entry.isFile() && entry.name.endsWith('.js')) total += 1;
  }
  return total;
}

test('Vercel serverless function count remains within Hobby limit', async () => {
  assert.ok(await countApiFunctions(path.join(root, 'api')) <= 12);
});

test('market plan migration keeps Pro at 2,000 frames and 500 credits', async () => {
  const migration = await readFile(path.join(root, 'supabase/migrations/005_pro_2000_500_and_usage_sync.sql'), 'utf8');
  assert.match(migration, /processing_frame_limit\s*=\s*2000/i);
  assert.match(migration, /creative_credit_limit\s*=\s*500/i);
  assert.match(migration, /price_vnd\s*=\s*499000/i);
  assert.match(migration, /where code = 'studio'/i);
});

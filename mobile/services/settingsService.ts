import { getDatabase } from '../database/database';

export interface DatabaseStats {
  customerCount: number;
  deliveryCount: number;
  lineItemCount: number;
  bottleSizeCount: number;
  schemaVersion: number;
}

export async function getSetting(key: string, defaultValue: string = ''): Promise<string> {
  const db = getDatabase();
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM settings WHERE key = ?',
    [key]
  );
  return row ? row.value : defaultValue;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = getDatabase();
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO settings (key, value, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [key, value, now]
  );
}

export async function getDatabaseStats(): Promise<DatabaseStats> {
  const db = getDatabase();

  const cRow = await db.getFirstAsync<{ c: number }>('SELECT COUNT(*) as c FROM customers');
  const dRow = await db.getFirstAsync<{ c: number }>('SELECT COUNT(*) as c FROM deliveries');
  const iRow = await db.getFirstAsync<{ c: number }>('SELECT COUNT(*) as c FROM delivery_items');
  const bRow = await db.getFirstAsync<{ c: number }>('SELECT COUNT(*) as c FROM bottle_sizes');
  const vRow = await db.getFirstAsync<{ version: number }>('SELECT MAX(version) as version FROM schema_migrations');

  return {
    customerCount: cRow?.c ?? 0,
    deliveryCount: dRow?.c ?? 0,
    lineItemCount: iRow?.c ?? 0,
    bottleSizeCount: bRow?.c ?? 0,
    schemaVersion: vRow?.version ?? 1,
  };
}

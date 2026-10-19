import { Platform } from 'react-native';
import * as SQLite from 'expo-sqlite';
import { CREATE_TABLES_SQL, CURRENT_SCHEMA_VERSION, INITIAL_BOTTLE_SIZES } from './schema';

let dbInstance: SQLite.SQLiteDatabase | null = null;
let initPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDatabase(): SQLite.SQLiteDatabase {
  if (!dbInstance) {
    if (Platform.OS === 'web') {
      throw new Error('Database is still initializing for web platform.');
    } else {
      dbInstance = SQLite.openDatabaseSync('watertrack.db');
    }
  }
  return dbInstance;
}

async function addColumnDirectly(
  db: SQLite.SQLiteDatabase,
  tableName: string,
  columnName: string,
  columnDef: string
) {
  try {
    const cols = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${tableName});`);
    const exists = cols.some((c) => c.name.toLowerCase() === columnName.toLowerCase());
    if (!exists) {
      await db.execAsync(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDef};`);
    }
  } catch (err: any) {
    const msg = (err?.message || '').toLowerCase();
    // If column already exists, SQLite throws "duplicate column name", which is completely safe to ignore
    if (!msg.includes('duplicate column') && !msg.includes('already exists')) {
      console.warn(`Column check note for ${tableName}.${columnName}:`, err?.message);
      try {
        await db.execAsync(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDef};`);
      } catch (e2) {
        // ignore duplicate column
      }
    }
  }
}

export async function initDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (dbInstance) {
    return dbInstance;
  }
  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    let db: SQLite.SQLiteDatabase;

    if (Platform.OS === 'web') {
      try {
        db = await SQLite.openDatabaseAsync('watertrack.db');
      } catch (err: any) {
        console.warn('Primary web OPFS lock detected, opening session database fallback:', err?.message);
        // Fallback to a timestamped session database if OPFS lock is held by another worker or recent refresh
        const fallbackName = `watertrack_session_${Date.now()}.db`;
        db = await SQLite.openDatabaseAsync(fallbackName);
      }
    } else {
      db = SQLite.openDatabaseSync('watertrack.db');
    }

    // Enforce foreign key constraints & WAL mode on native
    try {
      await db.execAsync('PRAGMA foreign_keys = ON;');
      if (Platform.OS !== 'web') {
        await db.execAsync('PRAGMA journal_mode = WAL;');
      }
    } catch (err) {
      console.warn('Pragma configuration notice:', err);
    }

    // Run core table creation SQL
    await db.execAsync(CREATE_TABLES_SQL);

    // Unconditionally ensure all v2 columns exist across all platforms and existing DB files
    await addColumnDirectly(db, 'customers', 'client_submission_id', 'TEXT');

    await addColumnDirectly(db, 'deliveries', 'bill_number', 'TEXT');
    await addColumnDirectly(db, 'deliveries', 'submission_key', 'TEXT');
    await addColumnDirectly(db, 'deliveries', 'total_bottles', 'INTEGER DEFAULT 0');
    await addColumnDirectly(db, 'deliveries', 'total_volume_ml', 'INTEGER DEFAULT 0');
    await addColumnDirectly(db, 'deliveries', 'total_amount', 'REAL DEFAULT 0');
    await addColumnDirectly(db, 'deliveries', 'total_amount_minor_units', 'INTEGER DEFAULT 0');

    await addColumnDirectly(db, 'bottle_sizes', 'volume_unit', "TEXT DEFAULT 'L'");
    await addColumnDirectly(db, 'bottle_sizes', 'description', 'TEXT');
    await addColumnDirectly(db, 'bottle_sizes', 'standard_price_paise', 'INTEGER');

    await addColumnDirectly(db, 'delivery_items', 'volume_ml_snapshot', 'INTEGER');
    await addColumnDirectly(db, 'delivery_items', 'volume_unit_snapshot', "TEXT DEFAULT 'L'");
    await addColumnDirectly(db, 'delivery_items', 'line_total', 'REAL DEFAULT 0');
    await addColumnDirectly(db, 'delivery_items', 'line_total_minor_units', 'INTEGER DEFAULT 0');

    // Ensure customer_product_rates table and v2 indexes exist
    try {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS customer_product_rates (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
          bottle_size_id INTEGER NOT NULL REFERENCES bottle_sizes(id) ON DELETE CASCADE,
          unit_price_minor_units INTEGER NOT NULL,
          rate_rupees REAL NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          UNIQUE(customer_id, bottle_size_id)
        );
        CREATE INDEX IF NOT EXISTS idx_cpr_customer ON customer_product_rates(customer_id);
        CREATE INDEX IF NOT EXISTS idx_cpr_bottle ON customer_product_rates(bottle_size_id);
        CREATE INDEX IF NOT EXISTS idx_deliveries_submission_key ON deliveries(submission_key);
        CREATE INDEX IF NOT EXISTS idx_customers_sub_id ON customers(client_submission_id);
        CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
        CREATE INDEX IF NOT EXISTS idx_customers_address ON customers(address);
      `);
    } catch (e) {
      console.warn('Index/table creation notice:', e);
    }

    // Check migration version
    const migrationRow = await db.getFirstAsync<{ version: number }>(
      'SELECT MAX(version) as version FROM schema_migrations'
    );

    const currentVersion = migrationRow?.version ?? 0;

    if (currentVersion < 1) {
      // Seed initial bottle sizes only if table is empty
      const bottleCount = await db.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) as count FROM bottle_sizes'
      );

      if (!bottleCount || bottleCount.count === 0) {
        const now = new Date().toISOString();
        for (const item of INITIAL_BOTTLE_SIZES) {
          const standardPaise = Math.round((item.default_unit_price || 0) * 100);
          await db.runAsync(
            `INSERT INTO bottle_sizes (name, volume_ml, volume_unit, is_active, default_unit_price, standard_price_paise, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [item.name, item.volume_ml, 'L', item.is_active, item.default_unit_price, standardPaise, now, now]
          );
        }
      }

      // Default settings
      const now = new Date().toISOString();
      await db.runAsync(
        `INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES ('theme', 'light', ?)`,
        [now]
      );
      await db.runAsync(
        `INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES ('pricing_enabled', 'false', ?)`,
        [now]
      );
      await db.runAsync(
        `INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES ('week_start', 'monday', ?)`,
        [now]
      );

      await db.runAsync(
        'INSERT INTO schema_migrations (version, applied_at) VALUES (1, ?)',
        [now]
      );
    }

    // Backfill missing snapshots for existing data if any
    try {
      await db.execAsync(`
        UPDATE bottle_sizes 
        SET standard_price_paise = ROUND(COALESCE(default_unit_price, 0) * 100) 
        WHERE standard_price_paise IS NULL AND default_unit_price IS NOT NULL;

        UPDATE delivery_items
        SET volume_ml_snapshot = (SELECT bs.volume_ml FROM bottle_sizes bs WHERE bs.id = delivery_items.bottle_size_id)
        WHERE volume_ml_snapshot IS NULL;

        UPDATE delivery_items
        SET volume_unit_snapshot = (SELECT bs.volume_unit FROM bottle_sizes bs WHERE bs.id = delivery_items.bottle_size_id)
        WHERE volume_unit_snapshot IS NULL;

        UPDATE delivery_items
        SET line_total = quantity * COALESCE(unit_price_snapshot, 0),
            line_total_minor_units = ROUND(quantity * COALESCE(unit_price_snapshot, 0) * 100)
        WHERE (line_total IS NULL OR line_total = 0) AND unit_price_snapshot IS NOT NULL;
      `);
    } catch (e) {
      console.warn('Backfill notice:', e);
    }

    if (currentVersion < 2) {
      const now = new Date().toISOString();
      await db.runAsync(
        'INSERT INTO schema_migrations (version, applied_at) VALUES (2, ?)',
        [now]
      );
    }

    // Data repair migration:
    // 1. Convert any invalid placeholder customer names ('none', 'null', 'undefined', 'nan', '') to 'Unnamed Customer'
    // 2. Ensure every delivery has a valid customer record (create Customer #id if orphaned)
    try {
      await db.execAsync(`
        UPDATE customers 
        SET name = 'Unnamed Customer' 
        WHERE name IS NULL OR LOWER(TRIM(name)) IN ('none', 'null', 'undefined', 'nan', '');

        INSERT OR IGNORE INTO customers (id, name, customer_type, created_at, updated_at)
        SELECT DISTINCT d.customer_id, 'Customer #' || d.customer_id, 'Other', d.created_at, d.created_at
        FROM deliveries d 
        WHERE d.customer_id IS NOT NULL 
          AND d.customer_id NOT IN (SELECT id FROM customers);
      `);
    } catch (repairErr) {
      console.warn('Customer data repair notice:', repairErr);
    }

    // Safety check: ensure clean_slate flag is marked without ever purging existing real user data
    try {
      const purgeFlag = await db.getFirstAsync<{ value: string }>(
        "SELECT value FROM settings WHERE key = 'clean_slate_real_data_purged'"
      );
      if (!purgeFlag || purgeFlag.value !== 'true') {
        const custCount = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM customers');
        const delivCount = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM deliveries');
        // Only if there is zero data in both tables, mark it. Never delete existing records!
        const now = new Date().toISOString();
        if ((custCount?.count ?? 0) === 0 && (delivCount?.count ?? 0) === 0) {
          await db.runAsync(
            "INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('clean_slate_real_data_purged', 'true', ?)",
            [now]
          );
        } else {
          // Real data exists: safely mark flag as initialized so no purge ever runs
          await db.runAsync(
            "INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('clean_slate_real_data_purged', 'true', ?)",
            [now]
          );
        }
      }
    } catch (purgeErr) {
      console.warn('Clean slate check notice:', purgeErr);
    }

    dbInstance = db;
    return db;
  })();

  try {
    return await initPromise;
  } catch (err) {
    dbInstance = null;
    initPromise = null;
    throw err;
  }
}

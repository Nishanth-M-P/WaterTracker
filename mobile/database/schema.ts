export const CURRENT_SCHEMA_VERSION = 2;

export const CREATE_TABLES_SQL = `
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_submission_id TEXT UNIQUE,
  name TEXT NOT NULL,
  customer_type TEXT NOT NULL DEFAULT 'Other',
  phone TEXT,
  address TEXT,
  notes TEXT,
  is_archived INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS bottle_sizes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  volume_ml INTEGER,
  volume_unit TEXT DEFAULT 'L',
  description TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  default_unit_price REAL,
  standard_price_paise INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS deliveries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bill_number TEXT,
  submission_key TEXT UNIQUE,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  delivery_date TEXT NOT NULL,
  delivered_at TEXT NOT NULL,
  delivery_location TEXT NOT NULL,
  notes TEXT,
  total_bottles INTEGER DEFAULT 0,
  total_volume_ml INTEGER DEFAULT 0,
  total_amount REAL DEFAULT 0,
  total_amount_minor_units INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS delivery_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  delivery_id INTEGER NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
  bottle_size_id INTEGER NOT NULL REFERENCES bottle_sizes(id),
  bottle_size_name_snapshot TEXT NOT NULL,
  volume_ml_snapshot INTEGER,
  volume_unit_snapshot TEXT DEFAULT 'L',
  quantity INTEGER NOT NULL,
  unit_price_snapshot REAL,
  line_total REAL DEFAULT 0,
  line_total_minor_units INTEGER DEFAULT 0,
  created_at TEXT NOT NULL
);

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

CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
CREATE INDEX IF NOT EXISTS idx_customers_type ON customers(customer_type);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_address ON customers(address);
CREATE INDEX IF NOT EXISTS idx_deliveries_customer_id ON deliveries(customer_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_delivery_date ON deliveries(delivery_date);
CREATE INDEX IF NOT EXISTS idx_delivery_items_delivery_id ON delivery_items(delivery_id);
CREATE INDEX IF NOT EXISTS idx_delivery_items_bottle_size_id ON delivery_items(bottle_size_id);
CREATE INDEX IF NOT EXISTS idx_cpr_customer ON customer_product_rates(customer_id);
CREATE INDEX IF NOT EXISTS idx_cpr_bottle ON customer_product_rates(bottle_size_id);
`;

export const INITIAL_BOTTLE_SIZES = [
  { name: '20L Water Jar', volume_ml: 20000, is_active: 1, default_unit_price: 80.0 },
  { name: '2L Bottle', volume_ml: 2000, is_active: 1, default_unit_price: 35.0 },
  { name: '1L Bottle', volume_ml: 1000, is_active: 1, default_unit_price: 20.0 },
  { name: '500ml Bottle', volume_ml: 500, is_active: 1, default_unit_price: 10.0 },
];

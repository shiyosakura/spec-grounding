import Database from "better-sqlite3";
import path from "path";

let db: Database.Database | null = null;

const DB_PATH = path.join(process.cwd(), "salon.db");

export function getDb(): Database.Database {
  if (db) return db;

  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  initializeSchema(db);
  seedIfEmpty(db);

  return db;
}

function initializeSchema(db: Database.Database): void {
  db.exec(`
    -- =====================
    -- Master Data Tables
    -- =====================

    CREATE TABLE IF NOT EXISTS product_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_name TEXT NOT NULL,
      CHECK (id >= 0 AND id <= 99)
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_code TEXT NOT NULL UNIQUE,
      product_name TEXT NOT NULL,
      category_id INTEGER NOT NULL DEFAULT 0,
      standard_unit_price INTEGER NOT NULL DEFAULT 0,
      unit TEXT NOT NULL DEFAULT '個',
      active INTEGER NOT NULL DEFAULT 1,
      CHECK (id >= 0 AND id <= 9999),
      CHECK (standard_unit_price >= 0 AND standard_unit_price <= 9999999),
      CHECK (active IN (0, 1)),
      FOREIGN KEY (category_id) REFERENCES product_categories(id)
    );

    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_code TEXT NOT NULL UNIQUE,
      customer_name TEXT NOT NULL,
      address TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      closing_day INTEGER NOT NULL DEFAULT 0,
      credit_limit INTEGER NOT NULL DEFAULT 0,
      CHECK (id >= 0 AND id <= 9999),
      CHECK (closing_day >= 0 AND closing_day <= 28),
      CHECK (credit_limit >= 0 AND credit_limit <= 99999999)
    );

    CREATE TABLE IF NOT EXISTS special_prices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      special_unit_price INTEGER NOT NULL,
      CHECK (id >= 0 AND id <= 9999),
      CHECK (special_unit_price >= 0 AND special_unit_price <= 9999999),
      UNIQUE (customer_id, product_id),
      FOREIGN KEY (customer_id) REFERENCES customers(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    -- =====================
    -- Persistent Data Tables
    -- =====================

    CREATE TABLE IF NOT EXISTS quotations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quotation_number TEXT NOT NULL UNIQUE,
      customer_id INTEGER NOT NULL,
      subject TEXT NOT NULL DEFAULT '',
      status INTEGER NOT NULL DEFAULT 0,
      expiration_date TEXT NOT NULL,
      created_by TEXT NOT NULL DEFAULT 'system',
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      CHECK (status >= 0 AND status <= 4),
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    );

    CREATE TABLE IF NOT EXISTS quotation_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quotation_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      product_name_snapshot TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price INTEGER NOT NULL,
      CHECK (quantity >= 1 AND quantity <= 99999),
      CHECK (unit_price >= 0 AND unit_price <= 9999999),
      FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_number TEXT NOT NULL UNIQUE,
      customer_id INTEGER NOT NULL,
      quotation_id INTEGER DEFAULT 0,
      subject TEXT NOT NULL DEFAULT '',
      status INTEGER NOT NULL DEFAULT 0,
      credit_warning INTEGER NOT NULL DEFAULT 0,
      ordered_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      CHECK (status >= 0 AND status <= 5),
      CHECK (credit_warning IN (0, 1)),
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      product_name_snapshot TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price INTEGER NOT NULL,
      shipped_quantity INTEGER NOT NULL DEFAULT 0,
      CHECK (quantity >= 1 AND quantity <= 99999),
      CHECK (unit_price >= 0 AND unit_price <= 9999999),
      CHECK (shipped_quantity >= 0 AND shipped_quantity <= 99999),
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS product_inventory (
      product_id INTEGER PRIMARY KEY,
      physical_stock INTEGER NOT NULL DEFAULT 0,
      allocated_quantity INTEGER NOT NULL DEFAULT 0,
      CHECK (physical_stock >= 0 AND physical_stock <= 999999),
      CHECK (allocated_quantity >= 0 AND allocated_quantity <= 999999),
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS shipping_instructions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shipping_instruction_number TEXT NOT NULL UNIQUE,
      order_id INTEGER NOT NULL,
      customer_id INTEGER NOT NULL,
      status INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      CHECK (status >= 0 AND status <= 3),
      FOREIGN KEY (order_id) REFERENCES orders(id),
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    );

    CREATE TABLE IF NOT EXISTS shipping_instruction_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shipping_instruction_id INTEGER NOT NULL,
      order_item_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      instructed_quantity INTEGER NOT NULL,
      shipped_quantity INTEGER NOT NULL DEFAULT 0,
      CHECK (instructed_quantity >= 1 AND instructed_quantity <= 99999),
      CHECK (shipped_quantity >= 0 AND shipped_quantity <= 99999),
      FOREIGN KEY (shipping_instruction_id) REFERENCES shipping_instructions(id) ON DELETE CASCADE,
      FOREIGN KEY (order_item_id) REFERENCES order_items(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS shipping_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shipping_instruction_item_id INTEGER NOT NULL,
      shipped_quantity INTEGER NOT NULL,
      shipped_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      CHECK (shipped_quantity >= 1 AND shipped_quantity <= 99999),
      FOREIGN KEY (shipping_instruction_item_id) REFERENCES shipping_instruction_items(id)
    );

    CREATE TABLE IF NOT EXISTS receivings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      receipt_date TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      registered_by TEXT NOT NULL DEFAULT 'system',
      registered_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS receiving_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      receiving_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      received_quantity INTEGER NOT NULL,
      CHECK (received_quantity >= 1 AND received_quantity <= 999999),
      FOREIGN KEY (receiving_id) REFERENCES receivings(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_number TEXT NOT NULL UNIQUE,
      customer_id INTEGER NOT NULL,
      billing_period TEXT NOT NULL,
      invoice_amount INTEGER NOT NULL DEFAULT 0,
      status INTEGER NOT NULL DEFAULT 0,
      issue_date TEXT NOT NULL,
      registered_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      CHECK (invoice_amount >= 0 AND invoice_amount <= 99999999),
      CHECK (status >= 0 AND status <= 3),
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    );

    CREATE TABLE IF NOT EXISTS invoice_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER NOT NULL,
      order_item_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      product_name_snapshot TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price INTEGER NOT NULL,
      CHECK (quantity >= 1 AND quantity <= 99999),
      CHECK (unit_price >= 0 AND unit_price <= 9999999),
      FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
      FOREIGN KEY (order_item_id) REFERENCES order_items(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      payment_amount INTEGER NOT NULL,
      payment_date TEXT NOT NULL,
      payment_method INTEGER NOT NULL DEFAULT 0,
      reconciliation_status INTEGER NOT NULL DEFAULT 0,
      unreconciled_balance INTEGER NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      registered_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      CHECK (payment_amount >= 1 AND payment_amount <= 99999999),
      CHECK (payment_method IN (0, 1)),
      CHECK (reconciliation_status >= 0 AND reconciliation_status <= 2),
      CHECK (unreconciled_balance >= 0 AND unreconciled_balance <= 99999999),
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    );

    CREATE TABLE IF NOT EXISTS payment_reconciliations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      payment_id INTEGER NOT NULL,
      invoice_id INTEGER NOT NULL,
      reconciled_amount INTEGER NOT NULL,
      reconciled_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      CHECK (reconciled_amount >= 1 AND reconciled_amount <= 99999999),
      FOREIGN KEY (payment_id) REFERENCES payments(id),
      FOREIGN KEY (invoice_id) REFERENCES invoices(id)
    );
  `);
}

function seedIfEmpty(db: Database.Database): void {
  const count = db.prepare("SELECT COUNT(*) as cnt FROM product_categories").get() as { cnt: number };
  if (count.cnt > 0) return;

  const insertCategory = db.prepare("INSERT INTO product_categories (category_name) VALUES (?)");
  const insertProduct = db.prepare(
    "INSERT INTO products (product_code, product_name, category_id, standard_unit_price, unit, active) VALUES (?, ?, ?, ?, ?, ?)"
  );
  const insertCustomer = db.prepare(
    "INSERT INTO customers (customer_code, customer_name, address, phone, email, closing_day, credit_limit) VALUES (?, ?, ?, ?, ?, ?, ?)"
  );
  const insertSpecialPrice = db.prepare(
    "INSERT INTO special_prices (customer_id, product_id, special_unit_price) VALUES (?, ?, ?)"
  );
  const insertSetting = db.prepare("INSERT INTO system_settings (key, value) VALUES (?, ?)");
  const insertInventory = db.prepare(
    "INSERT INTO product_inventory (product_id, physical_stock, allocated_quantity) VALUES (?, ?, ?)"
  );

  const seedAll = db.transaction(() => {
    // Product Categories
    insertCategory.run("電子部品");       // 1
    insertCategory.run("コネクタ");       // 2
    insertCategory.run("基板");           // 3
    insertCategory.run("工具・消耗品");   // 4

    // Products
    insertProduct.run("PRD-001", "抵抗器 10kΩ",           1, 50,    "個", 1);   // 1
    insertProduct.run("PRD-002", "コンデンサ 100μF",      1, 120,   "個", 1);   // 2
    insertProduct.run("PRD-003", "LED 赤色 5mm",           1, 30,    "個", 1);   // 3
    insertProduct.run("PRD-004", "USBコネクタ Type-C",     2, 250,   "個", 1);   // 4
    insertProduct.run("PRD-005", "D-Sub 9ピンコネクタ",    2, 380,   "個", 1);   // 5
    insertProduct.run("PRD-006", "ユニバーサル基板 A4",    3, 1500,  "枚", 1);   // 6
    insertProduct.run("PRD-007", "プリント基板 カスタム",  3, 8500,  "枚", 1);   // 7
    insertProduct.run("PRD-008", "はんだ線 1.0mm 500g",    4, 2200,  "巻", 1);   // 8
    insertProduct.run("PRD-009", "フラックス 100ml",       4, 850,   "本", 1);   // 9
    insertProduct.run("PRD-010", "精密ドライバーセット",   4, 3800,  "セット", 1); // 10

    // Customers
    insertCustomer.run("CUS-001", "東京電機株式会社",     "東京都千代田区神田須田町1-1-1",   "03-1234-5678", "info@tokyo-denki.example.com",  0,  5000000);
    insertCustomer.run("CUS-002", "大阪エレクトロニクス",  "大阪府大阪市中央区本町2-2-2",     "06-2345-6789", "contact@osaka-elec.example.com", 20, 3000000);
    insertCustomer.run("CUS-003", "名古屋デバイス株式会社","愛知県名古屋市中区栄3-3-3",       "052-345-6789", "sales@nagoya-dev.example.com",   0,  10000000);
    insertCustomer.run("CUS-004", "福岡テック合同会社",    "福岡県福岡市博多区博多駅前4-4-4", "092-456-7890", "order@fukuoka-tech.example.com", 15, 2000000);
    insertCustomer.run("CUS-005", "北海道パーツ商事",      "北海道札幌市中央区大通5-5-5",     "011-567-8901", "parts@hokkaido-parts.example.com", 0, 0);

    // Special Prices (customer-specific pricing)
    insertSpecialPrice.run(1, 1, 40);    // 東京電機: 抵抗器 10kΩ → 40円
    insertSpecialPrice.run(1, 6, 1300);  // 東京電機: ユニバーサル基板 → 1300円
    insertSpecialPrice.run(3, 7, 7500);  // 名古屋デバイス: プリント基板 → 7500円
    insertSpecialPrice.run(2, 4, 220);   // 大阪エレクトロニクス: USBコネクタ → 220円

    // System Settings
    insertSetting.run("tax_rate", "10");
    insertSetting.run("quotation_valid_days", "30");
    insertSetting.run("quotation_number_prefix", "EST-");
    insertSetting.run("order_number_prefix", "ORD-");
    insertSetting.run("invoice_number_prefix", "INV-");
    insertSetting.run("shipping_instruction_number_prefix", "SHP-");

    // Initial Inventory (100 each for all products)
    for (let i = 1; i <= 10; i++) {
      insertInventory.run(i, 100, 0);
    }
  });

  seedAll();
}

/**
 * Generate a sequential business number with prefix.
 * e.g., generateNumber('quotation_number_prefix', 'quotations', 'quotation_number') → "EST-000001"
 */
export function generateNumber(
  prefixSettingKey: string,
  tableName: string,
  columnName: string
): string {
  const database = getDb();
  const prefix = getSystemSetting(prefixSettingKey);

  const row = database.prepare(
    `SELECT COUNT(*) as cnt FROM ${tableName}`
  ).get() as { cnt: number };

  const nextNum = row.cnt + 1;
  const padded = String(nextNum).padStart(6, "0");
  return `${prefix}${padded}`;
}

/**
 * Retrieve a system setting by key.
 */
export function getSystemSetting(key: string): string {
  const database = getDb();
  const row = database.prepare(
    "SELECT value FROM system_settings WHERE key = ?"
  ).get(key) as { value: string } | undefined;

  if (!row) {
    throw new Error(`System setting not found: ${key}`);
  }
  return row.value;
}

/**
 * Get the current tax rate as a number (e.g., 10).
 */
export function getTaxRate(): number {
  return parseInt(getSystemSetting("tax_rate"), 10);
}

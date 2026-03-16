import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.join(process.cwd(), "salon.db");

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma("journal_mode = WAL");
    _db.pragma("foreign_keys = ON");
    initializeSchema(_db);
  }
  return _db;
}

function initializeSchema(db: Database.Database) {
  db.exec(`
    -- Menu Category (Master)
    CREATE TABLE IF NOT EXISTS menu_categories (
      category_id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_name TEXT NOT NULL,
      display_order INTEGER NOT NULL DEFAULT 0
    );

    -- Menu Master
    CREATE TABLE IF NOT EXISTS menus (
      menu_id INTEGER PRIMARY KEY AUTOINCREMENT,
      menu_name TEXT NOT NULL,
      category_id INTEGER NOT NULL DEFAULT 0,
      price INTEGER NOT NULL CHECK(price >= 1 AND price <= 99999),
      duration INTEGER NOT NULL CHECK(duration >= 10 AND duration <= 480),
      description TEXT NOT NULL DEFAULT '',
      is_public INTEGER NOT NULL DEFAULT 0 CHECK(is_public IN (0, 1)),
      FOREIGN KEY (category_id) REFERENCES menu_categories(category_id)
    );

    -- Staff Master
    CREATE TABLE IF NOT EXISTS staff (
      staff_id INTEGER PRIMARY KEY AUTOINCREMENT,
      staff_name TEXT NOT NULL,
      profile TEXT NOT NULL DEFAULT '',
      is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1))
    );

    -- Staff Shift
    CREATE TABLE IF NOT EXISTS staff_shifts (
      staff_id INTEGER NOT NULL,
      day_of_week INTEGER NOT NULL CHECK(day_of_week >= 0 AND day_of_week <= 6),
      start_time TEXT NOT NULL DEFAULT '09:00',
      end_time TEXT NOT NULL DEFAULT '19:00',
      is_working INTEGER NOT NULL DEFAULT 1 CHECK(is_working IN (0, 1)),
      PRIMARY KEY (staff_id, day_of_week),
      FOREIGN KEY (staff_id) REFERENCES staff(staff_id)
    );

    -- Staff Menu Assignment
    CREATE TABLE IF NOT EXISTS staff_menu_assignments (
      staff_id INTEGER NOT NULL,
      menu_id INTEGER NOT NULL,
      PRIMARY KEY (staff_id, menu_id),
      FOREIGN KEY (staff_id) REFERENCES staff(staff_id),
      FOREIGN KEY (menu_id) REFERENCES menus(menu_id)
    );

    -- System Settings
    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    -- Customer (Save)
    CREATE TABLE IF NOT EXISTS customers (
      customer_id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_name TEXT NOT NULL,
      phone_number TEXT NOT NULL,
      account_id TEXT,
      cancellation_penalty_count INTEGER NOT NULL DEFAULT 0,
      registered_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Reservation (Save)
    CREATE TABLE IF NOT EXISTS reservations (
      reservation_id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      staff_id INTEGER NOT NULL,
      is_nominated INTEGER NOT NULL DEFAULT 1 CHECK(is_nominated IN (0, 1)),
      nomination_fee INTEGER NOT NULL DEFAULT 0,
      start_datetime TEXT NOT NULL,
      total_duration INTEGER NOT NULL CHECK(total_duration >= 10),
      status INTEGER NOT NULL DEFAULT 0 CHECK(status >= 0 AND status <= 4),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (customer_id) REFERENCES customers(customer_id),
      FOREIGN KEY (staff_id) REFERENCES staff(staff_id)
    );

    -- Reservation Menu Detail (Save)
    CREATE TABLE IF NOT EXISTS reservation_menu_details (
      reservation_id INTEGER NOT NULL,
      menu_id INTEGER NOT NULL,
      price_at_booking INTEGER NOT NULL,
      duration_at_booking INTEGER NOT NULL,
      PRIMARY KEY (reservation_id, menu_id),
      FOREIGN KEY (reservation_id) REFERENCES reservations(reservation_id),
      FOREIGN KEY (menu_id) REFERENCES menus(menu_id)
    );

    -- Favorite (Save)
    CREATE TABLE IF NOT EXISTS favorites (
      customer_id INTEGER NOT NULL,
      target_type INTEGER NOT NULL CHECK(target_type IN (0, 1)),
      target_id INTEGER NOT NULL,
      PRIMARY KEY (customer_id, target_type, target_id),
      FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
    );
  `);

  // Insert default system settings if not present
  const insertSetting = db.prepare(
    "INSERT OR IGNORE INTO system_settings (key, value) VALUES (?, ?)"
  );
  insertSetting.run("cancellation_penalty_limit", "3");
  insertSetting.run("same_day_cancellation_hours", "24");
  insertSetting.run("booking_window_days", "30");
  insertSetting.run("time_slot_interval", "30");
}

export function getSystemSetting(key: string): string {
  const db = getDb();
  const row = db
    .prepare("SELECT value FROM system_settings WHERE key = ?")
    .get(key) as { value: string } | undefined;
  return row?.value ?? "";
}

export function getSystemSettingInt(key: string, defaultVal: number): number {
  const val = getSystemSetting(key);
  const parsed = parseInt(val, 10);
  return isNaN(parsed) ? defaultVal : parsed;
}

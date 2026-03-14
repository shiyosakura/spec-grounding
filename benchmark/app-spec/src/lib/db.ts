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
      start_datetime TEXT NOT NULL,
      total_duration INTEGER NOT NULL CHECK(total_duration >= 10),
      status INTEGER NOT NULL DEFAULT 0 CHECK(status >= 0 AND status <= 4),
      cancellation_fee INTEGER NOT NULL DEFAULT 0 CHECK(cancellation_fee >= 0 AND cancellation_fee <= 999999),
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

    -- Cancellation Policy (Master)
    CREATE TABLE IF NOT EXISTS cancellation_policy (
      tier_id INTEGER PRIMARY KEY AUTOINCREMENT,
      hour_threshold INTEGER NOT NULL CHECK(hour_threshold >= 1 AND hour_threshold <= 720),
      cancellation_rate INTEGER NOT NULL CHECK(cancellation_rate >= 0 AND cancellation_rate <= 100)
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
  insertSetting.run("booking_window_days", "30");
  insertSetting.run("time_slot_interval", "30");

  // Insert default cancellation policy tiers if not present
  const policyCount = db.prepare("SELECT COUNT(*) as c FROM cancellation_policy").get() as { c: number };
  if (policyCount.c === 0) {
    const insertPolicy = db.prepare(
      "INSERT INTO cancellation_policy (hour_threshold, cancellation_rate) VALUES (?, ?)"
    );
    insertPolicy.run(24, 100);  // Tier 1: less than 24 hours => 100%
    insertPolicy.run(72, 50);   // Tier 2: less than 72 hours => 50%
  }
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

export interface CancellationPolicyTier {
  tier_id: number;
  hour_threshold: number;
  cancellation_rate: number;
}

export function getCancellationPolicyTiers(): CancellationPolicyTier[] {
  const db = getDb();
  return db.prepare("SELECT * FROM cancellation_policy ORDER BY hour_threshold ASC").all() as CancellationPolicyTier[];
}

/**
 * Calculate cancellation rate based on tiered cancellation policy.
 * Scan tiers in ascending order of hour_threshold, apply the first tier where
 * remainingHours < hour_threshold. If no tier matches, rate is 0%.
 */
export function calculateCancellationRate(remainingHours: number): number {
  const tiers = getCancellationPolicyTiers();
  for (const tier of tiers) {
    if (remainingHours < tier.hour_threshold) {
      return tier.cancellation_rate;
    }
  }
  return 0; // No tier matched => free cancellation
}

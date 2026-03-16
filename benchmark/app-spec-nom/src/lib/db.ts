import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'salon.db');

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initializeDatabase(db);
  }
  return db;
}

function initializeDatabase(db: Database.Database): void {
  // Check if tables already exist
  const tableExists = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='system_settings'"
  ).get();

  if (tableExists) return;

  db.exec(`
    -- Menu Category
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
      is_public INTEGER NOT NULL DEFAULT 1 CHECK(is_public IN (0, 1)),
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
      id INTEGER PRIMARY KEY DEFAULT 1,
      cancellation_penalty_limit INTEGER NOT NULL DEFAULT 3,
      same_day_cancellation_hours INTEGER NOT NULL DEFAULT 24,
      booking_window_days INTEGER NOT NULL DEFAULT 30,
      time_slot_interval INTEGER NOT NULL DEFAULT 30,
      nomination_fee INTEGER NOT NULL DEFAULT 500
    );

    -- Customer
    CREATE TABLE IF NOT EXISTS customers (
      customer_id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_name TEXT NOT NULL,
      phone_number TEXT NOT NULL,
      account_id TEXT,
      cancellation_penalty_count INTEGER NOT NULL DEFAULT 0,
      registered_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    -- Reservation
    CREATE TABLE IF NOT EXISTS reservations (
      reservation_id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      staff_id INTEGER NOT NULL,
      is_nominated INTEGER NOT NULL DEFAULT 0 CHECK(is_nominated IN (0, 1)),
      nomination_fee INTEGER NOT NULL DEFAULT 0,
      start_datetime TEXT NOT NULL,
      total_duration INTEGER NOT NULL CHECK(total_duration >= 10),
      status INTEGER NOT NULL DEFAULT 0 CHECK(status >= 0 AND status <= 4),
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (customer_id) REFERENCES customers(customer_id),
      FOREIGN KEY (staff_id) REFERENCES staff(staff_id)
    );

    -- Reservation Menu Detail
    CREATE TABLE IF NOT EXISTS reservation_menus (
      reservation_id INTEGER NOT NULL,
      menu_id INTEGER NOT NULL,
      price_at_booking INTEGER NOT NULL,
      duration_at_booking INTEGER NOT NULL,
      PRIMARY KEY (reservation_id, menu_id),
      FOREIGN KEY (reservation_id) REFERENCES reservations(reservation_id),
      FOREIGN KEY (menu_id) REFERENCES menus(menu_id)
    );

    -- Favorite
    CREATE TABLE IF NOT EXISTS favorites (
      customer_id INTEGER NOT NULL,
      target_type INTEGER NOT NULL CHECK(target_type IN (0, 1)),
      target_id INTEGER NOT NULL,
      PRIMARY KEY (customer_id, target_type, target_id),
      FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
    );
  `);

  // Seed data
  seedData(db);
}

function seedData(db: Database.Database): void {
  // System Settings
  db.prepare(`INSERT INTO system_settings (id, cancellation_penalty_limit, same_day_cancellation_hours, booking_window_days, time_slot_interval, nomination_fee) VALUES (1, 3, 24, 30, 30, 500)`).run();

  // Menu Categories
  const insertCategory = db.prepare(`INSERT INTO menu_categories (category_name, display_order) VALUES (?, ?)`);
  insertCategory.run('Cut', 0);
  insertCategory.run('Color', 1);
  insertCategory.run('Perm', 2);
  insertCategory.run('Treatment', 3);

  // Menus
  const insertMenu = db.prepare(`INSERT INTO menus (menu_name, category_id, price, duration, description, is_public) VALUES (?, ?, ?, ?, ?, ?)`);
  insertMenu.run('Standard Cut', 1, 4500, 60, 'Standard haircut with shampoo and blow dry', 1);
  insertMenu.run('Kids Cut', 1, 3000, 30, 'Haircut for children under 12', 1);
  insertMenu.run('Color (Full)', 2, 8000, 90, 'Full head coloring with premium dye', 1);
  insertMenu.run('Highlight', 2, 6000, 60, 'Partial highlights for a natural look', 1);
  insertMenu.run('Perm', 3, 10000, 120, 'Digital perm for lasting curls', 1);
  insertMenu.run('Deep Treatment', 4, 3500, 30, 'Intensive hair repair treatment', 1);

  // Staff
  const insertStaff = db.prepare(`INSERT INTO staff (staff_name, profile, is_active) VALUES (?, ?, ?)`);
  insertStaff.run('Tanaka', 'Senior stylist with 10 years experience', 1);
  insertStaff.run('Suzuki', 'Color specialist', 1);
  insertStaff.run('Sato', 'Junior stylist, great with kids', 1);

  // Staff Shifts (Mon-Sat working, Sun off for all staff)
  const insertShift = db.prepare(`INSERT INTO staff_shifts (staff_id, day_of_week, start_time, end_time, is_working) VALUES (?, ?, ?, ?, ?)`);
  for (let staffId = 1; staffId <= 3; staffId++) {
    for (let dow = 0; dow <= 6; dow++) {
      if (dow === 0) {
        // Sunday off
        insertShift.run(staffId, dow, '09:00', '19:00', 0);
      } else {
        insertShift.run(staffId, dow, '09:00', '19:00', 1);
      }
    }
  }

  // Staff Menu Assignments (all staff can do all menus)
  const insertAssignment = db.prepare(`INSERT INTO staff_menu_assignments (staff_id, menu_id) VALUES (?, ?)`);
  for (let staffId = 1; staffId <= 3; staffId++) {
    for (let menuId = 1; menuId <= 6; menuId++) {
      insertAssignment.run(staffId, menuId);
    }
  }
}

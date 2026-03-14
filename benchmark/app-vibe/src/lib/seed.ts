import { getDb } from "./db";

export function seedIfEmpty() {
  const db = getDb();
  const count = db.prepare("SELECT COUNT(*) as c FROM menus").get() as {
    c: number;
  };
  if (count.c > 0) return;

  // Menu Categories
  const insertCategory = db.prepare(
    "INSERT INTO menu_categories (category_name, display_order) VALUES (?, ?)"
  );
  insertCategory.run("Cut", 0);
  insertCategory.run("Color", 1);
  insertCategory.run("Perm", 2);
  insertCategory.run("Treatment", 3);

  // Menus
  const insertMenu = db.prepare(
    "INSERT INTO menus (menu_name, category_id, price, duration, description, is_public) VALUES (?, ?, ?, ?, ?, ?)"
  );
  insertMenu.run("Standard Cut", 1, 4500, 60, "Basic haircut with shampoo and blow-dry", 1);
  insertMenu.run("Kids Cut", 1, 3000, 30, "Haircut for children under 12", 1);
  insertMenu.run("Full Color", 2, 7000, 90, "Single-process color from roots to ends", 1);
  insertMenu.run("Highlight", 2, 9000, 120, "Partial or full highlights with foils", 1);
  insertMenu.run("Digital Perm", 3, 12000, 150, "Long-lasting curls using digital perm rods", 1);
  insertMenu.run("Point Perm", 3, 8000, 90, "Partial perm for added volume or texture", 1);
  insertMenu.run("Deep Treatment", 4, 3500, 30, "Intensive hair repair treatment", 1);
  insertMenu.run("Scalp Spa", 4, 5000, 60, "Relaxing scalp massage and cleansing", 1);

  // Staff
  const insertStaff = db.prepare(
    "INSERT INTO staff (staff_name, profile, is_active) VALUES (?, ?, ?)"
  );
  insertStaff.run("Yuki Tanaka", "10 years experience. Specializes in color techniques.", 1);
  insertStaff.run("Ren Suzuki", "Expert in perm and digital styling.", 1);
  insertStaff.run("Aoi Yamamoto", "Friendly stylist who loves creative cuts.", 1);

  // Staff Shifts (all work Mon-Sat, off Sunday)
  const insertShift = db.prepare(
    "INSERT INTO staff_shifts (staff_id, day_of_week, start_time, end_time, is_working) VALUES (?, ?, ?, ?, ?)"
  );
  for (let staffId = 1; staffId <= 3; staffId++) {
    for (let dow = 0; dow <= 6; dow++) {
      const isWorking = dow === 0 ? 0 : 1; // Sunday off
      insertShift.run(staffId, dow, "09:00", "19:00", isWorking);
    }
  }

  // Staff Menu Assignments (all staff can do all menus)
  const insertAssignment = db.prepare(
    "INSERT INTO staff_menu_assignments (staff_id, menu_id) VALUES (?, ?)"
  );
  for (let staffId = 1; staffId <= 3; staffId++) {
    for (let menuId = 1; menuId <= 8; menuId++) {
      insertAssignment.run(staffId, menuId);
    }
  }

  // Sample customer
  const insertCustomer = db.prepare(
    "INSERT INTO customers (customer_name, phone_number, account_id, cancellation_penalty_count) VALUES (?, ?, ?, ?)"
  );
  insertCustomer.run("Sakura Sato", "09012345678", "user_1", 0);
}

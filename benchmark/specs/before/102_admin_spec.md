# Salon Reservation System — Admin Features Specification

> Referenced Data:
> - `01_master_data.md` (Menu Category, Menu Master, Staff Master, Staff Shift, Staff Menu Assignment, System Settings)
> - `02_persistent_data.md` (Customer, Reservation, Reservation Menu Detail)
> - `03_screen_data.md` (Admin Calendar Screen, Menu Management Screen, Staff Management Screen)

---

## §1. Process Triggers and Overview

This specification defines all Processes for the 3 admin screens (Reservation List/Calendar, Menu Management, Staff Management).
Customer-facing features (menu list, reservation creation, my page) are scoped to `101_customer_spec.md`.

| Section | Process Name | Trigger | Screen |
|:--|:--|:--|:--|
| §2-1, §3-1 | Fetch admin reservations | On screen display / date change | Reservation Calendar |
| §2-2, §3-2 | Update status (check-in) | On check-in action | Reservation Calendar |
| §2-3, §3-3 | Save menu | On save action | Menu Management |
| §2-4, §3-4 | Hide menu | On toggle action | Menu Management |
| §2-5, §3-5 | Save staff | On save action | Staff Management |
| §2-6, §3-6 | Save shifts | On save action | Staff Management |
| §2-7, §3-7 | Save supported menus | On save action | Staff Management |
| §2-8, §3-8 | Complete service | On admin action | Reservation Calendar |
| §2-9, §3-9 | No-show processing | On admin action | Reservation Calendar |

> Note: Admin reservation fetch is executed only on screen display and date change. Real-time updates (e.g., WebSocket) when reservations are created/modified on the customer side are outside the scope of this system.

---

## §2. Decision Logic (Conditional Branching)

### §2-1. Fetch Admin Reservations — Screen Initialization / Date Change

Executed on the Reservation List/Calendar screen display, or on date navigation / display mode change.

**Screen Initialization (first display):**
- Initialize `display_date` to today's date.
- Initialize `display_mode` to 0 (daily).
- Initialize `filter_staff_id` to 0 (show all staff).
- Initialize `selected_reservation_id` to 0 (none selected).

**Date Navigation:**
- Previous/next day buttons => Adjust `display_date` by ±1 day.
- Calendar date selection => Set `display_date` to the selected date.

- Proceed to data retrieval (§3-1).

---

### §2-2. Update Status (Check-In)

Executed when "Check-in" is triggered in the reservation detail panel.

**Guard Conditions:**
- If `selected_reservation_id` = 0 (none selected) => Do not execute this process.
- If `Reservation[selected_reservation_id].status` is not 0 (confirmed) => Display "Only confirmed reservations can be checked in." End process.

- Proceed to data update (§3-2).

---

### §2-3. Save Menu

Executed when "Save" is triggered in the menu edit form on the Menu Management screen.

**Validation:**
- If `menu_name` (input value) is empty => Display "Please enter a menu name." Abort.
- If `price` (input value) is less than 1 or exceeds 99999 => Display "Please enter a price between ¥1 and ¥99,999." Abort.
- If `duration` (input value) is less than 10 or exceeds 480 => Display "Please enter a duration between 10 and 480 minutes." Abort.
- If `category_id` (input value) does not exist in `Menu Category` => Display "Invalid category." Abort.

**New/Update Determination:**
- If `editing_menu_id` = 0 (add new mode) => Proceed to data update as new creation (§3-3).
- If `editing_menu_id` >= 1 (edit mode) => Proceed to data update as update (§3-3).

---

### §2-4. Hide Menu

Executed when "Publish/Hide toggle" is triggered on the Menu Management screen.

- Check the current value of `Menu Master[menu_id].is_public`.
  - If 1 (public) => Set to 0 (hidden). Proceed to data update (§3-4).
  - If 0 (hidden) => Set to 1 (public). Proceed to data update (§3-4).

> Note: Hiding a menu does not affect existing `Reservation` or `Reservation Menu Detail` records already confirmed with this menu.

---

### §2-5. Save Staff

Executed when "Save" is triggered for staff information on the Staff Management screen.

**Validation:**
- If `staff_name` (input value) is empty => Display "Please enter a staff name." Abort.

**Deactivation Impact Check:**
- When changing `is_active` to 0 (inactive), search `Reservation` for records where `staff_id` = `editing_staff_id`, `status` = 0 (confirmed), and `start_datetime` >= current datetime.
  - **Exists =>** Display warning: "[N] confirmed reservations exist. Deactivate this staff member?" Proceed to data update (§3-5) only if the admin confirms.

**New/Update Determination:**
- If `editing_staff_id` = 0 (add new mode) => Proceed to data update as new creation (§3-5).
- If `editing_staff_id` >= 1 (edit mode) => Proceed to data update as update (§3-5).

---

### §2-6. Save Shifts

Executed when "Save" is triggered for the shift settings table on the Staff Management screen.

**Validation:**
- For each day of the week, if `is_working` = 1 (working) and `start_time` >= `end_time` => Display "The end time for [day name] must be after the start time." Abort.

**Existing Reservation Conflict Check:**
- For the target staff x modified days of the week, search future `Reservation` records (`status` = 0: confirmed, `start_datetime` >= current datetime) for reservations that fall outside the new shift hours.
  - **Conflict found =>** Display warning: "The reservation on [date] at [time] will be outside the shift hours. Change the shift?" Proceed to data update (§3-6) only if the admin confirms.
  - **No conflict =>** Proceed to data update (§3-6).

---

### §2-7. Save Supported Menus

Executed when "Save" is triggered for the supported menu checklist on the Staff Management screen.

- Proceed to data update (§3-7).

---

### §2-8. Complete Service

Executed when "Complete Service" is triggered in the reservation detail panel.

**Guard Conditions:**
- If `selected_reservation_id` = 0 (none selected) => Do not execute this process.
- If `Reservation[selected_reservation_id].status` is not 2 (checked in) => Display "Only checked-in reservations can be marked as completed." End process.

- Proceed to data update (§3-8).

---

### §2-9. No-Show Processing

Executed when "No-Show" is triggered in the reservation detail panel.

**Guard Conditions:**
- If `selected_reservation_id` = 0 (none selected) => Do not execute this process.
- If `Reservation[selected_reservation_id].status` is not 0 (confirmed) => Display "Only confirmed reservations can be marked as no-show." End process.

- Proceed to data update (§3-9).

---

## §3. Data Update Processing

### §3-1. Fetch Admin Reservations

1. Determine the retrieval range.
   - If `display_mode` = 0 (daily) => 1 day of `display_date`.
   - If `display_mode` = 1 (weekly) => 7 days of the week containing `display_date` (Monday through Sunday).
2. Retrieve `Reservation` records matching the following conditions:
   - Date of `start_datetime` is within the retrieval range
   - If `filter_staff_id` >= 1 => Further filter by `staff_id` = `filter_staff_id`
3. For each reservation, join with `Reservation Menu Detail` and `Customer[Reservation.customer_id]`.
4. Store the results in `admin_reservation_list` (limit 200).
5. Proceed to display update (§4-1).

---

### §3-2. Update Status (Check-In)

1. Update `Reservation[selected_reservation_id].status` to 2 (checked in).
2. Update `Reservation[selected_reservation_id].updated_at` to current datetime.
3. Re-execute fetch admin reservations (§3-1) to refresh the list.

---

### §3-3. Save Menu

**New creation:**
1. Create a new record in `Menu Master`.
   - `menu_id`: auto-assigned
   - `menu_name`: input value
   - `category_id`: input value
   - `price`: input value
   - `duration`: input value
   - `description`: input value
   - `is_public`: 0 (hidden. Publishing is done separately via toggle)

**Update:**
1. Update the following fields of `Menu Master[menu_id]` with input values:
   - `menu_name`, `category_id`, `price`, `duration`, `description`

> Note: Changing the price or duration does not affect existing `Reservation Menu Detail` records' `price_at_booking` or `duration_at_booking` (already snapshotted).

2. Re-fetch the menu list table and proceed to display update (§4-2).

---

### §3-4. Hide Menu

1. Toggle `Menu Master[menu_id].is_public` (0 -> 1, 1 -> 0).
2. Re-fetch the menu list table and proceed to display update (§4-2).

---

### §3-5. Save Staff

**New creation:**
1. Create a new record in `Staff Master`.
   - `staff_id`: auto-assigned
   - `staff_name`: input value
   - `profile`: input value
   - `is_active`: 1 (active)

**Update:**
1. Update the following fields of `Staff Master[staff_id]` with input values:
   - `staff_name`, `profile`, `is_active`

> Note: Setting `is_active` to 0 (inactive) retains past `Reservation` data (per `Staff Master.is_active` field description).

2. Re-fetch the staff list and proceed to display update (§4-3).

---

### §3-6. Save Shifts

1. Update the target staff's `Staff Shift` records by day of week (full replacement).
   - Delete all existing `Staff Shift` records for the target staff.
   - Create new records for each day of the week (0–6) from input values:
     - `staff_id`: target staff's ID
     - `day_of_week`: 0–6
     - `start_time`: input value
     - `end_time`: input value
     - `is_working`: input value
2. Re-fetch the staff list and proceed to display update (§4-3).

---

### §3-7. Save Supported Menus

1. Replace all `Staff Menu Assignment` records for the target staff.
   - Delete all existing `Staff Menu Assignment` records for the target staff.
   - Create new records for each checked menu:
     - `staff_id`: target staff's ID
     - `menu_id`: checked menu's ID
2. Re-fetch the staff list and proceed to display update (§4-3).

---

### §3-8. Complete Service

1. Update `Reservation[selected_reservation_id].status` to 3 (completed).
2. Update `Reservation[selected_reservation_id].updated_at` to current datetime.
3. Re-execute fetch admin reservations (§3-1) to refresh the list.

---

### §3-9. No-Show Processing

1. Update `Reservation[selected_reservation_id].status` to 4 (no-show).
2. Update `Reservation[selected_reservation_id].updated_at` to current datetime.
3. Increment `Customer[Reservation[selected_reservation_id].customer_id].cancellation_penalty_count` by 1 (not exceeding `System Settings.cancellation_penalty_limit`).
4. Re-execute fetch admin reservations (§3-1) to refresh the list.

> Note: No-show is treated as a penalty event, equivalent to a same-day cancellation.

---

## §4. Display and Visual Updates (UI Hooks)

### §4-1. Reservation Calendar Screen — After Reservation Fetch

**Daily view (`display_mode` = 0):**
- Group `admin_reservation_list` by staff and display in time order of `start_datetime`.
- Each reservation displays the following:
  - Time range: `Reservation.start_datetime` time to `Reservation.start_datetime` + `Reservation.total_duration` in "HH:MM–HH:MM" format
  - Customer name: `Customer[Reservation.customer_id].customer_name`
  - Menus: For each `menu_id` in `Reservation Menu Detail`, `Menu Master[menu_id].menu_name` comma-separated
  - Status label: 0=Confirmed, 1=Cancelled, 2=Checked In, 3=Completed, 4=No-Show

**Weekly view (`display_mode` = 1):**
- Grid display with staff (rows) x time slots (columns). Each reservation is displayed as a block proportional to `total_duration`.
- Blocks show `Customer[Reservation.customer_id].customer_name` and the first menu name.

---

### §4-2. Menu Management Screen — After Menu List Update

- Each row in the menu list table displays the following:
  - Menu name: `Menu Master[menu_id].menu_name`
  - Category name: `Menu Category[Menu Master[menu_id].category_id].category_name`
  - Price: `Menu Master[menu_id].price` in "¥X,XXX" format
  - Duration: `Menu Master[menu_id].duration` in "XX min" format
  - Publication status: `Menu Master[menu_id].is_public` = 1 -> "Published", = 0 -> "Hidden"
- Rows with `is_public` = 0 are displayed with a grayed-out style.

---

### §4-3. Staff Management Screen — After Staff List Update

- Each row in the staff list displays the following:
  - Staff name: `Staff Master[staff_id].staff_name`
  - Supported menu count: Count of `Staff Menu Assignment` records matching the `staff_id`
  - This week's shift summary: Retrieve `is_working` for each day of the current week from `Staff Shift` and display working days as "Mon, Wed, Fri" format. Days with `is_working` = 0 are not shown
  - Active status: `Staff Master[staff_id].is_active` = 1 -> "Active", = 0 -> "Inactive"
- Rows with `is_active` = 0 are displayed with a grayed-out style.

---

### §4-4. Reservation Calendar Screen — Reservation Detail Panel

When a reservation is selected (`selected_reservation_id` >= 1), display the detail panel.

- Customer name: `Customer[Reservation[selected_reservation_id].customer_id].customer_name`
- Phone number: `Customer[Reservation[selected_reservation_id].customer_id].phone_number`
- Date/time: `Reservation[selected_reservation_id].start_datetime` in "YYYY/MM/DD HH:MM" format
- Staff name: `Staff Master[Reservation[selected_reservation_id].staff_id].staff_name`
- Nomination: `Reservation[selected_reservation_id].is_nominated` = 1 -> "Nominated", = 0 -> "No preference"
- Menu list: For each `Reservation Menu Detail` record:
  - `Menu Master[menu_id].menu_name` — `price_at_booking` yen / `duration_at_booking` min
- Total price: Sum of `Reservation Menu Detail.price_at_booking` in "¥X,XXX" format
- Status: Label corresponding to `Reservation[selected_reservation_id].status`
- If `status` = 0 (confirmed) => Show "Check-in" and "No-Show" buttons.
- If `status` = 2 (checked in) => Show "Complete Service" button.
- Otherwise => Do not show status change buttons.

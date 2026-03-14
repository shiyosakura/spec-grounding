# Salon Reservation System — Customer-Facing Features Specification

> Referenced Data:
> - `01_master_data.md` (Menu Category, Menu Master, Staff Master, Staff Shift, Staff Menu Assignment, System Settings)
> - `02_persistent_data.md` (Customer, Reservation, Reservation Menu Detail, Favorite)
> - `03_screen_data.md` (Menu List Screen, Reservation Creation Screen, My Page Screen)

---

## §1. Process Triggers and Overview

This specification defines all Processes for the 3 customer-facing screens (Menu List, Reservation Creation, My Page).
Admin features (menu management, staff management, reservation calendar) are scoped to `102_admin_spec.md`.

| Section | Process Name | Trigger | Screen |
|:--|:--|:--|:--|
| §2-1, §3-1 | Fetch menu list | On Menu List screen display | Menu List |
| §2-2, §3-2 | Category filtering | On filter action | Menu List |
| §2-3, §3-3 | Availability calculation | On staff/date selection | Reservation Creation |
| §2-4, §3-4 | No-preference availability calculation | On "No preference" selection | Reservation Creation |
| §2-5, §3-5 | Duplicate check | Immediately before reservation confirmation | Reservation Creation |
| §2-6, §3-6 | Confirm reservation | On confirm button press | Reservation Creation |
| §2-7, §3-7 | Guest customer registration | On reservation confirmation while not logged in | Reservation Creation |
| §2-8, §3-8 | Fetch reservation list | On My Page screen display | My Page |
| §2-9, §3-9 | Cancellation eligibility check | On cancel button press | My Page |
| §2-10, §3-10 | Process cancellation | After cancellation confirmation | My Page |
| §2-11, §3-11 | Reservation modification | On modification selection | My Page |
| §2-12, §3-12 | Toggle favorite | On register/unregister action | My Page |

---

## §2. Decision Logic (Conditional Branching)

### §2-1. Fetch Menu List — Screen Initialization

Executed when the Menu List screen is displayed.

- Initialize `selected_category_id` to 0 (show all categories).
- Proceed to data retrieval (§3-1).

---

### §2-2. Category Filtering

Executed when the category filter is toggled.

- Update `selected_category_id` to the category ID selected by the user.
- Proceed to data retrieval (§3-2).

---

### §2-3. Availability Calculation — With Staff Nomination

Executed on the Reservation Creation screen when both a staff member (`selected_staff_id` >= 1) and a date are selected.

**Guard Conditions:**
- If `selected_staff_id` is 0 (no preference) => Do not execute this process (go to §2-4).
- If `selected_date` is not selected => Do not execute this process.
- If `selected_date` is before today => Do not execute this process.
- If `selected_date` exceeds `System Settings.booking_window_days` (default `30`) days from today => Display "The selected date is beyond the booking window." End process.
- If `selected_menu_count` is 0 => Do not execute this process (no menu selected).
- Reference `Staff Menu Assignment` to verify that `selected_staff_id` can handle all menu IDs in `selected_menu_list`. If any menu is unsupported => Display "The selected staff member does not support some of the selected menus." End process.

**Prerequisite Check:**
- Retrieve the record from `Staff Shift` matching `selected_staff_id` x day of week of `selected_date`.
  - If `is_working` = 0 (day off) => Clear `available_slot_list`, display "The selected staff member is off on this day." End process.
  - If `is_working` = 1 (working) => Proceed to data retrieval (§3-3).

---

### §2-4. No-Preference Availability Calculation

Executed on the Reservation Creation screen when `selected_staff_id` = 0 (no preference) and a date is selected.

**Guard Conditions:**
- If `selected_date` is not selected => Do not execute this process.
- If `selected_date` is before today => Do not execute this process.
- If `selected_date` exceeds `System Settings.booking_window_days` (default `30`) days from today => Display "The selected date is beyond the booking window." End process.
- If `selected_menu_count` is 0 => Do not execute this process.

- Proceed to data retrieval (§3-4).

---

### §2-5. Duplicate Check — Optimistic Locking

Executed immediately before reservation confirmation (§3-6).

- Check whether any existing `Reservation` records (with `status` = 0: confirmed) overlap with the time range of the target staff_id x start_datetime x total_duration.
  - **Exists (conflict detected) =>** Display "The selected time slot conflicts with another reservation. Please refresh the available slots." Re-execute availability calculation (§2-3 or §2-4). Do not proceed to reservation confirmation.
  - **Does not exist (no conflict) =>** Proceed to reservation confirmation (§3-6).

---

### §2-6. Confirm Reservation — Execution from Confirmation Dialog

Executed when the confirm button is pressed in the reservation confirmation dialog.

**Guard Conditions:**
- If `confirmation_dialog_visible` = 0 => Do not execute this process.
- If `selected_menu_count` = 0 => Do not execute this process.
- If `selected_time_slot` is not selected => Do not execute this process.

**Penalty Check (if logged in):**
- If `Customer.cancellation_penalty_count` >= `System Settings.cancellation_penalty_limit` (default `3`) => Display "You have reached the maximum number of cancellations and cannot make new reservations. Please contact us by phone." End process.

**Login Check:**
- If the customer is logged in => Duplicate check (§2-5) -> Data update (§3-6).
- If the customer is not logged in => Display the guest info input form. After form completion, guest customer registration (§2-7) -> Duplicate check (§2-5) -> Data update (§3-6).

---

### §2-7. Guest Customer Registration

Executed when a non-logged-in customer confirms a reservation.

**Validation:**
- If `customer_name` (input value) is empty => Display "Please enter your name." Abort.
- If `phone_number` (input value) is empty or contains non-numeric characters => Display "Please enter a valid phone number." Abort.

**Existing Customer Lookup:**
- Search `Customer` for a record matching the `phone_number`.
  - **Match found =>** Use the existing `customer_id` for the reservation. Proceed to data update (§3-7) (name update only).
  - **No match =>** Create a new `Customer` record. Proceed to data update (§3-7).

---

### §2-8. Fetch Reservation List — My Page Initialization

Executed when the My Page screen is displayed.

- Proceed to data retrieval (§3-8).

---

### §2-9. Cancellation Eligibility Check

Executed when the cancel button is pressed on the My Page screen.

- If the target reservation's `status` is not 0 (confirmed) => Cannot cancel. End process.
- If `Customer.cancellation_penalty_count` >= `System Settings.cancellation_penalty_limit` (default `3`) => Display "You have reached the maximum number of cancellations and cannot cancel. Please contact us by phone." End process.
- Otherwise => Display the cancellation confirmation dialog. After confirmation, proceed to cancellation processing (§3-10).

---

### §2-10. Process Cancellation

Executed after confirmation in the cancellation confirmation dialog.

**Same-Day Cancellation Check:**
- If the current datetime is at or after `System Settings.same_day_cancellation_hours` (default `24` hours) before `Reservation.start_datetime` => Treat as same-day cancellation. Proceed to data update with penalty increment (§3-10).
- Otherwise => Normal cancellation. Proceed to data update without penalty increment (§3-10).

---

### §2-11. Reservation Modification

Executed when "Modify" is selected for a reservation on the My Page screen.

**Guard Conditions:**
- If the target reservation's `status` is not 0 (confirmed) => Cannot modify. End process.

- Execute data handoff (§3-11) and navigate to the Reservation Creation screen.

---

### §2-12. Toggle Favorite

Executed when a favorite is registered/unregistered on the My Page screen.

- Check whether a `Favorite` record already exists for the target (staff or menu).
  - **Exists =>** Proceed to deletion (§3-12).
  - **Does not exist =>** Proceed to addition (§3-12).

---

## §3. Data Update Processing

### §3-1. Fetch Menu List

1. Retrieve all records from `Menu Master` where `is_public` = 1.
2. Group by category in ascending order of `Menu Category.display_order` and display as the menu list.
3. Proceed to display update (§4-1).

---

### §3-2. Category Filtering

1. If `selected_category_id` = 0 (all categories) => Display the same result as §3-1.
2. If `selected_category_id` >= 1 => From the §3-1 results, extract and display only menus where `Menu Master[menu_id].category_id` = `selected_category_id`.
3. Proceed to display update (§4-1).

---

### §3-3. Availability Calculation (With Nomination)

1. Retrieve the `start_time` to `end_time` range from `Staff Shift` for the record matching `selected_staff_id` x day of week of `selected_date` as the working hours.
2. Retrieve all `Reservation` records matching the following conditions:
   - `staff_id` = `selected_staff_id`
   - Date of `start_datetime` = `selected_date`
   - `status` = 0 (confirmed) or 2 (checked in)
3. Divide the working hours into `System Settings.time_slot_interval` (default `30` minute) intervals.
4. For each slot, check whether it overlaps with any existing reservation's time range (`start_datetime` to `start_datetime` + `total_duration`) from step 2. Overlapping slots are marked as "occupied."
5. Calculate all start times where consecutive available slots exist for the `total_duration` (sum of durations from `selected_menu_list`).
6. Store the results in `available_slot_list`. Each element's `staff_id` is set to `selected_staff_id`.
7. If `available_slot_list` is empty => Display "No availability found for the selected criteria."
8. Proceed to display update (§4-2).

---

### §3-4. No-Preference Availability Calculation

1. Retrieve all staff from `Staff Master` where `is_active` = 1.
2. Further filter by referencing `Staff Menu Assignment` to include only staff who can handle all menu IDs in `selected_menu_list` (staff who can handle all menus alone).
3. For each filtered staff member, execute steps 1–5 of §3-3.
4. Consolidate available slots across all staff. If multiple staff have availability at the same start time, select the staff with the smallest `staff_id` as the auto-assignment candidate.
5. Store the consolidated results in `available_slot_list`. Each element's `staff_id` is set to the auto-assignment candidate's staff ID.
6. If `available_slot_list` is empty => Display "No availability found for the selected criteria."
7. Proceed to display update (§4-2).

---

### §3-5. Duplicate Check

1. Search `Reservation` for records matching the following conditions:
   - `staff_id` = target staff ID (`available_slot_list[selected_time_slot].staff_id`)
   - `status` = 0 (confirmed)
   - Time overlap: existing reservation's (`start_datetime` to `start_datetime` + `total_duration`) overlaps with new reservation's (`selected_date` + `selected_time_slot` to same + `total_duration`)
2. If 1 or more matching records exist => Conflict detected (return to §2-5 branching).
3. If 0 matching records => No conflict. Proceed to reservation confirmation (§3-6).

---

### §3-6. Confirm Reservation

1. Create a new record in `Reservation`.
   - `reservation_id`: auto-assigned
   - `customer_id`: authenticated customer ID if logged in; `customer_id` obtained/created in §3-7 if guest
   - `staff_id`: `available_slot_list[selected_time_slot].staff_id`
   - `is_nominated`: 1 (nominated) if `selected_staff_id` >= 1; 0 (no preference) if `selected_staff_id` = 0
   - `start_datetime`: `selected_date` + `selected_time_slot`
   - `total_duration`: `total_duration` (calculated screen data value)
   - `status`: 0 (confirmed)
   - `created_at`: current datetime
   - `updated_at`: current datetime
2. For each menu ID in `selected_menu_list`, create a record in `Reservation Menu Detail`.
   - `reservation_id`: the `reservation_id` created in step 1
   - `menu_id`: `selected_menu_list[i]`
   - `price_at_booking`: `Menu Master[selected_menu_list[i]].price`
   - `duration_at_booking`: `Menu Master[selected_menu_list[i]].duration`
3. If `modification_source_reservation_id` >= 1 (modification mode) => Update `Reservation[modification_source_reservation_id].status` to 1 (cancelled) and update `updated_at` to current datetime.
   > Note: This cancellation of the source reservation is an automatic process accompanying a reservation modification and does NOT increment `Customer.cancellation_penalty_count`. The status value uses the same 1 as a regular cancellation.
4. Clear the Reservation Creation screen's transient data and navigate to the My Page screen.

---

### §3-7. Guest Customer Registration

**If existing customer matched:**
1. Update the matched `Customer` record's `customer_name` with the input value (reflect the latest name).
2. Use this `customer_id` as the `customer_id` for reservation confirmation (§3-6).

**If creating new:**
1. Create a new record in `Customer`.
   - `customer_id`: auto-assigned
   - `customer_name`: input value
   - `phone_number`: input value
   - `account_id`: null (guest)
   - `cancellation_penalty_count`: 0
   - `registered_at`: current datetime
2. Use this `customer_id` as the `customer_id` for reservation confirmation (§3-6).

---

### §3-8. Fetch Reservation List

1. Retrieve all records from `Reservation` where `customer_id` matches the logged-in customer's ID.
2. Join with `Reservation Menu Detail` to retrieve menu information for each reservation.
3. Store records where `start_datetime` is at or after the current datetime in `upcoming_reservation_list`, sorted by `start_datetime` ascending (limit 20).
4. Store records where `start_datetime` is before the current datetime in `past_reservation_list`, sorted by `start_datetime` descending (limit 50).
5. Proceed to display update (§4-3).

---

### §3-9. Cancellation Eligibility Check

This process does not update data. It updates the UI based on the check results from §2-9.

- Cancellation allowed => Display the cancellation confirmation dialog.
- Cancellation not allowed (penalty limit reached) => Display error message.

---

### §3-10. Process Cancellation

1. Update `Reservation[target_reservation_id].status` to 1 (cancelled).
2. Update `Reservation[target_reservation_id].updated_at` to current datetime.
3. If same-day cancellation was determined in §2-10 => Increment `Customer[customer_id].cancellation_penalty_count` by 1 (not exceeding `System Settings.cancellation_penalty_limit`).
4. Re-fetch the reservation list (§3-8).

---

### §3-11. Reservation Modification — Handoff to Reservation Creation Screen

1. Retrieve `menu_id` from the target reservation's `Reservation Menu Detail` and set in `selected_menu_list`.
2. Set `selected_menu_count` to the record count of `Reservation Menu Detail`.
3. Set `selected_staff_id` to `Reservation[target_reservation_id].staff_id`. However, if `is_nominated` = 0, set `selected_staff_id` to 0 (no preference).
4. Set `selected_date` to the date portion of `Reservation[target_reservation_id].start_datetime`.
5. Set `modification_source_reservation_id` to the target reservation's `reservation_id`.
6. Navigate to the Reservation Creation screen. After navigation, availability calculation (§2-3 or §2-4) is automatically executed.

---

### §3-12. Toggle Favorite

**Addition:**
1. Create a new record in `Favorite`.
   - `customer_id`: logged-in customer's ID
   - `target_type`: 0 (staff) or 1 (menu)
   - `target_id`: target staff ID or menu ID

**Deletion:**
1. Delete the record from `Favorite` matching `customer_id` x `target_type` x `target_id`.

2. Proceed to display update (§4-4).

---

## §4. Display and Visual Updates (UI Hooks)

### §4-1. Menu List Screen — After Menu Fetch/Filter

- Update the menu card list. Each card displays the following:
  - Menu name: `Menu Master[menu_id].menu_name`
  - Price: `Menu Master[menu_id].price` in "¥X,XXX" format
  - Duration: `Menu Master[menu_id].duration` in "approx. XX min" format
  - Description: `Menu Master[menu_id].description`
  - Category name: `Menu Category[Menu Master[menu_id].category_id].category_name`
- Update the category filter selection state to match `selected_category_id`.
- The salon info header is fetched and displayed only once on screen load (not updated on filter actions).

---

### §4-2. Reservation Creation Screen — After Availability Calculation

- Update the time slot list based on `available_slot_list`. Display each slot's start time in "HH:MM" format.
- If `available_slot_list` is empty, display "No availability."
- Calculate and display the total price:
  - Sum `Menu Master[menu_id].price` for each menu ID in `selected_menu_list`
  - Store the result in `total_price` and display in "¥X,XXX" format
- Calculate and display the total duration:
  - Sum `Menu Master[menu_id].duration` for each menu ID in `selected_menu_list`
  - Store the result in `total_duration` and display in "approx. XX min" format

---

### §4-3. My Page Screen — Reservation List Display

- For each reservation in the upcoming reservation list, display the following:
  - Date/time: `Reservation[reservation_id].start_datetime` in "YYYY/MM/DD HH:MM" format
  - Staff name: `Staff Master[Reservation[reservation_id].staff_id].staff_name`
  - Menu names: For each `menu_id` in `Reservation Menu Detail`, `Menu Master[menu_id].menu_name` comma-separated
  - Total price: Sum of `Reservation Menu Detail.price_at_booking` in "¥X,XXX" format
  - Status: Label corresponding to `Reservation[reservation_id].status` (0=Confirmed, 1=Cancelled, 2=Checked In, 3=Completed, 4=No-Show)
  - Show "Cancel" and "Modify" buttons only when `status` = 0 (confirmed)
- For each reservation in the past reservation list, display the same items as above. Additionally show a "Re-book" button.
  - On re-book: Execute the same handoff logic as §3-11 (reservation modification). However, set `modification_source_reservation_id` to 0 (new reservation mode).
- Favorite staff list: For `Favorite` records with `target_type` = 0, display `Staff Master[target_id].staff_name`.
- Favorite menu list: For `Favorite` records with `target_type` = 1, display `Menu Master[target_id].menu_name`.

---

### §4-4. My Page Screen — After Favorite Toggle

- Toggle the display state of the favorite icon (heart, etc.) for the toggled target.
  - If a `Favorite` record exists => Show icon as active
  - If not => Show icon as inactive
- Re-fetch and update the favorite staff/menu lists.

---

### §4-5. Reservation Creation Screen — On Menu Add/Remove

- Recalculate and display the following when `selected_menu_list` changes:
  - Total price: Sum of `Menu Master[selected_menu_list[i]].price` -> Store in `total_price`
  - Total duration: Sum of `Menu Master[selected_menu_list[i]].duration` -> Store in `total_duration`
- Menu removal is only possible when `selected_menu_count` >= 2 (at least 1 menu required). Disable the remove button when `selected_menu_count` = 1.
- Menu addition is only possible when `selected_menu_count` < 5 (limit of 5). Disable the add button when `selected_menu_count` = 5.
- After adding/removing a menu, if availability has already been calculated, re-execute availability calculation (§2-3 or §2-4).

---

### §4-6. Reservation Creation Screen — Confirmation Dialog Display

When a time slot is selected, set `confirmation_dialog_visible` to 1 and display the following:

- Selected menus: `Menu Master[menu_id].menu_name` for each menu ID in `selected_menu_list`
- Staff: `Staff Master[available_slot_list[selected_time_slot].staff_id].staff_name`. If `selected_staff_id` = 0, display "Auto-assigned: [staff_name]"
- Date/time: `selected_date` + `selected_time_slot` in "YYYY/MM/DD HH:MM" format
- Total price: `total_price` in "¥X,XXX" format
- Total duration: `total_duration` in "approx. XX min" format

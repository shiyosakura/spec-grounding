# Salon Reservation System — Transient Data (In-Memory)

> Data that exists only while a screen is displayed. Discarded on screen transition or session end.
> Always reference this file when writing specifications.
>
> Equivalent to "transient data" in games. In business applications, this corresponds to screen state and view models.

---

| Category | Field Name | Range | Count | Description |
| :-- | :-- | :-- | :-- | :-- |
| Menu List Screen | selected_category_id | 0–99 | 1 | Currently selected category filter. 0 = show all categories |
| Reservation Creation Screen | selected_menu_list | 0–999 | ×5 | List of currently selected menu IDs. 0 = unused slot (reserved). Valid IDs start at 1. References `Menu Master`. Max 5 |
| | selected_menu_count | 0–5 | 1 | Number of currently selected menus |
| | selected_staff_id | 0–99 | 1 | Currently selected staff. 0 = no preference |
| | selected_date | date | 1 | Currently selected date |
| | selected_time_slot | time (HH:MM) | 1 | Currently selected start time |
| | available_slot_start_times | time (HH:MM) | ×48 | Available slot start times for the selected date. Max 48 slots per day (30-min intervals × 24 hours) |
| | available_slot_staff_ids | 0–99 | ×48 | Staff ID corresponding to each available slot. 0 = unused slot (reserved). For "no preference" bookings, stores the auto-assignment candidate |
| | total_duration | 0–2400 | 1 | Sum of durations for selected menus. Total of `Menu Master[selected_menu_id].duration`. Maintained separately as it is used as a key for consecutive slot availability checks |
| | confirmation_dialog_visible | 0–1 | 1 | 0 = hidden, 1 = shown |
| | modification_source_reservation_id | 0–999999 | 1 | 0 = new reservation. 1+ = modification mode (source reservation ID). The original reservation is cancelled when the modification is confirmed |
| My Page Screen | cancellation_fee_preview | 0–999999 | 1 | Cancellation fee shown in the cancellation confirmation dialog (yen). Calculated as: `Cancellation Policy` rate × total price (at time of booking). 0 = free cancellation |
| | cancellation_rate_preview | 0–100 | 1 | Applicable cancellation fee rate (%). For display in the cancellation confirmation dialog |
| | upcoming_reservation_list | 0–999999 | ×20 | Array of reservation IDs to display. 0 = unused slot (reserved). Estimated max 20 |
| | past_reservation_list | 0–999999 | ×50 | Array of reservation IDs to display. 0 = unused slot (reserved). Estimated max 50 |
| Admin Calendar Screen | display_date | date | 1 | Currently displayed reference date |
| | display_mode | 0–1 | 1 | 0 = daily, 1 = weekly |
| | filter_staff_id | 0–99 | 1 | 0 = show all staff. 1+ = show specified staff only |
| | admin_reservation_list | 0–999999 | ×200 | Array of reservation IDs to display. 0 = unused slot (reserved). Max 10 staff × 20 slots per day = 200 |
| | selected_reservation_id | 0–999999 | 1 | 0 = none selected. 1+ = reservation ID shown in the detail panel |
| Menu Management Screen | editing_menu_id | 0–999 | 1 | 0 = add new mode. 1+ = edit mode (menu ID being edited) |
| Staff Management Screen | editing_staff_id | 0–99 | 1 | 0 = add new mode. 1+ = edit mode (staff ID being edited) |

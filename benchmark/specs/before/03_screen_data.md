# Salon Reservation System — Transient Data (In-Memory)

> Data that exists only while a screen is displayed. Discarded on screen transition or session end.
> Always reference this file when writing specifications.
>
> Equivalent to "transient data" in games. In business applications, this corresponds to screen state and view models.

---

| Category | Field Name | Range | Count | Description |
| :-- | :-- | :-- | :-- | :-- |
| Menu List Screen | selected_category_id | 0–99 | 1 | Currently selected category filter. 0 = show all categories |
| Reservation Creation Screen | selected_menu_list | menu ID array | ×5 | List of currently selected menu IDs. Max 5. References `Menu Master` |
| | selected_menu_count | 0–5 | 1 | Number of currently selected menus |
| | selected_staff_id | 0–99 | 1 | Currently selected staff. 0 = no preference |
| | selected_date | date | 1 | Currently selected date |
| | selected_time_slot | time (HH:MM) | 1 | Currently selected start time |
| | available_slot_list | (start_time, staff_id) array | ×48 | Available slots for the selected date. Max 48 per day (30-min intervals × 24 hours). For "no preference", staff_id stores the auto-assignment candidate |
| | total_price | 0–999999 | 1 | Sum of selected menu prices. Total of `Menu Master[selected_menu_id].price` |
| | total_duration | 0–2400 | 1 | Sum of selected menu durations. Total of `Menu Master[selected_menu_id].duration` |
| | confirmation_dialog_visible | 0–1 | 1 | 0 = hidden, 1 = shown |
| | modification_source_reservation_id | 0–999999 | 1 | 0 = new reservation. 1+ = modification mode (source reservation ID). The original reservation is cancelled when the modification is confirmed |
| My Page Screen | upcoming_reservation_list | reservation ID array | ×20 | Upcoming reservations being displayed. Estimated max 20 |
| | past_reservation_list | reservation ID array | ×50 | Past reservations being displayed. Estimated max 50 |
| Admin Calendar Screen | display_date | date | 1 | Currently displayed reference date |
| | display_mode | 0–1 | 1 | 0 = daily, 1 = weekly |
| | filter_staff_id | 0–99 | 1 | 0 = show all staff. 1+ = show specified staff only |
| | admin_reservation_list | reservation ID array | ×200 | Reservations being displayed. Max 10 staff × 20 slots per day = 200 |
| | selected_reservation_id | 0–999999 | 1 | 0 = none selected. 1+ = reservation ID shown in the detail panel |
| Menu Management Screen | editing_menu_id | 0–999 | 1 | 0 = add new mode. 1+ = edit mode (menu ID being edited) |
| Staff Management Screen | editing_staff_id | 0–99 | 1 | 0 = add new mode. 1+ = edit mode (staff ID being edited) |

# Salon Reservation System — Fixed Data (Master Data)

> Fixed data referenced by all screens and features. Can be modified via the admin panel during operation, but does not change during reservation processing.
> Always reference this file when writing specifications.
>
> Designed for small salons (up to 10 staff members, up to 50 menu items).

---

| Category | Field Name | Range | Count | Description |
| :-- | :-- | :-- | :-- | :-- |
| Menu Category | category_id | 0–99 | 1 | 0 = uncategorized (reserved). Valid IDs start at 1 |
| | category_name | string | 1 | For UI display (e.g., Cut, Color, Perm, Treatment) |
| | display_order | 0–99 | 1 | Sort order in the filter UI. 0 = first |
| Menu Master | menu_id | 0–999 | 1 | 0 = none (reserved). Valid IDs start at 1 |
| | menu_name | string | 1 | For UI display |
| | category_id | 0–99 | 1 | References `Menu Category` |
| | price | 1–99999 | 1 | In yen |
| | duration | 10–480 | 1 | In minutes. 10-minute increments recommended |
| | description | string | 1 | Description shown on the menu list screen |
| | is_public | 0–1 | 1 | 0 = hidden (not shown to customers), 1 = public |
| Staff Master | staff_id | 0–99 | 1 | 0 = no preference (reserved). Valid IDs start at 1 |
| | staff_name | string | 1 | For UI display |
| | profile | string | 1 | Bio text shown to customers |
| | is_active | 0–1 | 1 | 0 = inactive (e.g., retired), 1 = active. Past reservation data is retained when deactivated |
| Staff Shift | staff_id | 1–99 | ×70 | References `Staff Master`. Max 10 staff × 7 days = 70 records |
| | day_of_week | 0–6 | ×70 | 0 = Sunday, 1 = Monday, …, 6 = Saturday |
| | start_time | string (HH:MM) | ×70 | Shift start time (e.g., "09:00") |
| | end_time | string (HH:MM) | ×70 | Shift end time (e.g., "19:00"). Must be after start_time |
| | is_working | 0–1 | ×70 | 0 = day off, 1 = working. Days off are excluded from availability calculation |
| Staff Menu Assignment | staff_id | 1–99 | ×500 | References `Staff Master`. Max 10 staff × 50 menus = 500 records |
| | menu_id | 1–999 | ×500 | References `Menu Master` |
| Cancellation Policy | tier_id | 1–10 | ×10 | Tier identifier. Max 10 tiers. See `101_customer_spec.md` §2-9 for evaluation logic |
| | hour_threshold | 1–720 | ×10 | Hours before reservation start time used as the boundary. The cancellation fee rate for this tier applies when remaining time is less than this value |
| | cancellation_rate | 0–100 | ×10 | Cancellation fee rate (%). Calculated as: total price (at time of booking) × rate / 100, rounded down |
| | | | | Default 2 tiers: Tier 1 (24 hours, 100%) and Tier 2 (72 hours, 50%). If none apply (72+ hours remaining), the rate is 0% |
| System Settings | cancellation_penalty_limit | 1–10 | 1 | Customers reaching this count are blocked from booking. Default: `3` |
| | booking_window_days | 1–90 | 1 | How many days ahead reservations are accepted from today. Default: `30` |
| | time_slot_interval | 10–60 | 1 | Minimum unit for availability calculation (minutes). Default: `30` |

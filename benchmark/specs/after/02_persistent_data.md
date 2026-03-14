# Salon Reservation System — Persistent Data (Save Data)

> Data that changes during operation. Subject to database persistence.
> Always reference this file when writing specifications.
>
> Equivalent to "save data" in games. In business applications, this corresponds to transaction data and user data.

---

| Category | Field Name | Range | Count | Description |
| :-- | :-- | :-- | :-- | :-- |
| Customer | customer_id | 0–99999 | 1 | 0 = guest (reserved). Valid IDs start at 1. Auto-assigned on account registration or guest booking |
| | customer_name | string | 1 | Entered at booking. Displayed in the admin reservation detail view |
| | phone_number | string | 1 | Lookup key for guest bookings. Digits only, no hyphens |
| | account_id | string or null | 1 | null = guest customer (no account). If registered, this is the authentication system ID |
| | cancellation_penalty_count | 0–10 | 1 | Cumulative count of paid cancellations (cancellation_rate > 0%) and no-shows. Booking is blocked when this reaches `cancellation_penalty_limit` |
| | registered_at | datetime | 1 | Customer record creation timestamp |
| Reservation | reservation_id | 0–999999 | 1 | Auto-assigned |
| | customer_id | 0–99999 | 1 | References `Customer` |
| | staff_id | 1–99 | 1 | References `Staff Master`. Even for "no preference" bookings, the auto-assigned staff ID is recorded |
| | is_nominated | 0–1 | 1 | 0 = no preference (auto-assigned), 1 = staff nominated |
| | start_datetime | datetime | 1 | Reservation start date and time |
| | total_duration | 10–960 | 1 | In minutes. Sum of durations from `Reservation Menu Detail` |
| | status | 0–4 | 1 | 0 = confirmed, 1 = cancelled, 2 = checked in, 3 = completed, 4 = no-show |
| | created_at | datetime | 1 | Reservation record creation timestamp |
| | cancellation_fee | 0–999999 | 1 | Cancellation fee determined at cancellation (yen). 0 = no fee (active reservation or free cancellation). Calculated and recorded based on `Cancellation Policy` rates at cancellation or no-show |
| | updated_at | datetime | 1 | Last update timestamp. Updated on status change |
| Reservation Menu Detail | reservation_id | 0–999999 | ×5 | References `Reservation`. Max 5 menus per reservation |
| | menu_id | 1–999 | ×5 | References `Menu Master` |
| | price_at_booking | 1–99999 | ×5 | Price snapshot at time of booking. Unaffected by master data changes |
| | duration_at_booking | 10–480 | ×5 | Duration snapshot at time of booking |
| Favorite | customer_id | 1–99999 | ×200 | References `Customer`. Max 20 per customer, estimated max 10 customers |
| | target_type | 0–1 | ×200 | 0 = staff, 1 = menu |
| | target_id | 1–999 | ×200 | References `Staff Master` or `Menu Master` depending on target_type |

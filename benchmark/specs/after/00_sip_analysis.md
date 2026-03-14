# Salon Reservation System — SIP Analysis

> Web reservation system for service-based businesses (hair salons, nail salons, etc.).
> 6 screens total: 3 customer-facing + 3 admin-facing.
> Engine Scope (delegated to framework): authentication, session management. Scope column omitted.

---

## 1. Menu List Screen (Customer-Facing)

### Scene (Display Information)

| Display Element | Description |
|:--|:--|
| Menu card list | Displays menu name, price, duration, and description in card format |
| Category filter | Filter menus by category (Cut, Color, Perm, etc.) |
| Salon info header | Salon name, business hours, address |

### Input (User Actions)

| Action | Condition | Destination / Effect |
|:--|:--|:--|
| Select menu ("Book" button) | Always | Navigate to Reservation Creation screen (carry over selected menu) |
| Toggle category filter | Always | Filter the list |

### Process (Background Processing)

| Process Name | Trigger | Summary |
|:--|:--|:--|
| Fetch menu list | On screen display | Retrieve public menus from `Menu Master` and display. See `101_customer_spec.md` §2-1, §3-1 |
| Category filtering | On filter action | Display only menus matching the selected category → Fetch menu list. See `101_customer_spec.md` §2-2, §3-2 |

### Data Derivation Notes

| Data Candidate | Category (Tentative) | Rationale |
|:--|:--|:--|
| `Menu Master` | Master | Menu name, price, duration, category, description, is_public flag |
| `Menu Category` | Master | Category definitions (Cut, Color, etc.) |

---

## 2. Reservation Creation Screen (Customer-Facing)

### Scene (Display Information)

| Display Element | Description |
|:--|:--|
| Selected menu list | List of selected menu names, prices, and durations. Can add/remove |
| Total display | Total price (UI hook: sum of selected menu prices) and `total_duration` |
| Staff selection | List of available staff. "No preference" is also selectable |
| Calendar / date picker | Select an available date |
| Time slot list | Display available time slots for the selected date (visually distinguishing open/booked) |
| Reservation confirmation dialog | Final confirmation of menu, staff, and date/time. Includes cancellation policy notice |
| Guest info input form | Displayed when not logged in. Name and phone number |

### Input (User Actions)

| Action | Condition | Destination / Effect |
|:--|:--|:--|
| Add menu | Always | Display menu list in modal, add selected menu |
| Remove menu | 2+ menus selected | Remove specified menu from selection list. Recalculate total |
| Select staff | Always | Execute availability calculation → Update time slot list |
| Select date | After staff selection | Execute availability calculation → Update time slot list |
| Select time slot | When slots are available | Display reservation confirmation dialog |
| Confirm reservation | While confirmation dialog is shown | Execute reservation confirmation → Navigate to My Page screen |
| Guest info input | Not logged in and at reservation confirmation | Confirm reservation after entering name and phone number |

### Process (Background Processing)

**— Availability Calculation —**

| Process Name | Trigger | Summary |
|:--|:--|:--|
| Availability calculation | On staff/date selection | Retrieve working hours from `Staff Shift`, exclude time slots occupied by `Reservation` data. Calculate consecutive available slots for the total_duration → Display time slot list. See `101_customer_spec.md` §2-3, §3-3 |
| No-preference availability calculation | On "No preference" selection | Consolidate available slots across all eligible staff. Auto-assign the earliest available staff → Display time slot list. See `101_customer_spec.md` §2-4, §3-4 |

**— Reservation Confirmation —**

| Process Name | Trigger | Summary |
|:--|:--|:--|
| Confirm reservation | On confirm button press | Create new `Reservation` (status = confirmed). Link selected menus as `Reservation Menu Detail`. If staff is "no preference", record the auto-assigned staff ID → Navigate to My Page screen. See `101_customer_spec.md` §2-6, §3-6 |
| Guest customer registration | On reservation confirmation while not logged in | Search `Customer` by name + phone number. If match found, link to existing customer; otherwise create new record → Confirm reservation. See `101_customer_spec.md` §2-7, §3-7 |
| Duplicate check | Immediately before reservation confirmation | Re-check for existing reservations with the same staff and time slot (optimistic locking). If conflict, display error; otherwise → Confirm reservation. See `101_customer_spec.md` §2-5, §3-5 |

### Data Derivation Notes

| Data Candidate | Category (Tentative) | Rationale |
|:--|:--|:--|
| `Reservation` | Save | customer_id, staff_id, start_datetime, total_duration, status, cancellation_fee, created_at |
| `Reservation Menu Detail` | Save | reservation_id, menu_id, price_at_booking, duration_at_booking. Multiple per reservation |
| `Customer` | Save | customer_name, phone_number, account_id (nullable), cancellation_penalty_count |
| `Staff Shift` | Master | staff_id, day_of_week, start_time, end_time |
| `Staff Menu Assignment` | Master | staff_id, menu_id |
| `available_slot_start_times` / `available_slot_staff_ids` | Memory | For screen display. Parallel arrays of available slot start times and staff IDs |
| `Cancellation Policy` | Master | For cancellation policy notice display in reservation confirmation dialog |

---

## 3. My Page Screen (Customer-Facing)

### Scene (Display Information)

| Display Element | Description |
|:--|:--|
| Upcoming reservations | Display upcoming reservations in date order. Menu name, staff name, date/time, status |
| Past reservations | Display past reservations in reverse date order |
| Favorite staff list | List of favorited staff |
| Favorite menu list | List of favorited menus |

### Input (User Actions)

| Action | Condition | Destination / Effect |
|:--|:--|:--|
| Cancel reservation | Reservation status is "confirmed", logged in | Display cancellation fee → Cancellation confirmation → Execute cancellation. Guest customers (not logged in) cannot access My Page; phone support only |
| Modify reservation | Reservation status is "confirmed" | Navigate to Reservation Creation screen (modification mode: preset with existing data) |
| Toggle favorite | Always | Toggle favorite for staff or menu |
| Re-book | When selecting a past reservation | Navigate to Reservation Creation screen (preset with same menu and staff) |

### Process (Background Processing)

**— Reservation Management —**

| Process Name | Trigger | Summary |
|:--|:--|:--|
| Fetch reservation list | On screen display | Retrieve reservations for the customer from `Reservation`. Split into upcoming/past. See `101_customer_spec.md` §2-8, §3-8 |
| Calculate cancellation fee | On cancel button press | Reference `Cancellation Policy` to determine the cancellation fee rate based on remaining time until reservation start. Calculate fee as total price × rate, display in confirmation dialog. See `101_customer_spec.md` §2-9, §3-9 |
| Process cancellation | After cancellation confirmation | Update `Reservation` status to "cancelled". Record cancellation fee. If rate > 0%, increment `Customer.cancellation_penalty_count` by 1 → Fetch reservation list. See `101_customer_spec.md` §2-10, §3-10 |
| Cancellation eligibility check | On cancel button press | If `cancellation_penalty_count` has reached `cancellation_penalty_limit` (`3`), display "cancellation not allowed" message. If eligible → Calculate cancellation fee → Process cancellation. See `101_customer_spec.md` §2-9, §3-9 |
| Reservation modification | On modification selection | Pass existing reservation's menu, staff, and date/time to Reservation Creation screen → Navigate. On confirmation, cancel old reservation → Create new reservation. See `101_customer_spec.md` §2-11, §3-11 |

**— Favorites —**

| Process Name | Trigger | Summary |
|:--|:--|:--|
| Toggle favorite | On register/unregister action | Add or remove `Favorite` record. See `101_customer_spec.md` §2-12, §3-12 |

### Data Derivation Notes

| Data Candidate | Category (Tentative) | Rationale |
|:--|:--|:--|
| `Favorite` | Save | customer_id, target_type (staff/menu), target_id |
| `cancellation_penalty_limit` | Master (setting) | Penalty count threshold. Default: `3` |
| `Cancellation Policy` | Master | Tiered cancellation fee definition. Pairs of hour_threshold (hours before reservation start) and cancellation_rate (0–100%). Default: <24h = 100%, <72h = 50%, 72h+ = 0% (free) |

---

## 4. Admin: Reservation List / Calendar Screen

### Scene (Display Information)

| Display Element | Description |
|:--|:--|
| Daily reservation list | Display reservations for the selected day, organized by staff in time order |
| Weekly calendar | Grid display with staff × time axis. Reservations shown as blocks |
| View toggle tabs | Switch between display modes such as "Today" and "Weekly" |
| Staff filter | Display only a specific staff member's reservations |
| Reservation detail panel | When a reservation is selected, display details (customer name, menu, phone number) |

### Input (User Actions)

| Action | Condition | Destination / Effect |
|:--|:--|:--|
| Navigate date (prev/next day / calendar select) | Always | Switch display date → Re-fetch reservation list |
| Toggle display mode | Always | Switch between daily ↔ weekly view |
| Select staff filter | Always | Display only the specified staff member's reservations |
| Select reservation | Always | Display reservation detail panel |
| Confirm check-in | While reservation detail panel is shown | Update status to "checked in" |

### Process (Background Processing)

**— Reservation Display —**

| Process Name | Trigger | Summary |
|:--|:--|:--|
| Fetch admin reservations | On screen display / date change | Retrieve `Reservation` data for the specified date (range) across all staff. Join with `Reservation Menu Detail` and `Customer`. See `102_admin_spec.md` §2-1, §3-1 |
| Update status (check-in) | On check-in action | Update `Reservation` status to "checked in" → Fetch admin reservations. See `102_admin_spec.md` §2-2, §3-2 |
| Complete service | On service completion action | Update `Reservation` status to "completed" (checked in → completed) → Fetch admin reservations. See `102_admin_spec.md` §2-8, §3-8 |
| No-show processing | On no-show action | Update `Reservation` status to "no-show" (confirmed → no-show). Record 100% cancellation fee. Increment penalty count → Fetch admin reservations. See `102_admin_spec.md` §2-9, §3-9 |

### Data Derivation Notes

| Data Candidate | Category (Tentative) | Rationale |
|:--|:--|:--|
| `reservation_status` | enum | confirmed, cancelled, checked_in, completed, no_show |
| `display_date` | Memory | Currently displayed date on the calendar |
| `display_mode` | Memory | Daily/weekly toggle state |
| `filter_staff_id` | Memory | Staff filter selection state |

---

## 5. Admin: Menu Management Screen

### Scene (Display Information)

| Display Element | Description |
|:--|:--|
| Menu list table | Menu name, category, price, duration, publication status |
| Menu edit form | Form for adding new / editing existing menus |

### Input (User Actions)

| Action | Condition | Destination / Effect |
|:--|:--|:--|
| Add menu | Always | Display empty form |
| Edit menu | When existing menu is selected | Display form pre-filled with data |
| Toggle publish/hide | When existing menu is selected | Toggle is_public flag |
| Save | After form input | Execute menu master update |

### Process (Background Processing)

**— Menu CRUD —**

| Process Name | Trigger | Summary |
|:--|:--|:--|
| Save menu | On save action | Create or update `Menu Master`. Validation (price > 0, duration > 0) → Re-fetch menu list. See `102_admin_spec.md` §2-3, §3-3 |
| Hide menu | On toggle action | Update `Menu Master` `is_public` flag. Does not affect existing reservations → Re-fetch menu list. See `102_admin_spec.md` §2-4, §3-4 |

### Data Derivation Notes

| Data Candidate | Category (Tentative) | Rationale |
|:--|:--|:--|
| (`Menu Master` defined in Screen 1) | — | — |

---

## 6. Admin: Staff Management Screen

### Scene (Display Information)

| Display Element | Description |
|:--|:--|
| Staff list | Staff name, number of supported menus, this week's shift summary |
| Staff edit form | Basic info: name, profile, etc. |
| Shift settings table | Tabular input for day_of_week × start_time / end_time |
| Supported menu checklist | Checkboxes for all menus |

### Input (User Actions)

| Action | Condition | Destination / Effect |
|:--|:--|:--|
| Add staff | Always | Display empty form, shift, and menu settings |
| Edit staff | When existing staff is selected | Display edit screen pre-filled with data |
| Modify shift | When editing shift table | Update working hours for the corresponding day |
| Modify supported menus | On checkbox action | Update staff menu assignments |
| Save | After editing | Batch save staff info, shifts, and supported menus |

### Process (Background Processing)

**— Staff Management —**

| Process Name | Trigger | Summary |
|:--|:--|:--|
| Save staff | On save action | Create or update `Staff Master` → Re-fetch staff list. See `102_admin_spec.md` §2-5, §3-5 |
| Save shifts | On save action | Update `Staff Shift` by day of week. If conflicts with existing reservations, display warning → Re-fetch staff list. See `102_admin_spec.md` §2-6, §3-6 |
| Save supported menus | On save action | Replace all `Staff Menu Assignment` records → Re-fetch staff list. See `102_admin_spec.md` §2-7, §3-7 |

### Data Derivation Notes

| Data Candidate | Category (Tentative) | Rationale |
|:--|:--|:--|
| `Staff Master` | Master | staff_id, staff_name, profile, is_active |
| (`Staff Shift` and `Staff Menu Assignment` defined in Screen 2) | — | — |

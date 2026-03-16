# Salon Reservation System — SIP Analysis

> Web reservation system for service-based businesses (hair salons, nail salons, etc.).
> 6 screens total: 3 customer-facing + 3 admin-facing.
> Engine Scope (delegated to framework): authentication, session management. Scope column omitted.

---

## 1. Menu List Screen (Customer-Facing)

### Scene (Display Information)

| Display Element | Description | Source |
|:--|:--|:--|
| Menu card list | Displays menu name, price, duration, and description in card format | [Plan] |
| Category filter | Filter menus by category (Cut, Color, Perm, etc.) | [Supp] |
| Salon info header | Salon name, business hours, address | [Supp] |

### Input (User Actions)

| Action | Condition | Destination / Effect | Source |
|:--|:--|:--|:--|
| Select menu ("Book" button) | Always | Navigate to Reservation Creation screen (carry over selected menu) | [Plan] |
| Toggle category filter | Always | Filter the list | [Supp] |

### Process (Background Processing)

| Process Name | Trigger | Summary | Source |
|:--|:--|:--|:--|
| Fetch menu list | On screen display | Retrieve public menus from `Menu Master` and display. See `101_customer_spec.md` §2-1, §3-1 | [Plan] |
| Category filtering | On filter action | Display only menus matching the selected category → Fetch menu list. See `101_customer_spec.md` §2-2, §3-2 | [Supp] |

### Data Derivation Notes

| Data Candidate | Category (Tentative) | Rationale | Source |
|:--|:--|:--|:--|
| `Menu Master` | Master | Menu name, price, duration, category, description, is_public flag | [Plan] |
| `Menu Category` | Master | Category definitions (Cut, Color, etc.) | [Supp] |

---

## 2. Reservation Creation Screen (Customer-Facing)

### Scene (Display Information)

| Display Element | Description | Source |
|:--|:--|:--|
| Selected menu list | List of selected menu names, prices, and durations. Can add/remove | [Plan] |
| Total display | Total price and total duration | [Plan] |
| Staff selection | List of available staff. "No preference" is also selectable | [Plan] |
| Calendar / date picker | Select an available date | [Plan] |
| Time slot list | Display available time slots for the selected date (visually distinguishing open/booked) | [Plan] |
| Reservation confirmation dialog | Final confirmation of menu, staff, and date/time | [Supp] |
| Guest info input form | Displayed when not logged in. Name and phone number | [Plan] |

### Input (User Actions)

| Action | Condition | Destination / Effect | Source |
|:--|:--|:--|:--|
| Add menu | Always | Display menu list in modal, add selected menu | [Plan] |
| Remove menu | 2+ menus selected | Remove specified menu from selection list. Recalculate total | [Supp] |
| Select staff | Always | Execute availability calculation → Update time slot list | [Plan] |
| Select date | After staff selection | Execute availability calculation → Update time slot list | [Plan] |
| Select time slot | When slots are available | Display reservation confirmation dialog | [Plan] |
| Confirm reservation | While confirmation dialog is shown | Execute reservation confirmation → Navigate to My Page screen | [Plan] |
| Guest info input | Not logged in and at reservation confirmation | Confirm reservation after entering name and phone number | [Plan] |

### Process (Background Processing)

**— Availability Calculation —**

| Process Name | Trigger | Summary | Source |
|:--|:--|:--|:--|
| Availability calculation | On staff/date selection | Retrieve working hours from `Staff Shift`, exclude time slots occupied by `Reservation` data. Calculate consecutive available slots for the total duration → Display time slot list. See `101_customer_spec.md` §2-3, §3-3 | [Plan] |
| No-preference availability calculation | On "No preference" selection | Consolidate available slots across all eligible staff. Auto-assign the earliest available staff → Display time slot list. See `101_customer_spec.md` §2-4, §3-4 | [Supp] |

**— Reservation Confirmation —**

| Process Name | Trigger | Summary | Source |
|:--|:--|:--|:--|
| Confirm reservation | On confirm button press | Create new `Reservation` (status = confirmed). Link selected menus as `Reservation Menu Detail`. If staff is "no preference", record the auto-assigned staff ID → Navigate to My Page screen. See `101_customer_spec.md` §2-6, §3-6 | [Plan] |
| Guest customer registration | On reservation confirmation while not logged in | Search `Customer` by name + phone number. If match found, link to existing customer; otherwise create new record → Confirm reservation. See `101_customer_spec.md` §2-7, §3-7 | [Plan] |
| Duplicate check | Immediately before reservation confirmation | Re-check for existing reservations with the same staff and time slot (optimistic locking). If conflict, display error; otherwise → Confirm reservation. See `101_customer_spec.md` §2-5, §3-5 | [Supp] |

### Data Derivation Notes

| Data Candidate | Category (Tentative) | Rationale | Source |
|:--|:--|:--|:--|
| `Reservation` | Save | customer_id, staff_id, start_datetime, total_duration, status, created_at | [Plan] |
| `Reservation Menu Detail` | Save | reservation_id, menu_id, price_at_booking, duration_at_booking. Multiple per reservation | [Plan] |
| `Customer` | Save | customer_name, phone_number, account_id (nullable), cancellation_penalty_count | [Plan] |
| `Staff Shift` | Master | staff_id, day_of_week, start_time, end_time | [Plan] |
| `Staff Menu Assignment` | Master | staff_id, menu_id | [Plan] |
| `available_slot_list` | Memory | For screen display. Array of (start_time, staff_id) pairs | [Supp] |

---

## 3. My Page Screen (Customer-Facing)

### Scene (Display Information)

| Display Element | Description | Source |
|:--|:--|:--|
| Upcoming reservations | Display upcoming reservations in date order. Menu name, staff name, date/time, status | [Plan] |
| Past reservations | Display past reservations in reverse date order | [Supp] |
| Favorite staff list | List of favorited staff | [Plan] |
| Favorite menu list | List of favorited menus | [Plan] |

### Input (User Actions)

| Action | Condition | Destination / Effect | Source |
|:--|:--|:--|:--|
| Cancel reservation | Reservation status is "confirmed" | Cancellation confirmation → Execute cancellation | [Plan] |
| Modify reservation | Reservation status is "confirmed" | Navigate to Reservation Creation screen (modification mode: preset with existing data) | [Plan] |
| Toggle favorite | Always | Toggle favorite for staff or menu | [Plan] |
| Re-book | When selecting a past reservation | Navigate to Reservation Creation screen (preset with same menu and staff) | [Supp] |

### Process (Background Processing)

**— Reservation Management —**

| Process Name | Trigger | Summary | Source |
|:--|:--|:--|:--|
| Fetch reservation list | On screen display | Retrieve reservations for the customer from `Reservation`. Split into upcoming/past. See `101_customer_spec.md` §2-8, §3-8 | [Plan] |
| Process cancellation | After cancellation confirmation | Update `Reservation` status to "cancelled". If same-day cancellation, increment `Customer.cancellation_penalty_count` by 1 → Fetch reservation list. See `101_customer_spec.md` §2-10, §3-10 | [Plan] |
| Cancellation eligibility check | On cancel button press | If `cancellation_penalty_count` has reached `cancellation_penalty_limit` (`3`), display "cancellation not allowed" message. If eligible → Process cancellation. See `101_customer_spec.md` §2-9, §3-9 | [Supp] |
| Reservation modification | On modification selection | Pass existing reservation's menu, staff, and date/time to Reservation Creation screen → Navigate. On confirmation, cancel old reservation → Create new reservation. See `101_customer_spec.md` §2-11, §3-11 | [Plan] |

**— Favorites —**

| Process Name | Trigger | Summary | Source |
|:--|:--|:--|:--|
| Toggle favorite | On register/unregister action | Add or remove `Favorite` record. See `101_customer_spec.md` §2-12, §3-12 | [Plan] |

### Data Derivation Notes

| Data Candidate | Category (Tentative) | Rationale | Source |
|:--|:--|:--|:--|
| `Favorite` | Save | customer_id, target_type (staff/menu), target_id | [Plan] |
| `cancellation_penalty_limit` | Master (setting) | Penalty count threshold. Default: `3` | [Supp] |

---

## 4. Admin: Reservation List / Calendar Screen

### Scene (Display Information)

| Display Element | Description | Source |
|:--|:--|:--|
| Daily reservation list | Display reservations for the selected day, organized by staff in time order | [Plan] |
| Weekly calendar | Grid display with staff × time axis. Reservations shown as blocks | [Plan] |
| View toggle tabs | Switch between display modes such as "Today" and "Weekly" | [Supp] |
| Staff filter | Display only a specific staff member's reservations | [Supp] |
| Reservation detail panel | When a reservation is selected, display details (customer name, menu, phone number) | [Plan] |

### Input (User Actions)

| Action | Condition | Destination / Effect | Source |
|:--|:--|:--|:--|
| Navigate date (prev/next day / calendar select) | Always | Switch display date → Re-fetch reservation list | [Supp] |
| Toggle display mode | Always | Switch between daily ↔ weekly view | [Supp] |
| Select staff filter | Always | Display only the specified staff member's reservations | [Supp] |
| Select reservation | Always | Display reservation detail panel | [Plan] |
| Confirm check-in | While reservation detail panel is shown | Update status to "checked in" | [Supp] |

### Process (Background Processing)

**— Reservation Display —**

| Process Name | Trigger | Summary | Source |
|:--|:--|:--|:--|
| Fetch admin reservations | On screen display / date change | Retrieve `Reservation` data for the specified date (range) across all staff. Join with `Reservation Menu Detail` and `Customer`. See `102_admin_spec.md` §2-1, §3-1 | [Plan] |
| Update status (check-in) | On check-in action | Update `Reservation` status to "checked in" → Fetch admin reservations. See `102_admin_spec.md` §2-2, §3-2 | [Supp] |
| Complete service | On service completion action | Update `Reservation` status to "completed" (checked in → completed) → Fetch admin reservations. See `102_admin_spec.md` §2-8, §3-8 | [Supp] |
| No-show processing | On no-show action | Update `Reservation` status to "no-show" (confirmed → no-show). Increment penalty count → Fetch admin reservations. See `102_admin_spec.md` §2-9, §3-9 | [Supp] |

### Data Derivation Notes

| Data Candidate | Category (Tentative) | Rationale | Source |
|:--|:--|:--|:--|
| `reservation_status` | enum | confirmed, cancelled, checked_in, completed, no_show | [Supp] |
| `display_date` | Memory | Currently displayed date on the calendar | [Supp] |
| `display_mode` | Memory | Daily/weekly toggle state | [Supp] |
| `filter_staff_id` | Memory | Staff filter selection state | [Supp] |

---

## 5. Admin: Menu Management Screen

### Scene (Display Information)

| Display Element | Description | Source |
|:--|:--|:--|
| Menu list table | Menu name, category, price, duration, publication status | [Plan] |
| Menu edit form | Form for adding new / editing existing menus | [Plan] |

### Input (User Actions)

| Action | Condition | Destination / Effect | Source |
|:--|:--|:--|:--|
| Add menu | Always | Display empty form | [Plan] |
| Edit menu | When existing menu is selected | Display form pre-filled with data | [Plan] |
| Toggle publish/hide | When existing menu is selected | Toggle is_public flag | [Plan] |
| Save | After form input | Execute menu master update | [Plan] |

### Process (Background Processing)

**— Menu CRUD —**

| Process Name | Trigger | Summary | Source |
|:--|:--|:--|:--|
| Save menu | On save action | Create or update `Menu Master`. Validation (price > 0, duration > 0) → Re-fetch menu list. See `102_admin_spec.md` §2-3, §3-3 | [Plan] |
| Hide menu | On toggle action | Update `Menu Master` `is_public` flag. Does not affect existing reservations → Re-fetch menu list. See `102_admin_spec.md` §2-4, §3-4 | [Plan] |

### Data Derivation Notes

| Data Candidate | Category (Tentative) | Rationale | Source |
|:--|:--|:--|:--|
| (`Menu Master` defined in Screen 1) | — | — | — |

---

## 6. Admin: Staff Management Screen

### Scene (Display Information)

| Display Element | Description | Source |
|:--|:--|:--|
| Staff list | Staff name, number of supported menus, this week's shift summary | [Plan] |
| Staff edit form | Basic info: name, profile, etc. | [Plan] |
| Shift settings table | Tabular input for day_of_week × start_time / end_time | [Plan] |
| Supported menu checklist | Checkboxes for all menus | [Plan] |

### Input (User Actions)

| Action | Condition | Destination / Effect | Source |
|:--|:--|:--|:--|
| Add staff | Always | Display empty form, shift, and menu settings | [Plan] |
| Edit staff | When existing staff is selected | Display edit screen pre-filled with data | [Plan] |
| Modify shift | When editing shift table | Update working hours for the corresponding day | [Plan] |
| Modify supported menus | On checkbox action | Update staff menu assignments | [Plan] |
| Save | After editing | Batch save staff info, shifts, and supported menus | [Plan] |

### Process (Background Processing)

**— Staff Management —**

| Process Name | Trigger | Summary | Source |
|:--|:--|:--|:--|
| Save staff | On save action | Create or update `Staff Master` → Re-fetch staff list. See `102_admin_spec.md` §2-5, §3-5 | [Plan] |
| Save shifts | On save action | Update `Staff Shift` by day of week. If conflicts with existing reservations, display warning → Re-fetch staff list. See `102_admin_spec.md` §2-6, §3-6 | [Plan] |
| Save supported menus | On save action | Replace all `Staff Menu Assignment` records → Re-fetch staff list. See `102_admin_spec.md` §2-7, §3-7 | [Plan] |

### Data Derivation Notes

| Data Candidate | Category (Tentative) | Rationale | Source |
|:--|:--|:--|:--|
| `Staff Master` | Master | staff_id, staff_name, profile, is_active | [Plan] |
| (`Staff Shift` and `Staff Menu Assignment` defined in Screen 2) | — | — | — |

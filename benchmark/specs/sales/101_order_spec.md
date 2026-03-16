# BtoB Sales Management System — Order Management Module Specification

> Referenced data:
> - `01_master_data.md` (Product Category, Product Master, Customer Master, Unit Price Master, System Settings)
> - `02_persistent_data.md` (Quotation Data, Quotation Line Items, Order Data, Order Line Items, Product Inventory, Shipping Instruction Data, Shipping Instruction Line Items)
> - `03_screen_data.md` (Quotation List Screen, Quotation Create/Edit Screen, Order List Screen, Order Detail Screen)

---

## §1. Process Triggers and Overview

This specification defines all Processes for the 4 screens of the Order Management Module (Quotation List Screen, Quotation Create/Edit Screen, Order List Screen, Order Detail Screen).
The Inventory & Shipping Management Module (Screens 5–8) is within the scope of `102_inventory_shipping_spec.md`.
The Billing & Payment Management Module (Screens 9–12) is within the scope of `103_billing_payment_spec.md`.
The Master Data Management Module (Screens 13–15) is within the scope of `104_master_spec.md`.

**Framework Delegation:** Authentication and session management, document PDF generation, email notifications.

**Boundaries with other specifications:**
- The "Order Confirmation Process" (§3-9) in this specification creates `Shipping Instruction Data` and `Shipping Instruction Line Items`, and increments `Product Inventory.allocation_count`. This is included in this specification as part of the continuous order confirmation flow. All shipping operations and beyond are within the scope of `102_inventory_shipping_spec.md`.
- The process of updating `Order Data.status` to "Invoiced" (status = 3) when an invoice is issued is within the scope of `103_billing_payment_spec.md`. Updating to "Completed" (status = 4) upon payment clearing is also within that specification's scope.
- Among `Order Data.status` transitions, this specification manages only "Confirmed" (status = 0) and "Cancelled" (status = 5). "Shipping" (1), "Shipped" (2), "Invoiced" (3), and "Completed" (4) are within the scope of other specifications.

**Order Status Transitions (managed by this specification):**

| Current Status | Valid Operations in This Specification |
|:--|:--|
| 0=Confirmed | Order Cancellation |
| 5=Cancelled | None |
| 1–4 | Within scope of other specifications |

| § Section | Process Name | Trigger | Screen |
|:--|:--|:--|:--|
| §2-1, §3-1 | Quotation List Retrieval | On screen display | Quotation List |
| §2-2, §3-2 | Status Filtering (Quotation) | On filter operation / on screen display | Quotation List |
| §2-3, §3-3 | Text Search (Quotation) | On search execution | Quotation List |
| §2-4, §3-4 | Quotation Initialization | On screen display | Quotation Create/Edit |
| §2-5, §3-5 | Auto Unit Price Set | On product selection | Quotation Create/Edit |
| §2-6, §3-6 | Total Amount Recalculation | On quantity/unit price change / on row add or delete | Quotation Create/Edit |
| §2-7, §3-7 | Quotation Save | On save operation | Quotation Create/Edit |
| §2-8, §3-8 | Quotation Submit | On submit operation | Quotation Create/Edit |
| §2-9, §3-9 | Order Conversion · Credit Check · Order Confirmation (Chained) | On order conversion operation (chained) | Quotation Create/Edit |
| §2-10, §3-10 | Lost Deal Process | On lost deal operation | Quotation Create/Edit |
| §2-11, §3-11 | Order List Retrieval | On screen display | Order List |
| §2-12, §3-12 | Status Filtering (Order) | On filter operation / on screen display | Order List |
| §2-13, §3-13 | Text Search (Order) | On search execution | Order List |
| §2-14, §3-14 | Order Detail Retrieval | On screen display | Order Detail |
| §2-15, §3-15 | Order Cancellation | On cancel operation | Order Detail |

---

## §2. Condition Judgments (Branching)

### §2-1. Quotation List Retrieval — Screen Initialization

Executed when the Quotation List Screen is displayed.

- Initialize `filter_status` to -1 (show all).
- Initialize `search_text` to an empty string.
- Proceed to data retrieval process (§3-1).

---

### §2-2. Status Filtering (Quotation)

Executed when the status filter is toggled on the Quotation List Screen, and also on screen display.

- Update `filter_status` to the status value selected by the operation (-1 to 4).
- Proceed to data retrieval process (§3-2).

---

### §2-3. Text Search (Quotation)

Executed when search is triggered on the Quotation List Screen.

- Update `search_text` to the entered search string.
- Proceed to data retrieval process (§3-3).

---

### §2-4. Quotation Initialization — Screen Initialization

Executed when the Quotation Create/Edit Screen is displayed.

- Branch based on the value of `edit_mode`.
  - If `edit_mode` = 0 (new creation) ⇒ Set `edit_target_quotation_id` to 0 and proceed to the new creation path of data retrieval process (§3-4) to display an empty header form and zero line items.
  - If `edit_mode` = 1 (edit existing) ⇒ Set `edit_target_quotation_id` to the carried-over Quotation ID and proceed to the existing edit path of data retrieval process (§3-4) to load existing data.

---

### §2-5. Auto Unit Price Set

Executed when a product is selected in a line item row on the Quotation Create/Edit Screen.

- Search `Unit Price Master` for a special price using the combination of (`Customer Master.customer_id` × `Product Master.product_id`).
  - If a special price record exists (`unit_price_master_id` ≥ 1) ⇒ Set `quotation_line_item.unit_price` to `Unit Price Master[unit_price_master_id].special_price` and proceed to total amount recalculation (§3-6).
  - If no matching special price record exists ⇒ Set `quotation_line_item.unit_price` to `Product Master[product_id].standard_unit_price` and proceed to total amount recalculation (§3-6).

---

### §2-6. Total Amount Recalculation

Executed when quantity or unit price is changed, or when a row is added or deleted on the Quotation Create/Edit Screen.

- Sum `quotation_line_item.quantity` × `quotation_line_item.unit_price` for all line item rows to calculate the subtotal (tax-exclusive).
- Update the tax amount and tax-inclusive total via UI Hook (see §4-3).
- No data is written. Writing occurs only on save or submit operations.

---

### §2-7. Quotation Save

Executed when the save operation is performed on the Quotation Create/Edit Screen.

**Validation:**
- If no customer is selected (customer ID is not set) ⇒ Display "Please select a customer." Abort processing.
- If `subject` is empty ⇒ Display "Please enter a subject." Abort processing.
- If there are 0 line item rows ⇒ Display "Please add at least one line item row." Abort processing.
- If any line item row has no product selected ⇒ Display "Please set a product for all line item rows." Abort processing.
- If any line item row has `quotation_line_item.quantity` less than 1 ⇒ Display "Please set a quantity of 1 or more for all line item rows." Abort processing.

Validation passed ⇒ Proceed to data update process (§3-7).

---

### §2-8. Quotation Submit

Executed when the submit operation is performed on the Quotation Create/Edit Screen.

**Validation:**
- Execute the same validation conditions as §2-7 (customer required, subject required, line items ≥ 1, each row with a product and quantity ≥ 1). Abort processing on validation failure.

Validation passed ⇒ Proceed to data update process (§3-8).

---

### §2-9. Order Conversion · Credit Check · Order Confirmation Process (Chained)

Executed when the order conversion operation is performed on the Quotation Create/Edit Screen. This Process chains three stages: Order Conversion → Credit Check → Order Confirmation.

**Guard Condition:**
- If `quotation_data.status` is not 1 (Submitted) ⇒ Do not execute this process (the order conversion button is only active when status = Submitted).

**Order Conversion Phase:**
- Proceed to data update process (§3-9 Order Conversion).

**Credit Check Phase (chained after order conversion completes):**
- Retrieve `Customer Master[customer_id].credit_limit` for the target customer.
  - If `credit_limit` = 0 (no credit check) ⇒ Do not set the credit warning flag; proceed to order confirmation process (§3-9 Order Confirmation).
  - If `credit_limit` ≥ 1 (credit check applies) ⇒ Calculate the outstanding balance total and proceed to credit judgment.
    - Outstanding balance total = Sum of `billing_amount` from `Billing Data` of that customer where `billing_data.status` = 1 (Issued) or 2 (Partially Paid) + Sum of order amounts from `Order Data` of that customer where `order_data.status` = 0 (Confirmed) and not yet billed and excluding the newly created order in this operation (for each order: tax-exclusive subtotal = Σ(`order_line_item.quantity` × `order_line_item.unit_price`), tax amount = tax-exclusive subtotal × `System Settings.consumption_tax_rate` ÷ 100 (rounded down to the nearest yen), tax-inclusive total = tax-exclusive subtotal + tax amount) + the order amount for this transaction (same formula).
    - If outstanding balance total exceeds `Customer Master[customer_id].credit_limit` ⇒ Set `order_data.credit_warning_flag` to 1. Order confirmation is not blocked even when credit limit is exceeded. Proceed to order confirmation process (§3-9 Order Confirmation).
    - If outstanding balance total is within `Customer Master[customer_id].credit_limit` ⇒ Proceed to order confirmation process (§3-9 Order Confirmation).

**Order Confirmation Phase (chained after credit check completes):**
- Proceed to data update process (§3-9 Order Confirmation).

---

### §2-10. Lost Deal Process

Executed when the lost deal operation is performed on the Quotation Create/Edit Screen.

**Guard Condition:**
- If `quotation_data.status` is not 1 (Submitted) ⇒ Do not execute this process (the lost deal button is only active when status = Submitted).

- Proceed to data update process (§3-10).

---

### §2-11. Order List Retrieval — Screen Initialization

Executed when the Order List Screen is displayed.

- Initialize `filter_status` to -1 (show all).
- Initialize `search_text` to an empty string.
- Proceed to data retrieval process (§3-11).

---

### §2-12. Status Filtering (Order)

Executed when the status filter is toggled on the Order List Screen, and also on screen display.

- Update `filter_status` to the status value selected by the operation (-1 to 5).
- Proceed to data retrieval process (§3-12).

---

### §2-13. Text Search (Order)

Executed when search is triggered on the Order List Screen.

- Update `search_text` to the entered search string.
- Proceed to data retrieval process (§3-13).

---

### §2-14. Order Detail Retrieval — Screen Initialization

Executed when the Order Detail Screen is displayed.

- Set `current_order_id` to the order ID carried over from the Order List Screen.
- Proceed to data retrieval process (§3-14).

---

### §2-15. Order Cancellation

Executed when the cancel operation is performed on the Order Detail Screen.

**Guard Condition:**
- If `Order Data[current_order_id].status` is not 0 (Confirmed) ⇒ Do not execute this process (the cancel button is only active when status = Confirmed).

- Proceed to data update process (§3-15).

---

## §3. Data Update Processes

### §3-1. Quotation List Retrieval

1. Retrieve all records from `Quotation Data`.
2. Join `Customer Master` to attach `Customer Master[quotation_data.customer_id].customer_name` to each row.
3. Sort by `created_at` descending.
4. Apply conditions from `filter_status` and `search_text` (same filtering logic as §3-2 and §3-3).
5. Proceed to display update (§4-1).

---

### §3-2. Status Filtering (Quotation)

1. Retrieve records from `Quotation Data`.
   - If `filter_status` = -1 (show all) ⇒ Retrieve all records without a status condition.
   - If `filter_status` = 0–4 ⇒ Retrieve only records where `quotation_data.status` = `filter_status`.
2. If `search_text` is not empty ⇒ Filter to rows where `quotation_data.quotation_number` or `Customer Master[quotation_data.customer_id].customer_name` contains `search_text` as a partial match (combined use with text search).
3. Join `Customer Master` to attach customer names to each row.
4. Sort by `created_at` descending.
5. Proceed to display update (§4-1).

---

### §3-3. Text Search (Quotation)

1. Retrieve rows where `quotation_data.quotation_number` contains `search_text` as a partial match, or where `Customer Master[quotation_data.customer_id].customer_name` contains `search_text` as a partial match.
2. If `filter_status` is not -1 ⇒ Further filter by `quotation_data.status` = `filter_status` (combined use with status filter).
3. Join `Customer Master` to attach customer names to each row.
4. Sort by `created_at` descending.
5. Proceed to display update (§4-1).

---

### §3-4. Quotation Initialization

**New Creation Mode (`edit_mode` = 0):**
1. Display the header form as empty (no customer selected, subject blank, expiry date blank).
2. Assign `quotation_number` as `System Settings.quotation_number_prefix` + sequential number (display only; finalized on save).
3. Set the default value for expiry date to today's date + `System Settings.quotation_validity_days` days.
4. Display 0 line item rows.
5. Proceed to display update (§4-2).

**Existing Edit Mode (`edit_mode` = 1):**
1. Retrieve `Quotation Data[edit_target_quotation_id]` and preset the customer, subject, and expiry date in the header form.
2. Retrieve all rows from `Quotation Line Items` where `quotation_id` = `edit_target_quotation_id` and preset them in the line item table.
3. Execute Auto Unit Price Set (§3-5) for each line item row to confirm and display `quotation_line_item.unit_price`.
4. Recalculate and display the total amount (§3-6).
5. Proceed to display update (§4-2).

---

### §3-5. Auto Unit Price Set

1. Search `Unit Price Master` using the combination of the customer ID set in the header and the selected product ID.
   - If a record matching `unit_price_master.customer_id` = target customer ID and `unit_price_master.product_id` = target product ID exists (`unit_price_master_id` ≥ 1) ⇒ Update `quotation_line_item.unit_price` of the target row to `Unit Price Master[unit_price_master_id].special_price`.
   - If no matching record exists ⇒ Update `quotation_line_item.unit_price` of the target row to `Product Master[product_id].standard_unit_price`.
2. Update `quotation_line_item.product_name_at_quotation` of the target row to `Product Master[product_id].product_name` (snapshot preparation).
3. Proceed to total amount recalculation (§3-6).
4. Proceed to display update (§4-3).

---

### §3-6. Total Amount Recalculation

1. Calculate `quotation_line_item.quantity` × `quotation_line_item.unit_price` for all rows in the line item table and sum them (tax-exclusive subtotal).
2. Retain the tax amount and tax-inclusive total as UI Hook values (no data is written).
3. Proceed to display update (§4-3).

---

### §3-7. Quotation Save

**New Creation (`edit_target_quotation_id` = 0):**
1. Create a new record in `Quotation Data`.
   - `quotation_number`: `System Settings.quotation_number_prefix` + sequential number (auto-assigned)
   - `customer_id`: The customer ID selected in the header form
   - `subject`: Input value
   - `status`: 0 (Draft)
   - `expiry_date`: Input value
   - `created_by`: Account ID retrieved from the authentication framework
   - `created_at`: Current datetime
   - `updated_at`: Current datetime
2. Create records in `Quotation Line Items` for each line item row (one per row).
   - `quotation_id`: The quotation ID assigned in step 1
   - `product_id`: The product ID selected in the line item row
   - `product_name_at_quotation`: `Product Master[product_id].product_name` (snapshot)
   - `quantity`: Input value (lower limit = 1, upper limit = 99999)
   - `unit_price`: Input value (lower limit = 0, upper limit = 9999999)

**Existing Edit (`edit_target_quotation_id` ≥ 1):**
1. Update the following fields in `Quotation Data[edit_target_quotation_id]`.
   - `customer_id`, `subject`, `expiry_date`, `updated_at` (current datetime)
   - `status` is not changed (remains Draft)
2. Delete all records from `Quotation Line Items` where `quotation_id` = `edit_target_quotation_id`, then recreate all rows with the current line item contents (full replacement). Each row's fields are the same as for new creation.

3. Navigate to the Quotation List Screen.

---

### §3-8. Quotation Submit

**New Creation (`edit_target_quotation_id` = 0):**
1. Create a new record in `Quotation Data` (same steps as §3-7 new creation). However, create with `status` = 1 (Submitted).

**Existing Edit (`edit_target_quotation_id` ≥ 1):**
1. Update the following fields in `Quotation Data[edit_target_quotation_id]`.
   - `customer_id`, `subject`, `expiry_date`, `updated_at` (current datetime)
   - `status`: Update to 1 (Submitted)
2. Delete all records from `Quotation Line Items` where `quotation_id` = `edit_target_quotation_id`, then recreate all rows with the current line item contents (full replacement).

3. Navigate to the Quotation List Screen.

---

### §3-9. Order Conversion · Credit Check · Order Confirmation Process (Chained)

**Order Conversion:**
1. Retrieve all rows from `Quotation Line Items` where `quotation_id` = `edit_target_quotation_id`.
2. Create a new record in `Order Data`.
   - `order_number`: `System Settings.order_number_prefix` + sequential number (auto-assigned)
   - `customer_id`: `Quotation Data[edit_target_quotation_id].customer_id`
   - `quotation_id`: `edit_target_quotation_id`
   - `subject`: `Quotation Data[edit_target_quotation_id].subject`
   - `status`: 0 (Confirmed)
   - `credit_warning_flag`: 0 (initial value; may be changed by Credit Check)
   - `order_date`: Current datetime
   - `updated_at`: Current datetime
3. Create records in `Order Line Items` for each quotation line item row (one per row retrieved in step 1).
   - `order_id`: The order ID assigned in step 2
   - `product_id`: `quotation_line_item.product_id`
   - `product_name_at_order`: `quotation_line_item.product_name_at_quotation` (copy snapshot as-is)
   - `quantity`: `quotation_line_item.quantity`
   - `unit_price`: `quotation_line_item.unit_price`
   - `shipped_quantity`: 0
4. Update `Quotation Data[edit_target_quotation_id].status` to 2 (Ordered).
5. Update `Quotation Data[edit_target_quotation_id].updated_at` to the current datetime.

**Credit Check (chained after order conversion completes):**
6. Retrieve `Customer Master[customer_id].credit_limit`.
   - If `credit_limit` = 0 (no credit check) ⇒ Skip to step 8 (Order Confirmation Phase).
   - If `credit_limit` ≥ 1 (credit check applies) ⇒ Proceed to step 7.
7. Calculate the outstanding balance total.
   - Sum `billing_amount` from outstanding `Billing Data` (that customer, where `billing_data.status` = 1 (Issued) or 2 (Partially Paid)).
   - Sum order amounts from `Order Data` of that customer where `order_data.status` = 0 (Confirmed) and not yet billed, excluding the new order created in step 2. Tax-inclusive amount per order = tax-exclusive subtotal (Σ(`order_line_item.quantity` × `order_line_item.unit_price`)) + tax amount (tax-exclusive subtotal × `System Settings.consumption_tax_rate` ÷ 100, rounded down to the nearest yen).
   - Add the order amount for this transaction. Tax-exclusive subtotal = Σ(`quantity` × `unit_price`) for all `Order Line Items` rows created in step 3. Tax amount = tax-exclusive subtotal × `System Settings.consumption_tax_rate` ÷ 100 (rounded down to the nearest yen). Tax-inclusive total = tax-exclusive subtotal + tax amount.
   - If the total exceeds `Customer Master[customer_id].credit_limit` ⇒ Update `Order Data[order_id].credit_warning_flag` to 1. Proceed to step 8.
   - If the total is within `Customer Master[customer_id].credit_limit` ⇒ Proceed to step 8 (no credit warning).

**Order Confirmation (chained after credit check completes):**
8. For each row in `Order Line Items`, add `order_line_item.quantity` to `Product Inventory[product_id].allocation_count` (upper limit = 999999).
9. Create a new record in `Shipping Instruction Data`.
   - `order_id`: The order ID assigned in step 2
   - `shipping_instruction_number`: `System Settings.shipping_instruction_number_prefix` + sequential number (auto-assigned)
   - `customer_id`: `Order Data[order_id].customer_id`
   - `status`: 0 (Not Shipped)
   - `created_at`: Current datetime
10. Create records in `Shipping Instruction Line Items` corresponding to each row in `Order Line Items`.
    - `shipping_instruction_id`: The shipping instruction ID assigned in step 9
    - `order_line_item_id`: Each `order_line_item.order_line_item_id`
    - `product_id`: `order_line_item.product_id`
    - `instructed_quantity`: `order_line_item.quantity`
    - `shipped_quantity`: 0

> Note: Step 8 (allocation count increment) is executed by referencing `Order Line Items`. Step 10's creation of `Shipping Instruction Line Items` also references `Order Line Items`. Proceed to the next process only after all references to `Order Line Items` are complete (Rule 14: do not clear data before reference is complete).

11. Navigate to the Order List Screen.

---

### §3-10. Lost Deal Process

1. Update `Quotation Data[edit_target_quotation_id].status` to 3 (Lost).
2. Update `Quotation Data[edit_target_quotation_id].updated_at` to the current datetime.
3. Navigate to the Quotation List Screen.

---

### §3-11. Order List Retrieval

1. Retrieve all records from `Order Data`.
2. Join `Customer Master` to attach `Customer Master[order_data.customer_id].customer_name` to each row.
3. Sort by `order_date` descending.
4. Apply conditions from `filter_status` and `search_text` (same filtering logic as §3-12 and §3-13).
5. Proceed to display update (§4-4).

---

### §3-12. Status Filtering (Order)

1. Retrieve records from `Order Data`.
   - If `filter_status` = -1 (show all) ⇒ Retrieve all records without a status condition.
   - If `filter_status` = 0–5 ⇒ Retrieve only records where `order_data.status` = `filter_status`.
2. If `search_text` is not empty ⇒ Filter to rows where `order_data.order_number` or `Customer Master[order_data.customer_id].customer_name` contains `search_text` as a partial match (combined use with text search).
3. Join `Customer Master` to attach customer names to each row.
4. Sort by `order_date` descending.
5. Proceed to display update (§4-4).

---

### §3-13. Text Search (Order)

1. Retrieve rows where `order_data.order_number` contains `search_text` as a partial match, or where `Customer Master[order_data.customer_id].customer_name` contains `search_text` as a partial match.
2. If `filter_status` is not -1 ⇒ Further filter by `order_data.status` = `filter_status` (combined use with status filter).
3. Join `Customer Master` to attach customer names to each row.
4. Sort by `order_date` descending.
5. Proceed to display update (§4-4).

---

### §3-14. Order Detail Retrieval

1. Retrieve `Order Data[current_order_id]`.
2. Join `Customer Master[order_data.customer_id]` to retrieve the customer name.
3. Retrieve all rows from `Order Line Items` where `order_id` = `current_order_id`.
4. Retrieve the record from `Shipping Instruction Data` where `order_id` = `current_order_id` and use it for displaying the shipping status summary (display is delegated to the UI Hook).
5. Proceed to display update (§4-5).

---

### §3-15. Order Cancellation

1. Retrieve all rows from `Order Line Items` where `order_id` = `current_order_id` (retrieve first to reference quantities for releasing allocation).
2. For each `Order Line Item` retrieved in step 1, subtract `order_line_item.quantity` from `Product Inventory[product_id].allocation_count` (lower limit = 0).
3. Retrieve the record from `Shipping Instruction Data` where `order_id` = `current_order_id`.
4. Update `Shipping Instruction Data[shipping_instruction_id].status` to 3 (Cancelled).
5. Update `Order Data[current_order_id].status` to 5 (Cancelled).
6. Update `Order Data[current_order_id].updated_at` to the current datetime.

> Note: The order of step 1 (retrieve Order Line Items) → step 2 (subtract allocation count) must be strictly maintained. The quantity for subtraction references `order_line_item.quantity`, so references must be completed before any data is deleted or cleared (Rule 14: do not clear data before reference is complete). Since `Order Line Items` are not deleted in this process, the clearing issue does not arise, but the explicit order must be maintained.

7. Execute Order Detail Retrieval (§3-14) to update the screen.

---

## §4. Display and Effect Updates (UI Hooks)

### §4-1. Quotation List Screen — After List Retrieval / Filter / Search

- Update the status filter selection state to match `filter_status`. If -1, highlight "All".
- Display `search_text` in the search field.
- Display the following in each row of the quotation list table.
  - Quotation Number: `quotation_data.quotation_number`
  - Customer Name: `Customer Master[quotation_data.customer_id].customer_name`
  - Subject: `quotation_data.subject`
  - Quotation Amount: Display the total (tax-exclusive) of all `Quotation Line Items` rows for that quotation in "¥X,XXX,XXX" format. Formula: Σ(`quotation_line_item.quantity` × `quotation_line_item.unit_price`)
  - Status: Display the label corresponding to `quotation_data.status` as a badge (0=Draft, 1=Submitted, 2=Ordered, 3=Lost, 4=Expired)
  - Created Date: `quotation_data.created_at` in "YYYY/MM/DD" format
  - Expiry Date: `quotation_data.expiry_date` in "YYYY/MM/DD" format. Highlight if the expiry date is in the past and status = Submitted

---

### §4-2. Quotation Create/Edit Screen — After Initialization

- Display the customer, subject, and expiry date in the header form.
  - Customer dropdown: Display all records from `Customer Master` (`customer_id` ≥ 1) as a list
  - Quotation Number: Display the assigned `quotation_data.quotation_number` (read-only)
- Display each row in the line item table.
  - Product dropdown: Display products from `Product Master` where `active_flag` = 1 (Active) as a list
  - Quantity field: `quotation_line_item.quantity`
  - Unit Price field: `quotation_line_item.unit_price` (manual override allowed)
- Button active/inactive state:
  - Order Conversion button: Active only when `quotation_data.status` = 1 (Submitted). Inactive otherwise
  - Lost Deal button: Active only when `quotation_data.status` = 1 (Submitted). Inactive otherwise

---

### §4-3. Quotation Create/Edit Screen — Real-Time Total Amount Update

Updated in real time when quantity or unit price is changed, when a row is added or deleted, and after auto unit price set.

- Each line item row's subtotal field: Display `quotation_line_item.quantity` × `quotation_line_item.unit_price` in "¥X,XXX,XXX" format
- Total Amount (tax-exclusive): Σ(`quotation_line_item.quantity` × `quotation_line_item.unit_price`)
- Consumption Tax Amount: Total Amount (tax-exclusive) × `System Settings.consumption_tax_rate` ÷ 100 (rounded down to the nearest yen)
- Tax-Inclusive Total: Total Amount (tax-exclusive) + Consumption Tax Amount

All displayed in "¥X,XXX,XXX" format.

---

### §4-4. Order List Screen — After List Retrieval / Filter / Search

- Update the status filter selection state to match `filter_status`. If -1, highlight "All".
- Display `search_text` in the search field.
- Display the following in each row of the order list table.
  - Order Number: `order_data.order_number`
  - Customer Name: `Customer Master[order_data.customer_id].customer_name`
  - Subject: `order_data.subject`
  - Order Amount (tax-exclusive): Σ(`order_line_item.quantity` × `order_line_item.unit_price`) (all line item rows for that order ID) in "¥X,XXX,XXX" format
  - Status: Display the label corresponding to `order_data.status` as a badge (0=Confirmed, 1=Shipping, 2=Shipped, 3=Invoiced, 4=Completed, 5=Cancelled)
  - Order Date: `order_data.order_date` in "YYYY/MM/DD" format
  - Shipping Status: Display the label corresponding to `shipping_instruction_data.status` for that order (0=Not Shipped, 1=Shipping, 2=Shipped, 3=Cancelled)

---

### §4-5. Order Detail Screen — After Order Detail Retrieval

- Order header information (read-only):
  - Order Number: `Order Data[current_order_id].order_number`
  - Customer Name: `Customer Master[order_data.customer_id].customer_name`
  - Subject: `Order Data[current_order_id].subject`
  - Order Date: `Order Data[current_order_id].order_date` in "YYYY/MM/DD HH:MM" format
  - Status: Label corresponding to `Order Data[current_order_id].status` (0=Confirmed, 1=Shipping, 2=Shipped, 3=Invoiced, 4=Completed, 5=Cancelled)
  - Credit Warning: If `Order Data[current_order_id].credit_warning_flag` = 1, display the warning message "This order exceeds the customer's credit limit." If 0, do not display.

- Display the following in each row of the order line item table.
  - Product Name: `order_line_item.product_name_at_order`
  - Quantity: `order_line_item.quantity`
  - Unit Price: `order_line_item.unit_price` in "¥X,XXX,XXX" format
  - Subtotal: `order_line_item.quantity` × `order_line_item.unit_price` in "¥X,XXX,XXX" format
  - Shipped Quantity: `order_line_item.shipped_quantity`
  - Unshipped Quantity: `order_line_item.quantity` − `order_line_item.shipped_quantity`

- Total amount summary:
  - Order Amount (tax-exclusive): Σ(`order_line_item.quantity` × `order_line_item.unit_price`)
  - Consumption Tax Amount: Order Amount (tax-exclusive) × `System Settings.consumption_tax_rate` ÷ 100 (rounded down to the nearest yen)
  - Tax-Inclusive Total: Order Amount (tax-exclusive) + Consumption Tax Amount
  - All displayed in "¥X,XXX,XXX" format

- Shipping status summary: Display the sum of `quantity` and the sum of `shipped_quantity` for all `Order Line Items` rows.
  - Example: "Shipped X unit(s) / Total Y unit(s)" format

- Cancel button: Active only when `Order Data[current_order_id].status` = 0 (Confirmed). Inactive otherwise.

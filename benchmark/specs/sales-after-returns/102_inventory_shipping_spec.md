# BtoB Sales Management System — Inventory & Shipping Management Module Specification

> Referenced data:
> - `01_master_data.md` (Product Category, Product Master, Customer Master, System Settings)
> - `02_persistent_data.md` (Product Inventory, Shipping Instruction Data, Shipping Instruction Line Items, Shipping Line Items, Order Data, Order Line Items, Receiving Data, Receiving Line Items, Return, Return Item, Invoice)
> - `03_screen_data.md` (Inventory List Screen, Shipping Instruction List Screen, Shipping Work Screen, Receiving Registration Screen, Returns Registration Screen)

---

## §1. Process Triggers and Overview

This specification defines all Processes for the 5 screens of the Inventory & Shipping Management Module (Inventory List Screen, Shipping Instruction List Screen, Shipping Work Screen, Receiving Registration Screen, Returns Registration Screen).

The Order Management Module (Screens 1–4) is within the scope of `101_order_spec.md`. Refer to `101_order_spec.md` for the process that creates `Shipping Instruction Data` and `Shipping Instruction Line Items` and increments `Product Inventory.allocation_count` when an order is confirmed.

The Billing & Payment Management Module (Screens 9–12) is within the scope of `103_billing_payment_spec.md`.

The Master Data Management Module (Screens 13–15) is within the scope of `104_master_spec.md`. Refer to `104_master_spec.md` for the process that creates an initial `Product Inventory` record when a new product is created in the Product Master.

**Framework Delegation:** Authentication and session management.

| § Section | Process Name | Trigger | Screen |
|:--|:--|:--|:--|
| §2-1, §3-1 | Inventory List Retrieval | On screen display | Inventory List |
| §2-2, §3-2 | Inventory Text Search | On search execution | Inventory List |
| §2-3, §3-3 | Shipping Instruction List Retrieval | On screen display | Shipping Instruction List |
| §2-4, §3-4 | Shipping Instruction Status Filtering | On filter operation | Shipping Instruction List |
| §2-5, §3-5 | Shipping Instruction Text Search | On search execution | Shipping Instruction List |
| §2-6, §3-6 | Shipping Work Initialization | On screen display | Shipping Work |
| §2-7, §3-7 | Shipping Confirmation Validation | On shipping confirmation operation | Shipping Work |
| §2-8, §3-8 | Shipping Confirmation Process | After validation passes | Shipping Work |
| §2-9, §3-9 | Order and Shipping Instruction Status Update | After shipping confirmation process completes | Shipping Work |
| §2-10, §3-10 | Receiving Initialization | On screen display | Receiving Registration |
| §2-11, §3-11 | Receiving Save | On save operation | Receiving Registration |
| §2-12, §3-12 | Returns Initialization | On screen display | Returns Registration |
| §2-13, §3-13 | Return Validation | On save operation | Returns Registration |
| §2-14, §3-14 | Return Registration Process | After validation passes | Returns Registration |

---

## §2. Condition Judgments (Branching)

### §2-1. Inventory List Retrieval — Screen Initialization

Executed when the Inventory List Screen is displayed.

- Initialize `search_text` (Inventory List Screen) to an empty string.
- Proceed to data retrieval process (§3-1).

---

### §2-2. Inventory Text Search

Executed when search is triggered on the Inventory List Screen.

- Update `search_text` (Inventory List Screen) to the entered search string.
- Proceed to data retrieval process (§3-2).

---

### §2-3. Shipping Instruction List Retrieval — Screen Initialization

Executed when the Shipping Instruction List Screen is displayed.

- Initialize `filter_status` (Shipping Instruction List Screen) to 0 (Not Shipped) (default: show only Not Shipped).
- Initialize `search_text` (Shipping Instruction List Screen) to an empty string.
- Proceed to data retrieval process (§3-3).

---

### §2-4. Shipping Instruction Status Filtering

Executed when the filter is toggled on the Shipping Instruction List Screen.

- Update `filter_status` (Shipping Instruction List Screen) to the status value selected by the operation.
- Proceed to data retrieval process (§3-4).

---

### §2-5. Shipping Instruction Text Search

Executed when search is triggered on the Shipping Instruction List Screen.

- Update `search_text` (Shipping Instruction List Screen) to the entered search string.
- Proceed to data retrieval process (§3-5).

---

### §2-6. Shipping Work Initialization — Screen Initialization

Executed when the "Start Shipping Work" operation is performed on the Shipping Instruction List Screen (when a `Shipping Instruction Data` record with status = Not Shipped or Shipping is selected).

**Guard Condition:**
- If the selected `shipping_instruction_data.status` is neither 0 (Not Shipped) nor 1 (Shipping) ⇒ Display "Only shipping instructions with status Not Shipped or Shipping can be worked on." End processing.

- Set `active_shipping_instruction_id` to the `shipping_instruction_id` of the selected `Shipping Instruction Data`.
- Initialize all slots (×30) of `current_shipping_quantity` to 0.
- Proceed to data retrieval process (§3-6).

---

### §2-7. Shipping Confirmation Validation

Executed when the "Confirm Shipping" button is operated on the Shipping Work Screen.

**Guard Condition:**
- If all slots (×30) of `current_shipping_quantity` are 0 ⇒ Display "Please enter a current shipping quantity for at least one row." End processing.

**Upper Limit Check (per line item row):**
- For each row of `Shipping Instruction Line Items` corresponding to `active_shipping_instruction_id`:
  - Calculate the remaining shipping quantity (`shipping_instruction_line_item.instructed_quantity` − `shipping_instruction_line_item.shipped_quantity`).
  - If the corresponding row's `current_shipping_quantity` > remaining shipping quantity ⇒ Record as an error: the row number, product name (`Product Master[shipping_instruction_line_item.product_id].product_name`), and excess quantity (`current_shipping_quantity` − remaining shipping quantity).
  - Rows where `current_shipping_quantity` = 0 are excluded from the check (treated as not shipping this time).

- If 1 or more errors exist ⇒ Display all errors together. End processing.
- If 0 errors ⇒ Proceed to shipping confirmation process (§3-8).

---

### §2-8. Shipping Confirmation Process

Executed after validation (§2-7) passes.

- Proceed to data update process (§3-8).

---

### §2-9. Order and Shipping Instruction Status Update

Executed after shipping confirmation process (§3-8) completes.

**Shipping Instruction Status Judgment:**
- For all rows of `Shipping Instruction Line Items` corresponding to `active_shipping_instruction_id`, if (`shipping_instruction_line_item.shipped_quantity` = `shipping_instruction_line_item.instructed_quantity`) holds for every row:
  - Update `shipping_instruction_data.status` to 2 (Shipped).
- Otherwise (if any row is not yet complete):
  - Update `shipping_instruction_data.status` to 1 (Shipping).

**Order Status Judgment:**
- Identify `Order Data` from `shipping_instruction_data.order_id` corresponding to `active_shipping_instruction_id`.
- If `order_data.status` ≥ 3 (Invoiced or above) ⇒ Do not update the order status (managed within the scope of billing and payment management). Skip the following judgment.
- For all rows of `Order Line Items` associated with that order, if (`order_line_item.shipped_quantity` = `order_line_item.quantity`) holds for every row:
  - Update `order_data.status` to 2 (Shipped).
- Otherwise (if any row is not yet shipped):
  - Update `order_data.status` to 1 (Shipping).

> Note: Updates to `order_data.status` are limited to transitions to "Shipping (1)" or "Shipped (2)". Transitions to "Invoiced (3)", "Completed (4)", or "Cancelled (5)" are within the scope of another specification (refer to `103_billing_payment_spec.md`).

- Proceed to data update process (§3-9).

---

### §2-10. Receiving Initialization — Screen Initialization

Executed when the "Register Receiving" button is operated on the Inventory List Screen.

- Initialize `input_receiving_date` to today's date.
- Initialize `input_notes` to an empty string.
- Proceed to data retrieval process (§3-10).

---

### §2-11. Receiving Save

Executed when the "Save" button is operated on the Receiving Registration Screen.

**Validation:**
- If `input_receiving_date` is not entered ⇒ Display "Please enter a receiving date." Abort processing.
- If there are 0 input line item rows (rows with a product selected) ⇒ Display "Please enter at least one line item." Abort processing.
- If any row has a product selected but a receiving quantity less than 1 ⇒ Display "Please enter a receiving quantity of 1 or more (Row: [row number])." Abort processing.

- Validation passed ⇒ Proceed to data update process (§3-11).

---

## §3. Data Update Processes

### §3-1. Inventory List Retrieval

1. Retrieve all records from `Product Inventory`.
2. Join `Product Master` to attach `Product Master.product_code`, `Product Master.product_name`, `Product Master.category_id`, and `Product Master.active_flag` (`product_inventory.product_id` = `Product Master.product_id`).
3. Join `Product Category` to attach the category name (`Product Category[Product Master.category_id].category_name`).
4. Sort by product code ascending.
5. Proceed to display update (§4-1).

---

### §3-2. Inventory Text Search

1. Retrieve all records from `Product Inventory`.
2. Join `Product Master` (same as §3-1 step 2).
3. Filter to rows where `Product Master.product_code` or `Product Master.product_name` contains `search_text` (Inventory List Screen) as a partial match. If `search_text` is an empty string, no filtering is applied.
4. Join `Product Category` to attach the category name (same as §3-1 step 3).
5. Sort by product code ascending.
6. Proceed to display update (§4-1).

---

### §3-3. Shipping Instruction List Retrieval

1. Retrieve all records from `Shipping Instruction Data` where `status` is not 3 (Cancelled).
2. Join `Customer Master` to attach `Customer Master.customer_name` (`shipping_instruction_data.customer_id` = `Customer Master.customer_id`).
3. Join `Order Data` to attach `order_data.order_number` (`shipping_instruction_data.order_id` = `Order Data.order_id`).
4. Join `Shipping Instruction Line Items` to attach the count of line items associated with each `Shipping Instruction Data`.
5. Filter by the condition `filter_status` (Shipping Instruction List Screen) = 0 (Not Shipped) (the default value at screen initialization). No search is performed since `search_text` is an empty string.
6. Sort by `shipping_instruction_data.created_at` ascending (oldest first).
7. Proceed to display update (§4-2).

---

### §3-4. Shipping Instruction Status Filtering

1. Retrieve all records from `Shipping Instruction Data` where `status` is not 3 (Cancelled).
2. Join `Customer Master`, `Order Data`, and `Shipping Instruction Line Items` (same as §3-3 steps 2–4).
3. Filter according to the value of `filter_status` (Shipping Instruction List Screen).
   - If `filter_status` = -1 (show all): Target all records except Cancelled (status = 3).
   - If `filter_status` = 0 (Not Shipped): Target only records where `shipping_instruction_data.status` = 0.
   - If `filter_status` = 1 (Shipping): Target only records where `shipping_instruction_data.status` = 1.
   - Otherwise (`filter_status` = 2: Shipped): Target only records where `shipping_instruction_data.status` = 2.
4. If `search_text` (Shipping Instruction List Screen) is not empty: Filter to rows that partially match `shipping_instruction_data.shipping_instruction_number` or `Customer Master.customer_name`.
5. Sort by `shipping_instruction_data.created_at` ascending.
6. Proceed to display update (§4-2).

---

### §3-5. Shipping Instruction Text Search

1. Retrieve all records from `Shipping Instruction Data` where `status` is not 3 (Cancelled).
2. Join `Customer Master`, `Order Data`, and `Shipping Instruction Line Items` (same as §3-3 steps 2–4).
3. Apply filtering by `filter_status` (Shipping Instruction List Screen) using the same conditions as §3-4 step 3.
4. If `search_text` (Shipping Instruction List Screen) is not empty: Filter to rows that partially match `shipping_instruction_data.shipping_instruction_number` or `Customer Master.customer_name`.
5. Sort by `shipping_instruction_data.created_at` ascending.
6. Proceed to display update (§4-2).

---

### §3-6. Shipping Work Initialization

1. Retrieve the record from `Shipping Instruction Data` where `shipping_instruction_id` = `active_shipping_instruction_id`.
2. Join `Customer Master` to attach `Customer Master.customer_name`.
3. Join `Order Data` to attach `order_data.order_number`.
4. Retrieve all records from `Shipping Instruction Line Items` where `shipping_instruction_id` = `active_shipping_instruction_id`.
5. Attach `Product Master[shipping_instruction_line_item.product_id].product_name` to each `Shipping Instruction Line Item`.
6. `current_shipping_quantity` was already initialized to 0 for all slots in §2-6; no additional initialization is needed.
7. Proceed to display update (§4-3).

---

### §3-7. Shipping Confirmation Validation

The validation in §2-7 is completed entirely in the condition judgment section; there are no data update operations in this section. After validation passes, proceed to §3-8.

---

### §3-8. Shipping Confirmation Process

For each `Shipping Instruction Line Item` row where `current_shipping_quantity` ≥ 1, execute the following steps per row.

1. Create a new record in `Shipping Line Items`.
   - `shipping_line_item_id`: Auto-assigned (0 = unused slot; valid values are 1 or above)
   - `shipping_instruction_line_item_id`: The target `shipping_instruction_line_item.shipping_instruction_line_item_id`
   - `shipping_quantity`: The value of the corresponding `current_shipping_quantity`
   - `shipped_at`: Current datetime

2. Add `current_shipping_quantity` to the target `shipping_instruction_line_item.shipped_quantity` (upper limit = `shipping_instruction_line_item.instructed_quantity`).

3. Subtract `current_shipping_quantity` from `Product Inventory.actual_stock` for the product ID corresponding to the target `shipping_instruction_line_item.product_id` (lower limit = 0).

4. Subtract `current_shipping_quantity` from `Product Inventory.allocation_count` for the product ID corresponding to the target `shipping_instruction_line_item.product_id` (lower limit = 0).

5. Add `current_shipping_quantity` to `order_line_item.shipped_quantity` for the `Order Line Item` corresponding to the target `shipping_instruction_line_item.order_line_item_id` (upper limit = `order_line_item.quantity`).

After all rows are processed, proceed to Order and Shipping Instruction Status Update (§2-9).

> Note: Proceed to §2-9 after completing steps 1 (`Shipping Line Items` creation) through 5 (`order_line_item.shipped_quantity` increment). Since `Shipping Instruction Line Items` are referenced in steps 2–5, do not clear data during processing of each row (Rule 14: do not clear data before reference is complete).

---

### §3-9. Order and Shipping Instruction Status Update

Update data based on the judgment result from §2-9.

1. Update `Shipping Instruction Data[active_shipping_instruction_id].status` to the judgment result from §2-9 (1=Shipping or 2=Shipped).

2. Referencing `shipping_instruction_data.order_id` corresponding to `active_shipping_instruction_id`, update `Order Data[order_id].status` to the judgment result from §2-9 (1=Shipping or 2=Shipped).

3. Navigate to the Shipping Instruction List Screen.

---

### §3-10. Receiving Initialization

This process performs no data reads or writes. Display an empty input form using the `input_receiving_date` and `input_notes` values initialized in §2-10.

- Proceed to display update (§4-4).

---

### §3-11. Receiving Save

Execute the following after validation (§2-11) passes.

1. Create a new record in `Receiving Data`.
   - `receiving_id`: Auto-assigned (0 = none (reserved value); valid values are 1 or above)
   - `receiving_date`: `input_receiving_date`
   - `notes`: `input_notes`
   - `registered_by`: Account ID retrieved from the authentication framework (framework delegation)
   - `registered_at`: Current datetime

2. For each line item row with a product selected, create a new record in `Receiving Line Items`.
   - `receiving_line_item_id`: Auto-assigned (0 = unused slot; valid values are 1 or above)
   - `receiving_id`: The `receiving_id` assigned in step 1
   - `product_id`: The `Product Master.product_id` of the product selected in that row (1 or above)
   - `receiving_quantity`: The receiving quantity entered in that row (1 or above)

3. For each `Receiving Line Item` created in step 2, add `receiving_line_item.receiving_quantity` to `Product Inventory.actual_stock` for the corresponding `product_id` (upper limit = 999999).

4. Navigate to the Inventory List Screen.

---

## §4. Display and Effect Updates (UI Hooks)

### §4-1. Inventory List Screen — After Inventory List Retrieval / Text Search

- Display the following in each row of the inventory list table.
  - Product Code: `Product Master[product_inventory.product_id].product_code`
  - Product Name: `Product Master[product_inventory.product_id].product_name`
  - Category Name: `Product Category[Product Master[product_inventory.product_id].category_id].category_name`
  - Actual Stock: `product_inventory.actual_stock`
  - Allocated: `product_inventory.allocation_count`
  - Available Stock (UI Hook): Display the calculated value of `product_inventory.actual_stock` − `product_inventory.allocation_count`. Not stored in data.
- Display the current value of `search_text` (Inventory List Screen) in the search field.

---

### §4-2. Shipping Instruction List Screen — After List Retrieval / Filtering / Text Search

- Update the status filter selection state to match `filter_status` (Shipping Instruction List Screen).
- Display the following in each row of the shipping instruction list table.
  - Shipping Instruction Number: `shipping_instruction_data.shipping_instruction_number`
  - Customer Name: `Customer Master[shipping_instruction_data.customer_id].customer_name`
  - Order Number: `Order Data[shipping_instruction_data.order_id].order_number`
  - Line Item Count: The count of records in `Shipping Instruction Line Items` with a matching `shipping_instruction_id`
  - Status: Display the label corresponding to `shipping_instruction_data.status` as a badge (0=Not Shipped, 1=Shipping, 2=Shipped)
  - Created Date: `shipping_instruction_data.created_at` in "YYYY/MM/DD" format
- For rows with status = 0 (Not Shipped) or 1 (Shipping), display the "Start Shipping Work" button as active. For rows with status = 2 (Shipped), the button is inactive.
- Display the current value of `search_text` (Shipping Instruction List Screen) in the search field.

---

### §4-3. Shipping Work Screen — After Initialization

- Display the following in the shipping instruction header (read-only).
  - Shipping Instruction Number: `Shipping Instruction Data[active_shipping_instruction_id].shipping_instruction_number`
  - Customer Name: `Customer Master[Shipping Instruction Data[active_shipping_instruction_id].customer_id].customer_name`
  - Order Number: `Order Data[Shipping Instruction Data[active_shipping_instruction_id].order_id].order_number`

- Display the following in each row of the shipping line item input table.
  - Product Name: `Product Master[shipping_instruction_line_item.product_id].product_name`
  - Instructed Quantity: `shipping_instruction_line_item.instructed_quantity`
  - Already Shipped Quantity: `shipping_instruction_line_item.shipped_quantity`
  - Remaining Shipping Quantity (UI Hook): Display the calculated value of `shipping_instruction_line_item.instructed_quantity` − `shipping_instruction_line_item.shipped_quantity` for reference. Not stored in data.
  - Current Shipping Quantity Input Field: An input field displaying the value of the corresponding `current_shipping_quantity` slot (initial value 0)

- Confirm Shipping button: Inactive if all slots (×30) of `current_shipping_quantity` are 0. Active if 1 or more slots have a value of 1 or above.

---

### §4-4. Receiving Registration Screen — After Initialization

- Display one empty line item row in the receiving line item table (no product selected, quantity not entered).
- Display `input_receiving_date` (today's date) in the receiving date field.
- Display `input_notes` (empty string) in the notes field.

---

## Returns Processing (Screen 16: Returns Registration)

### §2-12. Returns Initialization — Screen Initialization

Executed when the "Register Return" operation is performed on the Shipping Instruction List Screen (when a `Shipping Instruction Data` record with status = 2 (Shipped) is selected).

**Guard Condition:**
- If the selected `shipping_instruction_data.status` ≠ 2 (Shipped) ⇒ Display "Returns can only be registered for shipped shipping instructions." End processing.

- Set `active_shipping_instruction_id` (Returns Registration Screen) to the `shipping_instruction_id` of the selected `Shipping Instruction Data`.
- Initialize all slots (×30) of `return_quantity_input` to 0.
- Proceed to data retrieval process (§3-12).

---

### §2-13. Return Validation

Executed when the "Save" button is operated on the Returns Registration Screen.

**Guard Condition:**
- If all slots (×30) of `return_quantity_input` are 0 ⇒ Display "Please enter a return quantity for at least one row." End processing.

**Cumulative Return Quantity Check (per line item row):**
- For each row of `Shipping Instruction Line Items` corresponding to `active_shipping_instruction_id`:
  - Calculate the already returned quantity: Σ(`Return Item.Quantity`) for all existing `Return Item` records where `Return.Shipping Instruction ID` = `active_shipping_instruction_id` AND `Return Item.Product ID` = current row's `Product ID`.
  - Calculate the maximum returnable quantity: `shipping_instruction_line_item.shipped_quantity` − already returned quantity.
  - If the corresponding row's `return_quantity_input` > maximum returnable quantity ⇒ Record as an error: the row number, product name (`Product Master[shipping_instruction_line_item.product_id].product_name`), and excess quantity (`return_quantity_input` − maximum returnable quantity).
  - Rows where `return_quantity_input` = 0 are excluded from the check (treated as not returning this product).

- If 1 or more errors exist ⇒ Display all errors together. End processing.
- If 0 errors ⇒ Proceed to return registration process (§3-14).

---

### §2-14. Return Registration Process

Executed after validation (§2-13) passes.

- Proceed to data update process (§3-14).

---

### §3-12. Returns Initialization

1. Retrieve the record from `Shipping Instruction Data` where `shipping_instruction_id` = `active_shipping_instruction_id`.
2. Join `Customer Master` to attach `Customer Master.customer_name`.
3. Join `Order Data` to attach `order_data.order_number`.
4. Retrieve all records from `Shipping Instruction Line Items` where `shipping_instruction_id` = `active_shipping_instruction_id`.
5. Attach `Product Master[shipping_instruction_line_item.product_id].product_name` to each `Shipping Instruction Line Item`.
6. For each `Shipping Instruction Line Item`, calculate the already returned quantity: Σ(`Return Item.Quantity`) for all existing `Return` records where `Return.Shipping Instruction ID` = `active_shipping_instruction_id`, grouped by `Return Item.Product ID`.
7. `return_quantity_input` was already initialized to 0 for all slots in §2-12; no additional initialization is needed.
8. Proceed to display update (§4-5).

---

### §3-13. Return Validation

The validation in §2-13 is completed entirely in the condition judgment section; there are no data update operations in this section. After validation passes, proceed to §3-14.

---

### §3-14. Return Registration Process

For each `Shipping Instruction Line Item` row where `return_quantity_input` ≥ 1, execute the following steps.

1. Create a new record in `Return`.
   - `return_id`: Auto-assigned (0 = unused slot; valid values are 1 or above)
   - `shipping_instruction_id`: `active_shipping_instruction_id`
   - `customer_id`: `Shipping Instruction Data[active_shipping_instruction_id].customer_id`
   - `credit_note_invoice_id`: 0 (will be updated in step 5)
   - `created_at`: Current datetime

2. For each row where `return_quantity_input` ≥ 1, create a new record in `Return Item`.
   - `return_item_id`: Auto-assigned (0 = unused slot; valid values are 1 or above)
   - `return_id`: The `return_id` assigned in step 1
   - `product_id`: The target `shipping_instruction_line_item.product_id`
   - `quantity`: The value of the corresponding `return_quantity_input`
   - `unit_price`: The `Order Line Item.Unit Price` corresponding to the target `shipping_instruction_line_item.order_line_item_id` (the original order price)

3. For each `Return Item` created in step 2, add `return_item.quantity` to `Product Inventory.Physical Stock` for the corresponding `product_id` (upper limit = 999999).

4. **Credit Note Auto-Generation:**
   - Calculate the credit note amount as follows:
     - For each `Return Item` created in step 2:
       - Line subtotal = `return_item.quantity` × `return_item.unit_price`
       - Line tax = floor(`return_item.quantity` × `return_item.unit_price` × `System Settings.Consumption Tax Rate` / 100)
     - Credit note amount (negative) = −(Σ(line subtotals) + Σ(line taxes))
   - Create a new record in `Invoice`:
     - `invoice_id`: Auto-assigned
     - `invoice_number`: `System Settings.Invoice Number Prefix` + "CN-" + sequential number
     - `customer_id`: `Shipping Instruction Data[active_shipping_instruction_id].customer_id`
     - `billing_period`: Current year-month (YYYY-MM format)
     - `invoice_amount`: The credit note amount calculated above (**negative value**)
     - `status`: 4 (Credit Note)
     - `return_id`: The `return_id` assigned in step 1
     - `issue_date`: Today's date
     - `registered_at`: Current datetime

5. Update `Return[return_id].credit_note_invoice_id` to the `invoice_id` assigned in step 4.

6. Navigate to the Shipping Instruction List Screen.

> Note: The order step 1 (`Return` creation) → step 2 (`Return Item` creation) → step 3 (inventory update) → step 4 (credit note generation) → step 5 (`Return` update) must be strictly observed. The credit note amount calculation in step 4 references all `Return Item` records created in step 2 (Rule 14: no clearing before reference is complete).

---

### §4-5. Returns Registration Screen — After Initialization

- Display the following in the shipping instruction header (read-only).
  - Shipping Instruction Number: `Shipping Instruction Data[active_shipping_instruction_id].shipping_instruction_number`
  - Customer Name: `Customer Master[Shipping Instruction Data[active_shipping_instruction_id].customer_id].customer_name`
  - Order Number: `Order Data[Shipping Instruction Data[active_shipping_instruction_id].order_id].order_number`

- Display the following in each row of the return line item input table.
  - Product Name: `Product Master[shipping_instruction_line_item.product_id].product_name`
  - Shipped Quantity: `shipping_instruction_line_item.shipped_quantity`
  - Already Returned Quantity: The value calculated in §3-12 step 6
  - Maximum Returnable Quantity (UI Hook): Display the calculated value of `shipping_instruction_line_item.shipped_quantity` − Already Returned Quantity. Not stored in data.
  - Return Quantity Input Field: An input field displaying the value of the corresponding `return_quantity_input` slot (initial value 0)

- Save button: Inactive if all slots (×30) of `return_quantity_input` are 0. Active if 1 or more slots have a value of 1 or above.

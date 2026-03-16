# BtoB Sales Management System — Master Management Module Specification

> Referenced Data:
> - `01_master_data.md` (Product Category, Product Master, Customer Master, Special Price Master)
> - `02_persistent_data.md` (Product Inventory)
> - `03_screen_data.md` (Product Management Screen, Customer Management Screen, Special Price Master Screen)

---

## §1. Process Triggers and Overview

This specification defines all Processes for the 3 screens of the Master Management Module (Product Management Screen, Customer Management Screen, Special Price Master Screen).

Module boundaries:
- `101_order_spec.md` (Order Management Module): References `Product Master`, `Customer Master`, and `Special Price Master` when creating quotes and orders. This specification only registers and updates those data records.
- `102_inventory_shipping_spec.md` (Inventory & Shipping Management Module): When a new product is created in this specification, `Product Inventory` is created at the same time (see §3-4). Addition/subtraction of `Product Inventory` due to receiving and shipping is within the scope of `102_inventory_shipping_spec.md`.
- `103_billing_payment_spec.md` (Invoice & Payment Management Module): No data integration with this specification.

Framework delegation: Authentication/session management.

| § Section | Process Name | Trigger | Screen |
|:--|:--|:--|:--|
| §2-1, §3-1 | Product List Retrieval | On screen display | Product Management |
| §2-2, §3-2 | Text Search (Product) | On search execution | Product Management |
| §2-3, §3-3 | Product Form Preset | On product selection | Product Management |
| §2-4, §3-4 | Product Save | On save operation | Product Management |
| §2-5, §3-5 | Customer List Retrieval | On screen display | Customer Management |
| §2-6, §3-6 | Text Search (Customer) | On search execution | Customer Management |
| §2-7, §3-7 | Customer Form Preset | On customer selection | Customer Management |
| §2-8, §3-8 | Customer Save | On save operation | Customer Management |
| §2-9, §3-9 | Special Price List Retrieval | On screen display | Special Price Master |
| §2-10, §3-10 | Filtering (Special Price) | On filter operation | Special Price Master |
| §2-11, §3-11 | Special Price Form Preset | On record selection | Special Price Master |
| §2-12, §3-12 | Standard Price Reference Display | On product selection (in form) | Special Price Master |
| §2-13, §3-13 | Special Price Save | On save operation | Special Price Master |
| §2-14, §3-14 | Special Price Delete | On delete operation | Special Price Master |

> Products and customers do not have a delete operation. Deactivation is handled by updating `Product Master.Active Flag` to 0. Customers do not have a deactivation flag; only updates to existing records are supported (active/inactive management of customers is outside the scope of this system).

---

## §2. Decision Processing (Conditional Branching)

---

### §2-1. Product List Retrieval — Screen Initialization

Executed when the Product Management Screen is displayed.

- Initialize `Target Product ID` to 0 (new addition mode).
- Proceed to data retrieval processing (§3-1).

> Note: When the "Add New" button is operated, resetting `Target Product ID` to 0 produces the same behavior as this Process.

---

### §2-2. Text Search (Product)

Executed when a search is performed on the Product Management Screen.

- Update `Search Text` (input value on the Product Management Screen).
- Proceed to data retrieval processing (§3-1).

---

### §2-3. Product Form Preset

Executed when an existing product row is selected on the Product Management Screen.

- Update `Target Product ID` to the `Product ID` of the selected product.
- Proceed to data update processing (§3-3).

---

### §2-4. Product Save

Executed when "Save" is operated on the Product Management Screen.

**Validation (check all of the following; interrupt processing if any condition fails):**

1. If `Product Code` (input value) is empty ⇒ Display "Please enter the product code." Interrupt processing.
2. If `Product Name` (input value) is empty ⇒ Display "Please enter the product name." Interrupt processing.
3. If `Standard Unit Price` (input value) is less than 0 or exceeds 9,999,999 ⇒ Display "Please enter a standard unit price between ¥0 and ¥9,999,999." Interrupt processing.
4. Duplicate Check for `Product Code` (input value):
   - If `Target Product ID` = 0 (new addition mode) ⇒ If a `Product Master` with the same `Product Code` already exists, display "This code is already in use." Interrupt processing.
   - If `Target Product ID` ≥ 1 (edit mode) ⇒ If a `Product Master` with the same `Product Code` already exists for a record other than `Target Product ID`, display "This code is already in use." Interrupt processing.

**After validation passes:**
- If `Target Product ID` = 0 (new addition mode) ⇒ Proceed to data update processing (§3-4) as a new creation.
- If `Target Product ID` ≥ 1 (edit mode) ⇒ Proceed to data update processing (§3-4) as an update.

---

### §2-5. Customer List Retrieval — Screen Initialization

Executed when the Customer Management Screen is displayed.

- Initialize `Target Customer ID` to 0 (new addition mode).
- Proceed to data retrieval processing (§3-5).

> Note: When the "Add New" button is operated, resetting `Target Customer ID` to 0 produces the same behavior as this Process.

---

### §2-6. Text Search (Customer)

Executed when a search is performed on the Customer Management Screen.

- Update `Search Text` (input value on the Customer Management Screen).
- Proceed to data retrieval processing (§3-5).

---

### §2-7. Customer Form Preset

Executed when an existing customer row is selected on the Customer Management Screen.

- Update `Target Customer ID` to the `Customer ID` of the selected customer.
- Proceed to data update processing (§3-7).

---

### §2-8. Customer Save

Executed when "Save" is operated on the Customer Management Screen.

**Validation (check all of the following; interrupt processing if any condition fails):**

1. If `Customer Code` (input value) is empty ⇒ Display "Please enter the customer code." Interrupt processing.
2. If `Customer Name` (input value) is empty ⇒ Display "Please enter the customer name." Interrupt processing.
3. If `Credit Limit` (input value) is less than 0 or exceeds 99,999,999 ⇒ Display "Please enter a credit limit between ¥0 and ¥99,999,999." Interrupt processing.
4. If `Closing Day` (input value) does not match any of the following ⇒ Display "Please enter 0 (end of month) or an integer between 1 and 28 for the closing day." Interrupt processing.
   - 0 (end of month)
   - An integer from 1 to 28
5. Duplicate Check for `Customer Code` (input value):
   - If `Target Customer ID` = 0 (new addition mode) ⇒ If a `Customer Master` with the same `Customer Code` already exists, display "This code is already in use." Interrupt processing.
   - If `Target Customer ID` ≥ 1 (edit mode) ⇒ If a `Customer Master` with the same `Customer Code` already exists for a record other than `Target Customer ID`, display "This code is already in use." Interrupt processing.

**After validation passes:**
- If `Target Customer ID` = 0 (new addition mode) ⇒ Proceed to data update processing (§3-8) as a new creation.
- If `Target Customer ID` ≥ 1 (edit mode) ⇒ Proceed to data update processing (§3-8) as an update.

---

### §2-9. Special Price List Retrieval — Screen Initialization

Executed when the Special Price Master Screen is displayed.

- Initialize `Filter Customer ID` to 0 (show all customers).
- Initialize `Filter Product ID` to 0 (show all products).
- Initialize `Target Special Price Master ID` to 0 (new addition mode).
- Proceed to data retrieval processing (§3-9).

---

### §2-10. Filtering (Special Price)

Executed when the customer filter or product filter is operated on the Special Price Master Screen.

- On customer filter change: Update `Filter Customer ID` to the selected value (0 when all customers is selected).
- On product filter change: Update `Filter Product ID` to the selected value (0 when all products is selected).
- Proceed to data retrieval processing (§3-9).

---

### §2-11. Special Price Form Preset

Executed when an existing record row is selected on the Special Price Master Screen.

- Update `Target Special Price Master ID` to the `Special Price Master ID` of the selected record.
- Proceed to data update processing (§3-11).

---

### §2-12. Standard Price Reference Display

Executed when a product is selected in the form on the Special Price Master Screen.

- Proceed to data retrieval processing (§3-12).

---

### §2-13. Special Price Save

Executed when "Save" is operated on the Special Price Master Screen.

**Validation (check all of the following; interrupt processing if any condition fails):**

1. If `Customer ID` (form selection value) is not selected (no valid `Customer Master` selected) ⇒ Display "Please select a customer." Interrupt processing.
2. If `Product ID` (form selection value) is not selected (no valid `Product Master` selected) ⇒ Display "Please select a product." Interrupt processing.
3. If `Special Unit Price` (input value) is less than 0 or exceeds 9,999,999 ⇒ Display "Please enter a special unit price between ¥0 and ¥9,999,999." Interrupt processing.
4. Duplicate Check (new addition mode only):
   - If `Target Special Price Master ID` = 0 (new addition mode) ⇒ If a `Special Price Master` with the same combination of (`Customer ID` · `Product ID`) already exists, display "This combination of customer and product is already registered." Interrupt processing.
   - If `Target Special Price Master ID` ≥ 1 (edit mode) ⇒ Duplicate check is not required (customer and product cannot be changed in edit mode).

**After validation passes:**
- If `Target Special Price Master ID` = 0 (new addition mode) ⇒ Proceed to data update processing (§3-13) as a new creation.
- If `Target Special Price Master ID` ≥ 1 (edit mode) ⇒ Proceed to data update processing (§3-13) as an update.

---

### §2-14. Special Price Delete

Executed when "Delete" is operated while a form is displayed (`Target Special Price Master ID` ≥ 1) on the Special Price Master Screen.

**Guard condition:**
- If `Target Special Price Master ID` = 0 (new addition mode) ⇒ Do not execute this process.

**After guard passes:**
- Display a delete confirmation dialog ("Are you sure you want to delete this special unit price? After deletion, the standard unit price will be applied at the time of order.").
- Proceed to data update processing (§3-14) only if confirmed.
- If cancelled ⇒ Terminate processing.

---

## §3. Data Update Processing

---

### §3-1. Product List Retrieval

1. Retrieve all records from `Product Master` (including all records with `Active Flag` = 0 (inactive)).
2. Join `Product Category` to retrieve the `Category Name` corresponding to each product's `Category ID`.
3. If `Search Text` (Product Management Screen) is not an empty string, apply partial match filtering on `Product Master.Product Code` or `Product Master.Product Name`.
4. Sort by `Product Master.Product Code` in ascending order.
5. Proceed to display update (§4-1).

---

### §3-2. Text Search (Product)

Same processing as §3-1. Execute §3-1 with `Search Text` updated.

---

### §3-3. Product Form Preset

1. Display the following fields of `Product Master[Target Product ID]` in the form.
   - `Product Code`, `Product Name`, `Category ID`, `Standard Unit Price`, `Unit`, `Active Flag`
2. Proceed to display update (§4-1).

---

### §3-4. Product Save

**For new creation:**

1. Create a new record in `Product Master`.
   - `Product ID`: Auto-numbered (1–9999)
   - `Product Code`: Input value
   - `Product Name`: Input value
   - `Category ID`: `Category ID` selected in the form
   - `Standard Unit Price`: Input value (range: 0–9,999,999)
   - `Unit`: Input value
   - `Active Flag`: 1 (active)
2. Create a new record in `Product Inventory`.
   - `Product ID`: The `Product ID` assigned in step 1
   - `Physical Stock`: 0
   - `Allocated Quantity`: 0
3. Reset `Target Product ID` to 0 (new addition mode).
4. Execute §3-1 (Product List Retrieval).

**For update:**

1. Update the following fields of `Product Master[Target Product ID]` with the input values.
   - `Product Code`, `Product Name`, `Category ID`, `Standard Unit Price`, `Unit`, `Active Flag`
   > Note: Changing `Standard Unit Price` does not affect the `Unit Price` of existing `Quotation Line Item` or `Order Line Item` (already snapshotted).
2. Reset `Target Product ID` to 0 (new addition mode).
3. Execute §3-1 (Product List Retrieval).

---

### §3-5. Customer List Retrieval

1. Retrieve all records from `Customer Master`.
2. If `Search Text` (Customer Management Screen) is not an empty string, apply partial match filtering on `Customer Master.Customer Code` or `Customer Master.Customer Name`.
3. Sort by `Customer Master.Customer Code` in ascending order.
4. Proceed to display update (§4-2).

---

### §3-6. Text Search (Customer)

Same processing as §3-5. Execute §3-5 with `Search Text` updated.

---

### §3-7. Customer Form Preset

1. Display the following fields of `Customer Master[Target Customer ID]` in the form.
   - `Customer Code`, `Customer Name`, `Address`, `Phone Number`, `Email Address`, `Closing Day`, `Credit Limit`
2. Proceed to display update (§4-2).

---

### §3-8. Customer Save

**For new creation:**

1. Create a new record in `Customer Master`.
   - `Customer ID`: Auto-numbered (1–9999)
   - `Customer Code`: Input value
   - `Customer Name`: Input value
   - `Address`: Input value
   - `Phone Number`: Input value
   - `Email Address`: Input value
   - `Closing Day`: Input value (0=end of month, 1–28=the specified day)
   - `Credit Limit`: Input value (range: 0–99,999,999)
2. Reset `Target Customer ID` to 0 (new addition mode).
3. Execute §3-5 (Customer List Retrieval).

**For update:**

1. Update the following fields of `Customer Master[Target Customer ID]` with the input values.
   - `Customer Code`, `Customer Name`, `Address`, `Phone Number`, `Email Address`, `Closing Day`, `Credit Limit`
   > Note: If `Credit Limit` is changed, the new value takes effect from the next credit check (see `101_order_spec.md`). It does not retroactively affect already-confirmed order data.
2. Reset `Target Customer ID` to 0 (new addition mode).
3. Execute §3-5 (Customer List Retrieval).

---

### §3-9. Special Price List Retrieval

1. Retrieve all records from `Special Price Master`.
2. Join `Customer Master` to retrieve the `Customer Name` and `Customer Code` corresponding to each record's `Customer ID`.
3. Join `Product Master` to retrieve the `Product Name` and `Standard Unit Price` corresponding to each record's `Product ID`.
4. Apply filtering.
   - If `Filter Customer ID` ≥ 1 (narrow by specified customer) ⇒ Keep only records where `Special Price Master.Customer ID` = `Filter Customer ID`.
   - If `Filter Customer ID` = 0 (show all customers) ⇒ Do not apply customer filter.
   - If `Filter Product ID` ≥ 1 (narrow by specified product) ⇒ Keep only records where `Special Price Master.Product ID` = `Filter Product ID`.
   - If `Filter Product ID` = 0 (show all products) ⇒ Do not apply product filter.
5. Sort by `Customer Master.Customer Code` in ascending order.
6. Proceed to display update (§4-3).

---

### §3-10. Filtering (Special Price)

Same processing as §3-9. Execute §3-9 with `Filter Customer ID` or `Filter Product ID` updated.

---

### §3-11. Special Price Form Preset

1. Display the following fields of `Special Price Master[Target Special Price Master ID]` in the form.
   - `Customer ID` (display the corresponding `Customer Master.Customer Name`), `Product ID` (display the corresponding `Product Master.Product Name`), `Special Unit Price`
2. Retrieve `Product Master[Special Price Master[Target Special Price Master ID].Product ID].Standard Unit Price` and display it as a reference (do not write to the form).
3. Proceed to display update (§4-3).

---

### §3-12. Standard Price Reference Display

1. Retrieve `Product Master[Product ID].Standard Unit Price` corresponding to the `Product ID` selected in the form.
2. Display the retrieved `Standard Unit Price` in the reference display field (do not write to the form).

---

### §3-13. Special Price Save

**For new creation:**

1. Create a new record in `Special Price Master`.
   - `Special Price Master ID`: Auto-numbered (1–9999)
   - `Customer ID`: `Customer ID` selected in the form (1–9999)
   - `Product ID`: `Product ID` selected in the form (1–9999)
   - `Special Unit Price`: Input value (range: 0–9,999,999)
2. Reset `Target Special Price Master ID` to 0 (new addition mode).
3. Execute §3-9 (Special Price List Retrieval).

**For update:**

1. Update the following fields of `Special Price Master[Target Special Price Master ID]` with the input values.
   - `Special Unit Price` (range: 0–9,999,999)
   > Note: In edit mode, `Customer ID` and `Product ID` are not changed. If a change is required, delete the record and add a new one.
2. Reset `Target Special Price Master ID` to 0 (new addition mode).
3. Execute §3-9 (Special Price List Retrieval).

---

### §3-14. Special Price Delete

1. Delete the record where `Special Price Master ID` = `Target Special Price Master ID` from `Special Price Master`.
   > Note: Deletion does not affect the `Unit Price` of in-progress `Quotation Line Item` or `Order Line Item` (already snapshotted). From the next automatic unit price assignment (see `101_order_spec.md`), `Product Master.Standard Unit Price` will be applied.
2. Reset `Target Special Price Master ID` to 0 (new addition mode).
3. Execute §3-9 (Special Price List Retrieval).

---

## §4. Display and Effect Updates (UI Hook)

---

### §4-1. Product Management Screen — After Product List Update

- Display the following in each row of the product list table.
  - Product Code: `Product Master[Product ID].Product Code`
  - Product Name: `Product Master[Product ID].Product Name`
  - Category Name: `Product Category[Product Master[Product ID].Category ID].Category Name` (display "Uncategorized" when `Category ID` = 0 (uncategorized))
  - Standard Unit Price: `Product Master[Product ID].Standard Unit Price` displayed in "¥X,XXX" format
  - Unit: `Product Master[Product ID].Unit`
  - Active Flag: `Product Master[Product ID].Active Flag` = 1 → "Active"; = 0 → "Inactive"
- Rows with `Active Flag` = 0 are displayed grayed out.
- Product edit form:
  - If `Target Product ID` = 0 ⇒ Display an empty form (new addition mode; default value of `Active Flag` = 1)
  - If `Target Product ID` ≥ 1 ⇒ Display a form preset with the values from `Product Master[Target Product ID]` (edit mode)

---

### §4-2. Customer Management Screen — After Customer List Update

- Display the following in each row of the customer list table.
  - Customer Code: `Customer Master[Customer ID].Customer Code`
  - Customer Name: `Customer Master[Customer ID].Customer Name`
  - Address: `Customer Master[Customer ID].Address`
  - Phone Number: `Customer Master[Customer ID].Phone Number`
  - Closing Day: `Customer Master[Customer ID].Closing Day` = 0 → "End of Month"; 1–28 → "Day XX"
  - Credit Limit: `Customer Master[Customer ID].Credit Limit` displayed in "¥XX,XXX,XXX" format (display "No Check" when 0=no credit check)
- Customer edit form:
  - If `Target Customer ID` = 0 ⇒ Display an empty form (new addition mode)
  - If `Target Customer ID` ≥ 1 ⇒ Display a form preset with the values from `Customer Master[Target Customer ID]` (edit mode)

---

### §4-3. Special Price Master Screen — After Special Price List Update

- Display the following in each row of the special price master list table.
  - Customer Name: `Customer Master[Special Price Master[Special Price Master ID].Customer ID].Customer Name`
  - Product Name: `Product Master[Special Price Master[Special Price Master ID].Product ID].Product Name`
  - Special Unit Price: `Special Price Master[Special Price Master ID].Special Unit Price` displayed in "¥X,XXX" format
  - Standard Unit Price (Reference): `Product Master[Special Price Master[Special Price Master ID].Product ID].Standard Unit Price` displayed in "¥X,XXX" format (displayed in gray as reference information)
- Update the filter selection state to match `Filter Customer ID` and `Filter Product ID`.
- Special price edit form:
  - If `Target Special Price Master ID` = 0 ⇒ Display an empty form (new addition mode)
  - If `Target Special Price Master ID` ≥ 1 ⇒ Display a form preset with the values from `Special Price Master[Target Special Price Master ID]` (edit mode)
  - On product selection (in form): Display `Product Master[Selected Product ID].Standard Unit Price` in the reference display field as "Standard Unit Price: ¥X,XXX" (§3-12)

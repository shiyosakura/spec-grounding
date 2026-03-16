# BtoB Sales Management System — Invoice & Payment Management Module Specification

> Referenced Data:
> - `01_master_data.md` (Customer Master, System Settings)
> - `02_persistent_data.md` (Order Data, Order Line Items, Shipment Line Items, Invoice Data, Invoice Line Items, Payment Data, Payment Reconciliation Line Items)
> - `03_screen_data.md` (Invoice List Screen, Invoice Issuance Screen, Payment Registration Screen, Payment Reconciliation Screen)

---

## §1. Process Triggers and Overview

This specification defines all Processes for the 4 screens of the Invoice & Payment Management Module (Invoice List Screen, Invoice Issuance Screen, Payment Registration Screen, Payment Reconciliation Screen).
The Order Management Module (Screens 1–4) is scoped to `101_order_spec.md`. The Inventory & Shipping Management Module (Screens 5–8) is scoped to `102_inventory_shipping_spec.md`. The Master Management Module (Screens 13–15) is scoped to `104_master_spec.md`.
Framework delegation: Authentication/session management, report PDF generation (Invoice PDF output).

| § Section | Process Name | Trigger | Screen |
|:--|:--|:--|:--|
| §2-1, §3-1 | Invoice List Retrieval | On screen display | Invoice List |
| §2-2, §3-2 | Invoice List Filtering | On filter operation | Invoice List |
| §2-3, §3-3 | Invoice List Text Search | On search execution | Invoice List |
| §2-4, §3-4 | Target Order Line Preview Retrieval | On preview operation | Invoice Issuance |
| §2-5, §3-5 | Invoice Issuance | On issuance execution operation | Invoice Issuance |
| §2-6, §3-6 | Payment Initialization | On screen display | Payment Registration |
| §2-7, §3-7 | Payment Save | On save operation | Payment Registration |
| §2-8, §3-8 | Unreconciled Payment List Retrieval | On screen display | Payment Reconciliation |
| §2-9, §3-9 | Unreconciled Invoice List Retrieval | On payment selection | Payment Reconciliation |
| §2-10, §3-10 | Reconciliation Validation | On reconciliation execution operation | Payment Reconciliation |
| §2-11, §3-11 | Reconciliation Processing | After validation passed | Payment Reconciliation |

---

## §2. Decision Processing (Conditional Branching)

### §2-1. Invoice List Retrieval — Screen Initialization

Executed when the Invoice List Screen is displayed.

- Initialize `Filter Status` (Invoice List Screen) to -1 (show all).
- Initialize `Search Text` (Invoice List Screen) to empty string.
- Proceed to data retrieval processing (§3-1).

---

### §2-2. Invoice List Filtering

Executed when the status filter is switched on the Invoice List Screen.

- Update `Filter Status` (Invoice List Screen) to the status value selected by the operation.
- Proceed to data retrieval processing (§3-1).

---

### §2-3. Invoice List Text Search

Executed when a search is performed on the Invoice List Screen.

- Update `Search Text` (Invoice List Screen) to the entered search string.
- Proceed to data retrieval processing (§3-1).

---

### §2-4. Target Order Line Preview Retrieval — Screen Initialization / Preview Operation

Executed when the Invoice Issuance Screen is displayed, or when the "Preview" button is pressed.

**Screen Initialization (first display):**
- Initialize `Input Billing Period` to empty string.
- Initialize `Customer Selection Mode` to 0 (all customers).
- Initialize all slots of `Selected Customer ID List` to 0 (unused).
- Initialize `Preview Display Flag` to 0 (not displayed).

**Guard conditions for preview operation:**
- If `Input Billing Period` is empty ⇒ Display "Please enter the target year and month." Terminate processing.
- If `Customer Selection Mode` = 1 (individual selection) and `Selected Customer ID List` has 0 valid Customer IDs (≥ 1) ⇒ Display "Please select at least one customer." Terminate processing.

- Proceed to data retrieval processing (§3-4).

---

### §2-5. Invoice Issuance

Executed when the "Execute Issuance" button is pressed on the Invoice Issuance Screen.

**Guard conditions:**
- If `Preview Display Flag` = 0 (not displayed) ⇒ Display "Please confirm the preview before issuing." Terminate processing.
- If the target order line items extracted in §3-4 are 0 ⇒ Display "There are no order line items to issue." Terminate processing.

- Proceed to data update processing (§3-5).

---

### §2-6. Payment Initialization — Screen Initialization

Executed when the Payment Registration Screen is displayed.

- Initialize `Input Customer ID` to 0 (not selected).
- Initialize `Input Payment Amount` to 0 (not entered).
- Initialize `Input Payment Date` to today's date.
- Initialize `Input Payment Method` to 0 (Bank Transfer).
- Proceed to display update (§4-3).

---

### §2-7. Payment Save

Executed when the "Save" button is pressed on the Payment Registration Screen.

**Validation:**
- If `Input Customer ID` = 0 (not selected) ⇒ Display "Please select a customer." Interrupt processing.
- If `Input Payment Amount` is less than 1 ⇒ Display "Please enter a payment amount of at least ¥1." Interrupt processing.
- If `Input Payment Date` is not entered ⇒ Display "Please enter the payment date." Interrupt processing.

- Validation passed ⇒ Proceed to data update processing (§3-7).

---

### §2-8. Unreconciled Payment List Retrieval — Screen Initialization

Executed when the Payment Reconciliation Screen is displayed.

- Initialize `Selected Payment ID` to 0 (not selected).
- Initialize all slots (×20) of `Reconciliation Amount Input` to 0 (no reconciliation).
- Proceed to data retrieval processing (§3-8).

---

### §2-9. Unreconciled Invoice List Retrieval

Executed when a payment is selected on the Payment Reconciliation Screen.

- Update `Selected Payment ID` to the selected Payment ID.
- Initialize all slots (×20) of `Reconciliation Amount Input` to 0 (no reconciliation) (clear previous input).
- Proceed to data retrieval processing (§3-9).

---

### §2-10. Reconciliation Validation

Executed when the "Execute Reconciliation" button is pressed on the Payment Reconciliation Screen.

**Guard conditions:**
- If `Selected Payment ID` = 0 (not selected) ⇒ Do not execute this process.
- If the total of all slots in `Reconciliation Amount Input` is 0 (0 slots with reconciliation amount ≥ 1) ⇒ Display "Please enter at least one reconciliation amount." Terminate processing.

**Validation:**
- If the total of all slots in `Reconciliation Amount Input` (reconciliation total) exceeds `Payment[Selected Payment ID].Unreconciled Balance` ⇒ Display "The reconciliation total exceeds the unreconciled balance of the payment (¥[unreconciled balance])." Terminate processing.
- For each slot i, if `Reconciliation Amount Input[i]` exceeds the unreconciled balance of that invoice (the value calculated in §3-9 and displayed in §4-5) ⇒ Display "The reconciliation amount for Invoice No. [invoice number] exceeds the unreconciled balance." Terminate processing.

- Validation passed ⇒ Proceed to reconciliation processing (§2-11).

---

### §2-11. Reconciliation Processing

Executed after reconciliation validation (§2-10) has passed.

- Proceed to data update processing (§3-11).

---

## §3. Data Update Processing

### §3-1. Invoice List Retrieval

1. Retrieve records from `Invoice` under the following conditions.
   - If `Filter Status` (Invoice List Screen) = -1 (show all) ⇒ Retrieve all records.
   - If `Filter Status` (Invoice List Screen) = 0 (Unissued) ⇒ Retrieve records where `Invoice.Status` = 0.
   - If `Filter Status` (Invoice List Screen) = 1 (Issued) ⇒ Retrieve records where `Invoice.Status` = 1.
   - If `Filter Status` (Invoice List Screen) = 2 (Partially Paid) ⇒ Retrieve records where `Invoice.Status` = 2.
   - Else (`Filter Status` = 3: Fully Paid) ⇒ Retrieve records where `Invoice.Status` = 3.
2. If `Search Text` (Invoice List Screen) is not empty ⇒ Further narrow down to records that contain `Search Text` as a partial match in `Invoice.Invoice Number` or `Customer Master[Invoice.Customer ID].Customer Name`.
3. Join `Customer Master` to attach the customer name.
4. Sort by `Invoice.Issue Date` in descending order.
5. Proceed to display update (§4-1).

---

### §3-2. Invoice List Filtering

This process performs no data updates. After `Filter Status` is updated in §2-2, delegate to §3-1.

---

### §3-3. Invoice List Text Search

This process performs no data updates. After `Search Text` is updated in §2-3, delegate to §3-1.

---

### §3-4. Target Order Line Preview Retrieval

1. Determine the set of target Customer IDs based on the value of `Customer Selection Mode`.
   - If `Customer Selection Mode` = 0 (all customers) ⇒ Target all records in `Customer Master` (valid Customer ID ≥ 1).
   - If `Customer Selection Mode` = 1 (individual selection) ⇒ Target only valid Customer IDs (≥ 1) in `Selected Customer ID List`.
2. For each target customer, retrieve `Order` under the following conditions.
   - `Order.Status` = 2 (Shipment Complete).
   - Among the `Order Line Item` linked to the `Order.Order ID`, at least 1 record exists that has not been registered as a `Order Line Item ID` in `Invoice Line Item` (unbilled order line items exist).
3. For the `Order Line Item` narrowed down in step 2, retrieve the corresponding `Shipping Record` via `Shipping Instruction Line Item` (`Shipping Instruction Line Item.Order Line Item ID` = `Order Line Item.Order Line Item ID`) then `Shipping Record` (`Shipping Record.Shipping Instruction Line Item ID` = `Shipping Instruction Line Item.Shipping Instruction Line Item ID`). Extract as target order line items those where the date portion of `Shipping Record.Shipped At` satisfies the following conditions.
   - If `Customer Master[Customer ID].Closing Day` = 0 (end of month) for the target customer ⇒ The shipment date must be on or before the last day of the month in `Input Billing Period`.
   - If `Customer Master[Customer ID].Closing Day` is 1–28 ⇒ The shipment date must be on or before `Input Billing Period`-`Closing Day`.

> Note: Shipments from past billing periods that remain unbilled are also included. The "not registered in `Invoice Line Item`" condition in step 2 automatically excludes shipments that have already been invoiced.

4. Aggregate the extraction results from step 3 per customer, and display on screen: customer name, target order number(s), number of line items, and estimated invoice amount (sum of subtotals + tax, calculated in UI Hook).
5. Update `Preview Display Flag` to 1 (displayed).
6. Proceed to display update (§4-2).

> Note: Whether a `Order Line Item ID` is registered in `Invoice Line Item` is determined by searching `Invoice Line Item.Order Line Item ID` (a record exists with `Order Line Item ID` ≥ 1 = already invoiced).

---

### §3-5. Invoice Issuance

Using the target order line items extracted per customer in §3-4, execute the following steps per customer.

1. Create a new record in `Invoice`.
   - `Invoice ID`: Auto-numbered
   - `Invoice Number`: `System Settings.Invoice Number Prefix` + sequential number
   - `Customer ID`: Target Customer ID
   - `Billing Period`: `Input Billing Period`
   - `Invoice Amount`: Sum of subtotals for target order line items (`Order Line Item.Quantity` × `Order Line Item.Unit Price`) + tax amount (subtotal sum × `System Settings.Consumption Tax Rate` ÷ 100)
   - `Status`: 1 (Issued)
   - `Issue Date`: Today's date
   - `Registered At`: Current datetime
2. For each target order line item row, create a new record in `Invoice Line Item`.
   - `Invoice Line Item ID`: Auto-numbered
   - `Invoice ID`: The `Invoice ID` assigned in step 1
   - `Order Line Item ID`: Target `Order Line Item.Order Line Item ID`
   - `Product ID`: Target `Order Line Item.Product ID`
   - `Product Name (at Invoice)`: Target `Order Line Item.Product Name (at Order)` (copy the already-snapshotted value)
   - `Quantity`: Target `Order Line Item.Shipped Quantity`
   - `Unit Price`: Target `Order Line Item.Unit Price`
3. For target orders of the customer where all order line items (orders where unbilled `Invoice Line Item` entries = 0) are now registered, update `Order.Status` to 3 (Invoiced).
4. PDF generation is delegated to the framework (report PDF generation).
5. After all customers are processed ⇒ Navigate to the Invoice List Screen.

> Note: The order of step 2 (`Invoice Line Item` creation) → step 3 (`Order.Status` update) must be strictly observed. The determination of "all order line items registered in `Invoice Line Item`" is made after `Invoice Line Item` records are created, so `Invoice Line Item` must be created first (per Rule 14: no clearing before reference is complete).

---

### §3-6. Payment Initialization

This process performs no data updates. Display the form as empty per the initialization content in §2-6. Proceed to display update (§4-3).

---

### §3-7. Payment Save

1. Create a new record in `Payment`.
   - `Payment ID`: Auto-numbered
   - `Customer ID`: `Input Customer ID`
   - `Payment Amount`: `Input Payment Amount`
   - `Payment Date`: `Input Payment Date`
   - `Payment Method`: `Input Payment Method`
   - `Reconciliation Status`: 0 (Unreconciled)
   - `Unreconciled Balance`: `Input Payment Amount` (initialized to the same amount as the payment)
   - `Notes`: Input notes (empty string if not entered)
   - `Registered At`: Current datetime
2. Navigate to the Invoice List Screen.

---

### §3-8. Unreconciled Payment List Retrieval

1. Retrieve records from `Payment` where `Reconciliation Status` = 0 (Unreconciled) or `Reconciliation Status` = 1 (Partially Reconciled).
2. Join `Customer Master` to attach the customer name.
3. Sort by `Payment.Payment Date` in descending order.
4. Proceed to display update (§4-4).

---

### §3-9. Unreconciled Invoice List Retrieval

1. Retrieve `Payment[Selected Payment ID].Customer ID`.
2. Retrieve records from `Invoice` where `Customer ID` matches the Customer ID retrieved in step 1, and `Status` = 1 (Issued) or `Status` = 2 (Partially Paid).
3. For each `Invoice`, retrieve records from `Payment Reconciliation` where `Invoice ID` matches, and calculate the reconciled amount (Σ `Payment Reconciliation.Reconciled Amount`) (calculated in UI Hook; see §4-5).
4. Proceed to display update (§4-5).

---

### §3-10. Reconciliation Validation

This process performs no data updates. Display error messages based on the validation results of §2-10. After validation passes, delegate to §3-11.

---

### §3-11. Reconciliation Processing

1. For each slot i in `Reconciliation Amount Input` where `Reconciliation Amount Input[i]` ≥ 1, process only those slots and create a new record in `Payment Reconciliation`.
   - `Reconciliation ID`: Auto-numbered
   - `Payment ID`: `Selected Payment ID`
   - `Invoice ID`: The Invoice ID corresponding to that slot
   - `Reconciled Amount`: `Reconciliation Amount Input[i]`
   - `Reconciled At`: Current datetime
2. Update the status of each `Invoice` based on the following criteria.
   - Calculate the total reconciled amount (Σ `Payment Reconciliation.Reconciled Amount`) for the `Invoice ID` from `Payment Reconciliation`.
   - If the total reconciled amount equals `Invoice[Invoice ID].Invoice Amount` ⇒ Update `Invoice[Invoice ID].Status` to 3 (Fully Paid).
   - If the total reconciled amount is less than `Invoice[Invoice ID].Invoice Amount` ⇒ Update `Invoice[Invoice ID].Status` to 2 (Partially Paid).
3. Identify `Order` records whose `Status` should be updated to "Complete".
   - From `Invoice Line Item.Order Line Item ID` linked to the `Invoice` updated in step 2, identify the `Order ID`.
   - If all `Invoice Line Item` for the `Order ID` (all `Order Line Item ID` for that order) are included in invoices where `Invoice.Status` = 3 (Fully Paid) ⇒ Update `Order[Order ID].Status` to 4 (Complete).
4. Calculate the current reconciliation total (Σ `Reconciliation Amount Input[i]` for slots with i ≥ 1) and subtract it from `Payment[Selected Payment ID].Unreconciled Balance` (lower bound = 0).
5. Update `Reconciliation Status` based on the value of `Payment[Selected Payment ID].Unreconciled Balance`.
   - If `Unreconciled Balance` = 0 ⇒ Update `Payment[Selected Payment ID].Reconciliation Status` to 2 (Fully Reconciled).
   - If `Unreconciled Balance` ≥ 1 ⇒ Update `Payment[Selected Payment ID].Reconciliation Status` to 1 (Partially Reconciled).
6. Navigate to the Invoice List Screen.

> Note: The order step 1 (`Payment Reconciliation` creation) → step 2 (`Invoice.Status` update) → step 3 (`Order.Status` update) → steps 4–5 (`Payment` update) must be strictly observed. The calculation of the total reconciled amount in step 2 references all records including those created in step 1, so step 2 must be executed after step 1 is complete (Rule 14: no clearing before reference is complete).

---

## §4. Display and Effect Updates (UI Hook)

### §4-1. Invoice List Screen — After List Retrieval / Filter / Search

- Update the status filter selection state to match `Filter Status` (Invoice List Screen).
- Display `Search Text` (Invoice List Screen) in the search field.
- Display the following in each row of the invoice list table.
  - Invoice Number: `Invoice.Invoice Number`
  - Customer Name: `Customer Master[Invoice.Customer ID].Customer Name`
  - Invoice Amount: `Invoice.Invoice Amount` displayed in "¥X,XXX,XXX" format
  - Target Year/Month: `Invoice.Billing Period` (YYYY-MM format)
  - Status: Display the label corresponding to `Invoice.Status` as a badge (0=Unissued, 1=Issued, 2=Partially Paid, 3=Fully Paid)
  - Issue Date: `Invoice.Issue Date` (display "—" if Unissued)

---

### §4-2. Invoice Issuance Screen — After Preview Retrieval

- Display the target order preview when `Preview Display Flag` = 1 (displayed).
- Display the following per customer in a list.
  - Customer Name: `Customer Master[Customer ID].Customer Name`
  - Target Order Number(s): `Order.Order Number` of the target orders (comma-separated if multiple)
  - Number of Line Items: Count of target order line items
  - Subtotal Sum: `Σ (Order Line Item.Quantity × Order Line Item.Unit Price)` displayed in "¥X,XXX,XXX" format
  - Tax Amount: `Subtotal Sum × System Settings.Consumption Tax Rate ÷ 100` displayed in "¥X,XXX,XXX" format
  - Estimated Invoice Amount: `Subtotal Sum + Tax Amount` displayed in "¥X,XXX,XXX" format
- Customers with 0 target order line items are not shown in the list.
- Execute Issuance button: Disable when `Preview Display Flag` = 0 (not displayed) or target count = 0.

---

### §4-3. Payment Registration Screen — After Initialization

- Customer selection dropdown: Display all records in `Customer Master` (Customer ID ≥ 1) in customer code order. Display "Please select" when `Input Customer ID` = 0.
- Payment amount input field: Display as blank when `Input Payment Amount` = 0.
- Payment date input field: Display `Input Payment Date` in "YYYY/MM/DD" format.
- Payment method selection: Display "Bank Transfer" when `Input Payment Method` = 0; display "Cash" when = 1, in selected state.

---

### §4-4. Payment Reconciliation Screen — After Unreconciled Payment List Retrieval

- Display the following in each option of the payment selection dropdown.
  - Customer Name: `Customer Master[Payment.Customer ID].Customer Name`
  - Payment Date: `Payment.Payment Date` ("YYYY/MM/DD" format)
  - Payment Amount: `Payment.Payment Amount` in "¥X,XXX,XXX" format
  - Unreconciled Balance: `Payment.Unreconciled Balance` in "¥X,XXX,XXX" format
- If `Selected Payment ID` = 0 (not selected), display "Please select a payment" and do not show the unreconciled invoice list.
- Execute Reconciliation button: Disable when `Selected Payment ID` = 0 (not selected).

---

### §4-5. Payment Reconciliation Screen — After Unreconciled Invoice List Retrieval / On Reconciliation Amount Input

- Display the following in each row of the unreconciled invoice list table.
  - Invoice Number: `Invoice.Invoice Number`
  - Invoice Amount: `Invoice.Invoice Amount` in "¥X,XXX,XXX" format
  - Reconciled Amount: `Σ (Payment Reconciliation.Reconciled Amount)` (total of existing records for the `Invoice ID`) in "¥X,XXX,XXX" format
  - Unreconciled Balance: `Invoice.Invoice Amount − Σ (Payment Reconciliation.Reconciled Amount)` in "¥X,XXX,XXX" format
  - Reconciliation Amount Input: `Reconciliation Amount Input[i]` (display as blank when 0)
- Reconciliation total display:
  - Current Reconciliation Total: `Σ Reconciliation Amount Input[i]` (total of slots with i ≥ 1) displayed in "¥X,XXX,XXX" format
  - Payment Balance (after reconciliation): `Payment[Selected Payment ID].Unreconciled Balance − Σ Reconciliation Amount Input[i]` displayed in "¥X,XXX,XXX" format
  - If the current reconciliation total exceeds `Payment[Selected Payment ID].Unreconciled Balance`, display the balance in error color (red).

"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useToast, ToastContainer } from "@/components/Toast";
import ConfirmDialog from "@/components/ConfirmDialog";

interface Customer {
  id: number;
  customer_code: string;
  customer_name: string;
}

interface PreviewItem {
  customer_id: number;
  customer_name: string;
  order_numbers: string[];
  line_item_count: number;
  subtotal: number;
  tax: number;
  estimated_amount: number;
}

function formatCurrency(amount: number): string {
  return `¥${amount.toLocaleString()}`;
}

export default function InvoiceGeneratePage() {
  const router = useRouter();
  const { toasts, success: showSuccess, error: showError, removeToast } = useToast();

  // §2-4 Screen state
  const [billingPeriod, setBillingPeriod] = useState<string>("");
  const [customerMode, setCustomerMode] = useState<number>(0); // 0=all, 1=individual
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<number[]>([]);
  const [previewDisplayed, setPreviewDisplayed] = useState<boolean>(false);
  const [previewData, setPreviewData] = useState<PreviewItem[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);

  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loadingGenerate, setLoadingGenerate] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Load customer list for individual selection
  useEffect(() => {
    fetch("/api/customers")
      .then((res) => res.json())
      .then((json) => {
        if (json.success) {
          setCustomers(json.data);
        }
      })
      .catch(() => {});
  }, []);

  // Reset preview when inputs change
  useEffect(() => {
    setPreviewDisplayed(false);
    setPreviewData([]);
  }, [billingPeriod, customerMode, selectedCustomerIds]);

  const handleCustomerToggle = (customerId: number) => {
    setSelectedCustomerIds((prev) =>
      prev.includes(customerId)
        ? prev.filter((id) => id !== customerId)
        : [...prev, customerId]
    );
  };

  const handleSelectAll = () => {
    if (selectedCustomerIds.length === customers.length) {
      setSelectedCustomerIds([]);
    } else {
      setSelectedCustomerIds(customers.map((c) => c.id));
    }
  };

  // §3-4: Preview
  const handlePreview = useCallback(async () => {
    // §2-4 Guard conditions
    if (!billingPeriod.trim()) {
      showError("Please enter the target year and month.");
      return;
    }

    if (customerMode === 1 && selectedCustomerIds.length === 0) {
      showError("Please select at least one customer.");
      return;
    }

    setLoadingPreview(true);
    try {
      const res = await fetch("/api/invoices/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          billing_period: billingPeriod,
          customer_mode: customerMode,
          selected_customer_ids: customerMode === 1 ? selectedCustomerIds : [],
        }),
      });
      const json = await res.json();

      if (json.success) {
        setPreviewData(json.data);
        setPreviewDisplayed(true);
        if (json.data.length === 0) {
          showError("There are no order line items to issue.");
        }
      } else {
        showError(json.error || "Failed to retrieve preview");
      }
    } catch {
      showError("Failed to retrieve preview");
    } finally {
      setLoadingPreview(false);
    }
  }, [billingPeriod, customerMode, selectedCustomerIds, showError]);

  // §3-5: Execute Issuance
  const handleGenerate = async () => {
    // §2-5 Guard conditions
    if (!previewDisplayed) {
      showError("Please confirm the preview before issuing.");
      return;
    }
    if (previewData.length === 0) {
      showError("There are no order line items to issue.");
      return;
    }

    setConfirmOpen(true);
  };

  const executeGenerate = async () => {
    setConfirmOpen(false);
    setLoadingGenerate(true);

    try {
      const res = await fetch("/api/invoices/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          billing_period: billingPeriod,
          customer_mode: customerMode,
          selected_customer_ids: customerMode === 1 ? selectedCustomerIds : [],
        }),
      });
      const json = await res.json();

      if (json.success) {
        showSuccess(json.message || "Invoices have been issued.");
        setTimeout(() => router.push("/invoices"), 1000);
      } else {
        showError(json.error || "Failed to generate invoices");
      }
    } catch {
      showError("Failed to generate invoices");
    } finally {
      setLoadingGenerate(false);
    }
  };

  const grandTotal = previewData.reduce((sum, item) => sum + item.estimated_amount, 0);

  return (
    <div>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <ConfirmDialog
        open={confirmOpen}
        title="Confirm Invoice Issuance"
        message={`Issue ${previewData.length} invoice(s) for billing period ${billingPeriod}?`}
        confirmLabel="Execute Issuance"
        cancelLabel="Cancel"
        onConfirm={executeGenerate}
        onCancel={() => setConfirmOpen(false)}
      />

      <h1 className="text-2xl font-bold text-gray-800 mb-6">Invoice Issuance</h1>

      {/* Form */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Billing Period */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Target Billing Period <span className="text-red-500">*</span>
            </label>
            <input
              type="month"
              value={billingPeriod}
              onChange={(e) => setBillingPeriod(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="YYYY-MM"
            />
          </div>

          {/* Customer Selection Mode */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Customer Selection
            </label>
            <div className="flex gap-4 mt-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="customerMode"
                  checked={customerMode === 0}
                  onChange={() => {
                    setCustomerMode(0);
                    setSelectedCustomerIds([]);
                  }}
                  className="text-blue-600"
                />
                <span className="text-sm text-gray-700">All Customers</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="customerMode"
                  checked={customerMode === 1}
                  onChange={() => setCustomerMode(1)}
                  className="text-blue-600"
                />
                <span className="text-sm text-gray-700">Individual Selection</span>
              </label>
            </div>
          </div>
        </div>

        {/* Customer Selection List (when individual mode) */}
        {customerMode === 1 && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Select Customers
              </label>
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                {selectedCustomerIds.length === customers.length
                  ? "Deselect All"
                  : "Select All"}
              </button>
            </div>
            <div className="border border-gray-300 rounded-md p-3 max-h-48 overflow-y-auto">
              {customers.map((customer) => (
                <label
                  key={customer.id}
                  className="flex items-center gap-2 py-1 cursor-pointer hover:bg-gray-50"
                >
                  <input
                    type="checkbox"
                    checked={selectedCustomerIds.includes(customer.id)}
                    onChange={() => handleCustomerToggle(customer.id)}
                    className="text-blue-600 rounded"
                  />
                  <span className="text-sm text-gray-700">
                    {customer.customer_code} - {customer.customer_name}
                  </span>
                </label>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {selectedCustomerIds.length} customer(s) selected
            </p>
          </div>
        )}

        {/* Preview Button */}
        <div className="mt-6">
          <button
            onClick={handlePreview}
            disabled={loadingPreview}
            className="px-6 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed transition-colors"
          >
            {loadingPreview ? "Loading Preview..." : "Preview"}
          </button>
        </div>
      </div>

      {/* Preview Results */}
      {previewDisplayed && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden mb-6">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <h2 className="text-lg font-semibold text-gray-800">
              Preview Results — {billingPeriod}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {previewData.length} customer(s) with billable items
            </p>
          </div>

          {previewData.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No billable order line items found for the specified period.
            </div>
          ) : (
            <>
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                      Customer Name
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                      Target Order Numbers
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">
                      Line Items
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">
                      Subtotal
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">
                      Tax
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">
                      Estimated Amount
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {previewData.map((item) => (
                    <tr key={item.customer_id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {item.customer_name}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {item.order_numbers.join(", ")}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 text-right">
                        {item.line_item_count}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 text-right font-mono">
                        {formatCurrency(item.subtotal)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 text-right font-mono">
                        {formatCurrency(item.tax)}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-gray-900 text-right font-mono">
                        {formatCurrency(item.estimated_amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 border-t-2 border-gray-300">
                    <td colSpan={5} className="px-4 py-3 text-sm font-semibold text-gray-700 text-right">
                      Grand Total
                    </td>
                    <td className="px-4 py-3 text-sm font-bold text-gray-900 text-right font-mono">
                      {formatCurrency(grandTotal)}
                    </td>
                  </tr>
                </tfoot>
              </table>

              {/* Execute Issuance Button */}
              <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end">
                <button
                  onClick={handleGenerate}
                  disabled={
                    !previewDisplayed ||
                    previewData.length === 0 ||
                    loadingGenerate
                  }
                  className="px-6 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 disabled:bg-green-300 disabled:cursor-not-allowed transition-colors"
                >
                  {loadingGenerate ? "Processing..." : "Execute Issuance"}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

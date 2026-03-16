"use client";

import { useEffect, useState, useCallback } from "react";
import { useToast, ToastContainer } from "@/components/Toast";

interface ProductOption {
  id: number;
  product_code: string;
  product_name: string;
}

interface LineItem {
  key: string;
  product_id: number;
  quantity: number;
}

interface ReceivingRecord {
  id: number;
  receipt_date: string;
  notes: string;
  registered_by: string;
  registered_at: string;
  items: {
    id: number;
    product_id: number;
    received_quantity: number;
    product_code: string;
    product_name: string;
  }[];
}

function generateKey(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function todayStr(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function ReceivingPage() {
  // Form state (§2-10)
  const [receiptDate, setReceiptDate] = useState(todayStr());
  const [notes, setNotes] = useState("");
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { key: generateKey(), product_id: 0, quantity: 0 },
  ]);

  // Products list for dropdown
  const [products, setProducts] = useState<ProductOption[]>([]);

  // Recent receivings list
  const [recentReceivings, setRecentReceivings] = useState<ReceivingRecord[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const toast = useToast();

  // Fetch products for dropdown
  useEffect(() => {
    fetch("/api/products")
      .then((res) => res.json())
      .then((json) => {
        if (json.success) {
          setProducts(json.data);
        }
      })
      .catch(() => {});
  }, []);

  const fetchRecentReceivings = useCallback(async () => {
    setLoadingRecent(true);
    try {
      const res = await fetch("/api/receivings?limit=20");
      const json = await res.json();
      if (json.success) {
        setRecentReceivings(json.data);
      }
    } catch {
      // Silently fail for recent list
    } finally {
      setLoadingRecent(false);
    }
  }, []);

  useEffect(() => {
    fetchRecentReceivings();
  }, [fetchRecentReceivings]);

  const handleAddRow = () => {
    setLineItems((prev) => [
      ...prev,
      { key: generateKey(), product_id: 0, quantity: 0 },
    ]);
  };

  const handleRemoveRow = (key: string) => {
    setLineItems((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((item) => item.key !== key);
    });
  };

  const handleProductChange = (key: string, productId: number) => {
    setLineItems((prev) =>
      prev.map((item) =>
        item.key === key ? { ...item, product_id: productId } : item
      )
    );
  };

  const handleQuantityChange = (key: string, value: string) => {
    const qty = parseInt(value, 10);
    setLineItems((prev) =>
      prev.map((item) =>
        item.key === key
          ? { ...item, quantity: isNaN(qty) ? 0 : Math.max(0, qty) }
          : item
      )
    );
  };

  const handleSave = async () => {
    // Client-side validation matching §2-11
    if (!receiptDate) {
      toast.error("Please enter a receiving date.");
      return;
    }

    const validItems = lineItems.filter((item) => item.product_id > 0);
    if (validItems.length === 0) {
      toast.error("Please enter at least one line item.");
      return;
    }

    for (let i = 0; i < validItems.length; i++) {
      if (validItems[i].quantity < 1) {
        toast.error(`Please enter a receiving quantity of 1 or more (Row: ${i + 1}).`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/receivings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          receipt_date: receiptDate,
          notes,
          items: validItems.map((item) => ({
            product_id: item.product_id,
            quantity: item.quantity,
          })),
        }),
      });

      const json = await res.json();
      if (json.success) {
        toast.success(json.message || "Receiving registered successfully.");
        // Reset form
        setReceiptDate(todayStr());
        setNotes("");
        setLineItems([{ key: generateKey(), product_id: 0, quantity: 0 }]);
        // Refresh recent receivings list
        fetchRecentReceivings();
      } else {
        toast.error(json.error || "Failed to save receiving.");
      }
    } catch {
      toast.error("Failed to save receiving.");
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "-";
    // Handle both ISO and YYYY-MM-DD
    return dateStr.slice(0, 10);
  };

  const formatDateTime = (dateStr: string) => {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    return `${year}/${month}/${day} ${hours}:${minutes}`;
  };

  return (
    <div>
      <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Receipt Registration</h1>
      </div>

      {/* Registration Form */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">New Receiving</h2>

        {/* Receipt date and notes */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Receipt Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={receiptDate}
              onChange={(e) => setReceiptDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Line Items */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-700">Line Items</h3>
            <button
              onClick={handleAddRow}
              className="px-3 py-1 text-xs font-medium bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
            >
              + Add Row
            </button>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-2 font-medium text-gray-600 w-8">#</th>
                <th className="text-left px-4 py-2 font-medium text-gray-600">Product</th>
                <th className="text-right px-4 py-2 font-medium text-gray-600 w-32">Quantity</th>
                <th className="text-center px-4 py-2 font-medium text-gray-600 w-20">Action</th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map((item, index) => (
                <tr key={item.key} className="border-b border-gray-100">
                  <td className="px-4 py-2 text-gray-500">{index + 1}</td>
                  <td className="px-4 py-2">
                    <select
                      value={item.product_id}
                      onChange={(e) =>
                        handleProductChange(item.key, parseInt(e.target.value, 10))
                      }
                      className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value={0}>-- Select Product --</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.product_code} - {p.product_name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      min={0}
                      value={item.quantity || ""}
                      onChange={(e) => handleQuantityChange(item.key, e.target.value)}
                      placeholder="0"
                      className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </td>
                  <td className="px-4 py-2 text-center">
                    <button
                      onClick={() => handleRemoveRow(item.key)}
                      disabled={lineItems.length <= 1}
                      className={`text-xs font-medium px-2 py-1 rounded-md transition-colors ${
                        lineItems.length > 1
                          ? "text-red-600 hover:bg-red-50"
                          : "text-gray-300 cursor-not-allowed"
                      }`}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={submitting}
            className={`px-6 py-2 text-sm font-medium text-white rounded-md transition-colors ${
              submitting
                ? "bg-gray-300 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {submitting ? "Saving..." : "Save Receiving"}
          </button>
        </div>
      </div>

      {/* Recent Receivings */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-700">Recent Receivings (Last 20)</h2>
        </div>
        {loadingRecent ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : recentReceivings.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No receiving records found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-medium text-gray-600">ID</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Receipt Date</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Items</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Notes</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Registered At</th>
              </tr>
            </thead>
            <tbody>
              {recentReceivings.map((rec) => (
                <tr key={rec.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-700">{rec.id}</td>
                  <td className="px-4 py-3 text-gray-900">{formatDate(rec.receipt_date)}</td>
                  <td className="px-4 py-3 text-gray-700">
                    <div className="space-y-1">
                      {rec.items.map((item) => (
                        <div key={item.id} className="text-xs">
                          <span className="font-mono text-gray-500">{item.product_code}</span>{" "}
                          {item.product_name}{" "}
                          <span className="font-semibold">x{item.received_quantity}</span>
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{rec.notes || "-"}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs">
                    {formatDateTime(rec.registered_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

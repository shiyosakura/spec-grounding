"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useToast, ToastContainer } from "@/components/Toast";

// §4-4: Order status labels and badge colors
const ORDER_STATUS_LABELS: Record<number, string> = {
  0: "Confirmed",
  1: "Shipping",
  2: "Shipped",
  3: "Invoiced",
  4: "Completed",
  5: "Cancelled",
};

const ORDER_STATUS_COLORS: Record<number, string> = {
  0: "bg-blue-100 text-blue-700",
  1: "bg-yellow-100 text-yellow-700",
  2: "bg-indigo-100 text-indigo-700",
  3: "bg-purple-100 text-purple-700",
  4: "bg-green-100 text-green-700",
  5: "bg-red-100 text-red-700",
};

const SHIPPING_STATUS_LABELS: Record<number, string> = {
  0: "Not Shipped",
  1: "Shipping",
  2: "Shipped",
  3: "Cancelled",
};

interface OrderRow {
  id: number;
  order_number: string;
  customer_id: number;
  customer_name: string;
  subject: string;
  status: number;
  credit_warning: number;
  ordered_at: string;
  total_amount: number;
  shipping_status: number | null;
}

export default function OrderListPage() {
  const router = useRouter();
  const { toasts, error: showError, removeToast } = useToast();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [filterStatus, setFilterStatus] = useState(-1);
  const [searchText, setSearchText] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchOrders = useCallback(
    async (status: number, search: string) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("status", String(status));
        if (search.trim()) params.set("search", search.trim());

        const res = await fetch(`/api/orders?${params.toString()}`);
        const json = await res.json();
        if (json.success) {
          setOrders(json.data);
        } else {
          showError(json.error || "Failed to load orders");
        }
      } catch {
        showError("Failed to load orders");
      } finally {
        setLoading(false);
      }
    },
    [showError]
  );

  // §2-11: Initialize on mount
  useEffect(() => {
    fetchOrders(-1, "");
  }, [fetchOrders]);

  // §2-12: Status filter change
  const handleFilterChange = (status: number) => {
    setFilterStatus(status);
    fetchOrders(status, searchText);
  };

  // §2-13: Search
  const handleSearch = () => {
    fetchOrders(filterStatus, searchText);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  const formatCurrency = (amount: number) => `\u00a5${amount.toLocaleString()}`;

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}/${m}/${day}`;
  };

  const statusTabs = [
    { value: -1, label: "All" },
    { value: 0, label: "Confirmed" },
    { value: 1, label: "Shipping" },
    { value: 2, label: "Shipped" },
    { value: 3, label: "Invoiced" },
    { value: 4, label: "Completed" },
    { value: 5, label: "Cancelled" },
  ];

  return (
    <div>
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Order List</h1>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex gap-1 mb-4 flex-wrap">
        {statusTabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => handleFilterChange(tab.value)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              filterStatus === tab.value
                ? "bg-blue-600 text-white"
                : "bg-white text-gray-600 border border-gray-300 hover:bg-gray-50"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="flex gap-2 mb-6">
        <input
          type="text"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search by order number or customer name..."
          className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <button
          onClick={handleSearch}
          className="px-4 py-2 bg-gray-600 text-white text-sm font-medium rounded-md hover:bg-gray-700 transition-colors"
        >
          Search
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : orders.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No orders found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Order Number</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Customer Name</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Subject</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Amount</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600 w-8" title="Credit Warning">CW</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Shipping</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Order Date</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr
                  key={o.id}
                  onClick={() => router.push(`/orders/${o.id}`)}
                  className="border-b border-gray-100 hover:bg-blue-50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 font-mono text-blue-600">{o.order_number}</td>
                  <td className="px-4 py-3">{o.customer_name}</td>
                  <td className="px-4 py-3 max-w-xs truncate">{o.subject}</td>
                  <td className="px-4 py-3 text-right font-mono">
                    {formatCurrency(o.total_amount)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {o.credit_warning === 1 && (
                      <span
                        className="inline-block text-amber-500"
                        title="Credit limit exceeded"
                      >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${
                        ORDER_STATUS_COLORS[o.status] ?? "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {ORDER_STATUS_LABELS[o.status] ?? "Unknown"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-xs text-gray-500">
                    {o.shipping_status !== null && o.shipping_status !== undefined
                      ? SHIPPING_STATUS_LABELS[o.shipping_status] ?? ""
                      : ""}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-500">
                    {formatDate(o.ordered_at)}
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

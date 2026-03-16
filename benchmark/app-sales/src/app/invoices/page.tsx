"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useToast, ToastContainer } from "@/components/Toast";

interface InvoiceRow {
  id: number;
  invoice_number: string;
  customer_id: number;
  customer_name: string;
  billing_period: string;
  invoice_amount: number;
  status: number;
  issue_date: string;
  registered_at: string;
}

const STATUS_LABELS: Record<number, string> = {
  0: "Not Issued",
  1: "Issued",
  2: "Partially Paid",
  3: "Paid in Full",
};

const STATUS_BADGE_COLORS: Record<number, string> = {
  0: "bg-gray-100 text-gray-700",
  1: "bg-blue-100 text-blue-700",
  2: "bg-yellow-100 text-yellow-700",
  3: "bg-green-100 text-green-700",
};

const STATUS_TABS = [
  { value: -1, label: "All" },
  { value: 0, label: "Not Issued" },
  { value: 1, label: "Issued" },
  { value: 2, label: "Partially Paid" },
  { value: 3, label: "Paid in Full" },
];

function formatCurrency(amount: number): string {
  return `¥${amount.toLocaleString()}`;
}

export default function InvoiceListPage() {
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [filterStatus, setFilterStatus] = useState<number>(-1);
  const [searchText, setSearchText] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const { toasts, error: showError, removeToast } = useToast();

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("status", String(filterStatus));
      if (searchText.trim()) {
        params.set("search", searchText.trim());
      }

      const res = await fetch(`/api/invoices?${params.toString()}`);
      const json = await res.json();

      if (json.success) {
        setInvoices(json.data);
      } else {
        showError(json.error || "Failed to load invoices");
      }
    } catch {
      showError("Failed to load invoices");
    } finally {
      setLoading(false);
    }
  }, [filterStatus, searchText, showError]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchInvoices();
  };

  return (
    <div>
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Invoice List</h1>
        <div className="flex gap-3">
          <Link
            href="/invoices/generate"
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
          >
            Issue Invoices
          </Link>
          <Link
            href="/payments/register"
            className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 transition-colors"
          >
            Register Payment
          </Link>
        </div>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex gap-1 mb-4 border-b border-gray-200">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setFilterStatus(tab.value)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              filterStatus === tab.value
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search Bar */}
      <form onSubmit={handleSearch} className="mb-6">
        <div className="flex gap-2">
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Search by invoice number or customer name..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-gray-600 text-white text-sm font-medium rounded-md hover:bg-gray-700 transition-colors"
          >
            Search
          </button>
        </div>
      </form>

      {/* Invoice Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : invoices.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No invoices found.</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                  Invoice Number
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                  Customer Name
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">
                  Invoice Amount
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                  Billing Period
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                  Issue Date
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {invoices.map((invoice) => (
                <tr key={invoice.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    {invoice.invoice_number}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {invoice.customer_name}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 text-right font-mono">
                    {formatCurrency(invoice.invoice_amount)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {invoice.billing_period}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${
                        STATUS_BADGE_COLORS[invoice.status] || "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {STATUS_LABELS[invoice.status] || "Unknown"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {invoice.status === 0 ? "—" : invoice.issue_date}
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

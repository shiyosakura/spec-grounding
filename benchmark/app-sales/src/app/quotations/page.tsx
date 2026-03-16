"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useToast, ToastContainer } from "@/components/Toast";

// §4-1: Quotation status labels and badge colors
const QUOTATION_STATUS_LABELS: Record<number, string> = {
  0: "Draft",
  1: "Submitted",
  2: "Ordered",
  3: "Lost",
  4: "Expired",
};

const QUOTATION_STATUS_COLORS: Record<number, string> = {
  0: "bg-gray-100 text-gray-700",
  1: "bg-blue-100 text-blue-700",
  2: "bg-green-100 text-green-700",
  3: "bg-red-100 text-red-700",
  4: "bg-yellow-100 text-yellow-700",
};

interface QuotationRow {
  id: number;
  quotation_number: string;
  customer_id: number;
  customer_name: string;
  subject: string;
  status: number;
  expiration_date: string;
  created_at: string;
  total_amount: number;
}

export default function QuotationListPage() {
  const router = useRouter();
  const { toasts, error: showError, removeToast } = useToast();
  const [quotations, setQuotations] = useState<QuotationRow[]>([]);
  const [filterStatus, setFilterStatus] = useState(-1);
  const [searchText, setSearchText] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchQuotations = useCallback(
    async (status: number, search: string) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("status", String(status));
        if (search.trim()) params.set("search", search.trim());

        const res = await fetch(`/api/quotations?${params.toString()}`);
        const json = await res.json();
        if (json.success) {
          setQuotations(json.data);
        } else {
          showError(json.error || "Failed to load quotations");
        }
      } catch {
        showError("Failed to load quotations");
      } finally {
        setLoading(false);
      }
    },
    [showError]
  );

  // §2-1: Initialize on mount
  useEffect(() => {
    fetchQuotations(-1, "");
  }, [fetchQuotations]);

  // §2-2: Status filter change
  const handleFilterChange = (status: number) => {
    setFilterStatus(status);
    fetchQuotations(status, searchText);
  };

  // §2-3: Search
  const handleSearch = () => {
    fetchQuotations(filterStatus, searchText);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  const formatCurrency = (amount: number) => {
    return `\u00a5${amount.toLocaleString()}`;
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}/${m}/${day}`;
  };

  // §4-1: Check if expiry date is past and status is Submitted
  const isExpired = (row: QuotationRow) => {
    if (row.status !== 1) return false;
    const expiry = new Date(row.expiration_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return expiry < today;
  };

  const statusTabs = [
    { value: -1, label: "All" },
    { value: 0, label: "Draft" },
    { value: 1, label: "Submitted" },
    { value: 2, label: "Ordered" },
    { value: 3, label: "Lost" },
    { value: 4, label: "Expired" },
  ];

  return (
    <div>
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Quotation List</h1>
        <button
          onClick={() => router.push("/quotations/edit")}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
        >
          New Quotation
        </button>
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
          placeholder="Search by quotation number or customer name..."
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
        ) : quotations.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No quotations found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Quotation Number</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Customer Name</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Subject</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Amount</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Created</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Expiry</th>
              </tr>
            </thead>
            <tbody>
              {quotations.map((q) => (
                <tr
                  key={q.id}
                  onClick={() => router.push(`/quotations/edit?id=${q.id}`)}
                  className="border-b border-gray-100 hover:bg-blue-50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 font-mono text-blue-600">{q.quotation_number}</td>
                  <td className="px-4 py-3">{q.customer_name}</td>
                  <td className="px-4 py-3 max-w-xs truncate">{q.subject}</td>
                  <td className="px-4 py-3 text-right font-mono">
                    {formatCurrency(q.total_amount)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${
                        QUOTATION_STATUS_COLORS[q.status] ?? "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {QUOTATION_STATUS_LABELS[q.status] ?? "Unknown"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-gray-500">{formatDate(q.created_at)}</td>
                  <td
                    className={`px-4 py-3 text-center ${
                      isExpired(q) ? "text-red-600 font-semibold" : "text-gray-500"
                    }`}
                  >
                    {formatDate(q.expiration_date)}
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

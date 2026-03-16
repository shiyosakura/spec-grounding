"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useToast, ToastContainer } from "@/components/Toast";

interface ShippingInstructionRow {
  id: number;
  shipping_instruction_number: string;
  order_id: number;
  customer_id: number;
  status: number;
  created_at: string;
  customer_name: string;
  order_number: string;
  item_count: number;
}

const STATUS_LABELS: Record<number, string> = {
  0: "Not Shipped",
  1: "Shipping",
  2: "Shipped",
};

const STATUS_BADGE_CLASSES: Record<number, string> = {
  0: "bg-yellow-100 text-yellow-800",
  1: "bg-blue-100 text-blue-800",
  2: "bg-green-100 text-green-800",
};

const STATUS_TABS = [
  { value: 0, label: "Not Shipped" },
  { value: 1, label: "Shipping" },
  { value: 2, label: "Shipped" },
  { value: -1, label: "All" },
];

export default function ShippingInstructionListPage() {
  const [instructions, setInstructions] = useState<ShippingInstructionRow[]>([]);
  const [filterStatus, setFilterStatus] = useState(0); // Default: Not Shipped (§2-3)
  const [searchText, setSearchText] = useState("");
  const [loading, setLoading] = useState(true);
  const toast = useToast();
  const router = useRouter();

  const fetchInstructions = useCallback(async (status: number, search: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("status", String(status));
      if (search) params.set("search", search);
      const res = await fetch(`/api/shipping-instructions?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setInstructions(json.data);
      } else {
        toast.error(json.error || "Failed to fetch shipping instructions");
      }
    } catch {
      toast.error("Failed to fetch shipping instructions");
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchInstructions(filterStatus, searchText);
  }, [fetchInstructions, filterStatus, searchText]);

  const handleTabChange = (status: number) => {
    setFilterStatus(status);
  };

  const handleSearch = () => {
    fetchInstructions(filterStatus, searchText);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const handleRowClick = (instruction: ShippingInstructionRow) => {
    if (instruction.status === 0 || instruction.status === 1) {
      router.push(`/shipping/${instruction.id}`);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}/${month}/${day}`;
  };

  return (
    <div>
      <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Shipping Instructions</h1>
      </div>

      {/* Status Filter Tabs */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4">
        <div className="flex gap-2 mb-4">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => handleTabChange(tab.value)}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                filterStatus === tab.value
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="flex gap-3">
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search by instruction number or customer name..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            onClick={handleSearch}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
          >
            Search
          </button>
          {searchText && (
            <button
              onClick={() => {
                setSearchText("");
              }}
              className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-200 transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Instructions Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : instructions.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No shipping instructions found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Instruction No.</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Order No.</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Customer Name</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Items</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Created</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Action</th>
              </tr>
            </thead>
            <tbody>
              {instructions.map((row) => {
                const canWork = row.status === 0 || row.status === 1;
                return (
                  <tr
                    key={row.id}
                    className={`border-b border-gray-100 ${
                      canWork ? "hover:bg-blue-50 cursor-pointer" : "hover:bg-gray-50"
                    }`}
                    onClick={() => handleRowClick(row)}
                  >
                    <td className="px-4 py-3 font-mono text-gray-700">
                      {row.shipping_instruction_number}
                    </td>
                    <td className="px-4 py-3 font-mono text-gray-700">{row.order_number}</td>
                    <td className="px-4 py-3 text-gray-900">{row.customer_name}</td>
                    <td className="px-4 py-3 text-center text-gray-700">{row.item_count}</td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${
                          STATUS_BADGE_CLASSES[row.status] || "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {STATUS_LABELS[row.status] || `Status ${row.status}`}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{formatDate(row.created_at)}</td>
                    <td className="px-4 py-3 text-center">
                      {canWork ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/shipping/${row.id}`);
                          }}
                          className="px-3 py-1 text-xs font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                        >
                          Start Work
                        </button>
                      ) : (
                        <span className="text-xs text-gray-400">Completed</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

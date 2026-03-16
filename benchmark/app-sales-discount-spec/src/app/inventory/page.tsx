"use client";

import { useEffect, useState, useCallback } from "react";
import { useToast, ToastContainer } from "@/components/Toast";

interface InventoryRow {
  product_id: number;
  physical_stock: number;
  allocated_quantity: number;
  product_code: string;
  product_name: string;
  unit: string;
  active: number;
  category_id: number;
  category_name: string;
}

export default function InventoryListPage() {
  const [inventory, setInventory] = useState<InventoryRow[]>([]);
  const [searchText, setSearchText] = useState("");
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  const fetchInventory = useCallback(async (search: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      const res = await fetch(`/api/inventory?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setInventory(json.data);
      } else {
        toast.error(json.error || "Failed to fetch inventory");
      }
    } catch {
      toast.error("Failed to fetch inventory");
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Initial load
  useEffect(() => {
    fetchInventory("");
  }, [fetchInventory]);

  const handleSearch = () => {
    fetchInventory(searchText);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  return (
    <div>
      <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Inventory List</h1>
      </div>

      {/* Search Bar */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex gap-3">
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search by product code or product name..."
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
                fetchInventory("");
              }}
              className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-200 transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Inventory Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : inventory.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No inventory records found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Product Code</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Product Name</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Category</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Physical Stock</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Allocated</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Available Stock</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Unit</th>
              </tr>
            </thead>
            <tbody>
              {inventory.map((row) => {
                const availableStock = row.physical_stock - row.allocated_quantity;
                return (
                  <tr key={row.product_id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-gray-700">{row.product_code}</td>
                    <td className="px-4 py-3 text-gray-900">{row.product_name}</td>
                    <td className="px-4 py-3 text-gray-600">{row.category_name || "-"}</td>
                    <td className="px-4 py-3 text-right text-gray-900">
                      {row.physical_stock.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-900">
                      {row.allocated_quantity.toLocaleString()}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-semibold ${
                        availableStock <= 0 ? "text-red-600" : "text-gray-900"
                      }`}
                    >
                      {availableStock.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{row.unit}</td>
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

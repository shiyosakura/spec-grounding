"use client";

import { useEffect, useState } from "react";

interface DashboardData {
  products: number;
  customers: number;
  orders: number;
  invoices: number;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch dashboard data");
        return res.json();
      })
      .then((json) => {
        if (json.success) {
          setData(json.data);
        } else {
          setError(json.error || "Unknown error");
        }
      })
      .catch((err) => setError(err.message));
  }, []);

  const stats: { label: string; key: keyof DashboardData; color: string }[] = [
    { label: "Total Products", key: "products", color: "bg-blue-500" },
    { label: "Total Customers", key: "customers", color: "bg-green-500" },
    { label: "Total Orders", key: "orders", color: "bg-orange-500" },
    { label: "Total Invoices", key: "invoices", color: "bg-purple-500" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-2">Dashboard</h1>
      <p className="text-gray-600 mb-8">
        Welcome to BtoB Sales Management System. Manage quotations, orders,
        inventory, invoices, and payments from one place.
      </p>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 mb-6">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <div
            key={stat.key}
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-medium text-gray-500">
                {stat.label}
              </h2>
              <div className={`w-3 h-3 rounded-full ${stat.color}`} />
            </div>
            <p className="text-3xl font-bold text-gray-800">
              {data ? data[stat.key].toLocaleString() : "—"}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

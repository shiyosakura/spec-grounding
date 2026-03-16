"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Menu {
  menu_id: number;
  menu_name: string;
  category_id: number;
  price: number;
  duration: number;
  description: string;
  is_public: number;
  category_name: string;
}

interface Category {
  category_id: number;
  category_name: string;
  display_order: number;
}

export default function MenuListPage() {
  const [menus, setMenus] = useState<Menu[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState(0);

  useEffect(() => {
    fetch("/api/categories").then(r => r.json()).then(setCategories);
    fetchMenus(0);
  }, []);

  const fetchMenus = (categoryId: number) => {
    const params = categoryId > 0 ? `?category_id=${categoryId}` : "";
    fetch(`/api/menus${params}`).then(r => r.json()).then(setMenus);
  };

  const handleCategoryChange = (categoryId: number) => {
    setSelectedCategoryId(categoryId);
    fetchMenus(categoryId);
  };

  const formatPrice = (price: number) =>
    `¥${price.toLocaleString()}`;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <header className="mb-8">
        <h1 className="text-2xl font-bold mb-2">Salon Menu</h1>
        <p className="text-gray-500">Business Hours: 9:00 - 19:00 (Closed Sundays)</p>
      </header>

      {/* Category Filter */}
      <div className="flex gap-2 mb-6 flex-wrap">
        <button
          onClick={() => handleCategoryChange(0)}
          className={`px-4 py-2 rounded-full text-sm font-medium transition ${
            selectedCategoryId === 0
              ? "bg-blue-600 text-white"
              : "bg-gray-200 text-gray-700 hover:bg-gray-300"
          }`}
        >
          All
        </button>
        {categories.map((cat) => (
          <button
            key={cat.category_id}
            onClick={() => handleCategoryChange(cat.category_id)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition ${
              selectedCategoryId === cat.category_id
                ? "bg-blue-600 text-white"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            {cat.category_name}
          </button>
        ))}
      </div>

      {/* Menu Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {menus.map((menu) => (
          <div key={menu.menu_id} className="bg-white rounded-lg shadow p-5 border">
            <div className="flex justify-between items-start mb-2">
              <div>
                <span className="text-xs text-blue-600 font-medium">{menu.category_name}</span>
                <h3 className="text-lg font-semibold">{menu.menu_name}</h3>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-blue-600">{formatPrice(menu.price)}</p>
                <p className="text-sm text-gray-500">approx. {menu.duration} min</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-4">{menu.description}</p>
            <Link
              href={`/reserve?menu_id=${menu.menu_id}`}
              className="inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition text-sm"
            >
              Book
            </Link>
          </div>
        ))}
      </div>

      {menus.length === 0 && (
        <p className="text-center text-gray-500 mt-8">No menus available.</p>
      )}

      <div className="mt-8 text-center">
        <Link href="/mypage" className="text-blue-600 hover:underline">
          My Page
        </Link>
      </div>
    </div>
  );
}

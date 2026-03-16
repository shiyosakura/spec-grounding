"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Menu {
  menu_id: number;
  menu_name: string;
  category_id: number;
  category_name: string;
  price: number;
  duration: number;
  description: string;
}

interface Category {
  category_id: number;
  category_name: string;
}

export default function MenuListPage() {
  const [menus, setMenus] = useState<Menu[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState(0);

  useEffect(() => {
    fetch("/api/categories").then(r => r.json()).then(setCategories);
    fetchMenus(0);
  }, []);

  function fetchMenus(categoryId: number) {
    let url = "/api/menus?public_only=1";
    if (categoryId > 0) url += `&category_id=${categoryId}`;
    fetch(url).then(r => r.json()).then(setMenus);
  }

  function handleCategoryChange(categoryId: number) {
    setSelectedCategoryId(categoryId);
    fetchMenus(categoryId);
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1">Menu</h1>
        <p className="text-gray-500 text-sm">Salon Hours: 9:00 - 19:00 | Mon - Sat</p>
      </div>

      {/* Category Filter */}
      <div className="flex gap-2 mb-6 flex-wrap">
        <button
          onClick={() => handleCategoryChange(0)}
          className={`px-4 py-1.5 rounded-full text-sm border ${
            selectedCategoryId === 0 ? "bg-gray-800 text-white border-gray-800" : "bg-white text-gray-600 border-gray-300 hover:border-gray-400"
          }`}
        >
          All
        </button>
        {categories.map(cat => (
          <button
            key={cat.category_id}
            onClick={() => handleCategoryChange(cat.category_id)}
            className={`px-4 py-1.5 rounded-full text-sm border ${
              selectedCategoryId === cat.category_id ? "bg-gray-800 text-white border-gray-800" : "bg-white text-gray-600 border-gray-300 hover:border-gray-400"
            }`}
          >
            {cat.category_name}
          </button>
        ))}
      </div>

      {/* Menu Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {menus.map(menu => (
          <div key={menu.menu_id} className="bg-white rounded-lg shadow border p-5 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-semibold text-lg">{menu.menu_name}</h3>
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">{menu.category_name}</span>
              </div>
              <p className="text-gray-500 text-sm mb-3">{menu.description}</p>
              <div className="flex gap-4 text-sm text-gray-700">
                <span>¥{menu.price.toLocaleString()}</span>
                <span>approx. {menu.duration} min</span>
              </div>
            </div>
            <Link
              href={`/reserve?menu=${menu.menu_id}`}
              className="mt-4 block text-center bg-gray-800 text-white py-2 rounded-md hover:bg-gray-700 transition text-sm"
            >
              Book
            </Link>
          </div>
        ))}
      </div>
      {menus.length === 0 && (
        <p className="text-gray-400 text-center py-10">No menus available.</p>
      )}
    </div>
  );
}

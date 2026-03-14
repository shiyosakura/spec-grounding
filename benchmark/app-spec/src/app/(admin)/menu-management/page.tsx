"use client";

import { useEffect, useState } from "react";

interface Category {
  category_id: number;
  category_name: string;
}

interface Menu {
  menu_id: number;
  menu_name: string;
  category_id: number;
  category_name: string;
  price: number;
  duration: number;
  description: string;
  is_public: number;
}

export default function MenuManagementPage() {
  const [menus, setMenus] = useState<Menu[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [editingMenuId, setEditingMenuId] = useState(0); // 0 = add new
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    menu_name: "",
    category_id: 1,
    price: 0,
    duration: 30,
    description: "",
  });
  const [error, setError] = useState("");

  useEffect(() => {
    fetchMenus();
    fetch("/api/categories").then(r => r.json()).then(setCategories);
  }, []);

  async function fetchMenus() {
    const res = await fetch("/api/menus");
    setMenus(await res.json());
  }

  function startEdit(menu: Menu) {
    setEditingMenuId(menu.menu_id);
    setForm({
      menu_name: menu.menu_name,
      category_id: menu.category_id,
      price: menu.price,
      duration: menu.duration,
      description: menu.description,
    });
    setShowForm(true);
    setError("");
  }

  function startAdd() {
    setEditingMenuId(0);
    setForm({ menu_name: "", category_id: categories[0]?.category_id || 1, price: 0, duration: 30, description: "" });
    setShowForm(true);
    setError("");
  }

  async function handleSave() {
    setError("");
    const url = editingMenuId > 0 ? `/api/menus/${editingMenuId}` : "/api/menus";
    const method = editingMenuId > 0 ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Failed to save");
      return;
    }

    setShowForm(false);
    fetchMenus();
  }

  async function handleTogglePublic(menuId: number) {
    await fetch(`/api/menus/${menuId}`, { method: "PATCH" });
    fetchMenus();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Menu Management</h1>
        <button onClick={startAdd} className="px-4 py-2 bg-gray-800 text-white rounded-md text-sm hover:bg-gray-700">
          + Add Menu
        </button>
      </div>

      {/* Menu Table */}
      <div className="bg-white border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left p-3">Menu Name</th>
              <th className="text-left p-3">Category</th>
              <th className="text-right p-3">Price</th>
              <th className="text-right p-3">Duration</th>
              <th className="text-center p-3">Status</th>
              <th className="text-center p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {menus.map(menu => (
              <tr key={menu.menu_id} className={`border-b ${menu.is_public === 0 ? "opacity-50 bg-gray-50" : ""}`}>
                <td className="p-3 font-medium">{menu.menu_name}</td>
                <td className="p-3 text-gray-600">{menu.category_name}</td>
                <td className="p-3 text-right">¥{menu.price.toLocaleString()}</td>
                <td className="p-3 text-right">{menu.duration} min</td>
                <td className="p-3 text-center">
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    menu.is_public ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                  }`}>
                    {menu.is_public ? "Published" : "Hidden"}
                  </span>
                </td>
                <td className="p-3 text-center space-x-2">
                  <button onClick={() => startEdit(menu)} className="text-blue-500 hover:text-blue-700 text-xs">
                    Edit
                  </button>
                  <button onClick={() => handleTogglePublic(menu.menu_id)} className="text-gray-500 hover:text-gray-700 text-xs">
                    {menu.is_public ? "Hide" : "Publish"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit/Add Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full">
            <h3 className="font-bold mb-4">{editingMenuId > 0 ? "Edit Menu" : "Add Menu"}</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Menu Name</label>
                <input
                  value={form.menu_name}
                  onChange={e => setForm({ ...form, menu_name: e.target.value })}
                  className="w-full border rounded p-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Category</label>
                <select
                  value={form.category_id}
                  onChange={e => setForm({ ...form, category_id: parseInt(e.target.value) })}
                  className="w-full border rounded p-2 text-sm"
                >
                  {categories.map(c => (
                    <option key={c.category_id} value={c.category_id}>{c.category_name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Price (¥)</label>
                  <input
                    type="number"
                    value={form.price}
                    onChange={e => setForm({ ...form, price: parseInt(e.target.value) || 0 })}
                    className="w-full border rounded p-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Duration (min)</label>
                  <input
                    type="number"
                    value={form.duration}
                    onChange={e => setForm({ ...form, duration: parseInt(e.target.value) || 0 })}
                    className="w-full border rounded p-2 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Description</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  className="w-full border rounded p-2 text-sm"
                  rows={3}
                />
              </div>
            </div>
            {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
            <div className="flex gap-3 mt-4">
              <button onClick={() => setShowForm(false)} className="flex-1 py-2 border rounded-md text-sm hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={handleSave} className="flex-1 py-2 bg-gray-800 text-white rounded-md text-sm hover:bg-gray-700">
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

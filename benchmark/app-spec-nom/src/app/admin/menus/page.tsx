"use client";

import { useState, useEffect } from "react";

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
}

export default function AdminMenusPage() {
  const [menus, setMenus] = useState<Menu[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [editingMenuId, setEditingMenuId] = useState(0); // 0 = add new
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");

  // Form state
  const [formName, setFormName] = useState("");
  const [formCategoryId, setFormCategoryId] = useState(1);
  const [formPrice, setFormPrice] = useState(0);
  const [formDuration, setFormDuration] = useState(30);
  const [formDescription, setFormDescription] = useState("");

  const fetchMenus = () => {
    fetch("/api/menus?include_hidden=1").then(r => r.json()).then(setMenus);
  };

  useEffect(() => {
    fetchMenus();
    fetch("/api/categories").then(r => r.json()).then(setCategories);
  }, []);

  const resetForm = () => {
    setFormName("");
    setFormCategoryId(1);
    setFormPrice(0);
    setFormDuration(30);
    setFormDescription("");
    setEditingMenuId(0);
    setError("");
  };

  const handleAddNew = () => {
    resetForm();
    setShowForm(true);
  };

  const handleEdit = (menu: Menu) => {
    setEditingMenuId(menu.menu_id);
    setFormName(menu.menu_name);
    setFormCategoryId(menu.category_id);
    setFormPrice(menu.price);
    setFormDuration(menu.duration);
    setFormDescription(menu.description);
    setShowForm(true);
    setError("");
  };

  const handleSave = async () => {
    setError("");

    if (editingMenuId === 0) {
      // Create new
      const res = await fetch("/api/menus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          menu_name: formName,
          category_id: formCategoryId,
          price: formPrice,
          duration: formDuration,
          description: formDescription,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
        return;
      }
    } else {
      // Update
      const res = await fetch(`/api/menus/${editingMenuId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          menu_name: formName,
          category_id: formCategoryId,
          price: formPrice,
          duration: formDuration,
          description: formDescription,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
        return;
      }
    }

    setShowForm(false);
    resetForm();
    fetchMenus();
  };

  const handleTogglePublic = async (menu: Menu) => {
    await fetch(`/api/menus/${menu.menu_id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_public: menu.is_public === 1 ? 0 : 1 }),
    });
    fetchMenus();
  };

  const formatPrice = (price: number) => `¥${price.toLocaleString()}`;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Menu Management</h1>
        <button
          onClick={handleAddNew}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition text-sm"
        >
          + Add Menu
        </button>
      </div>

      {/* Menu Table */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-3 text-sm font-medium text-gray-600">Menu Name</th>
              <th className="text-left p-3 text-sm font-medium text-gray-600">Category</th>
              <th className="text-right p-3 text-sm font-medium text-gray-600">Price</th>
              <th className="text-right p-3 text-sm font-medium text-gray-600">Duration</th>
              <th className="text-center p-3 text-sm font-medium text-gray-600">Status</th>
              <th className="text-center p-3 text-sm font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody>
            {menus.map((menu) => (
              <tr
                key={menu.menu_id}
                className={`border-t ${menu.is_public === 0 ? "opacity-50 bg-gray-50" : ""}`}
              >
                <td className="p-3">{menu.menu_name}</td>
                <td className="p-3 text-sm text-gray-600">{menu.category_name}</td>
                <td className="p-3 text-right">{formatPrice(menu.price)}</td>
                <td className="p-3 text-right text-sm">{menu.duration} min</td>
                <td className="p-3 text-center">
                  <span className={`text-xs px-2 py-1 rounded ${menu.is_public ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-600"}`}>
                    {menu.is_public ? "Published" : "Hidden"}
                  </span>
                </td>
                <td className="p-3 text-center">
                  <button
                    onClick={() => handleEdit(menu)}
                    className="text-blue-600 hover:underline text-sm mr-3"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleTogglePublic(menu)}
                    className="text-gray-600 hover:underline text-sm"
                  >
                    {menu.is_public ? "Hide" : "Publish"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold mb-4">
              {editingMenuId === 0 ? "Add New Menu" : "Edit Menu"}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Menu Name</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full p-2 border rounded"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Category</label>
                <select
                  value={formCategoryId}
                  onChange={(e) => setFormCategoryId(Number(e.target.value))}
                  className="w-full p-2 border rounded"
                >
                  {categories.map((cat) => (
                    <option key={cat.category_id} value={cat.category_id}>
                      {cat.category_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Price (yen)</label>
                <input
                  type="number"
                  value={formPrice}
                  onChange={(e) => setFormPrice(Number(e.target.value))}
                  className="w-full p-2 border rounded"
                  min={1}
                  max={99999}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Duration (minutes)</label>
                <input
                  type="number"
                  value={formDuration}
                  onChange={(e) => setFormDuration(Number(e.target.value))}
                  className="w-full p-2 border rounded"
                  min={10}
                  max={480}
                  step={10}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Description</label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full p-2 border rounded"
                  rows={3}
                />
              </div>
            </div>

            {error && <p className="text-red-600 text-sm mt-2">{error}</p>}

            <div className="flex gap-3 mt-4">
              <button
                onClick={handleSave}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
              >
                Save
              </button>
              <button
                onClick={() => { setShowForm(false); resetForm(); }}
                className="flex-1 px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

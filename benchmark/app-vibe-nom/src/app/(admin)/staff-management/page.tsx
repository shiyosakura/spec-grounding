"use client";

import { useEffect, useState } from "react";

interface Staff {
  staff_id: number;
  staff_name: string;
  profile: string;
  is_active: number;
  menu_count: number;
  shift_summary: string;
}

interface Shift {
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_working: number;
}

interface MenuOption {
  menu_id: number;
  menu_name: string;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function StaffManagementPage() {
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [editingStaffId, setEditingStaffId] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ staff_name: "", profile: "", is_active: 1 });
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [allMenus, setAllMenus] = useState<MenuOption[]>([]);
  const [assignedMenuIds, setAssignedMenuIds] = useState<number[]>([]);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");

  useEffect(() => {
    fetchStaff();
    fetch("/api/menus").then(r => r.json()).then((data: MenuOption[]) => setAllMenus(data));
  }, []);

  async function fetchStaff() {
    const res = await fetch("/api/staff");
    setStaffList(await res.json());
  }

  function defaultShifts(): Shift[] {
    return Array.from({ length: 7 }, (_, i) => ({
      day_of_week: i,
      start_time: "09:00",
      end_time: "19:00",
      is_working: i === 0 ? 0 : 1,
    }));
  }

  async function startEdit(staff: Staff) {
    setEditingStaffId(staff.staff_id);
    setForm({ staff_name: staff.staff_name, profile: staff.profile, is_active: staff.is_active });
    setError("");
    setWarning("");

    // Fetch shifts and assignments
    const [shiftRes, assignRes] = await Promise.all([
      fetch(`/api/shifts/${staff.staff_id}`),
      fetch(`/api/staff-menu-assignments/${staff.staff_id}`),
    ]);
    setShifts(await shiftRes.json());
    const assignments = await assignRes.json();
    setAssignedMenuIds(assignments.map((a: { menu_id: number }) => a.menu_id));
    setShowForm(true);
  }

  function startAdd() {
    setEditingStaffId(0);
    setForm({ staff_name: "", profile: "", is_active: 1 });
    setShifts(defaultShifts());
    setAssignedMenuIds([]);
    setError("");
    setWarning("");
    setShowForm(true);
  }

  async function handleSave() {
    setError("");
    setWarning("");

    // Save staff info
    const staffUrl = editingStaffId > 0 ? `/api/staff/${editingStaffId}` : "/api/staff";
    const staffMethod = editingStaffId > 0 ? "PUT" : "POST";
    const staffRes = await fetch(staffUrl, {
      method: staffMethod,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    if (!staffRes.ok) {
      const data = await staffRes.json();
      setError(data.error || "Failed to save staff");
      return;
    }

    const staffData = await staffRes.json();
    const staffId = editingStaffId > 0 ? editingStaffId : staffData.staff_id;

    // Save shifts
    const shiftRes = await fetch(`/api/shifts/${staffId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(shifts),
    });

    if (!shiftRes.ok) {
      const data = await shiftRes.json();
      if (data.warning) {
        setWarning(data.warning);
      } else {
        setError(data.error || "Failed to save shifts");
        return;
      }
    }

    // Save menu assignments
    await fetch(`/api/staff-menu-assignments/${staffId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(assignedMenuIds),
    });

    setShowForm(false);
    fetchStaff();
  }

  function updateShift(dow: number, field: keyof Shift, value: string | number) {
    setShifts(shifts.map(s =>
      s.day_of_week === dow ? { ...s, [field]: value } : s
    ));
  }

  function toggleMenuAssignment(menuId: number) {
    setAssignedMenuIds(
      assignedMenuIds.includes(menuId)
        ? assignedMenuIds.filter(id => id !== menuId)
        : [...assignedMenuIds, menuId]
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Staff Management</h1>
        <button onClick={startAdd} className="px-4 py-2 bg-gray-800 text-white rounded-md text-sm hover:bg-gray-700">
          + Add Staff
        </button>
      </div>

      {/* Staff List */}
      <div className="bg-white border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left p-3">Staff Name</th>
              <th className="text-right p-3">Supported Menus</th>
              <th className="text-left p-3">This Week&apos;s Shifts</th>
              <th className="text-center p-3">Status</th>
              <th className="text-center p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {staffList.map(staff => (
              <tr key={staff.staff_id} className={`border-b ${staff.is_active === 0 ? "opacity-50 bg-gray-50" : ""}`}>
                <td className="p-3 font-medium">{staff.staff_name}</td>
                <td className="p-3 text-right">{staff.menu_count}</td>
                <td className="p-3 text-gray-600 text-xs">{staff.shift_summary}</td>
                <td className="p-3 text-center">
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    staff.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                  }`}>
                    {staff.is_active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="p-3 text-center">
                  <button onClick={() => startEdit(staff)} className="text-blue-500 hover:text-blue-700 text-xs">
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit/Add Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 overflow-y-auto py-8">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-2xl w-full">
            <h3 className="font-bold text-lg mb-4">{editingStaffId > 0 ? "Edit Staff" : "Add Staff"}</h3>

            {/* Basic Info */}
            <div className="space-y-3 mb-6">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Staff Name</label>
                <input
                  value={form.staff_name}
                  onChange={e => setForm({ ...form, staff_name: e.target.value })}
                  className="w-full border rounded p-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Profile</label>
                <textarea
                  value={form.profile}
                  onChange={e => setForm({ ...form, profile: e.target.value })}
                  className="w-full border rounded p-2 text-sm"
                  rows={2}
                />
              </div>
              <div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.is_active === 1}
                    onChange={e => setForm({ ...form, is_active: e.target.checked ? 1 : 0 })}
                  />
                  Active
                </label>
              </div>
            </div>

            {/* Shift Settings */}
            <div className="mb-6">
              <h4 className="font-semibold text-sm mb-2">Shift Settings</h4>
              <table className="w-full text-sm border">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="p-2 text-left">Day</th>
                    <th className="p-2 text-center">Working</th>
                    <th className="p-2 text-center">Start</th>
                    <th className="p-2 text-center">End</th>
                  </tr>
                </thead>
                <tbody>
                  {shifts.map(shift => (
                    <tr key={shift.day_of_week} className="border-t">
                      <td className="p-2">{DAY_NAMES[shift.day_of_week]}</td>
                      <td className="p-2 text-center">
                        <input
                          type="checkbox"
                          checked={shift.is_working === 1}
                          onChange={e => updateShift(shift.day_of_week, "is_working", e.target.checked ? 1 : 0)}
                        />
                      </td>
                      <td className="p-2 text-center">
                        <input
                          type="time"
                          value={shift.start_time}
                          onChange={e => updateShift(shift.day_of_week, "start_time", e.target.value)}
                          disabled={shift.is_working === 0}
                          className="border rounded p-1 text-xs disabled:opacity-30"
                        />
                      </td>
                      <td className="p-2 text-center">
                        <input
                          type="time"
                          value={shift.end_time}
                          onChange={e => updateShift(shift.day_of_week, "end_time", e.target.value)}
                          disabled={shift.is_working === 0}
                          className="border rounded p-1 text-xs disabled:opacity-30"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Supported Menus */}
            <div className="mb-6">
              <h4 className="font-semibold text-sm mb-2">Supported Menus</h4>
              <div className="grid grid-cols-2 gap-1">
                {allMenus.map(menu => (
                  <label key={menu.menu_id} className="flex items-center gap-2 text-sm p-1">
                    <input
                      type="checkbox"
                      checked={assignedMenuIds.includes(menu.menu_id)}
                      onChange={() => toggleMenuAssignment(menu.menu_id)}
                    />
                    {menu.menu_name}
                  </label>
                ))}
              </div>
            </div>

            {error && <p className="text-red-500 text-sm mb-2">{error}</p>}
            {warning && <p className="text-yellow-600 text-sm mb-2">{warning}</p>}

            <div className="flex gap-3">
              <button onClick={() => setShowForm(false)} className="flex-1 py-2 border rounded-md text-sm hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={handleSave} className="flex-1 py-2 bg-gray-800 text-white rounded-md text-sm hover:bg-gray-700">
                Save All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

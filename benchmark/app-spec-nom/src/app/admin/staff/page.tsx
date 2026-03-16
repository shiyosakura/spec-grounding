"use client";

import { useState, useEffect } from "react";

interface Shift {
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_working: number;
}

interface StaffMember {
  staff_id: number;
  staff_name: string;
  profile: string;
  is_active: number;
  menu_count: number;
  shifts: Shift[];
  menu_ids: number[];
}

interface Menu {
  menu_id: number;
  menu_name: string;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function AdminStaffPage() {
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [allMenus, setAllMenus] = useState<Menu[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingStaffId, setEditingStaffId] = useState(0);
  const [error, setError] = useState("");

  // Form state
  const [formName, setFormName] = useState("");
  const [formProfile, setFormProfile] = useState("");
  const [formIsActive, setFormIsActive] = useState(1);
  const [formShifts, setFormShifts] = useState<Shift[]>([]);
  const [formMenuIds, setFormMenuIds] = useState<number[]>([]);

  const fetchStaff = () => {
    fetch("/api/staff?include_inactive=1").then(r => r.json()).then(setStaffList);
  };

  useEffect(() => {
    fetchStaff();
    fetch("/api/menus?include_hidden=1").then(r => r.json()).then(setAllMenus);
  }, []);

  const initializeShifts = (): Shift[] =>
    Array.from({ length: 7 }, (_, i) => ({
      day_of_week: i,
      start_time: "09:00",
      end_time: "19:00",
      is_working: 0,
    }));

  const handleAddNew = () => {
    setEditingStaffId(0);
    setFormName("");
    setFormProfile("");
    setFormIsActive(1);
    setFormShifts(initializeShifts());
    setFormMenuIds([]);
    setShowForm(true);
    setError("");
  };

  const handleEdit = (staff: StaffMember) => {
    setEditingStaffId(staff.staff_id);
    setFormName(staff.staff_name);
    setFormProfile(staff.profile);
    setFormIsActive(staff.is_active);

    // Ensure all 7 days are present
    const shifts = initializeShifts();
    for (const s of staff.shifts) {
      shifts[s.day_of_week] = { ...s };
    }
    setFormShifts(shifts);
    setFormMenuIds([...staff.menu_ids]);
    setShowForm(true);
    setError("");
  };

  const handleSave = async () => {
    setError("");

    if (editingStaffId === 0) {
      // Create new
      const res = await fetch("/api/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staff_name: formName,
          profile: formProfile,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
        return;
      }

      // Update shifts and menu assignments
      const staffId = data.staff_id;
      await fetch(`/api/staff/${staffId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staff_name: formName,
          profile: formProfile,
          is_active: formIsActive,
          shifts: formShifts,
          menu_ids: formMenuIds,
        }),
      });
    } else {
      const res = await fetch(`/api/staff/${editingStaffId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staff_name: formName,
          profile: formProfile,
          is_active: formIsActive,
          shifts: formShifts,
          menu_ids: formMenuIds,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
        return;
      }
    }

    setShowForm(false);
    fetchStaff();
  };

  const toggleMenuId = (menuId: number) => {
    if (formMenuIds.includes(menuId)) {
      setFormMenuIds(formMenuIds.filter(id => id !== menuId));
    } else {
      setFormMenuIds([...formMenuIds, menuId]);
    }
  };

  const updateShift = (dayOfWeek: number, field: keyof Shift, value: string | number) => {
    setFormShifts(formShifts.map(s =>
      s.day_of_week === dayOfWeek ? { ...s, [field]: value } : s
    ));
  };

  const getWorkingDays = (shifts: Shift[]) => {
    return shifts
      .filter(s => s.is_working === 1)
      .map(s => DAY_NAMES[s.day_of_week])
      .join(", ");
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Staff Management</h1>
        <button
          onClick={handleAddNew}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition text-sm"
        >
          + Add Staff
        </button>
      </div>

      {/* Staff List */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-3 text-sm font-medium text-gray-600">Name</th>
              <th className="text-center p-3 text-sm font-medium text-gray-600">Menus</th>
              <th className="text-left p-3 text-sm font-medium text-gray-600">Working Days</th>
              <th className="text-center p-3 text-sm font-medium text-gray-600">Status</th>
              <th className="text-center p-3 text-sm font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody>
            {staffList.map((staff) => (
              <tr
                key={staff.staff_id}
                className={`border-t ${staff.is_active === 0 ? "opacity-50 bg-gray-50" : ""}`}
              >
                <td className="p-3 font-medium">{staff.staff_name}</td>
                <td className="p-3 text-center text-sm">{staff.menu_count} menus</td>
                <td className="p-3 text-sm text-gray-600">{getWorkingDays(staff.shifts)}</td>
                <td className="p-3 text-center">
                  <span className={`text-xs px-2 py-1 rounded ${staff.is_active ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-600"}`}>
                    {staff.is_active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="p-3 text-center">
                  <button
                    onClick={() => handleEdit(staff)}
                    className="text-blue-600 hover:underline text-sm"
                  >
                    Edit
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
          <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold mb-4">
              {editingStaffId === 0 ? "Add New Staff" : "Edit Staff"}
            </h3>

            <div className="space-y-4">
              {/* Basic Info */}
              <div>
                <label className="block text-sm text-gray-600 mb-1">Staff Name</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full p-2 border rounded"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Profile</label>
                <textarea
                  value={formProfile}
                  onChange={(e) => setFormProfile(e.target.value)}
                  className="w-full p-2 border rounded"
                  rows={2}
                />
              </div>
              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formIsActive === 1}
                    onChange={(e) => setFormIsActive(e.target.checked ? 1 : 0)}
                  />
                  <span className="text-sm">Active</span>
                </label>
              </div>

              {/* Shifts */}
              <div>
                <h4 className="font-medium mb-2">Shift Schedule</h4>
                <div className="space-y-2">
                  {formShifts.map((shift) => (
                    <div key={shift.day_of_week} className="flex items-center gap-2">
                      <label className="flex items-center gap-1 w-16">
                        <input
                          type="checkbox"
                          checked={shift.is_working === 1}
                          onChange={(e) =>
                            updateShift(shift.day_of_week, "is_working", e.target.checked ? 1 : 0)
                          }
                        />
                        <span className="text-sm">{DAY_NAMES[shift.day_of_week]}</span>
                      </label>
                      {shift.is_working === 1 && (
                        <>
                          <input
                            type="time"
                            value={shift.start_time}
                            onChange={(e) => updateShift(shift.day_of_week, "start_time", e.target.value)}
                            className="p-1 border rounded text-sm"
                          />
                          <span className="text-sm">to</span>
                          <input
                            type="time"
                            value={shift.end_time}
                            onChange={(e) => updateShift(shift.day_of_week, "end_time", e.target.value)}
                            className="p-1 border rounded text-sm"
                          />
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Menu Assignments */}
              <div>
                <h4 className="font-medium mb-2">Supported Menus</h4>
                <div className="grid grid-cols-2 gap-1">
                  {allMenus.map((menu) => (
                    <label key={menu.menu_id} className="flex items-center gap-1 text-sm">
                      <input
                        type="checkbox"
                        checked={formMenuIds.includes(menu.menu_id)}
                        onChange={() => toggleMenuId(menu.menu_id)}
                      />
                      {menu.menu_name}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {error && <p className="text-red-600 text-sm mt-2">{error}</p>}

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleSave}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
              >
                Save
              </button>
              <button
                onClick={() => setShowForm(false)}
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

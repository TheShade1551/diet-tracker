// src/pages/Foods.jsx
import React, { useState } from "react";
// ✅ FIXED: Explicitly adding .jsx extension
import { useAppState } from "../context/AppStateContext.jsx";
import { 
  Search, Plus, Edit2, Trash2, Save, X, 
  Star, UtensilsCrossed
} from "lucide-react";

// Ensure CSS is imported
import "../styles/Foods.css";

export default function Foods() {
  const { state, dispatch } = useAppState();

  // --- State ---
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({
    name: "",
    category: "home",
    unitLabel: "serving",
    kcalPerUnit: "",
    isFavourite: false,
  });

  const [newFood, setNewFood] = useState({
    name: "",
    category: "home",
    unitLabel: "serving",
    kcalPerUnit: "",
    isFavourite: false,
  });

  const [categoryFilter, setCategoryFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // --- Constants ---
  const FOOD_CATEGORIES = [
    { key: "all", label: "All" },
    { key: "home", label: "Home" },
    { key: "street", label: "Street" },
    { key: "packaged", label: "Packaged" }, 
    { key: "cheat", label: "Cheat" },
    { key: "drinks", label: "Drinks" },
  ];

  // --- Filtering Logic ---
  const allFoods = state.foodItems || [];
  let filteredFoods = allFoods;

  if (categoryFilter !== "all") {
    filteredFoods = filteredFoods.filter(
      (f) => (f.category || "home") === categoryFilter
    );
  }

  const query = searchQuery.trim().toLowerCase();
  if (query) {
    filteredFoods = filteredFoods.filter((f) =>
      f.name.toLowerCase().includes(query)
    );
  }

  filteredFoods = [...filteredFoods].sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  // --- Helpers ---
  const startEdit = (food) => {
    setEditingId(food.id);
    setEditForm({
      name: food.name,
      category: food.category || "home",
      unitLabel: food.unitLabel || "serving",
      kcalPerUnit: String(food.kcalPerUnit ?? ""),
      isFavourite: !!food.isFavourite,
    });
  };

  const cancelEdit = () => setEditingId(null);

  const updateEditForm = (key, value) => {
    setEditForm((prev) => ({ ...prev, [key]: value }));
  };

  const saveEdit = () => {
    if (!editingId) return;
    const name = editForm.name.trim();
    if (!name) return;

    dispatch({
      type: "UPSERT_FOOD_ITEM",
      payload: {
        id: editingId,
        name,
        category: editForm.category || "home",
        unitLabel: editForm.unitLabel || "serving",
        kcalPerUnit: Number(editForm.kcalPerUnit) || 0,
        isFavourite: !!editForm.isFavourite,
      },
    });
    setEditingId(null);
  };

  const handleAddNew = (e) => {
    e.preventDefault();
    const name = newFood.name.trim();
    if (!name) return;

    dispatch({
      type: "UPSERT_FOOD_ITEM",
      payload: {
        id: crypto.randomUUID(),
        name,
        category: newFood.category || "home",
        unitLabel: newFood.unitLabel || "serving",
        kcalPerUnit: Number(newFood.kcalPerUnit) || 0,
        isFavourite: !!newFood.isFavourite,
      },
    });

    setNewFood({
      name: "",
      category: "home",
      unitLabel: "serving",
      kcalPerUnit: "",
      isFavourite: false,
    });
  };

  return (
    <div className="foods-page">
      
      {/* 1. Header */}
      <div className="foods-header">
        <div className="foods-title-group">
          <h1 className="foods-title">
            <UtensilsCrossed size={32} color="#3182ce" /> Foods Database
          </h1>
          <p className="foods-subtitle">
            Manage your food library and calories per unit.
          </p>
        </div>
        <div className="foods-count">
          {allFoods.length} Items
        </div>
      </div>

      {/* 2. Add New Food Card */}
      <section className="foods-card">
        <div className="card-header-row">
          <Plus size={20} /> Add New Item
        </div>
        <form onSubmit={handleAddNew}>
          <div className="form-row">
            <div className="form-group flex-2">
              <label>Name</label>
              <input
                type="text"
                placeholder="e.g. Protein Bar"
                value={newFood.name}
                onChange={(e) => setNewFood({ ...newFood, name: e.target.value })}
                className="foods-input"
                required
              />
            </div>

            <div className="form-group">
              <label>Category</label>
              <select
                value={newFood.category}
                onChange={(e) => setNewFood({ ...newFood, category: e.target.value })}
                className="foods-select"
              >
                {FOOD_CATEGORIES.filter(c => c.key !== 'all').map(c => (
                  <option key={c.key} value={c.key}>{c.label}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Unit</label>
              <input
                type="text"
                placeholder="e.g. pack, piece"
                value={newFood.unitLabel}
                onChange={(e) => setNewFood({ ...newFood, unitLabel: e.target.value })}
                className="foods-input"
                required
              />
            </div>

            <div className="form-group flex-small">
              <label>Kcal</label>
              <input
                type="number"
                step="1"
                min="0"
                placeholder="0"
                value={newFood.kcalPerUnit}
                onChange={(e) => setNewFood({ ...newFood, kcalPerUnit: e.target.value })}
                className="foods-input text-right"
                required
              />
            </div>

            <div className="form-group" style={{flex:'0 0 auto'}}>
                <label>&nbsp;</label>
                <label className="checkbox-wrapper">
                    <input
                        type="checkbox"
                        checked={newFood.isFavourite}
                        onChange={(e) => setNewFood({ ...newFood, isFavourite: e.target.checked })}
                        style={{marginRight:'8px'}}
                    />
                    Top Pick
                </label>
            </div>

            <div className="form-group" style={{flex:'0 0 auto'}}>
               <label>&nbsp;</label>
               <button type="submit" className="btn-add">
                 Add Food
               </button>
            </div>
          </div>
        </form>
      </section>

      {/* 3. Food List & Filters */}
      <section className="foods-card">
        <div className="controls-container">
            <div className="search-wrapper">
                <Search className="search-icon" size={18}/>
                <input 
                    type="text" 
                    placeholder="Search foods..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="search-input"
                />
            </div>
            <div className="filter-chips">
                {FOOD_CATEGORIES.map((btn) => (
                    <button
                        key={btn.key}
                        onClick={() => setCategoryFilter(btn.key)}
                        className={`filter-chip ${categoryFilter === btn.key ? "active" : ""}`}
                    >
                        {btn.label}
                    </button>
                ))}
            </div>
        </div>

        {/* Table */}
        <div className="table-container">
            {filteredFoods.length === 0 ? (
                <p className="muted" style={{textAlign:'center', padding:'2rem'}}>
                    No foods found. Try adding one or adjusting filters.
                </p>
            ) : (
                <table className="foods-table">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Category</th>
                            <th>Unit</th>
                            <th style={{textAlign:'right'}}>Kcal/Unit</th>
                            <th style={{textAlign:'center'}}>Fav</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredFoods.map((food) => {
                            const isEditing = editingId === food.id;
                            return (
                                <tr key={food.id}>
                                    <td>
                                        {isEditing ? (
                                            <input className="table-input" value={editForm.name} onChange={(e) => updateEditForm("name", e.target.value)} />
                                        ) : (
                                            <span style={{display:'flex', alignItems:'center'}}>
                                                {food.isFavourite && <Star size={14} className="fav-star" />}
                                                {food.name}
                                            </span>
                                        )}
                                    </td>
                                    <td>
                                        {isEditing ? (
                                            <select className="table-input" value={editForm.category} onChange={(e) => updateEditForm("category", e.target.value)}>
                                                {FOOD_CATEGORIES.filter(c => c.key !== 'all').map(c => (
                                                    <option key={c.key} value={c.key}>{c.label}</option>
                                                ))}
                                            </select>
                                        ) : (
                                            <span style={{textTransform:'capitalize'}}>{food.category}</span>
                                        )}
                                    </td>
                                    <td>
                                        {isEditing ? (
                                            <input className="table-input" value={editForm.unitLabel} onChange={(e) => updateEditForm("unitLabel", e.target.value)} />
                                        ) : food.unitLabel}
                                    </td>
                                    <td style={{textAlign:'right'}}>
                                        {isEditing ? (
                                            <input type="number" className="table-input input-tiny" value={editForm.kcalPerUnit} onChange={(e) => updateEditForm("kcalPerUnit", e.target.value)} />
                                        ) : food.kcalPerUnit}
                                    </td>
                                    <td style={{textAlign:'center'}}>
                                        {isEditing ? (
                                            <input type="checkbox" checked={editForm.isFavourite} onChange={(e) => updateEditForm("isFavourite", e.target.checked)} />
                                        ) : (
                                            food.isFavourite ? <Star size={16} className="fav-star" /> : <span className="muted">-</span>
                                        )}
                                    </td>
                                    <td style={{display:'flex', gap:'0.5rem'}}>
                                        {isEditing ? (
                                            <>
                                                <button className="action-btn save" onClick={saveEdit} title="Save"><Save size={18}/></button>
                                                <button className="action-btn cancel" onClick={cancelEdit} title="Cancel"><X size={18}/></button>
                                            </>
                                        ) : (
                                            <button className="action-btn" onClick={() => startEdit(food)} title="Edit"><Edit2 size={18}/></button>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            )}
        </div>
      </section>
    </div>
  );
}
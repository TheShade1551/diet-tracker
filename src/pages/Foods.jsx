// src/pages/Foods.jsx
import React, { useState, useMemo } from "react";
import { useAppState, DEFAULT_FOOD_CATEGORIES } from "../context/AppStateContext.jsx";
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  Save,
  X,
  Star,
  UtensilsCrossed,
  Settings2,
} from "lucide-react";

import "../styles/Foods.css";

function prettyLabel(key) {
  if (!key) return "";
  return key
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

export default function Foods() {
  const { state, dispatch } = useAppState();

  // ---------- Local UI State ----------
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

  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");

  // ---------- Categories from global state ----------
  const userCategories =
    (state.foodCategories && state.foodCategories.length
      ? state.foodCategories
      : DEFAULT_FOOD_CATEGORIES) || [];

  const allFoods = state.foodItems || [];
  const unassignedCount = allFoods.filter(
    (f) => !f.category || f.category === ""
  ).length;

  // Build filter chips
  const filterOptions = useMemo(
    () => [
      { key: "all", label: "All" },
      ...userCategories.map((key) => ({
        key,
        label: prettyLabel(key),
      })),
      { key: "null", label: "Unassigned" },
    ],
    [userCategories]
  );

  // ---------- Filtering ----------
  let filteredFoods = allFoods;

  if (categoryFilter === "null") {
    filteredFoods = filteredFoods.filter(
      (f) => !f.category || f.category === ""
    );
  } else if (categoryFilter !== "all") {
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

  // ---------- Food CRUD helpers ----------
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

  const deleteFood = (foodId) => {
    if (
      window.confirm("Are you sure you want to delete this food item?")
    ) {
      dispatch({
        type: "DELETE_FOOD_ITEM",
        payload: { id: foodId },
      });
    }
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

  // ---------- Category manager helpers ----------
  const openCategoryModal = () => {
    setCategoryModalOpen(true);
    setNewCategoryName("");
  };

  const closeCategoryModal = () => {
    setCategoryModalOpen(false);
    setNewCategoryName("");
  };

  const handleAddCategory = () => {
    const name = newCategoryName.trim();
    if (!name) return;
    dispatch({ type: "ADD_FOOD_CATEGORY", payload: name });
    setNewCategoryName("");
  };

  const handleRenameCategory = (oldName) => {
    const currentLabel = prettyLabel(oldName);
    const next = window.prompt("Rename category", currentLabel);
    if (!next) return;
    const trimmed = next.trim();
    if (!trimmed) return;

    dispatch({
      type: "RENAME_FOOD_CATEGORY",
      payload: { oldName, newName: trimmed },
    });
  };

  const handleDeleteCategory = (name) => {
    if (
      !window.confirm(
        `Delete category "${prettyLabel(
          name
        )}"?\n\nFoods in this category will become unassigned.`
      )
    ) {
      return;
    }

    dispatch({
      type: "DELETE_FOOD_CATEGORY",
      payload: { name },
    });

    // If current filter is this category, bounce back to "all"
    if (categoryFilter === name) {
      setCategoryFilter("all");
    }
  };

  return (
    <div className="page foods-page">
      {/* Header */}
      <header className="foods-header">
        <div className="foods-header-left">
          <h1 className="page-title">
            <UtensilsCrossed size={22} style={{ marginRight: 8 }} />
            Foods Database
          </h1>
          <p className="page-subtitle">
            Manage your food library and calories per unit.
          </p>
        </div>
        <div className="foods-header-right">
          <span className="tag-pill">
            {allFoods.length} {allFoods.length === 1 ? "item" : "items"}
          </span>
        </div>
      </header>

      {/* Add New Item card */}
      <section className="foods-section">
        <div className="foods-card add-food-card">
          <div className="card-header">
            <h2 className="card-title">Add New Item</h2>
          </div>

          <form className="add-form" onSubmit={handleAddNew}>
            <div className="add-form-row">
              <label className="field-label">
                Name
                <input
                  type="text"
                  value={newFood.name}
                  onChange={(e) =>
                    setNewFood({ ...newFood, name: e.target.value })
                  }
                  className="foods-input"
                  required
                />
              </label>

              <label className="field-label">
                Category
                <select
                  value={newFood.category}
                  onChange={(e) =>
                    setNewFood({ ...newFood, category: e.target.value })
                  }
                  className="foods-select"
                >
                  {userCategories.map((key) => (
                    <option key={key} value={key}>
                      {prettyLabel(key)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field-label">
                Unit
                <input
                  type="text"
                  value={newFood.unitLabel}
                  onChange={(e) =>
                    setNewFood({ ...newFood, unitLabel: e.target.value })
                  }
                  className="foods-input"
                  required
                />
              </label>

              <label className="field-label">
                Kcal
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={newFood.kcalPerUnit}
                  onChange={(e) =>
                    setNewFood({ ...newFood, kcalPerUnit: e.target.value })
                  }
                  className="foods-input text-right"
                  required
                />
              </label>
            </div>

            <div className="add-form-footer">
              <label className="checkbox-inline">
                <input
                  type="checkbox"
                  checked={newFood.isFavourite}
                  onChange={(e) =>
                    setNewFood({
                      ...newFood,
                      isFavourite: e.target.checked,
                    })
                  }
                />
                <span style={{ marginLeft: 6 }}>Top Pick</span>
              </label>

              <button type="submit" className="btn-primary">
                <Plus size={16} />
                <span>Add Food</span>
              </button>
            </div>
          </form>
        </div>
      </section>

      {/* Search + Filters + Table */}
      <section className="foods-section">
        <div className="foods-card">
          {/* Search row */}
          <div className="foods-search-row">
            <div className="search-input-wrapper">
              <Search size={16} className="search-icon" />
              <input
                type="text"
                placeholder="Search foods..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
              />
            </div>
          </div>

          {/* Filter chips */}
          <div className="foods-filter-row">
            <div className="filter-chip-group">
              {filterOptions.map((btn) => {
                const active = categoryFilter === btn.key;
                const isNull = btn.key === "null";
                const showBadge = isNull && unassignedCount > 0;

                return (
                  <button
                    key={btn.key}
                    type="button"
                    onClick={() => setCategoryFilter(btn.key)}
                    className={`filter-chip ${
                      active ? "active" : ""
                    } ${isNull ? "filter-chip-null" : ""}`}
                  >
                    {btn.label}
                    {showBadge && (
                      <span className="chip-badge">
                        {unassignedCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              className="filter-chip filter-chip-edit"
              onClick={openCategoryModal}
              title="Edit categories"
            >
              <Settings2 size={14} />
              <span className="hide-on-very-small">Edit</span>
            </button>
          </div>

          {/* Table */}
          {filteredFoods.length === 0 ? (
            <div className="empty-state">
              <p>No foods found. Try adding one or adjusting filters.</p>
            </div>
          ) : (
            <div className="foods-table-wrapper">
              <table className="foods-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Category</th>
                    <th>Unit</th>
                    <th className="text-right">Kcal/Unit</th>
                    <th>Fav</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFoods.map((food) => {
                    const isEditing = editingId === food.id;

                    return (
                      <tr key={food.id}>
                        {/* Name */}
                        <td className="col-name">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editForm.name}
                              onChange={(e) =>
                                updateEditForm("name", e.target.value)
                              }
                              className="foods-input inline-input"
                            />
                          ) : (
                            <>
                              {food.isFavourite && (
                                <Star
                                  size={14}
                                  className="fav-star"
                                  fill="#fbbf24"
                                  stroke="#f59e0b"
                                />
                              )}
                              <span>{food.name}</span>
                            </>
                          )}
                        </td>

                        {/* Category */}
                        <td className="col-category">
                          {isEditing ? (
                            <select
                              value={editForm.category}
                              onChange={(e) =>
                                updateEditForm("category", e.target.value)
                              }
                              className="foods-select inline-select"
                            >
                              {userCategories.map((key) => (
                                <option key={key} value={key}>
                                  {prettyLabel(key)}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span>
                              {food.category
                                ? prettyLabel(food.category)
                                : "—"}
                            </span>
                          )}
                        </td>

                        {/* Unit */}
                        <td>
                          {isEditing ? (
                            <input
                              type="text"
                              value={editForm.unitLabel}
                              onChange={(e) =>
                                updateEditForm(
                                  "unitLabel",
                                  e.target.value
                                )
                              }
                              className="foods-input inline-input"
                            />
                          ) : (
                            food.unitLabel || "—"
                          )}
                        </td>

                        {/* Kcal/Unit */}
                        <td className="text-right">
                          {isEditing ? (
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={editForm.kcalPerUnit}
                              onChange={(e) =>
                                updateEditForm(
                                  "kcalPerUnit",
                                  e.target.value
                                )
                              }
                              className="foods-input inline-input text-right"
                            />
                          ) : (
                            food.kcalPerUnit ?? 0
                          )}
                        </td>

                        {/* Fav */}
                        <td className="col-fav">
                          {isEditing ? (
                            <label className="checkbox-inline">
                              <input
                                type="checkbox"
                                checked={editForm.isFavourite}
                                onChange={(e) =>
                                  updateEditForm(
                                    "isFavourite",
                                    e.target.checked
                                  )
                                }
                              />
                            </label>
                          ) : food.isFavourite ? (
                            <Star
                              size={16}
                              fill="#fbbf24"
                              stroke="#f59e0b"
                            />
                          ) : (
                            <span className="muted-dash">—</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="text-right col-actions">
                          {isEditing ? (
                            <div className="row-actions">
                              <button
                                type="button"
                                className="icon-btn success"
                                onClick={saveEdit}
                                title="Save"
                              >
                                <Save size={15} />
                              </button>
                              <button
                                type="button"
                                className="icon-btn subtle"
                                onClick={cancelEdit}
                                title="Cancel"
                              >
                                <X size={15} />
                              </button>
                            </div>
                          ) : (
                            <div className="row-actions">
                              <button
                                type="button"
                                className="icon-btn subtle"
                                onClick={() => startEdit(food)}
                                title="Edit"
                              >
                                <Edit2 size={15} />
                              </button>
                              <button
                                type="button"
                                className="icon-btn danger"
                                onClick={() => deleteFood(food.id)}
                                title="Delete"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* Category Manager Modal */}
      {categoryModalOpen && (
        <div
          className="foods-modal-backdrop"
          onClick={closeCategoryModal}
        >
          <div
            className="foods-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2>Manage Categories</h2>
            </div>

            <ul className="category-list">
              {userCategories.map((key) => (
                <li key={key} className="category-row">
                  <span className="category-name">
                    {prettyLabel(key)}
                  </span>
                  <div className="category-actions">
                    <button
                      type="button"
                      className="icon-btn subtle"
                      onClick={() => handleRenameCategory(key)}
                      title="Rename"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      type="button"
                      className="icon-btn danger"
                      onClick={() => handleDeleteCategory(key)}
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </li>
              ))}

              {userCategories.length === 0 && (
                <li className="category-row empty">
                  <span className="muted">
                    No categories yet. Add one below.
                  </span>
                </li>
              )}
            </ul>

            <div className="category-add-row">
              <input
                type="text"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="New category name"
                className="foods-input"
              />
              <button
                type="button"
                className="btn-primary"
                onClick={handleAddCategory}
              >
                <Plus size={14} />
                <span>Add</span>
              </button>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn-secondary"
                onClick={closeCategoryModal}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

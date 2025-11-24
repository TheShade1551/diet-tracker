// src/pages/Foods.jsx
import React, { useState } from "react";
import { useAppState } from "../context/AppStateContext";

export default function Foods() {
  const { state, dispatch } = useAppState();

  // ---- edit existing food ----
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({
    name: "",
    category: "home",
    unitLabel: "serving",
    kcalPerUnit: "",
    isFavourite: false,
  });

  // ---- add new food ----
  const [newFood, setNewFood] = useState({
    name: "",
    category: "home",
    unitLabel: "serving",
    kcalPerUnit: "",
    isFavourite: false,
  });

  // ---- filters ----
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const allFoods = state.foodItems || [];

  // build filtered list
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

  // ---- helpers ----

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

    // reset form
    setNewFood({
      name: "",
      category: "home",
      unitLabel: "serving",
      kcalPerUnit: "",
      isFavourite: false,
    });
  };

  return (
    <div style={{ padding: "1rem" }}>
      <h1>Foods Database</h1>
      <p>
        Total items: {allFoods.length} ({filteredFoods.length} shown)
      </p>

      {/* --- Add new food form --- */}
      <section
        style={{
          marginBottom: "1rem",
          padding: "0.75rem",
          border: "1px solid #ddd",
          borderRadius: 4,
        }}
      >
        <h2 style={{ fontSize: "1rem", marginBottom: "0.5rem" }}>
          Add new food
        </h2>
        <form
          onSubmit={handleAddNew}
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "0.5rem",
            alignItems: "center",
          }}
        >
          <input
            type="text"
            placeholder="Name (e.g. Chapati)"
            value={newFood.name}
            onChange={(e) =>
              setNewFood((prev) => ({ ...prev, name: e.target.value }))
            }
            style={{ minWidth: 160 }}
          />
          <select
            value={newFood.category}
            onChange={(e) =>
              setNewFood((prev) => ({ ...prev, category: e.target.value }))
            }
          >
            <option value="home">Home</option>
            <option value="street">Street</option>
            <option value="cheat">Cheat</option>
            <option value="drinks">Drinks</option>
          </select>
          <input
            type="text"
            placeholder="Unit (e.g. piece, serving)"
            value={newFood.unitLabel}
            onChange={(e) =>
              setNewFood((prev) => ({ ...prev, unitLabel: e.target.value }))
            }
            style={{ width: 120 }}
          />
          <input
            type="number"
            step="1"
            min="0"
            placeholder="kcal / unit"
            value={newFood.kcalPerUnit}
            onChange={(e) =>
              setNewFood((prev) => ({
                ...prev,
                kcalPerUnit: e.target.value,
              }))
            }
            style={{ width: 110 }}
          />
          <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <input
              type="checkbox"
              checked={newFood.isFavourite}
              onChange={(e) =>
                setNewFood((prev) => ({
                  ...prev,
                  isFavourite: e.target.checked,
                }))
              }
            />
            Favourite
          </label>
          <button type="submit">Add</button>
        </form>
      </section>

      {/* --- Search + filter controls --- */}
      <div style={{ marginBottom: "0.75rem" }}>
        <input
          type="text"
          placeholder="Search by name…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ width: "250px", marginRight: "0.5rem" }}
        />
        {[
          { key: "all", label: "All" },
          { key: "home", label: "Home" },
          { key: "street", label: "Street" },
          { key: "cheat", label: "Cheat" },
          { key: "drinks", label: "Drinks" },
        ].map((btn) => (
          <button
            key={btn.key}
            type="button"
            onClick={() => setCategoryFilter(btn.key)}
            style={{
              padding: "0.25rem 0.75rem",
              border:
                categoryFilter === btn.key
                  ? "2px solid black"
                  : "1px solid #ccc",
              fontWeight: categoryFilter === btn.key ? "bold" : "normal",
              cursor: "pointer",
              marginRight: "0.25rem",
            }}
          >
            {btn.label}
          </button>
        ))}
      </div>

      {/* --- Empty state / table --- */}
      {filteredFoods.length === 0 && (
        <p>
          No food items match your criteria. Try adjusting the search or filter.
        </p>
      )}

      {filteredFoods.length > 0 && (
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            marginTop: "0.5rem",
          }}
        >
          <thead>
            <tr>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>
                Name
              </th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>
                Category
              </th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>
                Unit
              </th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>
                kcal / unit
              </th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>
                Favourite
              </th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredFoods.map((food) => (
              <tr key={food.id}>
                {/* Name */}
                <td style={{ padding: "4px 0" }}>
                  {editingId === food.id ? (
                    <input
                      value={editForm.name}
                      onChange={(e) =>
                        updateEditForm("name", e.target.value)
                      }
                    />
                  ) : (
                    <>
                      {food.isFavourite && <span>⭐ </span>}
                      {food.name}
                    </>
                  )}
                </td>

                {/* Category */}
                <td style={{ padding: "4px 0" }}>
                  {editingId === food.id ? (
                    <select
                      value={editForm.category}
                      onChange={(e) =>
                        updateEditForm("category", e.target.value)
                      }
                    >
                      <option value="home">Home</option>
                      <option value="street">Street</option>
                      <option value="cheat">Cheat</option>
                      <option value="drinks">Drinks</option>
                    </select>
                  ) : (
                    food.category || "home"
                  )}
                </td>

                {/* Unit label */}
                <td style={{ padding: "4px 0" }}>
                  {editingId === food.id ? (
                    <input
                      value={editForm.unitLabel}
                      onChange={(e) =>
                        updateEditForm("unitLabel", e.target.value)
                      }
                    />
                  ) : (
                    food.unitLabel
                  )}
                </td>

                {/* kcal per unit */}
                <td style={{ padding: "4px 0" }}>
                  {editingId === food.id ? (
                    <input
                      type="number"
                      value={editForm.kcalPerUnit}
                      onChange={(e) =>
                        updateEditForm("kcalPerUnit", e.target.value)
                      }
                    />
                  ) : (
                    food.kcalPerUnit
                  )}
                </td>

                {/* Favourite flag */}
                <td style={{ padding: "4px 0" }}>
                  {editingId === food.id ? (
                    <label>
                      <input
                        type="checkbox"
                        checked={editForm.isFavourite}
                        onChange={(e) =>
                          updateEditForm("isFavourite", e.target.checked)
                        }
                      />{" "}
                      Favourite
                    </label>
                  ) : food.isFavourite ? (
                    "Yes"
                  ) : (
                    "No"
                  )}
                </td>

                {/* Actions */}
                <td style={{ padding: "4px 0" }}>
                  {editingId === food.id ? (
                    <>
                      <button type="button" onClick={saveEdit}>
                        Save
                      </button>{" "}
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => startEdit(food)}
                    >
                      Edit
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

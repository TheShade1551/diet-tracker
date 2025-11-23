import React, { useState } from "react";
import { useAppState } from "../context/AppStateContext";

export default function Foods() {
  const { state, dispatch } = useAppState();
  const foods = state.foodItems;

  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({
    name: "",
    category: "",
    unitLabel: "",
    kcalPerUnit: "",
  });

  const startEdit = (food) => {
    setEditingId(food.id);
    setEditForm({
      name: food.name,
      category: food.category,
      unitLabel: food.unitLabel,
      kcalPerUnit: food.kcalPerUnit,
    });
  };

  const saveEdit = () => {
    dispatch({
      type: "UPSERT_FOOD_ITEM",
      payload: {
        id: editingId,
        ...editForm,
        kcalPerUnit: Number(editForm.kcalPerUnit),
      },
    });
    setEditingId(null);
  };

  return (
    <div>
      <h1>Foods Database</h1>
      <p>Total items: {foods.length}</p>

      {foods.length === 0 && (
        <p style={{ opacity: 0.7 }}>No food items yet. Add some via Day Log.</p>
      )}

      {foods.length > 0 && (
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            marginTop: "1rem",
          }}
        >
          <thead>
            <tr>
              <th style={{ textAlign: "left" }}>Name</th>
              <th>Category</th>
              <th>Unit</th>
              <th>kcal/unit</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {foods.map((food) => (
              <tr key={food.id}>
                <td>
                  {editingId === food.id ? (
                    <input
                      value={editForm.name}
                      onChange={(e) =>
                        setEditForm({ ...editForm, name: e.target.value })
                      }
                    />
                  ) : (
                    food.name
                  )}
                </td>

                <td style={{ textAlign: "center" }}>
                  {editingId === food.id ? (
                    <input
                      value={editForm.category}
                      onChange={(e) =>
                        setEditForm({ ...editForm, category: e.target.value })
                      }
                    />
                  ) : (
                    food.category
                  )}
                </td>

                <td style={{ textAlign: "center" }}>
                  {editingId === food.id ? (
                    <input
                      value={editForm.unitLabel}
                      onChange={(e) =>
                        setEditForm({ ...editForm, unitLabel: e.target.value })
                      }
                    />
                  ) : (
                    food.unitLabel
                  )}
                </td>

                <td style={{ textAlign: "center" }}>
                  {editingId === food.id ? (
                    <input
                      type="number"
                      value={editForm.kcalPerUnit}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          kcalPerUnit: e.target.value,
                        })
                      }
                    />
                  ) : (
                    food.kcalPerUnit
                  )}
                </td>

                <td style={{ textAlign: "center" }}>
                  {editingId === food.id ? (
                    <>
                      <button onClick={saveEdit}>Save</button>
                      <button onClick={() => setEditingId(null)}>
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button onClick={() => startEdit(food)}>Edit</button>
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
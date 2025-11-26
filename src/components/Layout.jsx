// src/components/Layout.jsx
import React, { useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import Sidebar from "./Sidebar.jsx";

import "../styles/Layout.css";
import "../App.css";

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <div className={`app-root ${sidebarOpen ? "sidebar-open" : ""}`}>
      {/* Off-canvas sidebar (handles its own compact buttons + overlay) */}
      <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} />

      {/* Main content column */}
      <div className={`main-area ${sidebarOpen ? "dimmed" : ""}`}>
        {/* Sticky top bar */}
        <header className="topbar">
          <div className="topbar-left">
            <button
              type="button"
              className="topbar-logo-btn"
              onClick={() => navigate("/")}
            >
              <span className="brand">
                <span className="diet">Diet</span>
                <span className="tracker">Tracker</span>
              </span>
            </button>
          </div>

          <div className="topbar-right">
            <span className="topbar-version">v1.0 • Local Storage</span>
          </div>
        </header>

        {/* Routed pages go here */}
        <main className="content">
          <div className="app-shell">
            <div className="page-container">
              <Outlet />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

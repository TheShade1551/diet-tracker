import React, { useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import "../App.css";

export default function Layout() {
  // State to manage the sidebar open/closed status
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // The navigation links structure to be passed to the Sidebar
  const navLinks = [
    { to: "/", label: "Dashboard", end: true },
    { to: "/day-log", label: "Day Log" },
    { to: "/foods", label: "Foods" },
    { to: "/trends", label: "Trends" },
    { to: "/settings", label: "Settings" },
  ];

  return (
    <div className="app-root">
      {/* Integrate the Sidebar component */}
      <Sidebar 
        open={sidebarOpen} 
        setOpen={setSidebarOpen} 
        compact={true}
        navLinks={navLinks}
      />

      {/* The main content area, with conditional "dimmed" class for overlay effect */}
      <div className={`main-area ${sidebarOpen ? "dimmed" : ""}`}>
        
        <header className="topbar">
          <div className="topbar-left">
            
            {/* Styled Brand Logo/Title using the new 'brand' class with split spans */}
            <h1 className="brand" onClick={() => window.location.assign("/")}>
                <span className="diet">Diet</span>
                <span className="tracker">Tracker</span>
            </h1>
            
          </div>
          <div className="topbar-right">
            {/* any top controls / user info */}
            <div className="muted">Chat × Sagar · v1</div>
          </div>
        </header>

        <main className="content">
          <div className="page">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
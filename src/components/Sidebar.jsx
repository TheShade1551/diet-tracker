// src/components/Sidebar.jsx
import React, { useEffect, useRef } from "react";
import { NavLink, useNavigate } from "react-router-dom";
// ✅ 1. Import 'PieChart' for the Stats icon
import { Menu, Home, FileText, BookOpen, BarChart2, PieChart, Settings } from "lucide-react";
import "../styles/Sidebar.css"; 

export default function Sidebar({ open, setOpen, compact }) {
  const navigate = useNavigate();
  const panelRef = useRef(null);
  
  // Helper function to close the sidebar
  const closeSidebar = () => setOpen(false);

  // Close on ESC key (UX improvement)
  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") setOpen(false);
    }
    // Only listen if the sidebar is open
    if (open) {
      document.addEventListener("keydown", onKey);
    }
    return () => document.removeEventListener("keydown", onKey);
  }, [open, setOpen]);


  // Compact buttons (always visible) — clicking navigates and closes the main panel if open
  const CompactButtons = () => (
    <div className="sidebar-compact">
      {/* 1. Hamburger button: Uses Lucide Menu icon */}
      <button 
        className="hamburger-btn" 
        aria-label="Toggle menu" 
        onClick={() => setOpen(prev => !prev)} // Toggles the state
      >
        <Menu size={18} />
      </button>

      {/* 2. Navigation buttons: Use Lucide icons */}
      <button className="mini-btn" title="Dashboard" onClick={() => { closeSidebar(); navigate("/"); }}>
        <Home size={18} />
      </button>
      <button className="mini-btn" title="Day Log" onClick={() => { closeSidebar(); navigate("/day-log"); }}>
        <FileText size={18} />
      </button>
      <button className="mini-btn" title="Foods" onClick={() => { closeSidebar(); navigate("/foods"); }}>
        <BookOpen size={18} />
      </button>
      <button className="mini-btn" title="Trends" onClick={() => { closeSidebar(); navigate("/trends"); }}>
        <BarChart2 size={18} />
      </button>
      
      {/* ✅ 2. Added Stats Button (Compact) */}
      <button className="mini-btn" title="Stats" onClick={() => { closeSidebar(); navigate("/stats"); }}>
        <PieChart size={18} />
      </button>

      <button className="mini-btn" title="Settings" onClick={() => { closeSidebar(); navigate("/settings"); }}>
        <Settings size={18} />
      </button>
    </div>
  );

  return (
    <>
      {/* 1. The Compact sidebar buttons remain visible always */}
      <CompactButtons />

      {/* 2. Overlay: visible only when 'open' is true */}
      {open && (
        <div 
          className="sidebar-overlay show" 
          onMouseDown={closeSidebar} 
          role="presentation"
        />
      )}

      {/* 3. Full Sidebar Panel */}
      <aside 
        ref={panelRef}
        className={`sidebar-panel ${open ? "open" : ""}`}
        aria-hidden={!open}
      >
        <div className="sidebar-header">
          <div className="logo" onClick={() => { navigate("/"); closeSidebar(); }} tabIndex={0}>
            Diet Tracker
          </div>
        </div>

        <nav className="sidebar-nav" aria-label="Main navigation">
          {/* Ensure NavLink clicks also close the sidebar */}
          <NavLink to="/" className="nav-link" onClick={closeSidebar}>Dashboard</NavLink>
          <NavLink to="/day-log" className="nav-link" onClick={closeSidebar}>Day Log</NavLink>
          <NavLink to="/foods" className="nav-link" onClick={closeSidebar}>Foods DB</NavLink>
          <NavLink to="/trends" className="nav-link" onClick={closeSidebar}>Trends</NavLink>
          
          {/* ✅ 3. Added Stats Link (Full Menu) */}
          <NavLink to="/stats" className="nav-link" onClick={closeSidebar}>Stats</NavLink>
          
          <NavLink to="/settings" className="nav-link" onClick={closeSidebar}>Settings</NavLink>
        </nav>

        <div className="sidebar-footer">
          <small>v1 • local</small>
        </div>
      </aside>
    </>
  );
}
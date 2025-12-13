// src/components/Layout.jsx
import React, { useState, useRef, useEffect } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import Sidebar from "./Sidebar.jsx";

import "../styles/Layout.css";
import "../App.css";

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // New state: Controls visibility of the compact rail on mobile
  const [mobileRailVisible, setMobileRailVisible] = useState(true);
  
  // Ref to store timestamp of the last tap
  const lastTapRef = useRef(0);
  
  // State to determine if we are strictly on mobile view
  const [isMobile, setIsMobile] = useState(false);

  const navigate = useNavigate();

  // 1. Detect Screen Size on Mount/Resize
  useEffect(() => {
    const checkIsMobile = () => setIsMobile(window.innerWidth <= 640);
    
    // Initial check
    checkIsMobile();
    
    // Listener
    window.addEventListener("resize", checkIsMobile);
    return () => window.removeEventListener("resize", checkIsMobile);
  }, []);

  // 2. Double-Tap Handler
  const handleMainTouchEnd = () => {
    // Only run this logic on mobile devices
    if (!isMobile) return;

    const now = Date.now();
    const delta = now - lastTapRef.current;

    // If time between taps is less than 300ms, treat as double-tap
    if (delta > 0 && delta < 300) {
      setMobileRailVisible((prev) => !prev);
      lastTapRef.current = 0; // Reset to avoid triple-tap triggering
    } else {
      lastTapRef.current = now; // Store first tap time
    }
  };

  return (
    <div className={`app-root ${sidebarOpen ? "sidebar-open" : ""}`}>
      {/* Sidebar now receives mobileRailVisible to toggle 
         the bottom/compact rail on mobile 
      */}
      <Sidebar 
        open={sidebarOpen} 
        setOpen={setSidebarOpen} 
        mobileRailVisible={mobileRailVisible}
      />

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
            <span className="topbar-version">v3.0 • TDEE Revamp</span>
          </div>
        </header>

        {/* Routed pages go here 
           Added onTouchEnd listener here to capture taps on the content body
        */}
        <main className="content" onTouchEnd={handleMainTouchEnd}>
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
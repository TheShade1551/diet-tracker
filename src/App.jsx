import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";

import Dashboard from "./pages/Dashboard";
import DayLog from "./pages/DayLog";
import Foods from "./pages/Foods";
import Trends from "./pages/Trends";
import Settings from "./pages/Settings";
import Stats from "./pages/Stats"; // 1. Import Added
import ActivityTab from "./pages/ActivityTab";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          
          {/* Day Log for today */}
          <Route path="day-log" element={<DayLog />} /> 
          {/* Day Log for specific date */}
          <Route path="day-log/:date" element={<DayLog />} /> 
          
          <Route path="/foods" element={<Foods />} />
          <Route path="/trends" element={<Trends />} />
          
          {/* 2. Route Added */}
          <Route path="/stats" element={<Stats />} />
          <Route path="/activity" element={<ActivityTab />} />

          <Route path="/settings" element={<Settings />} />
          
          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
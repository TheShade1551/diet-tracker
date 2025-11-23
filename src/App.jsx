import { Routes, Route, NavLink } from 'react-router-dom';
import DashboardPage from './pages/DashboardPage';
import DayLogPage from './pages/DayLogPage';
import FoodsPage from './pages/FoodsPage';
import TrendsPage from './pages/TrendsPage';
import SettingsPage from './pages/SettingsPage';

export default function App() {
  return (
    <div className="app-root">
      <header className="app-header">
        <h1>Diet Tracker v1</h1>
        <nav className="app-nav">
          <NavLink to="/" end>Dashboard</NavLink>
          <NavLink to="/day/today">Today</NavLink>
          <NavLink to="/foods">Foods</NavLink>
          <NavLink to="/trends">Trends</NavLink>
          <NavLink to="/settings">Settings</NavLink>
        </nav>
      </header>

      <main className="app-main">
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/day/:date" element={<DayLogPage />} />
          <Route path="/foods" element={<FoodsPage />} />
          <Route path="/trends" element={<TrendsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          {/* Fallback */}
          <Route path="*" element={<DashboardPage />} />
        </Routes>
      </main>
    </div>
  );
}
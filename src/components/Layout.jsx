import { NavLink, Outlet } from "react-router-dom";

export default function Layout() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-title">
          Diet<span>Tracker</span>
        </div>
        <div className="muted">Chat × Sagar · v1</div>
      </header>

      <div className="app-body">
        <nav className="app-nav">
          <h2>Navigation</h2>
          <ul className="nav-list">
            <li>
              <NavLink
                to="/"
                end
                className={({ isActive }) =>
                  "nav-link " + (isActive ? "nav-link-active" : "")
                }
              >
                Dashboard
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/day-log"
                className={({ isActive }) =>
                  "nav-link " + (isActive ? "nav-link-active" : "")
                }
              >
                Day Log
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/foods"
                className={({ isActive }) =>
                  "nav-link " + (isActive ? "nav-link-active" : "")
                }
              >
                Foods
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/trends"
                className={({ isActive }) =>
                  "nav-link " + (isActive ? "nav-link-active" : "")
                }
              >
                Trends
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/settings"
                className={({ isActive }) =>
                  "nav-link " + (isActive ? "nav-link-active" : "")
                }
              >
                Settings
              </NavLink>
            </li>
          </ul>
        </nav>

        <main className="app-main">
          <div className="page">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
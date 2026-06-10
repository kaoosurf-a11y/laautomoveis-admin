import { useState } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { LayoutDashboard, Car, MessageSquare, LogOut, Menu, X } from "lucide-react";

const navItems = [
  { path: "/", icon: LayoutDashboard, label: "Dashboard" },
  { path: "/veiculos", icon: Car, label: "Veículos" },
  { path: "/leads", icon: MessageSquare, label: "Leads" },
];

export default function Layout() {
  const nav = useNavigate();
  const loc = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  function logout() {
    localStorage.removeItem("la_token");
    nav("/login");
  }

  function navTo(path) {
    nav(path);
    setMenuOpen(false);
  }

  return (
    <div className="layout">
      {/* Topbar mobile */}
      <header className="mobile-topbar">
        <div className="mobile-topbar-brand">
          <span>LA AUTOMÓVEIS</span>
        </div>
        <button className="mobile-menu-btn" onClick={() => setMenuOpen(o => !o)}>
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </header>

      {/* Overlay mobile */}
      {menuOpen && (
        <div className="mobile-overlay" onClick={() => setMenuOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${menuOpen ? "sidebar-open" : ""}`}>
        <div className="sidebar-logo">
          <span>LA AUTOMÓVEIS</span>
          <p>Painel Administrativo</p>
        </div>
        <nav>
          {navItems.map(({ path, icon: Icon, label }) => (
            <div
              key={path}
              className={`nav-item ${loc.pathname === path ? "active" : ""}`}
              onClick={() => navTo(path)}
            >
              <Icon size={16} />
              {label}
            </div>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="nav-item" onClick={logout}>
            <LogOut size={16} />
            Sair
          </div>
        </div>
      </aside>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}

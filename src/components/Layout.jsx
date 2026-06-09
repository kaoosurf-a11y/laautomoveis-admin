import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { LayoutDashboard, Car, MessageSquare, LogOut } from "lucide-react";

const navItems = [
  { path: "/", icon: LayoutDashboard, label: "Dashboard" },
  { path: "/veiculos", icon: Car, label: "Veículos" },
  { path: "/leads", icon: MessageSquare, label: "Leads" },
];

export default function Layout() {
  const nav = useNavigate();
  const loc = useLocation();

  function logout() {
    localStorage.removeItem("la_token");
    nav("/login");
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <span>LA AUTOMÓVEIS</span>
          <p>Painel Administrativo</p>
        </div>
        <nav>
          {navItems.map(({ path, icon: Icon, label }) => (
            <div
              key={path}
              className={`nav-item ${loc.pathname === path ? "active" : ""}`}
              onClick={() => nav(path)}
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

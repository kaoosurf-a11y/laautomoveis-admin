import { Routes, Route, Navigate } from "react-router-dom";
import { isLoggedIn, isManager } from "./auth.js";
import Layout from "./components/Layout.jsx";
import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import CRM from "./pages/CRM.jsx";
import FollowUps from "./pages/FollowUps.jsx";
import Agenda from "./pages/Agenda.jsx";
import Veiculos from "./pages/Veiculos.jsx";
import Equipe from "./pages/Equipe.jsx";
import ContatosPerdidos from "./pages/ContatosPerdidos.jsx";
import Clientes from "./pages/Clientes.jsx";
import Disparador from "./pages/Disparador.jsx";
import Status from "./pages/Status.jsx";
import Lojas from "./pages/Lojas.jsx";

function Priv({ children }) {
  if (!isLoggedIn()) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
}
function OwnerOnly({ children }) {
  if (!isLoggedIn()) return <Navigate to="/login" replace />;
  const u = JSON.parse(localStorage.getItem("la_user")||"{}");
  if (u.role === "vendedor") return <Navigate to="/crm" replace />;
  return <Layout>{children}</Layout>;
}
// AdminMasterOnly: mais restrito que OwnerOnly — bloqueia também gerente, não só
// vendedor. 2026-07-20: Clientes e Contatos perdidos ficaram admin_master-only por
// pedido explícito (Felipe só, por ora).
function AdminMasterOnly({ children }) {
  if (!isLoggedIn()) return <Navigate to="/login" replace />;
  const u = JSON.parse(localStorage.getItem("la_user")||"{}");
  if (u.role !== "admin_master") return <Navigate to="/crm" replace />;
  return <Layout>{children}</Layout>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={isLoggedIn() ? (isManager() ? <Navigate to="/dashboard" replace /> : <Navigate to="/crm" replace />) : <Navigate to="/login" replace />} />
      <Route path="/dashboard" element={<OwnerOnly><Dashboard /></OwnerOnly>} />
      <Route path="/crm"       element={<Priv><CRM /></Priv>} />
      <Route path="/followups" element={<Priv><FollowUps /></Priv>} />
      <Route path="/agenda"    element={<Priv><Agenda /></Priv>} />
      <Route path="/veiculos"  element={<Priv><Veiculos /></Priv>} />
      <Route path="/clientes"  element={<AdminMasterOnly><Clientes /></AdminMasterOnly>} />
      <Route path="/disparador" element={<OwnerOnly><Disparador /></OwnerOnly>} />
      <Route path="/status"     element={<OwnerOnly><Status /></OwnerOnly>} />
      <Route path="/equipe"    element={<OwnerOnly><Equipe /></OwnerOnly>} />
      <Route path="/lojas"     element={<OwnerOnly><Lojas /></OwnerOnly>} />
      <Route path="/contatos-perdidos" element={<AdminMasterOnly><ContatosPerdidos /></AdminMasterOnly>} />
      <Route path="*"          element={<Navigate to="/" replace />} />
    </Routes>
  );
}

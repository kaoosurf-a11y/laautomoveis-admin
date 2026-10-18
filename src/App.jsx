import { lazy, Suspense, useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { isLoggedIn, isManager, getUser } from "./auth.js";
import Layout from "./components/Layout.jsx";
import DialogHost from "./components/Dialog.jsx";
import Login from "./pages/Login.jsx";
// 2026-10-18: cada tela vira um pedaço separado do JS (React.lazy), pra abrir o painel
// no celular baixando só a tela aberta. Depois de abrir, as outras são baixadas em
// segundo plano (prebaixarTelas), então trocar de tela continua instantâneo.
// Se uma aba ficou aberta durante uma publicação, o pedaço antigo some do servidor:
// recarrega a página uma vez em vez de mostrar tela branca.
function tela(carregar) {
  const C = lazy(() => carregar().catch(err => {
    try {
      if (!sessionStorage.getItem("la_recarregou_tela")) {
        sessionStorage.setItem("la_recarregou_tela", "1");
        window.location.reload();
        return new Promise(() => {});
      }
    } catch {}
    throw err;
  }));
  C.carregar = carregar;
  return C;
}
const Dashboard = tela(() => import("./pages/Dashboard.jsx"));
const CRM = tela(() => import("./pages/CRM.jsx"));
const FollowUps = tela(() => import("./pages/FollowUps.jsx"));
const Agenda = tela(() => import("./pages/Agenda.jsx"));
const Veiculos = tela(() => import("./pages/Veiculos.jsx"));
const Equipe = tela(() => import("./pages/Equipe.jsx"));
const ContatosPerdidos = tela(() => import("./pages/ContatosPerdidos.jsx"));
const Clientes = tela(() => import("./pages/Clientes.jsx"));
const Disparador = tela(() => import("./pages/Disparador.jsx"));
const Status = tela(() => import("./pages/Status.jsx"));
const Lojas = tela(() => import("./pages/Lojas.jsx"));
const Campanha = tela(() => import("./pages/Campanha.jsx"));
const Envios = tela(() => import("./pages/Envios.jsx"));
const Mensal = tela(() => import("./pages/Mensal.jsx"));

const TELAS = [Dashboard, CRM, FollowUps, Agenda, Veiculos, Equipe, ContatosPerdidos, Clientes, Disparador, Status, Lojas, Campanha, Envios, Mensal];
function prebaixarTelas() {
  try { sessionStorage.removeItem("la_recarregou_tela"); } catch {}
  TELAS.forEach(t => t.carregar().catch(() => {}));
}

const carregandoTela = <div className="empty-state"><i className="ti ti-loader" style={{animation:"spin 1s linear infinite"}}/><p>Carregando...</p></div>;
function ComTela({ children }) {
  return <Layout><Suspense fallback={carregandoTela}>{children}</Suspense></Layout>;
}

function Priv({ children }) {
  if (!isLoggedIn()) return <Navigate to="/login" replace />;
  return <ComTela>{children}</ComTela>;
}
function OwnerOnly({ children }) {
  if (!isLoggedIn()) return <Navigate to="/login" replace />;
  const u = getUser() || {};
  if (u.role === "vendedor") return <Navigate to="/crm" replace />;
  return <ComTela>{children}</ComTela>;
}
// AdminMasterOnly: mais restrito que OwnerOnly — bloqueia também gerente, não só
// vendedor. 2026-07-20: Clientes e Contatos perdidos ficaram admin_master-only por
// pedido explícito (Felipe só, por ora).
function AdminMasterOnly({ children }) {
  if (!isLoggedIn()) return <Navigate to="/login" replace />;
  const u = getUser() || {};
  if (u.role !== "admin_master") return <Navigate to="/crm" replace />;
  return <ComTela>{children}</ComTela>;
}

export default function App() {
  useEffect(() => {
    const ocioso = window.requestIdleCallback || (fn => setTimeout(fn, 1500));
    const id = setTimeout(() => ocioso(prebaixarTelas), 2500);
    return () => clearTimeout(id);
  }, []);
  return (
    <>
    {/* Host único do confirmDialog()/alertDialog() (ver components/Dialog.jsx) — fora
        das <Routes> pra ficar disponível em qualquer página, montado uma vez só. */}
    <DialogHost/>
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={isLoggedIn() ? (isManager() ? <Navigate to="/dashboard" replace /> : <Navigate to="/crm" replace />) : <Navigate to="/login" replace />} />
      <Route path="/dashboard" element={<OwnerOnly><Dashboard /></OwnerOnly>} />
      <Route path="/mensal"    element={<AdminMasterOnly><Mensal /></AdminMasterOnly>} />
      <Route path="/crm"       element={<Priv><CRM /></Priv>} />
      <Route path="/followups" element={<Priv><FollowUps /></Priv>} />
      <Route path="/agenda"    element={<Priv><Agenda /></Priv>} />
      <Route path="/envios"    element={<AdminMasterOnly><Envios /></AdminMasterOnly>} />
      <Route path="/veiculos"  element={<Priv><Veiculos /></Priv>} />
      <Route path="/clientes"  element={<AdminMasterOnly><Clientes /></AdminMasterOnly>} />
      <Route path="/campanha"    element={<OwnerOnly><Campanha /></OwnerOnly>} />
      <Route path="/disparador" element={<OwnerOnly><Disparador /></OwnerOnly>} />
      <Route path="/status"     element={<OwnerOnly><Status /></OwnerOnly>} />
      <Route path="/equipe"    element={<OwnerOnly><Equipe /></OwnerOnly>} />
      <Route path="/lojas"     element={<OwnerOnly><Lojas /></OwnerOnly>} />
      <Route path="/contatos-perdidos" element={<AdminMasterOnly><ContatosPerdidos /></AdminMasterOnly>} />
      <Route path="*"          element={<Navigate to="/" replace />} />
    </Routes>
    </>
  );
}

import { Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login.jsx";
import Layout from "./components/Layout.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Veiculos from "./pages/Veiculos.jsx";
import Leads from "./pages/Leads.jsx";

function PrivateRoute({ children }) {
  const token = localStorage.getItem("la_token");
  return token ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="veiculos" element={<Veiculos />} />
        <Route path="leads" element={<Leads />} />
      </Route>
    </Routes>
  );
}

import { getToken, logout } from "../auth.js";

const BASE = import.meta.env.VITE_API_URL || "https://api.laautomoveis.com.br";

function token() {
  return getToken();
}

function headers(isFormData = false) {
  const h = { Authorization: `Bearer ${token()}` };
  if (!isFormData) h["Content-Type"] = "application/json";
  return h;
}

async function req(method, path, body, isFormData = false) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: headers(isFormData),
    body: body ? (isFormData ? body : JSON.stringify(body)) : undefined,
  });
  if (res.status === 401) {
    logout();
    window.location.href = "/admin/";
    return;
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Erro na requisição");
  return data;
}

export const api = {
  login: (email, senha) =>
    req("POST", "/api/admin/login", { email, senha }),

  me: () => req("GET", "/api/admin/me"),

  // Veículos — rota de admin traz TODOS (inclusive ativo=false), a pública só traz ativos
  getVeiculos: () => req("GET", "/api/veiculos/admin/todos"),
  getVeiculo: (id) => req("GET", `/api/veiculos/${id}`),
  criarVeiculo: (data) => req("POST", "/api/veiculos", data),
  editarVeiculo: (id, data) => req("PUT", `/api/veiculos/${id}`, data),
  removerVeiculo: (id) => req("DELETE", `/api/veiculos/${id}`),

  // Upload
  uploadFotos: (formData) => req("POST", "/api/upload/fotos", formData, true),

  // Leads
  getLeadsContato: () => req("GET", "/api/leads/contato"),
  getLeadsFinanciamento: () => req("GET", "/api/leads/financiamento"),
  marcarLidoContato: (id) => req("PATCH", `/api/leads/contato/${id}/lido`),
  marcarLidoFinanciamento: (id) => req("PATCH", `/api/leads/financiamento/${id}/lido`),

  // Equipe
  getUsers: () => req("GET", "/api/admin/users"),
};

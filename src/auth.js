const API = import.meta.env.VITE_API_URL || "https://api.laautomoveis.com.br";
const TOKEN_KEY   = "la_token";
const USER_KEY    = "la_user";
const PERSIST_KEY = "la_persist"; // "1" = manter conectado

// Usa localStorage se "manter conectado", senão sessionStorage (apaga ao fechar aba)
function store() {
  return localStorage.getItem(PERSIST_KEY) === "1" ? localStorage : sessionStorage;
}
function saveSession(token, user, persist) {
  if (persist) localStorage.setItem(PERSIST_KEY, "1");
  else         localStorage.removeItem(PERSIST_KEY);
  store().setItem(TOKEN_KEY, token);
  store().setItem(USER_KEY, JSON.stringify(user));
}

export async function login(usuario, senha, persist = false) {
  const u = usuario.toLowerCase().trim();
  try {
    const res = await fetch(`${API}/api/admin/login`, {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ usuario: u, senha }),
    });
    const data = await res.json();
    if (!res.ok) return { ok:false, erro: data.error || "E-mail ou senha incorretos" };
    saveSession(data.token, data.user, persist);
    return { ok:true, user:data.user };
  } catch(_) {
    return { ok:false, erro:"Não foi possível conectar ao servidor. Tente novamente." };
  }
}

export function logout() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(PERSIST_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
}
export function getToken()   { return store().getItem(TOKEN_KEY); }
export function getUser()    { try { return JSON.parse(store().getItem(USER_KEY)||""); } catch { return null; } }
export function isLoggedIn() { return !!getToken() && !!getUser(); }
export function getRole()    { return getUser()?.role || "agent"; }
export function isOwner()    { return getRole() === "owner"; }
export function isManager()  { return ["owner","manager"].includes(getRole()); }
export function authHeaders(){ return { "Content-Type":"application/json", "Authorization":`Bearer ${getToken()}` }; }

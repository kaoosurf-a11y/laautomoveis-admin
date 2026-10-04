const API = import.meta.env.VITE_API_URL || "https://api.laautomoveis.com.br";
const TOKEN_KEY   = "la_token";
const USER_KEY    = "la_user";
const PERSIST_KEY = "la_persist"; // "1" = manter conectado
// "Ver como" (só o dono): a sessão do dono fica guardada nestas chaves enquanto ele
// olha o painel como outro usuário, e volta pro lugar em voltarParaMim().
const TOKEN_ORIG  = "la_token_dono";
const USER_ORIG   = "la_user_dono";

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
  [localStorage, sessionStorage].forEach(s => { s.removeItem(TOKEN_ORIG); s.removeItem(USER_ORIG); });
}

// Abre o painel como outro usuário (o backend só aceita do dono). Guarda a sessão do
// dono e troca pela do usuário escolhido; quem chama recarrega a página em seguida.
export async function verComo(id) {
  if (estaVendoComo()) return { ok:false, erro:"Volte para o seu usuário antes de ver como outro." };
  try {
    const res = await fetch(`${API}/api/admin/ver-como/${id}`, { method:"POST", headers: authHeaders() });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok:false, erro: data.error || "Não foi possível abrir como esse usuário." };
    const s = store();
    s.setItem(TOKEN_ORIG, s.getItem(TOKEN_KEY));
    s.setItem(USER_ORIG, s.getItem(USER_KEY));
    s.setItem(TOKEN_KEY, data.token);
    s.setItem(USER_KEY, JSON.stringify(data.user));
    return { ok:true, user:data.user };
  } catch(_) {
    return { ok:false, erro:"Não foi possível conectar ao servidor. Tente novamente." };
  }
}
export function estaVendoComo() { return !!store().getItem(TOKEN_ORIG); }
export function getDono()       { try { return JSON.parse(store().getItem(USER_ORIG)||""); } catch { return null; } }
export function voltarParaMim() {
  const s = store();
  const t = s.getItem(TOKEN_ORIG), u = s.getItem(USER_ORIG);
  if (!t || !u) return false;
  s.setItem(TOKEN_KEY, t); s.setItem(USER_KEY, u);
  s.removeItem(TOKEN_ORIG); s.removeItem(USER_ORIG);
  return true;
}
export function getToken()   { return store().getItem(TOKEN_KEY); }
export function getUser()    { try { return JSON.parse(store().getItem(USER_KEY)||""); } catch { return null; } }
export function isLoggedIn() { return !!getToken() && !!getUser(); }
export function getRole()    { return getUser()?.role || "vendedor"; }
export function isOwner()    { return getRole() === "admin_master"; }
export function isManager()  { return ["admin_master","gerente"].includes(getRole()); }
export function authHeaders(){ return { "Content-Type":"application/json", "Authorization":`Bearer ${getToken()}` }; }

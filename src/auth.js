const API = import.meta.env.VITE_API_URL || "https://api.laautomoveis.com.br";
const TOKEN_KEY = "la_token";
const USER_KEY  = "la_user";

const MOCK_USERS = {
  felipe:  { id:1, nome:"Felipe",  iniciais:"FE", role:"owner",   senha:"LA@2025" },
  diana:   { id:2, nome:"Diana",   iniciais:"DI", role:"owner",   senha:"LA@2025" },
  wilhian: { id:3, nome:"Wilhian", iniciais:"WI", role:"manager", senha:"LA@2025" },
  dariana: { id:4, nome:"Dariana", iniciais:"DA", role:"agent",   senha:"LA@2025" },
  alex:    { id:5, nome:"Alex",    iniciais:"AL", role:"agent",   senha:"LA@2025" },
  wolni:   { id:6, nome:"Wolni",   iniciais:"WO", role:"agent",   senha:"LA@2025" },
};

export async function login(usuario, senha) {
  const u = usuario.toLowerCase().trim();
  try {
    const res = await fetch(`${API}/api/auth/login`, {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ usuario: u, senha }),
    });
    if (res.ok) {
      const data = await res.json();
      localStorage.setItem(TOKEN_KEY, data.token);
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      return { ok:true, user:data.user };
    }
  } catch(_) {}
  const mock = MOCK_USERS[u];
  if (!mock || mock.senha !== senha) return { ok:false, erro:"Usuário ou senha incorretos" };
  const user = { id:mock.id, nome:mock.nome, iniciais:mock.iniciais, role:mock.role, usuario:u };
  const h = btoa(JSON.stringify({alg:"HS256",typ:"JWT"}));
  const p = btoa(JSON.stringify(user));
  localStorage.setItem(TOKEN_KEY, `${h}.${p}.mock`);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  return { ok:true, user };
}

export function logout() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}
export function getToken()    { return localStorage.getItem(TOKEN_KEY); }
export function getUser()     { try { return JSON.parse(localStorage.getItem(USER_KEY)||""); } catch { return null; } }
export function isLoggedIn()  { return !!getToken() && !!getUser(); }
export function getRole()     { return getUser()?.role || "agent"; }
export function isOwner()     { return getRole() === "owner"; }
export function isManager()   { return ["owner","manager"].includes(getRole()); }
export function authHeaders() { return { "Content-Type":"application/json", "Authorization":`Bearer ${getToken()}` }; }

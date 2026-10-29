// Uso do app (2026-10-29, Felipe): registra quando cada pessoa abre o painel e quanto tempo fica.
// Abre uma sessão quando a tela fica visível, manda sinal a cada minuto só enquanto está visível
// e fecha quando o app vai pro fundo ou a tela bloqueia. O backend ignora o "Ver como".
// Falha de rede nunca aparece pro usuário: o registro é só pra o dono acompanhar.
import { authHeaders, isLoggedIn } from "../auth.js";

const API = import.meta.env.VITE_API_URL || "https://api.laautomoveis.com.br";
const MINUTO = 60 * 1000;
let sessao = null, abrindo = false, timer = null;

const tela = () => window.location.pathname.split("/")[1] || "inicio";
const visivel = () => document.visibilityState === "visible";

function post(caminho, corpo, keepalive = false) {
  return fetch(`${API}/api/uso/${caminho}`, { method: "POST", headers: authHeaders(), body: JSON.stringify(corpo), keepalive })
    .then(r => (r.ok ? r.json() : null)).catch(() => null);
}

async function abrir() {
  if (abrindo || sessao || !isLoggedIn() || !visivel()) return;
  abrindo = true;
  const r = await post("abrir", { tela: tela() });
  sessao = r?.id || null;
  abrindo = false;
}

async function sinal() {
  if (!isLoggedIn() || !visivel()) return;
  if (!sessao) return abrir();
  const r = await post("sinal", { id: sessao, tela: tela() });
  if (r?.nova) { sessao = null; abrir(); }
}

function fechar() {
  if (sessao) post("fechar", { id: sessao }, true);
  sessao = null;
}

function mudou() {
  clearInterval(timer);
  if (visivel()) { abrir(); timer = setInterval(sinal, MINUTO); }
  else fechar();
}

export function iniciarUso() {
  document.addEventListener("visibilitychange", mudou);
  window.addEventListener("pagehide", fechar);
  mudou();
}

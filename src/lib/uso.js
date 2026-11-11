// Uso do app (2026-10-29, Felipe): registra quando cada pessoa abre o painel e quanto tempo fica.
// Abre uma sessão quando a tela fica visível, manda sinal a cada minuto só enquanto está visível
// e fecha quando o app vai pro fundo ou a tela bloqueia. O backend ignora o "Ver como".
// Falha de rede nunca aparece pro usuário: o registro é só pra o dono acompanhar.
// 2026-11-11 (Felipe): aba aberta com o PC parado contava tempo (Matheus, 18h seguidas de 06 pra
// 07/11). Depois de 10 min sem mouse, teclado ou toque o sinal para; o backend fecha a sessão no
// último sinal. Ao mexer de novo volta a contar na hora.
import { authHeaders, isLoggedIn } from "../auth.js";

const API = import.meta.env.VITE_API_URL || "https://api.laautomoveis.com.br";
const MINUTO = 60 * 1000;
const PARADO = 10 * MINUTO;
let sessao = null, abrindo = false, timer = null, ultimaAcao = Date.now();

const tela = () => window.location.pathname.split("/")[1] || "inicio";
const visivel = () => document.visibilityState === "visible";
const parado = () => Date.now() - ultimaAcao > PARADO;

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
  if (parado()) { sessao = null; return; }
  if (!sessao) return abrir();
  const r = await post("sinal", { id: sessao, tela: tela() });
  if (r?.nova) { sessao = null; abrir(); }
}

function fechar() {
  if (sessao) post("fechar", { id: sessao }, true);
  sessao = null;
}

function mexeu() {
  const voltou = parado();
  ultimaAcao = Date.now();
  if (voltou) sinal();
}

function mudou() {
  clearInterval(timer);
  if (visivel()) { ultimaAcao = Date.now(); abrir(); timer = setInterval(sinal, MINUTO); }
  else fechar();
}

export function iniciarUso() {
  document.addEventListener("visibilitychange", mudou);
  window.addEventListener("pagehide", fechar);
  for (const ev of ["pointerdown", "pointermove", "keydown", "wheel", "touchstart"])
    window.addEventListener(ev, mexeu, { passive: true, capture: true });
  mudou();
}

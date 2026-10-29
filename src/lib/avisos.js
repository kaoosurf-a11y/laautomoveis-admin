// 2026-10-28 (Felipe): avisos do app no celular e no PC (aparecem por cima e com a tela bloqueada).
// O aparelho fica ligado ao usuário logado; ao sair do painel, ele para de receber.
import { getToken, estaVendoComo } from "../auth.js";
import { rodandoComoApp, ehIphone } from "./instalarApp.js";

const BASE = import.meta.env.VITE_API_URL || "https://api.laautomoveis.com.br";
const ouvintes = new Set();
const avisar = () => ouvintes.forEach(f => f());
export function aoMudarAvisos(f) { ouvintes.add(f); return () => ouvintes.delete(f); }

const suporta = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

async function api(path, body) {
  const r = await fetch(`${BASE}/api/push${path}`, {
    method: body ? "POST" : "GET",
    headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Erro nos avisos");
  return r.json();
}

let registro = null;
export function registrarServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("/sw.js", { scope: "/" })
    .then(r => { registro = r; avisar(); })
    .catch(e => console.warn("avisos: service worker não registrou", e));
  // Toque num aviso com o painel já aberto: o service worker pede pra ir pra tela do aviso.
  navigator.serviceWorker.addEventListener("message", e => {
    if (e.data?.tipo === "abrir" && e.data.url) window.dispatchEvent(new CustomEvent("la-abrir", { detail: e.data.url }));
  });
}

// navigator.serviceWorker.ready nunca termina se o registro falhou: espera no máximo 8 s.
const pronto = async () => registro || (registro = await Promise.race([
  navigator.serviceWorker.ready,
  new Promise((_, n) => setTimeout(() => n(new Error("service worker não ficou pronto")), 8000)),
]));

// "sem-suporte" | "precisa-app" (iPhone fora do app) | "negado" | "desligado" | "ligado"
export async function estadoAvisos() {
  if (ehIphone() && !rodandoComoApp()) return "precisa-app";
  if (!suporta()) return "sem-suporte";
  if (Notification.permission === "denied") return "negado";
  if (Notification.permission !== "granted") return "desligado";
  const r = await pronto().catch(() => null);
  const s = await r?.pushManager.getSubscription().catch(() => null);
  return s ? "ligado" : "desligado";
}

function chaveBytes(b64) {
  const p = (b64 + "=".repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(p), c => c.charCodeAt(0));
}

async function inscrever() {
  const r = await pronto();
  let s = await r.pushManager.getSubscription();
  if (!s) {
    const { chave } = await api("/chave");
    s = await r.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chaveBytes(chave) });
  }
  await api("/inscrever", { inscricao: s.toJSON() });
}

// 2026-10-29 (Felipe): um botão só liga e desliga. Quem desligou fica desligado (o painel não religa sozinho ao abrir).
const DESLIGOU = "la_avisos_desligados";
export function desligouDeProposito() { try { return localStorage.getItem(DESLIGOU) === "1"; } catch { return false; } }

// Precisa vir de um toque (o navegador só pede a permissão assim).
export async function ativarAvisos() {
  try { localStorage.removeItem(DESLIGOU); } catch {}
  const p = await Notification.requestPermission();
  if (p !== "granted") { avisar(); return false; }
  await inscrever();
  avisar();
  return true;
}

// Ao abrir o painel logado: se este aparelho já tinha permissão, garante que está ligado a este usuário.
// No "Ver como" não mexe: o aparelho é do dono e não pode passar a receber os avisos de quem ele está olhando.
export async function sincronizarAvisos() {
  try { if (suporta() && Notification.permission === "granted" && getToken() && !estaVendoComo() && !desligouDeProposito()) { await inscrever(); avisar(); } }
  catch (e) { console.warn("avisos: não sincronizou", e); }
}

export async function testarAvisos() { return api("/teste", {}); }

// Desliga os avisos neste aparelho (pelo botão do menu).
export async function desligarAvisos() {
  try { localStorage.setItem(DESLIGOU, "1"); } catch {}
  await desligarAvisosDoAparelho();
  try { const s = await (await pronto()).pushManager.getSubscription(); await s?.unsubscribe(); } catch {}
  avisar();
}

// Antes de sair: desliga o aparelho deste usuário (outro que logar no mesmo celular não recebe os avisos dele).
export async function desligarAvisosDoAparelho() {
  try {
    if (!suporta() || !getToken()) return;
    const r = await pronto();
    const s = await r.pushManager.getSubscription();
    if (s) await api("/sair", { endpoint: s.endpoint });
  } catch {}
}

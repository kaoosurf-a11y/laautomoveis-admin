// 2026-10-28 (Felipe): botão "Baixar o app" pra todos os usuários.
// Android/Chrome/Edge: o navegador avisa (beforeinstallprompt) e o botão abre a instalação.
// iPhone (Safari) não tem esse aviso: o botão mostra o passo a passo do "Adicionar à Tela de Início".
let pedido = null;
const ouvintes = new Set();
const avisar = () => ouvintes.forEach(f => f());

// 2026-10-29 (Felipe: pediu pra baixar de novo depois de já ter baixado): guarda que o app já foi
// instalado neste aparelho. No Android e no PC o app e o navegador dividem a mesma memória, então a
// aba do navegador para de oferecer o app. No iPhone o Safari não enxerga o app (memória separada).
const INSTALADO = "la_app_instalado";
export function marcarInstalado() { try { localStorage.setItem(INSTALADO, "1"); } catch {} }

export function ouvirInstalacao() {
  if (rodandoComoApp()) marcarInstalado();
  window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); pedido = e; avisar(); });
  window.addEventListener("appinstalled", () => { pedido = null; marcarInstalado(); avisar(); });
}

// Já tem o app neste aparelho (aberto como app agora ou instalado antes por este navegador).
export function jaTemApp() {
  if (rodandoComoApp()) return true;
  try { return localStorage.getItem(INSTALADO) === "1"; } catch { return false; }
}

export function aoMudarInstalacao(f) { ouvintes.add(f); return () => ouvintes.delete(f); }

// Já está aberto como app (tela inicial): não mostra o botão.
export function rodandoComoApp() {
  try { return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true; }
  catch { return false; }
}

export function podeInstalarDireto() { return !!pedido; }

export function ehIphone() {
  const ua = navigator.userAgent || "";
  return /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

// Abre a instalação do navegador. Devolve true se abriu, false se precisa mostrar o passo a passo.
export async function instalarApp() {
  if (!pedido) return false;
  const p = pedido; pedido = null;
  p.prompt();
  let ok = false;
  try { ok = (await p.userChoice)?.outcome === "accepted"; } catch {}
  if (ok) marcarInstalado();
  avisar();
  return true;
}

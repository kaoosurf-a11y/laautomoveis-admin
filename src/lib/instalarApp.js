// 2026-10-28 (Felipe): botão "Baixar o app" pra todos os usuários.
// Android/Chrome/Edge: o navegador avisa (beforeinstallprompt) e o botão abre a instalação.
// iPhone (Safari) não tem esse aviso: o botão mostra o passo a passo do "Adicionar à Tela de Início".
let pedido = null;
const ouvintes = new Set();
const avisar = () => ouvintes.forEach(f => f());

export function ouvirInstalacao() {
  window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); pedido = e; avisar(); });
  window.addEventListener("appinstalled", () => { pedido = null; avisar(); });
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
  try { await p.userChoice; } catch {}
  avisar();
  return true;
}

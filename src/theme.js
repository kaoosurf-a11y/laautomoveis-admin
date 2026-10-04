// Tema do painel (claro/escuro). Só aparência: guarda a escolha no aparelho e
// troca o atributo data-theme do <html>, que o index.css usa pra trocar as cores.
// Padrão é o escuro (identidade do painel); o claro é opção de quem preferir.
const CHAVE = "la_tema";
const COR_BARRA = { dark: "#0c0c0a", light: "#f2f2f7" };

export function getTema() {
  try { return localStorage.getItem(CHAVE) === "light" ? "light" : "dark"; } catch { return "dark"; }
}

export function aplicarTema(tema) {
  document.documentElement.setAttribute("data-theme", tema);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", COR_BARRA[tema]);
}

export function alternarTema() {
  const novo = getTema() === "light" ? "dark" : "light";
  try { localStorage.setItem(CHAVE, novo); } catch { /* aparelho sem storage: vale só nesta visita */ }
  aplicarTema(novo);
  return novo;
}

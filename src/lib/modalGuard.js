import { confirmDialog } from "../components/Dialog.jsx";

// 2026-10-07 (Felipe): comportamento único pra TODAS as janelas (.modal-overlay) do painel,
// sem precisar mexer em cada tela:
//  - ESC fecha a janela de cima (se o cursor está num campo, o primeiro ESC só sai do campo);
//  - X do cabeçalho, clique fora e botões marcados com data-fechar passam pelo mesmo aviso;
//  - se há dado alterado e não salvo, pergunta antes de fechar.
// "Alterado e não salvo":
//  - janela comum (formulário com botão de salvar): qualquer campo mexido desde que abriu;
//  - janela com data-autosave (detalhe do lead, onde cada campo salva sozinho ou tem o seu
//    botão ✓): só quando existe um ✓ pendente na tela.
// Fechar de verdade = clicar no fundo da janela, que é como toda janela do painel já fecha.

const ehDialogo = ov => ov?.hasAttribute("data-dialog");
const janelaDeCima = () => {
  // o aviso/confirmação (data-dialog) fica sempre por cima, mesmo vindo antes na página
  const dialogo = document.querySelector(".modal-overlay[data-dialog]");
  if (dialogo) return dialogo;
  const todas = document.querySelectorAll(".modal-overlay");
  return todas.length ? todas[todas.length - 1] : null;
};
function temPendencia(ov) {
  const m = ov.querySelector(".modal");
  if (!m) return false;
  if (m.hasAttribute("data-autosave")) return !!m.querySelector(".btn-primary .ti-check");
  return ov.dataset.mexido === "1";
}
function fecharDeVerdade(ov) {
  ov.dataset.liberado = "1";
  ov.click();
  // se a janela continuar aberta por algum motivo, o próximo clique volta a ser conferido
  setTimeout(() => { if (ov.isConnected) delete ov.dataset.liberado; }, 0);
}
let perguntando = false;
async function pedirFechar(ov) {
  if (!ov || perguntando) return;
  if (temPendencia(ov)) {
    perguntando = true;
    const ok = await confirmDialog("Você alterou dados que ainda não foram salvos.\nSe fechar agora, a alteração se perde.", {
      title: "Fechar sem salvar?", danger: true, confirmLabel: "Fechar sem salvar", cancelLabel: "Continuar editando",
    });
    perguntando = false;
    if (!ok || !ov.isConnected) return;
    delete ov.dataset.mexido;
  }
  fecharDeVerdade(ov);
}

// 2026-10-18 (Felipe: "qualquer submenu fecha com ESC no PC, com o voltar no celular, e sempre o X"):
// camadas que abrem por cima da tela = janelas (.modal-overlay, inclusive avisos) e a gaveta do menu
// no celular (.sidebar-overlay.show). Cada camada aberta ganha uma entrada no histórico do navegador;
// o voltar do Android (ou o gesto de voltar do iPhone) fecha a camada de cima em vez de sair da tela.
const camadasAbertas = () => [...document.querySelectorAll(".modal-overlay, .sidebar-overlay.show")];
let empilhadas = 0;       // entradas que este código pôs no histórico e ainda não saíram
let ignorarVolta = 0;     // history.back() feitos por nós (camada fechada pelo X/ESC/clique)
function fecharCamada(ov) {
  if (ov.classList.contains("sidebar-overlay")) { ov.click(); return; }
  if (ehDialogo(ov)) { (ov.querySelector(".btn-ghost") || ov.querySelector(".btn"))?.click(); return; }
  pedirFechar(ov);
}
function sincronizarHistorico() {
  const abertas = camadasAbertas().length;
  while (empilhadas < abertas) {
    history.pushState({ ...(history.state || {}), laCamada: true }, "");
    empilhadas++;
  }
  while (empilhadas > abertas) {
    empilhadas--;
    // só volta se ainda estamos na entrada que nós criamos (se a tela mudou de rota, não mexe)
    if (history.state?.laCamada) { ignorarVolta++; history.back(); }
  }
}

export function instalarModalGuard() {
  if (window.__laModalGuard) return;
  window.__laModalGuard = true;

  let agendado = false;
  new MutationObserver(() => {
    if (agendado) return;
    agendado = true;
    requestAnimationFrame(() => { agendado = false; sincronizarHistorico(); });
  }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });

  window.addEventListener("popstate", () => {
    if (ignorarVolta > 0) { ignorarVolta--; return; }
    if (empilhadas === 0) return;
    empilhadas--;
    const ov = janelaDeCima() || document.querySelector(".sidebar-overlay.show");
    // se a pessoa desistir de fechar (dado não salvo), o observador empilha de novo
    if (ov) fecharCamada(ov);
  });

  document.addEventListener("input", e => {
    const ov = e.target.closest?.(".modal-overlay");
    if (ov && !ehDialogo(ov)) ov.dataset.mexido = "1";
  }, true);

  document.addEventListener("keydown", e => {
    if (e.key !== "Escape" || e.defaultPrevented) return;
    const ov = janelaDeCima();
    if (!ov) { document.querySelector(".sidebar-overlay.show")?.click(); return; }
    if (ehDialogo(ov)) {
      // confirmação: ESC = cancelar; aviso simples: ESC = OK
      const cancelar = ov.querySelector(".btn-ghost") || ov.querySelector(".btn");
      cancelar?.click();
      return;
    }
    const a = document.activeElement;
    if (a && ov.contains(a) && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) { a.blur(); return; }
    pedirFechar(ov);
  });

  document.addEventListener("click", e => {
    const ov = e.target.closest?.(".modal-overlay");
    if (!ov || ehDialogo(ov)) return;
    if (ov.dataset.liberado === "1") return;
    const noFundo = e.target === ov;
    const botao = e.target.closest("button");
    const noX = botao && botao.closest(".modal-header") && botao.querySelector(".ti-x") && !botao.classList.contains("btn");
    const marcado = botao?.hasAttribute("data-fechar");
    if (!(noFundo || noX || marcado)) return;
    if (!temPendencia(ov)) return;
    e.preventDefault();
    e.stopPropagation();
    pedirFechar(ov);
  }, true);
}

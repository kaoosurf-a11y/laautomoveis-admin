import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { aoMudarInstalacao, rodandoComoApp, instalarApp, ehIphone } from "../lib/instalarApp.js";

// 2026-10-28 (Felipe): "Baixar o app" pra todos (menu lateral e tela de login).
// Some quando o painel já está aberto como app.
export default function BaixarApp({ tipo = "nav", onAbrir }) {
  const [, setV] = useState(0);
  const [ajuda, setAjuda] = useState(false);
  useEffect(() => aoMudarInstalacao(() => setV(v => v + 1)), []);
  if (rodandoComoApp()) return null;

  async function clicar() {
    onAbrir?.();
    if (!(await instalarApp())) setAjuda(true);
  }

  return (
    <>
      {tipo === "login"
        ? <button type="button" className="btn btn-ghost baixar-app-login" onClick={clicar}>
            <i className="ti ti-device-mobile"/> Baixar o app da LA
          </button>
        : <button type="button" className="nav-item tema-item baixar-app-item" onClick={clicar}>
            <i className="ti ti-device-mobile"/><span>Baixar o app</span>
          </button>}
      {/* portal: o menu lateral do celular tem transform, e o modal dentro dele ficaria preso nele */}
      {ajuda && createPortal(<AjudaInstalar onClose={() => setAjuda(false)}/>, document.body)}
    </>
  );
}

function AjudaInstalar({ onClose }) {
  const iphone = ehIphone();
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{maxWidth:400}} onClick={e => e.stopPropagation()}>
        <div className="modal-handle"/>
        <div className="modal-header">
          <h2 className="modal-title">Baixar o app</h2>
          <button className="icon-btn" aria-label="Fechar" onClick={onClose}><i className="ti ti-x"/></button>
        </div>
        <div className="baixar-app-topo">
          <img src="/icon-192.png?v=2" alt="" width="56" height="56"/>
          <div>O painel vira um app na tela inicial do celular e abre em tela cheia, sem a barra do navegador.</div>
        </div>
        {iphone
          ? <ol className="baixar-app-passos">
              <li>Abra este painel no <b>Safari</b>.</li>
              <li>Toque em <b>Compartilhar</b> (o quadrado com a seta pra cima, embaixo da tela).</li>
              <li>Escolha <b>Adicionar à Tela de Início</b> e toque em <b>Adicionar</b>.</li>
            </ol>
          : <ol className="baixar-app-passos">
              <li>Abra este painel no <b>Chrome</b>.</li>
              <li>Toque nos <b>3 pontinhos</b> no canto de cima.</li>
              <li>Escolha <b>Instalar app</b> ou <b>Adicionar à tela inicial</b> e confirme.</li>
              <li>No computador: clique no ícone de instalar na barra de endereço.</li>
            </ol>}
        <button type="button" className="btn btn-primary" style={{width:"100%"}} onClick={onClose}>Entendi</button>
      </div>
    </div>
  );
}

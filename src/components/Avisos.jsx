import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { estadoAvisos, ativarAvisos, testarAvisos, desligarAvisos, desligouDeProposito, aoMudarAvisos } from "../lib/avisos.js";
import { estaVendoComo } from "../auth.js";
import { aoMudarInstalacao, instalarApp } from "../lib/instalarApp.js";

// 2026-10-28 (Felipe): avisos do app pra todos (lead novo, mensagem do cliente, agendamento, cliente esperando).
// tipo "nav": linha no rodapé do menu. tipo "faixa": faixa no topo até a pessoa ativar (fecha por sessão).
// 2026-10-29 (Felipe): no menu é um botão só que liga e desliga (sem "Testar"; ao ligar já chega um aviso de teste).
// No "Ver como" o botão fica travado: o aparelho é do dono, não da pessoa que ele está olhando.
function useEstado() {
  const [estado, setEstado] = useState(null);
  useEffect(() => {
    const ler = () => estadoAvisos().then(setEstado).catch(() => setEstado("sem-suporte"));
    ler();
    const a = aoMudarAvisos(ler), b = aoMudarInstalacao(ler);
    document.addEventListener("visibilitychange", ler);
    return () => { a(); b(); document.removeEventListener("visibilitychange", ler); };
  }, []);
  return estado;
}

export default function Avisos({ tipo = "nav", onAbrir }) {
  const estado = useEstado();
  const [ajuda, setAjuda] = useState(null);
  const [msg, setMsg] = useState(null);
  const lerFechada = () => { try { return sessionStorage.getItem("la_faixa_avisos") === "1"; } catch { return false; } };
  const [fechada, setFechada] = useState(lerFechada);
  // 2026-10-29: o passo a passo da primeira vez já pede os avisos; a faixa não aparece junto (um pedido por vez).
  useEffect(() => {
    const f = () => setFechada(lerFechada());
    window.addEventListener("la-faixa-avisos", f);
    return () => window.removeEventListener("la-faixa-avisos", f);
  }, []);
  const [ocupado, setOcupado] = useState(false);
  if (!estado || estado === "sem-suporte") return null;
  const vendoComo = estaVendoComo();

  async function ligar() {
    if (estado === "precisa-app") { onAbrir?.(); if (!(await instalarApp())) setAjuda("iphone"); return; }
    if (estado === "negado") { onAbrir?.(); setAjuda("negado"); return; }
    try {
      const ok = await ativarAvisos();
      if (!ok) setAjuda("negado");
      else { setMsg("Avisos ligados"); testarAvisos().catch(() => {}); }
    } catch { setMsg("Não deu pra ligar agora. Tente de novo."); }
  }
  async function alternar() {
    if (vendoComo || ocupado) return;
    setOcupado(true); setMsg(null);
    try {
      if (estado === "ligado") { await desligarAvisos(); setMsg("Avisos desligados"); }
      else await ligar();
    } finally { setOcupado(false); setTimeout(() => setMsg(null), 4000); }
  }

  const modal = ajuda && createPortal(<AjudaAvisos tipo={ajuda} onClose={() => setAjuda(null)}/>, document.body);

  if (tipo === "faixa") {
    if (estado === "ligado" || fechada || vendoComo || desligouDeProposito()) return modal || null;
    const fechar = () => { setFechada(true); try { sessionStorage.setItem("la_faixa_avisos", "1"); } catch {} };
    return (
      <>
        <div className="avisos-faixa">
          <i className="ti ti-bell"/>
          <span>{estado === "precisa-app" ? "Baixe o app pra receber os avisos." : "Ative os avisos de lead e cliente."}</span>
          <button type="button" className="btn btn-primary btn-sm" onClick={ligar}>{estado === "precisa-app" ? "Como baixar" : "Ativar"}</button>
          <button type="button" className="icon-btn" aria-label="Fechar" onClick={fechar}><i className="ti ti-x"/></button>
        </div>
        {modal}
      </>
    );
  }

  const ligado = estado === "ligado";
  const texto = vendoComo ? "Avisos: só no seu usuário"
    : msg || (ligado ? "Avisos ligados" : estado === "negado" ? "Avisos bloqueados" : "Avisos desligados");
  return (
    <>
      <button type="button" className={`nav-item tema-item avisos-botao${ligado ? " ligado" : ""}`} role="switch" aria-checked={ligado}
        disabled={vendoComo} title={vendoComo ? "Volte pro seu usuário pra ligar ou desligar os avisos deste aparelho" : undefined} onClick={alternar}>
        <i className={ligado ? "ti ti-bell" : "ti ti-bell-off"}/><span>{texto}</span>
        {!vendoComo && <span className="avisos-chave" aria-hidden="true">{ocupado ? <span className="spinner"/> : <span className="avisos-bolinha"/>}</span>}
      </button>
      {modal}
    </>
  );
}

function AjudaAvisos({ tipo, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{maxWidth:400}} onClick={e => e.stopPropagation()}>
        <div className="modal-handle"/>
        <div className="modal-header">
          <h2 className="modal-title">{tipo === "iphone" ? "Avisos no iPhone" : "Liberar os avisos"}</h2>
          <button className="icon-btn" aria-label="Fechar" onClick={onClose}><i className="ti ti-x"/></button>
        </div>
        {tipo === "iphone"
          ? <ol className="baixar-app-passos">
              <li>No iPhone os avisos só chegam pelo app. Abra este painel no <b>Safari</b>.</li>
              <li>Toque em <b>Compartilhar</b> e em <b>Adicionar à Tela de Início</b>.</li>
              <li>Abra o app <b>LA Painel</b> pela tela inicial, entre e toque em <b>Ativar avisos</b>.</li>
              <li>Em Ajustes &gt; Notificações &gt; LA Painel, deixe <b>Tela Bloqueada</b> e <b>Faixas</b> ligados.</li>
            </ol>
          : <ol className="baixar-app-passos">
              <li>Os avisos foram bloqueados neste aparelho.</li>
              <li><b>Android:</b> segure o ícone do app LA Painel, toque em <b>Informações do app &gt; Notificações</b> e ligue tudo (inclusive <b>Pop-up</b> e <b>Tela de bloqueio</b>).</li>
              <li><b>Chrome no PC:</b> clique no cadeado ao lado do endereço, em <b>Notificações</b> escolha <b>Permitir</b>.</li>
              <li><b>iPhone:</b> Ajustes &gt; Notificações &gt; LA Painel e ligue <b>Permitir Notificações</b>.</li>
              <li>Depois volte aqui e toque em <b>Ativar avisos</b>.</li>
            </ol>}
        <button type="button" className="btn btn-primary" style={{width:"100%"}} onClick={onClose}>Entendi</button>
      </div>
    </div>
  );
}

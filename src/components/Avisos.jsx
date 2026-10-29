import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { estadoAvisos, ativarAvisos, testarAvisos, aoMudarAvisos } from "../lib/avisos.js";
import { aoMudarInstalacao, instalarApp } from "../lib/instalarApp.js";

// 2026-10-28 (Felipe): avisos do app pra todos (lead novo, mensagem do cliente, agendamento, cliente esperando).
// tipo "nav": linha no rodapé do menu. tipo "faixa": faixa no topo até a pessoa ativar (fecha por sessão).
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
  const [fechada, setFechada] = useState(() => { try { return sessionStorage.getItem("la_faixa_avisos") === "1"; } catch { return false; } });
  if (!estado || estado === "sem-suporte") return null;

  async function ligar() {
    onAbrir?.();
    if (estado === "precisa-app") { if (!(await instalarApp())) setAjuda("iphone"); return; }
    if (estado === "negado") { setAjuda("negado"); return; }
    try {
      const ok = await ativarAvisos();
      if (!ok) setAjuda("negado");
      else { setMsg("Avisos ligados"); testarAvisos().catch(() => {}); }
    } catch { setMsg("Não deu pra ligar agora. Tente de novo."); }
  }
  async function testar() {
    setMsg("Enviando teste…");
    try { const r = await testarAvisos(); setMsg(r.ok ? "Teste enviado: confira o aviso" : "Este aparelho não recebeu. Toque em Ativar de novo."); }
    catch { setMsg("Não deu pra testar agora."); }
    setTimeout(() => setMsg(null), 5000);
  }

  const modal = ajuda && createPortal(<AjudaAvisos tipo={ajuda} onClose={() => setAjuda(null)}/>, document.body);

  if (tipo === "faixa") {
    if (estado === "ligado" || fechada) return modal || null;
    const fechar = () => { setFechada(true); try { sessionStorage.setItem("la_faixa_avisos", "1"); } catch {} };
    return (
      <>
        <div className="avisos-faixa">
          <i className="ti ti-bell"/>
          <span>{estado === "precisa-app" ? "Baixe o app pra receber lead novo e mensagem de cliente na hora." : "Ative os avisos pra receber lead novo e mensagem de cliente na hora."}</span>
          <button type="button" className="btn btn-primary btn-sm" onClick={ligar}>{estado === "precisa-app" ? "Como baixar" : "Ativar"}</button>
          <button type="button" className="icon-btn" aria-label="Fechar" onClick={fechar}><i className="ti ti-x"/></button>
        </div>
        {modal}
      </>
    );
  }

  return (
    <>
      {estado === "ligado"
        ? <div className="tema-linha">
            <div className="nav-item tema-item avisos-ligados"><i className="ti ti-bell"/><span>{msg || "Avisos ligados"}</span></div>
            <button type="button" className="btn btn-ghost btn-sm avisos-testar" onClick={testar}>Testar</button>
          </div>
        : <button type="button" className="nav-item tema-item avisos-ativar" onClick={ligar}>
            <i className="ti ti-bell"/><span>{msg || (estado === "negado" ? "Avisos bloqueados" : "Ativar avisos")}</span>
          </button>}
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

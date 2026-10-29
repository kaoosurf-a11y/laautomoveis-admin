import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { rodandoComoApp, instalarApp, ehIphone, aoMudarInstalacao } from "../lib/instalarApp.js";
import { estadoAvisos, ativarAvisos, testarAvisos } from "../lib/avisos.js";

// 2026-10-28 (Felipe): na primeira vez que a pessoa abre o painel (ou o app), um passo a passo:
// 1) baixar o app, 2) ativar os avisos, 3) ajustar o aparelho (tela bloqueada, pop-up, bateria).
// Fica marcado como feito quando os avisos estão ligados ou quando a pessoa diz "agora não" já dentro do app.
// No navegador, "agora não" só vale pra esta aba (quando abrir o app instalado, pede de novo).
// No iPhone o app instalado tem memória separada do Safari, então pede de novo na primeira abertura do app.
const FEITO = "la_primeira_vez_v1";
const lerFeito = () => { try { return localStorage.getItem(FEITO) === "1"; } catch { return false; } };
const marcarFeito = () => { try { localStorage.setItem(FEITO, "1"); } catch {} };
const lerAdiado = () => { try { return sessionStorage.getItem(FEITO) === "1"; } catch { return false; } };
const marcarAdiado = () => { try { sessionStorage.setItem(FEITO, "1"); } catch {} };

export default function PrimeiraVez() {
  const [passo, setPasso] = useState(null); // null | "app" | "avisos" | "aparelho"
  const [ajudaApp, setAjudaApp] = useState(false);
  const [erro, setErro] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    const url = new URL(window.location.href);
    const pediuBaixar = url.searchParams.get("baixar") === "1";
    if (pediuBaixar) { url.searchParams.delete("baixar"); window.history.replaceState(null, "", url.pathname + url.search); }
    if (!pediuBaixar && (lerFeito() || lerAdiado())) return;
    let vivo = true;
    // Espera o painel aparecer antes de abrir (não cobre a tela no primeiro instante).
    const t = setTimeout(async () => {
      const est = await estadoAvisos().catch(() => "sem-suporte");
      if (!vivo) return;
      if (pediuBaixar || (!rodandoComoApp() && (ehIphone() || est !== "ligado"))) setPasso("app");
      else if (est === "desligado" || est === "negado") setPasso("avisos");
      else if (est === "ligado") marcarFeito();
    }, 1200);
    const parar = aoMudarInstalacao(() => { if (rodandoComoApp()) setPasso(p => (p === "app" ? "avisos" : p)); });
    return () => { vivo = false; clearTimeout(t); parar(); };
  }, []);

  if (!passo) return null;

  const fechar = () => { if (rodandoComoApp()) marcarFeito(); else marcarAdiado(); setPasso(null); };

  async function baixar() {
    if (await instalarApp()) { setPasso("avisos"); return; }
    setAjudaApp(true);
  }
  async function depoisDoApp() {
    const est = await estadoAvisos().catch(() => "sem-suporte");
    if (est === "ligado") { setPasso("aparelho"); return; }
    if (est === "sem-suporte" || est === "precisa-app") { fechar(); return; }
    setPasso("avisos");
  }
  async function ligar() {
    setErro(null); setOcupado(true);
    try {
      const est = await estadoAvisos();
      if (est === "negado") { setErro("negado"); return; }
      const ok = await ativarAvisos();
      if (!ok) { setErro("negado"); return; }
      testarAvisos().catch(() => {});
      marcarFeito();
      setPasso("aparelho");
    } catch { setErro("falhou"); }
    finally { setOcupado(false); }
  }

  const iphone = ehIphone();
  const corpo = {
    app: (
      <>
        <div className="pv-topo">
          <img src="/icon-192.png?v=2" alt="" width="64" height="64"/>
          <div><h2 className="modal-title">Baixe o app da LA</h2>
            <div className="pv-sub">Abre em tela cheia, direto da tela inicial, e recebe os avisos mesmo com o app fechado.</div></div>
        </div>
        {!ajudaApp
          ? <button type="button" className="btn btn-primary pv-btn" onClick={baixar}><i className="ti ti-device-mobile"/> Baixar o app</button>
          : iphone
            ? <ol className="baixar-app-passos">
                <li>Abra este endereço no <b>Safari</b>: <b>app.laautomoveis.com.br</b></li>
                <li>Toque em <b>Compartilhar</b> (quadrado com a seta pra cima).</li>
                <li>Toque em <b>Adicionar à Tela de Início</b> e em <b>Adicionar</b>.</li>
                <li>Abra o app <b>LA Painel</b> pela tela inicial e entre. Lá ele pede os avisos.</li>
              </ol>
            : <ol className="baixar-app-passos">
                <li>No <b>Chrome</b>, toque nos <b>3 pontinhos</b> no canto de cima.</li>
                <li>Toque em <b>Instalar app</b> ou <b>Adicionar à tela inicial</b> e confirme.</li>
                <li>No computador: clique no ícone de instalar na barra de endereço.</li>
              </ol>}
        <button type="button" className="btn btn-ghost pv-btn" onClick={depoisDoApp}>{ajudaApp ? "Já instalei / continuar" : "Agora não, continuar"}</button>
      </>
    ),
    avisos: (
      <>
        <div className="pv-topo">
          <div className="pv-sino"><i className="ti ti-bell"/></div>
          <div><h2 className="modal-title">Ative os avisos</h2>
            <div className="pv-sub">Lead novo, mensagem do seu cliente, agendamento chegando e cliente esperando: o aviso aparece por cima da tela e com o celular bloqueado.</div></div>
        </div>
        {erro === "negado"
          ? <ol className="baixar-app-passos">
              <li>Os avisos estão bloqueados neste aparelho.</li>
              <li><b>Android:</b> segure o ícone do <b>LA Painel</b>, toque em <b>Informações do app &gt; Notificações</b> e ligue tudo.</li>
              <li><b>iPhone:</b> Ajustes &gt; Notificações &gt; <b>LA Painel</b> &gt; Permitir Notificações.</li>
              <li><b>PC:</b> clique no cadeado ao lado do endereço &gt; Notificações &gt; <b>Permitir</b>.</li>
              <li>Depois toque em <b>Ativar avisos</b> de novo.</li>
            </ol>
          : erro === "falhou" ? <div className="pv-erro">Não deu pra ligar agora. Confira a internet e tente de novo.</div> : null}
        <button type="button" className="btn btn-primary pv-btn" onClick={ligar} disabled={ocupado}>{ocupado ? <span className="spinner"/> : <i className="ti ti-bell"/>} Ativar avisos</button>
        <button type="button" className="btn btn-ghost pv-btn" onClick={fechar}>Agora não</button>
      </>
    ),
    aparelho: (
      <>
        <div className="pv-topo">
          <div className="pv-sino pv-ok"><i className="ti ti-bell"/></div>
          <div><h2 className="modal-title">Avisos ligados</h2>
            <div className="pv-sub">Chegou um aviso de teste. Agora deixe o aparelho liberado pra eles aparecerem sempre:</div></div>
        </div>
        {iphone
          ? <ol className="baixar-app-passos">
              <li>Ajustes &gt; Notificações &gt; <b>LA Painel</b>: ligue <b>Tela Bloqueada</b>, <b>Central de Notificações</b> e <b>Faixas</b> (estilo <b>Persistente</b>).</li>
              <li>Ligue <b>Sons</b> e <b>Indicadores</b>.</li>
              <li>Em <b>Foco</b> (Não Perturbe), deixe o LA Painel como app permitido.</li>
            </ol>
          : <ol className="baixar-app-passos">
              <li>Segure o ícone do <b>LA Painel</b> &gt; <b>Informações do app</b> &gt; <b>Notificações</b>: ligue tudo, com <b>Pop-up</b> (ou "Mostrar por cima") e <b>Tela de bloqueio</b>.</li>
              <li>Em <b>Bateria</b> do app (e do Chrome): <b>Sem restrições</b>. Isso evita que o celular segure os avisos.</li>
              <li>No PC: deixe o Chrome/Edge abrir com o computador e as notificações do Windows ligadas.</li>
            </ol>}
        <div className="pv-sub" style={{marginBottom:14}}>Com o celular desligado ou sem internet nada chega na hora: os avisos ficam guardados até 12 horas e aparecem quando ele voltar.</div>
        <button type="button" className="btn btn-primary pv-btn" onClick={() => { marcarFeito(); setPasso(null); }}>Pronto</button>
      </>
    ),
  }[passo];

  return createPortal(
    <div className="modal-overlay">
      <div className="modal pv-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-handle"/>
        {corpo}
      </div>
    </div>,
    document.body
  );
}

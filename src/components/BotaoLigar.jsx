import { useState } from "react";
import { ligarLead, resultadoLigacao, verNumeroLead } from "../api.js";
import { getRole, estaVendoComo } from "../auth.js";
import { alertDialog, confirmDialog } from "./Dialog.jsx";
import { COLUNAS_CELULAR } from "./BotaoAtendiCelular.jsx";

// 2026-11-06 (Felipe): o vendedor ve so os 4 ultimos numeros do cliente. Pra ligar, o numero vem do backend
// na hora do toque (POST /api/crm/leads/:id/ligar), que registra quem ligou e quando, e abre o discador.
// Mostra o botao so quando o lead tem telefone de verdade (mascarado ****1234 ou completo); contato @lid nao.
export function temTelefone(tel) {
  const s = String(tel || "");
  if (/^\*{4}\d{4}$/.test(s)) return true;
  const d = s.replace(/\D/g, "");
  return d.length >= 10 && d.length <= 13;
}

// 2026-11-17 (Felipe): no PC nao tem discador, o tel: nao abria nada e o vendedor ficava sem o numero.
// No PC (mouse, sem toque) mostra o numero numa janela com botao de copiar. No celular segue abrindo o discador.
function ehPC() {
  try { return window.matchMedia("(pointer: fine)").matches && !window.matchMedia("(pointer: coarse)").matches; } catch { return false; }
}
function formatarTel(e164) {
  let d = String(e164 || "").replace(/\D/g, "");
  if (d.startsWith("55") && d.length >= 12) d = d.slice(2);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return d;
}
async function mostrarNumeroPC(e164, titulo = "Número do cliente") {
  const num = formatarTel(e164);
  const copiar = await confirmDialog(num, { title: titulo, icon: "phone", grande: true, danger: false, confirmLabel: "Copiar número", cancelLabel: "Fechar" });
  if (!copiar) return;
  try { await navigator.clipboard.writeText(num.replace(/\D/g, "")); } catch { /* sem permissao: o numero ja esta na tela */ }
}

// 2026-11-19d (Felipe: "ligacao com resultado"): depois de ligar, o vendedor dono do lead diz como foi. Atendeu =
// escolhe a coluna (mesma lista do "Ja atendi pelo meu WhatsApp"), o cartao anda e o cliente sai de Responder agora
// (5 pontos); nao atendeu = so registra (2 pontos). O toque em Ligar sozinho nao pontua mais.
const nomeCurto = (n) => { const p = String(n || "").trim().split(/\s+/)[0] || ""; return /[A-Za-zÀ-ú]/.test(p) ? p : "o cliente"; };

function PerguntaResultado({ nome, onEscolher, onFechar, enviando }) {
  const [atendeu, setAtendeu] = useState(false);
  return (
    <div className="modal-overlay" data-dialog onClick={() => !enviando && onFechar()}>
      <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
        <div className="modal-handle" />
        <div style={{ textAlign: "center", padding: "6px 0 14px" }}>
          <i className="ti ti-phone" style={{ fontSize: 40, color: "var(--accent, #f5c518)", marginBottom: 8, display: "block" }} />
          <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--fg)", marginBottom: 6 }}>
            {atendeu ? `Como ficou com ${nomeCurto(nome)}?` : `Como foi a ligação com ${nomeCurto(nome)}?`}
          </h2>
          <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.5 }}>
            {atendeu ? "Escolha a coluna. O cliente continua seu e sai de \"Responder agora\"." : "Um toque e fica registrado."}
          </p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: "55vh", overflowY: "auto" }}>
          {!atendeu ? <>
            <button type="button" className="btn btn-primary" disabled={enviando} onClick={() => setAtendeu(true)}><i className="ti ti-phone" />Atendeu</button>
            <button type="button" className="btn btn-ghost" disabled={enviando} onClick={() => onEscolher("nao_atendeu")}>
              {enviando ? <span className="spinner" /> : <i className="ti ti-phone-off" />}Não atendeu</button>
          </> : COLUNAS_CELULAR.map(([k, label, icone]) => (
            <button key={k} type="button" className="btn btn-ghost" style={{ justifyContent: "flex-start", gap: 10, textAlign: "left" }}
              disabled={enviando} onClick={() => onEscolher("atendeu", k, label)}>
              {enviando ? <span className="spinner" /> : <i className={`ti ${icone}`} />}{label}
            </button>
          ))}
          <button type="button" className="btn btn-ghost" style={{ color: "var(--muted)" }} disabled={enviando}
            onClick={() => atendeu ? setAtendeu(false) : onFechar()}>{atendeu ? "Voltar" : "Agora não"}</button>
        </div>
      </div>
    </div>
  );
}

export default function BotaoLigar({ leadId, telefone, origem, nome, className = "btn btn-ghost btn-sm", onLigou, onResultado, children }) {
  const [abrindo, setAbrindo] = useState(false);
  const [pergunta, setPergunta] = useState(null);   // id da ligacao esperando o resultado
  const [enviando, setEnviando] = useState(false);
  if (!leadId || !temTelefone(telefone)) return null;
  const pergunta_ok = getRole() === "vendedor" && !estaVendoComo();
  async function escolher(resultado, estagio, label) {
    if (enviando) return;
    setEnviando(true);
    try {
      const r = await resultadoLigacao(leadId, pergunta, resultado, estagio);
      setPergunta(null);
      onResultado?.({ ...r, label });
    } catch (err) {
      setPergunta(null);
      await alertDialog(err?.message && !/^\d+$/.test(err.message) ? err.message : "Não foi possível registrar agora. Tente de novo.");
    }
    setEnviando(false);
  }
  async function ligar(e) {
    e?.preventDefault?.(); e?.stopPropagation?.();
    if (abrindo) return;
    setAbrindo(true);
    try {
      const r = await ligarLead(leadId, origem);
      onLigou?.();
      if (r?.discar) {
        if (ehPC()) await mostrarNumeroPC(r.discar);
        else window.location.href = `tel:${r.discar}`;
        // a pergunta fica aberta por baixo do discador e aparece quando o vendedor volta pro painel
        if (pergunta_ok && r.ligacao_id) setTimeout(() => setPergunta(r.ligacao_id), ehPC() ? 0 : 1200);
      }
    } catch (err) {
      await alertDialog(String(err?.message || "").includes("403") ? "Esse lead não é seu." : "Não foi possível ligar agora. Tente de novo.");
    }
    setAbrindo(false);
  }
  return (
    <>
      <button type="button" className={className} onClick={ligar} disabled={abrindo} title="Ligar pro cliente (fica registrado)">
        {abrindo ? <span className="spinner" /> : <i className="ti ti-phone" />}{children ?? "Ligar"}
      </button>
      {pergunta && <PerguntaResultado nome={nome} enviando={enviando} onEscolher={escolher} onFechar={() => setPergunta(null)} />}
    </>
  );
}

// 2026-11-23 (Felipe): "Ver numero" no card e na Rotina. O vendedor ve so ****1234; com o botao ve o numero inteiro
// (com Copiar) pra chamar lead antigo pelo proprio telefone. Nao registra ligacao nem pontua. So aparece quando o
// numero esta mascarado pra quem esta vendo (gerente e dono ja veem o numero completo).
export function numeroMascarado(tel) { return /^\*{4}\d{4}$/.test(String(tel || "")); }

export function BotaoVerNumero({ leadId, telefone, nome, className = "btn btn-ghost btn-sm", style, children }) {
  const [abrindo, setAbrindo] = useState(false);
  if (!leadId || !numeroMascarado(telefone)) return null;
  async function ver(e) {
    e?.preventDefault?.(); e?.stopPropagation?.();
    if (abrindo) return;
    setAbrindo(true);
    try {
      const r = await verNumeroLead(leadId);
      setAbrindo(false);
      if (r?.numero) await mostrarNumeroPC(r.numero, nome ? `Número de ${nomeCurto(nome)}` : "Número do cliente");
    } catch (err) {
      setAbrindo(false);
      await alertDialog(String(err?.message || "").includes("403") || /não é seu/.test(err?.message || "") ? "Esse lead não é seu." : "Não foi possível mostrar o número agora. Tente de novo.");
    }
  }
  return (
    <button type="button" className={className} style={style} onClick={ver} disabled={abrindo} title="Ver o número completo do cliente">
      {abrindo ? <span className="spinner" /> : <i className="ti ti-eye" />}{children ?? "Ver número"}
    </button>
  );
}

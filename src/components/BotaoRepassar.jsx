import { useState, useEffect } from "react";
import { repassarLead, podemTransferir } from "../api.js";
import { getRole } from "../auth.js";
import { alertDialog } from "./Dialog.jsx";

// 2026-11-09 (Felipe): "Transferir" (era "Não posso atender"; Felipe pediu o nome Transferir no mesmo dia). O vendedor passa o lead dele pro próximo vendedor do rodízio da mesma
// loja. Limites no backend (lib/repasse.js): antes de responder o cliente (era só Para atender e Parou de responder), 1 vez por lead, 3 por dia por
// vendedor. O cliente não recebe nada; o novo vendedor recebe aviso e a conversa fica atribuída a ele no Chatwoot.
export const ESTAGIOS_REPASSE = ["novo_lead", "parou_responder"];
// Nome com letra vira o primeiro nome; nome só de emoji (comum no WhatsApp) vira "o cliente".
const nomeCurto = (n) => { const p = String(n || "").trim().split(/\s+/)[0] || ""; return /[A-Za-zÀ-ú]/.test(p) ? p : "o cliente"; };
// 2026-11-09 tarde (Felipe: "o certo e os vendedores poderem transferir logo no inicio do atendimento"): o botao
// aparece so enquanto o vendedor ainda nao respondeu o cliente, em qualquer coluna aberta. Quem decide e o backend
// (GET /api/crm/repasse/podem, olha o Chatwoot). Os botoes da mesma tela perguntam juntos, numa chamada so.
let fila = new Map(); let agendado = null;
function perguntar(id) {
  return new Promise(resolve => {
    const lista = fila.get(id) || []; lista.push(resolve); fila.set(id, lista);
    if (agendado) return;
    agendado = setTimeout(async () => {
      const lote = fila; fila = new Map(); agendado = null;
      let podem = {};
      try { podem = (await podemTransferir([...lote.keys()]))?.podem || {}; } catch { podem = {}; }
      for (const [k, rs] of lote) rs.forEach(r => r(!!podem[k]));
    }, 30);
  });
}
const MOTIVOS = [["folga", "Estou de folga", "ti-beach"], ["ocupado", "Ocupado com outro cliente", "ti-users"], ["outro", "Outro motivo", "ti-dots"]];

export default function BotaoRepassar({ leadId, estagio, nome, className = "btn btn-ghost btn-sm", onRepassado, children }) {
  const [aberto, setAberto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [pode, setPode] = useState(false);
  const vendedor = getRole() === "vendedor";
  useEffect(() => {
    let vivo = true; setPode(false);
    if (vendedor && leadId) perguntar(leadId).then(ok => { if (vivo) setPode(ok); });
    return () => { vivo = false; };
  }, [leadId, estagio, vendedor]);
  if (!leadId || !vendedor || !pode) return null;

  async function escolher(motivo) {
    if (enviando) return;
    setEnviando(true);
    try {
      const r = await repassarLead(leadId, motivo);
      setAberto(false);
      const resto = r?.restantes ?? 0;
      await alertDialog(`Lead transferido para ${r?.para?.nome || "o próximo vendedor"}.\n${resto ? `Você ainda pode transferir ${resto} hoje.` : "Você não pode transferir mais nenhum hoje."}`,
        { title: "Pronto" });
      onRepassado?.(r);
    } catch (err) {
      setAberto(false);
      await alertDialog(err?.message && !/^\d+$/.test(err.message) ? err.message : "Não foi possível transferir o lead agora. Tente de novo.");
    }
    setEnviando(false);
  }

  return (
    <>
      <button type="button" className={className} onClick={(e) => { e.preventDefault(); e.stopPropagation(); setAberto(true); }}
        title="Transferir pro próximo vendedor da loja">
        <i className="ti ti-arrow-forward-up" />{children ?? "Transferir"}
      </button>
      {aberto && (
        <div className="modal-overlay" data-dialog onClick={() => !enviando && setAberto(false)}>
          <div className="modal" style={{ maxWidth: 380 }} onClick={e => e.stopPropagation()}>
            <div className="modal-handle" />
            <div style={{ textAlign: "center", padding: "6px 0 16px" }}>
              <i className="ti ti-arrow-forward-up" style={{ fontSize: 44, color: "var(--brand)", marginBottom: 10, display: "block" }} />
              <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--fg)", marginBottom: 6 }}>Transferir {nomeCurto(nome)} pro próximo vendedor?</h2>
              <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.5 }}>
                Vai pro próximo vendedor da sua loja. Use antes de responder o cliente, pra ele não ficar esperando. Cada lead só pode ser transferido 1 vez e você pode transferir até 3 por dia. O cliente não recebe mensagem.
              </p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {MOTIVOS.map(([k, label, icone]) => (
                <button key={k} type="button" className="btn btn-ghost" style={{ justifyContent: "flex-start", gap: 10 }} disabled={enviando} onClick={() => escolher(k)}>
                  {enviando ? <span className="spinner" /> : <i className={`ti ${icone}`} />}{label}
                </button>
              ))}
              <button type="button" className="btn btn-ghost" style={{ color: "var(--muted)" }} disabled={enviando} onClick={() => setAberto(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

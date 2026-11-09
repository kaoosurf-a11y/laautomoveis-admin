import { useState } from "react";
import { repassarLead } from "../api.js";
import { getRole } from "../auth.js";
import { alertDialog } from "./Dialog.jsx";

// 2026-11-09 (Felipe): "Não posso atender". O vendedor passa o lead dele pro próximo vendedor do rodízio da mesma
// loja. Limites no backend (lib/repasse.js): só Para atender e Parou de responder, 1 vez por lead, 3 por dia por
// vendedor. O cliente não recebe nada; o novo vendedor recebe aviso e a conversa fica atribuída a ele no Chatwoot.
export const ESTAGIOS_REPASSE = ["novo_lead", "parou_responder"];
const MOTIVOS = [["folga", "Estou de folga", "ti-beach"], ["ocupado", "Ocupado com outro cliente", "ti-users"], ["outro", "Outro motivo", "ti-dots"]];

export default function BotaoRepassar({ leadId, estagio, nome, className = "btn btn-ghost btn-sm", onRepassado, children }) {
  const [aberto, setAberto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  if (!leadId || getRole() !== "vendedor" || !ESTAGIOS_REPASSE.includes(estagio)) return null;

  async function escolher(motivo) {
    if (enviando) return;
    setEnviando(true);
    try {
      const r = await repassarLead(leadId, motivo);
      setAberto(false);
      const resto = r?.restantes ?? 0;
      await alertDialog(`Lead passado para ${r?.para?.nome || "o próximo vendedor"}.\n${resto ? `Você ainda pode passar ${resto} hoje.` : "Você não pode passar mais nenhum hoje."}`,
        { title: "Pronto" });
      onRepassado?.(r);
    } catch (err) {
      setAberto(false);
      await alertDialog(err?.message && !/^\d+$/.test(err.message) ? err.message : "Não foi possível passar o lead agora. Tente de novo.");
    }
    setEnviando(false);
  }

  return (
    <>
      <button type="button" className={className} onClick={(e) => { e.preventDefault(); e.stopPropagation(); setAberto(true); }}
        title="Não posso atender: passa pro próximo vendedor da loja">
        <i className="ti ti-arrow-forward-up" />{children ?? "Não posso atender"}
      </button>
      {aberto && (
        <div className="modal-overlay" data-dialog onClick={() => !enviando && setAberto(false)}>
          <div className="modal" style={{ maxWidth: 380 }} onClick={e => e.stopPropagation()}>
            <div className="modal-handle" />
            <div style={{ textAlign: "center", padding: "6px 0 16px" }}>
              <i className="ti ti-arrow-forward-up" style={{ fontSize: 44, color: "var(--brand)", marginBottom: 10, display: "block" }} />
              <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--fg)", marginBottom: 6 }}>Passar {nome ? nome.split(" ")[0] : "o cliente"} pro próximo vendedor?</h2>
              <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.5 }}>
                Vai pro próximo da sua loja. Cada lead só pode ser passado 1 vez e você pode passar até 3 por dia. O cliente não recebe mensagem.
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

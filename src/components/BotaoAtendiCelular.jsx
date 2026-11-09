import { useState } from "react";
import { atendiCelular } from "../api.js";
import { getRole, estaVendoComo } from "../auth.js";
import { alertDialog } from "./Dialog.jsx";

// 2026-11-09 (Felipe): "Ja atendi pelo meu WhatsApp". O vendedor falou com o cliente pelo celular particular (o sistema
// nao ve) e escolhe pra qual coluna o lead vai. O lead sai de "Responder agora", continua dele e a coluna escolhida
// segue com o follow-up dela. Vale 5 pontos, 1 vez por lead por dia (POST /api/rotina/atendi-celular).
export const COLUNAS_CELULAR = [
  ["negociando", "Em negociação", "ti-message-circle"],
  ["agendados", "Agendados (vai vir na loja)", "ti-calendar-event"],
  ["vai_pensar", "Vai pensar", "ti-bulb"],
  ["sem_credito", "Sem crédito", "ti-credit-card"],
  ["nao_achou_carro", "Não achou o carro", "ti-car-off"],
  ["fecha_mes", "Fecha mês", "ti-calendar"],
  ["carros_baratos", "Carros baratos", "ti-coin"],
  ["feirao", "Feirão", "ti-speakerphone"],
  ["fechado_perdido", "Venda perdida (desistiu ou comprou em outro lugar)", "ti-circle-x"],
];
const nomeCurto = (n) => { const p = String(n || "").trim().split(/\s+/)[0] || ""; return /[A-Za-zÀ-ú]/.test(p) ? p : "o cliente"; };

export default function BotaoAtendiCelular({ leadId, nome, className = "btn btn-ghost btn-sm", style, onFeito, children }) {
  const [aberto, setAberto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  if (!leadId || getRole() !== "vendedor" || estaVendoComo()) return null;

  async function escolher(estagio, label) {
    if (enviando) return;
    setEnviando(true);
    try {
      const r = await atendiCelular(leadId, estagio);
      setAberto(false);
      onFeito?.({ ...r, label });
    } catch (err) {
      setAberto(false);
      await alertDialog(err?.message && !/^\d+$/.test(err.message) ? err.message : "Não foi possível registrar agora. Tente de novo.");
    }
    setEnviando(false);
  }

  return (
    <>
      <button type="button" className={className} style={style} onClick={(e) => { e.preventDefault(); e.stopPropagation(); setAberto(true); }}
        title="Já falei com o cliente pelo meu WhatsApp">
        <i className="ti ti-brand-whatsapp" />{children ?? "Já atendi pelo meu WhatsApp"}
      </button>
      {aberto && (
        <div className="modal-overlay" data-dialog onClick={() => !enviando && setAberto(false)}>
          <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <div className="modal-handle" />
            <div style={{ textAlign: "center", padding: "6px 0 14px" }}>
              <i className="ti ti-brand-whatsapp" style={{ fontSize: 40, color: "var(--success, #2ecc71)", marginBottom: 8, display: "block" }} />
              <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--fg)", marginBottom: 6 }}>Já falou com {nomeCurto(nome)}?</h2>
              <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.5 }}>
                Escolha como ficou. O cliente continua seu e sai de "Responder agora". Se ele escrever de novo no WhatsApp da loja, volta pra sua lista.
              </p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: "55vh", overflowY: "auto" }}>
              {COLUNAS_CELULAR.map(([k, label, icone]) => (
                <button key={k} type="button" className="btn btn-ghost" style={{ justifyContent: "flex-start", gap: 10, textAlign: "left" }}
                  disabled={enviando} onClick={() => escolher(k, label)}>
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

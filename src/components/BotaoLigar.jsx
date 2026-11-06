import { useState } from "react";
import { ligarLead } from "../api.js";
import { alertDialog } from "./Dialog.jsx";

// 2026-11-06 (Felipe): o vendedor ve so os 4 ultimos numeros do cliente. Pra ligar, o numero vem do backend
// na hora do toque (POST /api/crm/leads/:id/ligar), que registra quem ligou e quando, e abre o discador.
// Mostra o botao so quando o lead tem telefone de verdade (mascarado ****1234 ou completo); contato @lid nao.
export function temTelefone(tel) {
  const s = String(tel || "");
  if (/^\*{4}\d{4}$/.test(s)) return true;
  const d = s.replace(/\D/g, "");
  return d.length >= 10 && d.length <= 13;
}

export default function BotaoLigar({ leadId, telefone, origem, className = "btn btn-ghost btn-sm", onLigou, children }) {
  const [abrindo, setAbrindo] = useState(false);
  if (!leadId || !temTelefone(telefone)) return null;
  async function ligar(e) {
    e?.preventDefault?.(); e?.stopPropagation?.();
    if (abrindo) return;
    setAbrindo(true);
    try {
      const r = await ligarLead(leadId, origem);
      onLigou?.();
      if (r?.discar) window.location.href = `tel:${r.discar}`;
    } catch (err) {
      await alertDialog(String(err?.message || "").includes("403") ? "Esse lead não é seu." : "Não foi possível ligar agora. Tente de novo.");
    }
    setAbrindo(false);
  }
  return (
    <button type="button" className={className} onClick={ligar} disabled={abrindo} title="Ligar pro cliente (fica registrado)">
      {abrindo ? <span className="spinner" /> : <i className="ti ti-phone" />}{children ?? "Ligar"}
    </button>
  );
}

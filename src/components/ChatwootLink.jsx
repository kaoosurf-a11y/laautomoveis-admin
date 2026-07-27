import { useState, useEffect } from "react";
import { getLeadChatwoot } from "../api.js";

// Botão/link de acesso rápido pra conversa no Chatwoot — extraído em 2026-07-17 de 6
// cópias inline (CRM.jsx, Clientes.jsx, FollowUps.jsx x3) pra virar um componente único
// reaproveitado em toda tela, incluindo o card do Kanban do vendedor (que não tinha).
// `compact` usa um estilo pequeno de ícone só, pra caber no rodapé do card sem esticar
// o layout — o botão cheio (com texto) continua igual ao que já existia.
//
// 2026-07-27: URL com inbox quando disponível
// (`/app/accounts/1/inbox/{inbox}/conversations/{id}`). LeadPhoneChatwoot resolve
// conversa via API quando crm_leads.chatwoot_conv_id ainda é NULL — nunca abre wa.me.

export const CHATWOOT_BASE = "https://chat.laautomoveis.com.br";
export const CHATWOOT_ACCOUNT_ID = "1";

export function chatwootConversationUrl(conv_id, inbox_id) {
  if (!conv_id) return null;
  const base = `${CHATWOOT_BASE}/app/accounts/${CHATWOOT_ACCOUNT_ID}`;
  if (inbox_id) return `${base}/inbox/${inbox_id}/conversations/${conv_id}`;
  return `${base}/conversations/${conv_id}`;
}

export function ChatwootLink({ conv_id, inbox_id, children, compact, style, onClick }) {
  const href = chatwootConversationUrl(conv_id, inbox_id);
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={compact ? "btn-chatwoot-compact" : "btn-chatwoot"}
      style={style}
      onClick={onClick}
      title="Abrir conversa no Chatwoot"
    >
      <i className="ti ti-message-2" />{children}
    </a>
  );
}

// Telefone do lead → sempre Chatwoot (nunca WhatsApp Web do vendedor).
// Se já tem chatwoot_conv_id, link direto; senão busca/cria a conversa no backend.
export function LeadPhoneChatwoot({ lead, children, compact, style, onClick, onResolved }) {
  const [convId, setConvId] = useState(lead?.chatwoot_conv_id || null);
  const [inboxId, setInboxId] = useState(lead?.chatwoot_inbox_id || null);
  const [abrindo, setAbrindo] = useState(false);

  useEffect(() => {
    setConvId(lead?.chatwoot_conv_id || null);
    setInboxId(lead?.chatwoot_inbox_id || null);
  }, [lead?.chatwoot_conv_id, lead?.chatwoot_inbox_id, lead?.id]);

  if (convId) {
    return (
      <ChatwootLink
        conv_id={convId}
        inbox_id={inboxId}
        compact={compact}
        style={style}
        onClick={onClick}
      >
        {children}
      </ChatwootLink>
    );
  }

  if (!lead?.id || !lead?.telefone) return null;

  async function abrir(e) {
    onClick?.(e);
    e?.preventDefault?.();
    e?.stopPropagation?.();
    if (abrindo) return;
    setAbrindo(true);
    try {
      const r = await getLeadChatwoot(lead.id);
      setConvId(r.conversation_id);
      setInboxId(r.inbox_id || null);
      onResolved?.(r);
      const url = chatwootConversationUrl(r.conversation_id, r.inbox_id);
      if (url) window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      alert("Não foi possível abrir a conversa no Chatwoot. Tente de novo.");
    }
    setAbrindo(false);
  }

  return (
    <button
      type="button"
      className={compact ? "btn-chatwoot-compact" : "btn-chatwoot"}
      style={{ ...style, border: "none", cursor: abrindo ? "wait" : "pointer" }}
      onClick={abrir}
      disabled={abrindo}
      title="Abrir conversa no Chatwoot"
    >
      {abrindo ? <span className="spinner" /> : <i className="ti ti-message-2" />}
      {children}
    </button>
  );
}

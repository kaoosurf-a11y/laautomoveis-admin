// Botão/link de acesso rápido pra conversa no Chatwoot — extraído em 2026-07-17 de 6
// cópias inline (CRM.jsx, Clientes.jsx, FollowUps.jsx x3) pra virar um componente único
// reaproveitado em toda tela, incluindo o card do Kanban do vendedor (que não tinha).
// `compact` usa um estilo pequeno de ícone só, pra caber no rodapé do card sem esticar
// o layout — o botão cheio (com texto) continua igual ao que já existia.
export function ChatwootLink({ conv_id, children, compact, style, onClick }) {
  if (!conv_id) return null;
  return (
    <a
      href={`https://chat.laautomoveis.com.br/app/accounts/1/conversations/${conv_id}`}
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

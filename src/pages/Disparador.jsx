import { useState, useEffect, useCallback } from "react";
import { getDisparador } from "../api.js";

// Tela "Disparador" (2026-07-16, só owner/manager) — contatos AINDA na campanha de
// reativação (campanha_reativacao_clientes), antes de qualquer validação. Universo
// separado de "Clientes" (que só tem quem já foi confirmado) — aba própria por
// pedido explícito do usuário, mesmo sendo fases da mesma jornada. Um contato só
// "sai" daqui quando o vendedor valida manualmente e cria o lead no CRM (checkbox
// em CRM.jsx NovoModal); a linha aqui continua existindo pra rastreio.
const FILTROS = [
  { key: "todos", label: "Todos" },
  { key: "aguardando", label: "Aguardando envio" },
  { key: "enviado", label: "Enviado, aguardando resposta" },
  { key: "confirmado", label: "Confirmado" },
  { key: "invalido", label: "Inválido" },
  { key: "sem_resposta", label: "Sem resposta" },
];

const PERIODOS = [
  { key: "todos", label: "Todos" },
  { key: "hoje", label: "Hoje" },
  { key: "semana", label: "Esta semana" },
  { key: "mes", label: "Este mês" },
  { key: "ano", label: "Este ano" },
  { key: "personalizado", label: "Personalizado" },
];

const STATUS_INFO = {
  confirmado: ["#4caf7d", "Confirmado"],
  invalido: ["#e05252", "Inválido"],
  sem_resposta: ["#8d6e63", "Sem resposta"],
};

function fmtData(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function InstanciaBadge({ nome, status }) {
  const conectado = status === "open";
  return (
    <span className="badge" style={{ background: conectado ? "#4caf7d22" : "#e0525222", color: conectado ? "#4caf7d" : "#e05252", display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11 }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: conectado ? "#4caf7d" : "#e05252", display: "inline-block" }} />
      {nome} {conectado ? "conectado" : "desconectado"}
    </span>
  );
}

export default function Disparador() {
  const [data, setData] = useState({ contatos: [], total: 0, resumo: [], instancias: {} });
  const [filtro, setFiltro] = useState("todos");
  const [busca, setBusca] = useState("");
  // "quando" decide a QUE data o filtro de período se aplica: data de entrada na
  // campanha (criado_em) ou data prevista/real de envio (estimativa pra quem ainda
  // não foi mandado, ultimo_envio real pra quem já foi) — os dois combinam com
  // qualquer filtro de status acima, sem substituí-lo.
  const [quando, setQuando] = useState("previsto_enviado");
  const [periodo, setPeriodo] = useState("todos");
  const [desde, setDesde] = useState("");
  const [ate, setAte] = useState("");
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);
  const [expandido, setExpandido] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    const params = { limit: 100 };
    if (filtro !== "todos") params.filtro = filtro;
    if (busca.trim()) params.busca = busca.trim();
    if (periodo !== "todos") {
      params.quando = quando;
      params.periodo = periodo;
      if (periodo === "personalizado" && desde) { params.desde = desde; params.ate = ate || desde; }
    }
    getDisparador(params).then(d => { setData(d); setLoading(false); })
      .catch(() => { setErro("Erro ao carregar dados. Tente novamente."); setLoading(false); });
  }, [filtro, busca, quando, periodo, desde, ate]);

  useEffect(() => { load(); }, [load]);

  const totalGeral = data.resumo.reduce((s, r) => s + r.total, 0);
  const totalRetido = data.resumo.filter(r => r.vendedor_atribuido === "dariana").reduce((s, r) => s + r.total, 0);

  if (erro) return <div className="empty-state"><i className="ti ti-alert-triangle" /><p>{erro}</p></div>;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title"><i className="ti ti-send" /> Disparador ({totalGeral})</h1>
      </div>

      {/* Aviso importante: disparo usa o número PESSOAL de cada vendedor (instância
      Evolution própria), não o número da Lara — diferente do atendimento normal. */}
      <div className="card" style={{ marginBottom: 16, borderLeft: "3px solid var(--brand)", display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ fontSize: 13, color: "var(--fg)" }}>
          <i className="ti ti-info-circle" style={{ color: "var(--brand)" }} /> Esse disparo sai pelo WhatsApp <b>pessoal de cada vendedor</b> (Alex e Wolni), não pelo número da Lara — instâncias separadas da que atende o dia a dia.
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <InstanciaBadge nome="Alex" status={data.instancias["vendedor-alex"]} />
          <InstanciaBadge nome="Wolni" status={data.instancias["vendedor-wolni"]} />
          <InstanciaBadge nome="Dariana" status={data.instancias["vendedor-dariana"]} />
          {totalRetido > 0 && <span className="badge" style={{ background: "#C8A84B22", color: "#C8A84B", fontSize: 11 }}>{totalRetido} contatos retidos até Dariana reconectar</span>}
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        {FILTROS.map(f => (
          <button key={f.key} className={`tab-btn ${filtro === f.key ? "active" : ""}`} onClick={() => setFiltro(f.key)}>{f.label}</button>
        ))}
      </div>

      <input className="form-input" style={{ marginBottom: 14, maxWidth: 320 }} placeholder="Buscar por nome ou telefone..." value={busca} onChange={e => setBusca(e.target.value)} />

      {/* Filtro de período — combinável com o filtro de status acima, não substitui. */}
      <div className="card" style={{ marginBottom: 16, padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>Filtrar data de:</span>
            <select className="form-input" style={{ marginBottom: 0, width: "auto", padding: "5px 8px", fontSize: 12 }} value={quando} onChange={e => setQuando(e.target.value)}>
              <option value="previsto_enviado">Previsão/envio</option>
              <option value="entrada">Entrada na campanha</option>
            </select>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {PERIODOS.map(p => (
              <button key={p.key} className={`tab-btn ${periodo === p.key ? "active" : ""}`} style={{ padding: "5px 10px", fontSize: 12 }} onClick={() => setPeriodo(p.key)}>{p.label}</button>
            ))}
          </div>
        </div>
        {periodo === "personalizado" && (
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <input type="date" className="form-input" style={{ marginBottom: 0, width: "auto" }} value={desde} onChange={e => setDesde(e.target.value)} />
            <span style={{ color: "var(--muted)", fontSize: 12 }}>até</span>
            <input type="date" className="form-input" style={{ marginBottom: 0, width: "auto" }} value={ate} onChange={e => setAte(e.target.value)} />
          </div>
        )}
        {quando === "entrada" && (
          <div style={{ fontSize: 11, color: "var(--warning)" }}>
            <i className="ti ti-alert-triangle" /> Todos os 3.763 contatos entraram no mesmo dia (importação em lote) — esse filtro só fica útil quando novos contatos forem adicionados em datas diferentes.
          </div>
        )}
      </div>

      {loading && <div className="empty-state"><i className="ti ti-loader" style={{ animation: "spin 1s linear infinite" }} /><p>Carregando...</p></div>}
      {!loading && data.contatos.length === 0 && <div className="empty-state"><i className="ti ti-send" /><p>Nenhum contato nesse filtro.</p></div>}

      {!loading && data.contatos.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {data.total > data.contatos.length && (
            <div style={{ fontSize: 12, color: "var(--muted)" }}>Mostrando {data.contatos.length} de {data.total} — use a busca ou os filtros pra refinar.</div>
          )}
          {data.contatos.map(c => {
            const retido = c.vendedor_atribuido === "dariana" && c.instancia_status !== "open";
            const aguardando = c.status === "validando-numero" && c.tentativas === 0;
            const [corStatus, labelStatus] = STATUS_INFO[c.status] || ["#7ba7e0", aguardando ? "Aguardando envio" : `Enviado (${c.tentativas}/3)`];
            const cor = retido ? "#C8A84B" : corStatus;
            const aberto = expandido === c.id;
            return (
              <div key={c.id} className="card" style={{ borderLeft: `3px solid ${cor}`, padding: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "var(--fg)" }}>{c.nome}</div>
                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                      {c.telefone || "sem telefone"} {(c.cidade || c.estado) && `· ${[c.cidade, c.estado].filter(Boolean).join("/")}`}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                    <span className="badge" style={{ background: `${cor}22`, color: cor, fontSize: 11 }}>{retido ? "Retido (Dariana desconectada)" : labelStatus}</span>
                    <span className="badge" style={{ background: "var(--surface2)", color: "var(--muted)", fontSize: 11, display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: c.instancia_status === "open" ? "#4caf7d" : "#e05252", display: "inline-block" }} />
                      {c.vendedor_nome_exibicao} ({c.instance})
                    </span>
                  </div>
                </div>

                {aguardando && !retido && (
                  <div style={{ fontSize: 12, color: "var(--brand)", marginTop: 8, display: "flex", alignItems: "center", gap: 5 }}>
                    <i className="ti ti-clock" style={{ fontSize: 13 }} />
                    {c.estimativa_envio ? <>Previsão de envio: <b>{c.estimativa_envio}</b> <span style={{ color: "var(--muted)", fontWeight: 400 }}>(estimativa, não garantido)</span></> : "Sem estimativa disponível"}
                  </div>
                )}
                {!aguardando && (
                  <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 8 }}>
                    {c.tentativas} tentativa(s) · Último envio: {fmtData(c.ultimo_envio)} · Próxima: {fmtData(c.proxima_tentativa)}
                  </div>
                )}

                <div style={{ marginTop: 10, background: "var(--surface2)", borderRadius: 8, padding: "8px 10px" }}>
                  <div style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", marginBottom: 4 }}>
                    {c.mensagem_ja_enviada ? "Última mensagem enviada" : "Prévia da próxima mensagem"}
                  </div>
                  <div style={{ fontSize: 13, color: "var(--fg)" }}>{c.mensagem || "—"}</div>
                </div>
                {c.historico && c.historico.length > 1 && (
                  <button className="btn btn-ghost" style={{ padding: "3px 8px", fontSize: 11, marginTop: 8 }} onClick={() => setExpandido(aberto ? null : c.id)}>
                    {aberto ? "Ocultar" : "Ver"} histórico completo ({c.historico.length})
                  </button>
                )}
                {aberto && (
                  <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                    {c.historico.map((h, i) => (
                      <div key={i} style={{ fontSize: 12, padding: "6px 10px", borderRadius: 8, background: h.role === "assistant" ? "var(--surface2)" : "rgba(200,168,75,.12)" }}>
                        <span style={{ color: "var(--muted)", fontSize: 10 }}>{h.role === "assistant" ? c.vendedor_nome_exibicao : "Cliente"} · {fmtData(h.timestamp)}</span>
                        <div style={{ color: "var(--fg)", marginTop: 2 }}>{h.content}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

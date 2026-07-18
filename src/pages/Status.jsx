import { useState, useEffect, useCallback } from "react";
import { getStatusLaraConfig, atualizarStatusLaraConfig, getStatusLaraHistorico, getStatusLaraFila } from "../api.js";

// Tela "Status" (2026-07-18) — Status/Stories automático da Lara no WhatsApp,
// postado na instância felipe2la (a própria Lara, atendimento normal) via
// POST /message/sendStatus/felipe2la. Universo TOTALMENTE separado do
// Disparador (que usa os números pessoais de Alex/Wolni pra campanha de
// reativação) — mesmo padrão visual da tela, propósito diferente.

function fmtData(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}
function fmtPreco(v) {
  return v == null ? "—" : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

const TIPO_INFO = {
  manha_especial: ["#C8A84B", "☀️ Especial da manhã"],
  texto_link: ["#7ba7e0", "🔗 Texto com link"],
};
function TipoBadge({ tipo }) {
  const [cor, label] = TIPO_INFO[tipo] || ["var(--muted)", "Normal"];
  return <span className="badge" style={{ background: `${cor}22`, color: cor, fontSize: 11 }}>{label}</span>;
}

function FilaItem({ item }) {
  return (
    <div className="card" style={{ padding: 14, display: "flex", gap: 14, flexWrap: "wrap" }}>
      {item.tipo === "texto_link" ? (
        <div style={{ width: 100, height: 100, borderRadius: 10, flexShrink: 0, background: `#${item.backgroundColor || "FFD400"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#0c0c0a", textAlign: "center", padding: 8 }}>
          texto (sem foto)
        </div>
      ) : item.veiculo ? (
        <img src={item.veiculo.foto_url} alt={item.veiculo.nome} style={{ width: 100, height: 100, objectFit: "cover", borderRadius: 10, background: "var(--surface2)", flexShrink: 0 }} />
      ) : (
        <div style={{ width: 100, height: 100, borderRadius: 10, flexShrink: 0, background: "var(--surface2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <i className="ti ti-car-off" style={{ color: "var(--muted)" }} />
        </div>
      )}
      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 6 }}>
          <span className="badge" style={{ background: "var(--surface2)", color: "var(--brand)", fontSize: 11, fontWeight: 700 }}><i className="ti ti-clock" style={{ fontSize: 11 }} /> {item.horario}</span>
          <TipoBadge tipo={item.tipo} />
          {item.veiculo && <span style={{ fontSize: 12, color: "var(--muted)" }}>{item.veiculo.nome} · {fmtPreco(item.veiculo.preco)}</span>}
        </div>
        {item.legenda
          ? <div style={{ fontSize: 13, color: "var(--fg)", background: "var(--surface2)", borderRadius: 8, padding: "10px 12px" }}>{item.legenda}</div>
          : <div style={{ fontSize: 12, color: "var(--muted)" }}>Nenhum veículo elegível pra esse slot no momento.</div>}
        {item.clima && (
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 6 }}>
            Clima usado na legenda: {item.clima.condicao}, {item.clima.min}°C–{item.clima.max}°C, {item.clima.chuva_prob}% chance de chuva (Curitibanos/SC, hoje)
          </div>
        )}
      </div>
    </div>
  );
}

export default function Status() {
  const [config, setConfig] = useState(null);
  const [historico, setHistorico] = useState([]);
  const [fila, setFila] = useState([]);
  const [jaEnviadosHoje, setJaEnviadosHoje] = useState(0);
  const [loadingFila, setLoadingFila] = useState(true);
  const [loadingHistorico, setLoadingHistorico] = useState(true);
  const [pausando, setPausando] = useState(false);
  const [erro, setErro] = useState(null);

  const loadConfig = useCallback(() => {
    getStatusLaraConfig().then(setConfig).catch(() => setErro("Erro ao carregar configuração."));
  }, []);
  const loadHistorico = useCallback(() => {
    setLoadingHistorico(true);
    getStatusLaraHistorico(30).then(d => { setHistorico(d.historico); setLoadingHistorico(false); })
      .catch(() => { setErro("Erro ao carregar histórico."); setLoadingHistorico(false); });
  }, []);
  const loadFila = useCallback(() => {
    setLoadingFila(true);
    getStatusLaraFila().then(d => { setFila(d.fila); setJaEnviadosHoje(d.jaEnviadosHoje); setLoadingFila(false); })
      .catch(() => { setErro("Erro ao gerar fila do dia."); setLoadingFila(false); });
  }, []);

  useEffect(() => { loadConfig(); loadHistorico(); loadFila(); }, [loadConfig, loadHistorico, loadFila]);

  const togglePausa = () => {
    if (!config) return;
    setPausando(true);
    atualizarStatusLaraConfig(!config.pausado).then(setConfig).finally(() => setPausando(false));
  };

  if (erro) return <div className="empty-state"><i className="ti ti-alert-triangle" /><p>{erro}</p></div>;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title"><i className="ti ti-photo" /> Status</h1>
      </div>

      {/* Aviso importante: diferente do Disparador, esse Status sai pelo número DA
      PRÓPRIA LARA (felipe2la), o mesmo do atendimento normal — não pelos números
      pessoais dos vendedores. */}
      <div className="card" style={{ marginBottom: 16, borderLeft: "3px solid var(--brand)" }}>
        <div style={{ fontSize: 13, color: "var(--fg)" }}>
          <i className="ti ti-info-circle" style={{ color: "var(--brand)" }} /> Esse Status é postado pelo WhatsApp <b>da própria Lara</b> (felipe2la, o mesmo do atendimento normal), visível só pra quem já é contato real (número salvo) dessa instância — não usa os números dos vendedores.
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16, padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--fg)", display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: config?.pausado ? "#e05252" : "#4caf7d", display: "inline-block" }} />
            {config == null ? "Carregando..." : config.pausado ? "Pausado" : "Ativo"}
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
            {config?.pausado ? "Nenhum Status será postado enquanto estiver pausado." : "Postando até 6 Status por dia, todo dia (inclusive fim de semana), das 10h às 20h."}
          </div>
        </div>
        <button className={`btn ${config?.pausado ? "btn-primary" : "btn-danger"}`} disabled={!config || pausando} onClick={togglePausa}>
          {pausando ? <span className="spinner" /> : <i className={`ti ti-${config?.pausado ? "player-play" : "player-pause"}`} />}
          {config?.pausado ? "Retomar" : "Pausar"}
        </button>
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--fg)" }}>
            <i className="ti ti-list-details" /> Fila de hoje {!loadingFila && `(${fila.length} restante${fila.length === 1 ? "" : "s"} de 6, ${jaEnviadosHoje} já postado${jaEnviadosHoje === 1 ? "" : "s"})`}
          </div>
          <button className="btn btn-ghost" style={{ padding: "4px 10px", fontSize: 12 }} onClick={loadFila} disabled={loadingFila}>
            <i className="ti ti-refresh" style={loadingFila ? { animation: "spin 1s linear infinite" } : undefined} /> {loadingFila ? "Gerando..." : "Gerar nova fila"}
          </button>
        </div>
        <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 10 }}>
          Estimativa, não garantida — horário, veículo e legenda reais no momento do disparo podem variar um pouco.
        </div>
        {loadingFila && <div className="empty-state" style={{ padding: 20 }}><i className="ti ti-loader" style={{ animation: "spin 1s linear infinite" }} /><p>Gerando fila do dia...</p></div>}
        {!loadingFila && fila.length === 0 && <div className="empty-state" style={{ padding: 20 }}><i className="ti ti-check" /><p>Todos os status de hoje já foram postados.</p></div>}
        {!loadingFila && fila.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {fila.map(item => <FilaItem key={item.slot} item={item} />)}
          </div>
        )}
      </div>

      <div className="card" style={{ padding: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--fg)", marginBottom: 10 }}><i className="ti ti-history" /> Histórico</div>
        {loadingHistorico && <div className="empty-state" style={{ padding: 20 }}><i className="ti ti-loader" style={{ animation: "spin 1s linear infinite" }} /><p>Carregando...</p></div>}
        {!loadingHistorico && historico.length === 0 && <div className="empty-state" style={{ padding: 20 }}><i className="ti ti-photo-off" /><p>Nenhum Status postado ainda.</p></div>}
        {!loadingHistorico && historico.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {historico.map(h => (
              <div key={h.id} style={{ display: "flex", gap: 12, padding: 10, borderRadius: 8, background: "var(--surface2)", alignItems: "flex-start" }}>
                {h.foto_url
                  ? <img src={h.foto_url} alt="" style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 8, flexShrink: 0 }} />
                  : <div style={{ width: 56, height: 56, borderRadius: 8, flexShrink: 0, background: "#FFD400" }} />}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 4 }}>
                    <TipoBadge tipo={h.tipo} />
                    <span className="badge" style={{ background: h.sucesso ? "#4caf7d22" : "#e0525222", color: h.sucesso ? "#4caf7d" : "#e05252", fontSize: 11 }}>
                      {h.sucesso ? `Enviado · ${h.contatos_alcancados} contatos` : "Falhou"}
                    </span>
                    <span style={{ fontSize: 11, color: "var(--muted)" }}>{fmtData(h.enviado_em)}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--fg)" }}>{h.marca ? `${h.marca} ${h.modelo} ${h.ano} — ` : ""}{h.legenda}</div>
                  {!h.sucesso && h.erro && <div style={{ fontSize: 11, color: "#e05252", marginTop: 4 }}>{h.erro}</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

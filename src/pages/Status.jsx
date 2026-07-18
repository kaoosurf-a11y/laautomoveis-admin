import { useState, useEffect, useCallback } from "react";
import { getStatusLaraConfig, atualizarStatusLaraConfig, getStatusLaraHistorico, getStatusLaraPreview } from "../api.js";

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

function TipoBadge({ tipo }) {
  const manha = tipo === "manha_especial";
  return (
    <span className="badge" style={{ background: manha ? "#C8A84B22" : "var(--surface2)", color: manha ? "#C8A84B" : "var(--muted)", fontSize: 11 }}>
      {manha ? "☀️ Especial da manhã" : "Normal"}
    </span>
  );
}

export default function Status() {
  const [config, setConfig] = useState(null);
  const [historico, setHistorico] = useState([]);
  const [preview, setPreview] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(true);
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
  const loadPreview = useCallback(() => {
    setLoadingPreview(true);
    getStatusLaraPreview().then(d => { setPreview(d); setLoadingPreview(false); })
      .catch(() => { setErro("Erro ao gerar prévia."); setLoadingPreview(false); });
  }, []);

  useEffect(() => { loadConfig(); loadHistorico(); loadPreview(); }, [loadConfig, loadHistorico, loadPreview]);

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
            {config?.pausado ? "Nenhum Status será postado enquanto estiver pausado." : "Postando até 6 Status por dia, dentro do horário comercial."}
          </div>
        </div>
        <button className={`btn ${config?.pausado ? "btn-primary" : "btn-danger"}`} disabled={!config || pausando} onClick={togglePausa}>
          {pausando ? <span className="spinner" /> : <i className={`ti ti-${config?.pausado ? "player-play" : "player-pause"}`} />}
          {config?.pausado ? "Retomar" : "Pausar"}
        </button>
      </div>

      <div className="card" style={{ marginBottom: 16, padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--fg)" }}><i className="ti ti-clock" /> Prévia do próximo Status</div>
          <button className="btn btn-ghost" style={{ padding: "4px 10px", fontSize: 12 }} onClick={loadPreview} disabled={loadingPreview}>
            <i className="ti ti-refresh" style={loadingPreview ? { animation: "spin 1s linear infinite" } : undefined} /> {loadingPreview ? "Gerando..." : "Gerar nova prévia"}
          </button>
        </div>
        {loadingPreview && <div className="empty-state" style={{ padding: 20 }}><i className="ti ti-loader" style={{ animation: "spin 1s linear infinite" }} /><p>Gerando prévia...</p></div>}
        {!loadingPreview && !preview?.veiculo && <div className="empty-state" style={{ padding: 20 }}><i className="ti ti-car-off" /><p>Nenhum veículo elegível no estoque no momento.</p></div>}
        {!loadingPreview && preview?.veiculo && (
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            <img src={preview.veiculo.foto_url} alt={preview.veiculo.nome} style={{ width: 160, height: 160, objectFit: "cover", borderRadius: 10, background: "var(--surface2)" }} />
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                <TipoBadge tipo={preview.tipo} />
                <span style={{ fontSize: 12, color: "var(--muted)" }}>{preview.veiculo.nome} · {fmtPreco(preview.veiculo.preco)}</span>
              </div>
              <div style={{ fontSize: 13, color: "var(--fg)", background: "var(--surface2)", borderRadius: 8, padding: "10px 12px" }}>{preview.legenda}</div>
              {preview.clima && (
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 6 }}>
                  Clima usado na legenda: {preview.clima.condicao}, {preview.clima.min}°C–{preview.clima.max}°C, {preview.clima.chuva_prob}% chance de chuva (Curitibanos/SC, hoje)
                </div>
              )}
            </div>
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
                <img src={h.foto_url} alt="" style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 8, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 4 }}>
                    <TipoBadge tipo={h.tipo} />
                    <span className="badge" style={{ background: h.sucesso ? "#4caf7d22" : "#e0525222", color: h.sucesso ? "#4caf7d" : "#e05252", fontSize: 11 }}>
                      {h.sucesso ? `Enviado · ${h.contatos_alcancados} contatos` : "Falhou"}
                    </span>
                    <span style={{ fontSize: 11, color: "var(--muted)" }}>{fmtData(h.enviado_em)}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--fg)" }}>{h.marca} {h.modelo} {h.ano} — {h.legenda}</div>
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

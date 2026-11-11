import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api.js";
import { fotosCarroDoLead, mandarFotosCarro } from "../api.js";
import { alertDialog } from "./Dialog.jsx";

// 2026-11-11 (Felipe): botao "Fotos" na Rotina e no card do lead. O vendedor escolhe o carro do estoque e todas as
// fotos dele vao pro cliente pelo WhatsApp da loja, sem passar pela galeria (o app do Chatwoot so manda 1 por vez).
// O carro que o cliente quer vem marcado no topo. Codigo do carro = id (o mesmo do atalho /codigo no Chatwoot).
// Trava no backend: mesmo carro pro mesmo cliente so 1 vez a cada 2 h, a nao ser que confirme de novo.
const mini = (url, w) => (url && url.includes("/uploads/") && !url.includes("?")) ? `${url}?w=${w}` : url;
const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const hora = (d) => new Date(d).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
const preco = (p) => Number(p) ? Number(p).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }) : "";
const nome = (v) => [v.modelo, v.versao].filter(Boolean).join(" ").trim();

// Quanto o carro combina com o texto do lead ("Onix 2019 prata"): modelo vale mais, ano e cor desempatam.
function combina(v, interesse) {
  const t = norm(interesse);
  if (!t) return 0;
  let p = 0;
  const modelo = norm(v.modelo).trim();
  if (modelo && t.includes(modelo)) p += 10;
  if (v.ano && t.includes(String(v.ano))) p += 3;
  if (v.cor && t.includes(norm(v.cor))) p += 1;
  return p >= 10 ? p : 0;
}

export default function BotaoFotosCarro({ leadId, veiculoInteresse, className = "btn btn-ghost btn-sm", style, children, onEnviado }) {
  const [aberto, setAberto] = useState(false);
  const [carros, setCarros] = useState(null);
  const [envios, setEnvios] = useState({});
  const [interesse, setInteresse] = useState(veiculoInteresse || "");
  const [busca, setBusca] = useState("");
  const [escolhido, setEscolhido] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (!aberto) return;
    let vivo = true;
    setErro(""); setEscolhido(null); setBusca("");
    Promise.all([api.getVeiculos(), fotosCarroDoLead(leadId)]).then(([vs, f]) => {
      if (!vivo) return;
      const lista = (Array.isArray(vs) ? vs : vs?.veiculos || []).filter(v => v.ativo && !v.excluido_em && (v.fotos || []).some(Boolean));
      setCarros(lista);
      setEnvios(Object.fromEntries((f?.envios || []).map(e => [e.veiculo_id, e])));
      if (f?.veiculo_interesse) setInteresse(f.veiculo_interesse);
    }).catch(() => vivo && setErro("Não foi possível carregar o estoque. Tente de novo."));
    return () => { vivo = false; };
  }, [aberto, leadId]);

  const lista = useMemo(() => {
    if (!carros) return [];
    const q = norm(busca).trim();
    const filtrados = q
      ? carros.filter(v => norm(`${v.id} ${v.marca} ${v.modelo} ${v.versao || ""} ${v.ano} ${v.cor || ""}`).includes(q.replace(/^\//, "")))
      : carros;
    return filtrados.map(v => ({ v, p: combina(v, interesse) }))
      .sort((a, b) => b.p - a.p || norm(a.v.modelo).localeCompare(norm(b.v.modelo)) || (b.v.ano || 0) - (a.v.ano || 0))
      .map(x => ({ ...x.v, _interesse: x.p > 0 }));
  }, [carros, busca, interesse]);

  if (!leadId) return null;

  async function mandar(v, forcar = false) {
    if (enviando) return;
    setEnviando(true);
    try {
      const r = await mandarFotosCarro(leadId, v.id, forcar);
      setAberto(false);
      onEnviado?.(r);
      await alertDialog(`${r.mensagem}. Elas chegam pro cliente uma atrás da outra e aparecem na conversa do Chatwoot.`, { title: "Fotos saindo" });
    } catch (err) {
      if (err?.body?.codigo === "repetido") setEscolhido({ ...v, _repetido: err.body.enviado_em });
      else await alertDialog(err?.message && !/^\d+$/.test(err.message) ? err.message : "Não foi possível mandar agora. Tente de novo.");
    }
    setEnviando(false);
  }

  const env = escolhido ? envios[escolhido.id] : null;
  const jaFoi = escolhido?._repetido || (env && ["ok", "parcial", "enviando"].includes(env.status) ? env.criado_em : null);
  const qtd = escolhido ? (escolhido.fotos || []).filter(Boolean).length : 0;

  return (
    <>
      <button type="button" className={className} style={style} title="Mandar as fotos de um carro do estoque pro cliente"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setAberto(true); }}>
        <i className="ti ti-photo" />{children ?? "Fotos"}
      </button>
      {aberto && (
        <div className="modal-overlay" data-dialog onClick={() => !enviando && setAberto(false)}>
          <div className={`modal${escolhido ? "" : " fc-modal"}`} style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
            <div className="modal-handle" />
            {!escolhido ? (<>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--fg)", margin: "4px 0 4px" }}>Mandar fotos do carro</h2>
              <p className="fc-dica" style={{ fontSize: 13, color: "var(--muted)", marginBottom: 10 }}>
                Toque no carro. Todas as fotos dele vão pro cliente pelo WhatsApp da loja.
              </p>
              <input type="search" className="form-input" value={busca} onChange={e => setBusca(e.target.value)}
                placeholder="Buscar por carro ou código" aria-label="Buscar por carro ou código" autoComplete="off" style={{ marginBottom: 10 }} />
              {erro && <p style={{ color: "var(--danger, #e5484d)", fontSize: 13 }}>{erro}</p>}
              {!carros && !erro && <div style={{ textAlign: "center", padding: 20 }}><span className="spinner" /></div>}
              {carros && !lista.length && <p style={{ fontSize: 13, color: "var(--muted)", padding: "10px 0" }}>Nenhum carro com fotos achado.</p>}
              <div className="fc-lista">
                {lista.map(v => {
                  const e = envios[v.id];
                  return (
                    <button key={v.id} type="button" className="btn btn-ghost fc-item" onClick={() => setEscolhido(v)}
                      style={{
                        ...(v._interesse ? { borderColor: "var(--brand-line)", background: "var(--brand-soft)" } : {}) }}>
                      <img className="fc-thumb" src={mini(v.fotos.find(Boolean), 160)} alt="" loading="lazy" decoding="async" />
                      <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                        <span className="fc-nome">{[v.modelo, v.ano, v.versao].map(x => String(x || "").trim()).filter(Boolean).join(" ")}</span>
                        <span style={{ fontSize: 12, color: "var(--muted)" }}>
                          {[v.cor, preco(v.preco), `${v.fotos.filter(Boolean).length} fotos`].filter(Boolean).join(" · ")}
                        </span>
                        {v._interesse && <span style={{ fontSize: 11, color: "var(--brand)", fontWeight: 600 }}>Carro que o cliente quer</span>}
                        {e && <span style={{ fontSize: 11, color: "var(--success, #2ecc71)" }}>Enviadas às {hora(e.criado_em)}</span>}
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "var(--brand)", flexShrink: 0 }}>Cód. {v.id}</span>
                    </button>
                  );
                })}
              </div>
              <button type="button" className="btn btn-ghost fc-fechar" onClick={() => setAberto(false)}>Fechar</button>
            </>) : (<>
              <div style={{ textAlign: "center", padding: "6px 0 12px" }}>
                <img src={mini(escolhido.fotos.find(Boolean), 480)} alt="" style={{ width: "100%", maxHeight: 200, objectFit: "cover", borderRadius: 10, marginBottom: 10 }} />
                <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--fg)", marginBottom: 4 }}>{nome(escolhido)} {escolhido.ano}</h2>
                <p style={{ fontSize: 13, color: "var(--muted)" }}>Cód. {escolhido.id} · {qtd} fotos</p>
                {jaFoi && <p style={{ fontSize: 13, color: "var(--warning, #f5a524)", marginTop: 8, fontWeight: 600 }}>
                  Essas fotos já foram enviadas pra esse cliente às {hora(jaFoi)}. Mandar de novo?</p>}
              </div>
              <button type="button" className="btn btn-primary" style={{ width: "100%" }} disabled={enviando}
                onClick={() => mandar(escolhido, !!jaFoi)}>
                {enviando ? <span className="spinner" /> : <i className="ti ti-send" />}{jaFoi ? `Mandar de novo as ${qtd} fotos` : `Mandar ${qtd} fotos`}
              </button>
              <button type="button" className="btn btn-ghost" style={{ width: "100%", marginTop: 8 }} disabled={enviando} onClick={() => setEscolhido(null)}>Escolher outro carro</button>
            </>)}
          </div>
        </div>
      )}
    </>
  );
}

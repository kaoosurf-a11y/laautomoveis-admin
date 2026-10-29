import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api.js";

// Mapa do site (2026-10-29, Felipe: mapa de calor nos sites "feito por nós"), só proprietários.
// Mostra a página real do site dentro de um iframe com ?mapa=1; o painel manda os cliques e a
// rolagem por postMessage e o próprio site desenha o calor por cima (ver mapaCalor.ts no site).
// Dentro do iframe o site não conta visita nem dispara o Pixel.
const SITES = {
  1: { nome: "Curitibanos", url: import.meta.env.VITE_SITE1_URL || "https://laautomoveis.com.br" },
  2: { nome: "Campos Novos", url: import.meta.env.VITE_SITE2_URL || "https://camposnovos.laautomoveis.com.br" },
};
const PAGINAS = [["inicio", "Início", "/"], ["estoque", "Estoque", "/estoque"], ["veiculo", "Página do carro", null],
  ["contato", "Contato", "/contato"], ["sobre", "Sobre", "/sobre"], ["promocoes", "Promoções", "/promocoes"]];
const TELA = { cel: { w: 390, h: 844 }, pc: { w: 1366, h: 820 } };

const num = n => Number(n || 0).toLocaleString("pt-BR");
const pct = (a, b) => (b > 0 ? `${Math.round((a / b) * 100)}%` : "–");
function duracao(s) {
  if (!s) return "0 s";
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min${s % 60 ? ` ${s % 60} s` : ""}`;
}

function Previa({ src, dados }) {
  const caixa = useRef(null), quadro = useRef(null), pronto = useRef(false);
  const [largura, setLargura] = useState(0);
  const tela = TELA[dados.aparelho];
  const escala = largura ? Math.min(1, largura / tela.w) : 0;

  useEffect(() => {
    const ro = new ResizeObserver(([e]) => setLargura(e.contentRect.width));
    ro.observe(caixa.current);
    return () => ro.disconnect();
  }, []);

  // O site avisa "pronto" quando carrega; aí recebe os pontos. Se os dados mudarem com o
  // site já aberto, manda de novo.
  const mandar = () => {
    if (!pronto.current || !quadro.current?.contentWindow) return;
    quadro.current.contentWindow.postMessage({ tipo: "la-mapa", pontos: dados.pontos, rolagem: dados.rolagem }, new URL(src).origin);
  };
  useEffect(() => {
    const ouvir = ev => {
      if (ev.source === quadro.current?.contentWindow && ev.data?.tipo === "la-mapa-pronto") { pronto.current = true; mandar(); }
    };
    window.addEventListener("message", ouvir);
    return () => window.removeEventListener("message", ouvir);
  });
  useEffect(() => { pronto.current = false; }, [src]);
  useEffect(mandar, [dados]);

  return (
    <div ref={caixa} style={{ width: "100%", maxWidth: dados.aparelho === "cel" ? 390 : "none", margin: "0 auto" }}>
      <div style={{ width: tela.w * escala, height: tela.h * escala, overflow: "hidden", borderRadius: 14, border: "1px solid var(--border)", background: "var(--surface2)" }}>
        {escala > 0 && (
          <iframe ref={quadro} key={src} src={src} title="Página do site com o mapa de calor"
            style={{ width: tela.w, height: tela.h, border: 0, transform: `scale(${escala})`, transformOrigin: "0 0" }} />
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--muted)", marginTop: 8, flexWrap: "wrap" }}>
        pouco
        <span style={{ width: 80, height: 8, borderRadius: 4, background: "linear-gradient(90deg, #3b82f6, #8b5cf6, #ec4899, #fff1f2)" }} />
        muito · linha tracejada = até onde as visitas rolam · role dentro da página
      </div>
    </div>
  );
}

export default function SiteMapa() {
  const [site, setSite] = useState("1");
  const [aparelho, setAparelho] = useState("cel");
  const [dias, setDias] = useState(30);
  const [pagina, setPagina] = useState("inicio");
  const [carro, setCarro] = useState(null);
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    let vivo = true;
    setErro(false);
    api.getSiteMapa({ site, aparelho, dias, pagina })
      .then(d => { if (vivo) { setDados(d); setCarro(c => (d.carros?.some(x => x.id === c && x.ativo) ? c : d.carros?.find(x => x.ativo)?.id ?? null)); } })
      .catch(() => vivo && setErro(true));
    return () => { vivo = false; };
  }, [site, aparelho, dias, pagina]);

  const visitasPorPagina = Object.fromEntries((dados?.paginas || []).map(p => [p.pagina, p.visitas]));
  const caminho = pagina === "veiculo" ? (carro ? `/veiculo/${carro}` : null) : PAGINAS.find(p => p[0] === pagina)[2];
  const src = caminho ? `${SITES[site].url}${caminho}?mapa=1` : null;
  const visitas = dados?.visitas || 0;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title"><i className="ti ti-flame" /> Mapa do site</h1>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <div className="seg">
          {Object.entries(SITES).map(([id, s]) => (
            <button key={id} className={`seg-btn ${site === id ? "active" : ""}`} onClick={() => setSite(id)}>{s.nome}</button>
          ))}
        </div>
        <div className="seg">
          <button className={`seg-btn ${aparelho === "cel" ? "active" : ""}`} onClick={() => setAparelho("cel")}>Celular</button>
          <button className={`seg-btn ${aparelho === "pc" ? "active" : ""}`} onClick={() => setAparelho("pc")}>Computador</button>
        </div>
        <div className="seg">
          {[7, 30, 90].map(d => (
            <button key={d} className={`seg-btn ${dias === d ? "active" : ""}`} onClick={() => setDias(d)}>{d} dias</button>
          ))}
        </div>
      </div>

      <div className="seg" style={{ marginBottom: 16, overflowX: "auto", maxWidth: "100%" }}>
        {PAGINAS.map(([id, nome]) => (
          <button key={id} className={`seg-btn ${pagina === id ? "active" : ""}`} onClick={() => setPagina(id)} style={{ whiteSpace: "nowrap" }}>
            {nome}{visitasPorPagina[id] ? <span style={{ opacity: 0.6 }}> {num(visitasPorPagina[id])}</span> : null}
          </button>
        ))}
      </div>

      {erro && <div className="card" style={{ color: "var(--danger)", fontSize: 13 }}>Não consegui carregar o mapa agora.</div>}

      {dados && (<>
        <div className="metrics-grid">
          <div className="metric-card">
            <div className="metric-label">Visitas nesta página</div>
            <div className="metric-value">{num(visitas)}</div>
            <div className="metric-delta">{dados.desde ? `desde ${new Date(dados.desde).toLocaleDateString("pt-BR")}` : "começou a contar agora"}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Tempo na página</div>
            <div className="metric-value">{duracao(dados.segundos)}</div>
            <div className="metric-delta">metade fica menos que isso</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Chamaram no WhatsApp</div>
            <div className="metric-value">{pct(dados.com_whatsapp, visitas)}</div>
            <div className="metric-delta">{num(dados.com_whatsapp)} visitas clicaram</div>
          </div>
        </div>

        <div className={`site-mapa-grade${aparelho === "pc" ? " pc" : ""}`}>
          <div className="card">
            {src ? <Previa src={src} dados={dados} /> : (
              <div style={{ fontSize: 13, color: "var(--muted)" }}>Ainda não tem visita em página de carro à venda.</div>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
            <div className="card">
              <div className="card-title"><i className="ti ti-target" /> Mais clicados</div>
              {dados.botoes.length ? dados.botoes.map(b => (
                <div key={b.rotulo} style={{ display: "flex", gap: 10, padding: "7px 0", borderTop: "1px solid var(--border)", fontSize: 13 }}>
                  <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: b.rotulo === "Clique sem efeito" ? "var(--muted)" : undefined }}>{b.rotulo}</span>
                  <span style={{ fontVariantNumeric: "tabular-nums" }}>{num(b.cliques)}</span>
                  <span style={{ width: 44, textAlign: "right", color: "var(--muted)", fontVariantNumeric: "tabular-nums" }}>{pct(b.visitas, visitas)}</span>
                </div>
              )) : <div style={{ fontSize: 13, color: "var(--muted)" }}>Nenhum clique ainda.</div>}
              {dados.botoes.length > 0 && (
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 8 }}>
                  Número = cliques; % = das visitas, quantas clicaram. "Clique sem efeito" é toque em algo que não é botão (foto, texto): mostra o que o cliente acha que devia abrir.
                </div>
              )}
            </div>

            {pagina === "veiculo" && dados.carros.length > 0 && (
              <div className="card">
                <div className="card-title"><i className="ti ti-car" /> Carros: visitas e WhatsApp</div>
                {dados.carros.map(c => (
                  <div key={c.id} onClick={() => c.ativo && setCarro(c.id)}
                    style={{ display: "flex", gap: 10, padding: "7px 4px", borderTop: "1px solid var(--border)", fontSize: 13, cursor: c.ativo ? "pointer" : "default",
                      background: c.id === carro ? "var(--brand-soft)" : undefined, opacity: c.ativo ? 1 : 0.55 }}>
                    <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {c.marca ? `${c.marca} ${c.modelo} ${c.ano}` : `Carro ${c.id}`}{!c.ativo && " · saiu"}
                    </span>
                    <span style={{ fontVariantNumeric: "tabular-nums" }}>{num(c.visitas)}</span>
                    <span style={{ width: 44, textAlign: "right", fontVariantNumeric: "tabular-nums", color: "var(--muted)" }}>{pct(c.whatsapp, c.visitas)}</span>
                  </div>
                ))}
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 8 }}>Visitas e % que chamou no WhatsApp. Muita visita e pouco WhatsApp: olhar preço e fotos. O mapa junta todos os carros; toque num carro pra trocar a página de fundo.</div>
              </div>
            )}
          </div>
        </div>
      </>)}
    </div>
  );
}

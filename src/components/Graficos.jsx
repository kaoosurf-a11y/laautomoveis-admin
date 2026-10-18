// Gráficos neon do Dashboard e do Mensal (2026-10-18, Felipe mandou a referência:
// fundo escuro, degradê magenta/roxo/azul/laranja, barras numeradas 01-05, colunas com
// brilho, anéis com % no meio, rosca e área com ondas). Só os gráficos usam esse visual;
// o resto do painel segue o DESIGN.md (dourado chapado). SVG/CSS próprio, sem biblioteca,
// pra continuar leve no celular.

import { useId } from "react";

// Pares de cor do degradê, na ordem da referência.
export const NEON = [
  ["#ff4fd8", "#c026d3"], // magenta
  ["#b77cff", "#6d28d9"], // roxo
  ["#4cc9ff", "#2563eb"], // azul
  ["#ffc23d", "#ff5e1a"], // laranja
  ["#3ff0e0", "#0891b2"], // ciano
  ["#c6f24e", "#16a34a"], // lima
];
// Cores com sentido (temperatura do lead, perda).
export const NEON_TOM = {
  quente: ["#ffb23d", "#ff2d55"],
  morno: ["#ffe066", "#f59f00"],
  frio: ["#6fd3ff", "#3b5bff"],
  perda: ["#ff6b9a", "#e11d48"],
};

const corDe = (i, cor) => cor || NEON[i % NEON.length];
const vars = (c) => ({ "--c1": c[0], "--c2": c[1] });
const doisDig = (n) => String(n).padStart(2, "0");

// Barras horizontais numeradas (01, 02...). itens: {label, valor, texto?, cor?}
// `max` opcional (padrão: maior valor). `numerar=false` tira o número.
export function BarrasNeon({ itens, max, numerar = true, vazio = "Sem dados no período." }) {
  if (!itens?.length) return <p className="vazio">{vazio}</p>;
  const teto = max || Math.max(...itens.map((x) => Number(x.valor) || 0), 1);
  return (
    <div className={`nx-barras${numerar ? "" : " sem-num"}`}>
      {itens.map((x, i) => {
        const c = corDe(i, x.cor);
        const pct = Math.max(2, Math.round(((Number(x.valor) || 0) / teto) * 100));
        return (
          <div key={i} className="nx-barra" style={vars(c)}>
            {numerar && <span className="nx-num">{doisDig(i + 1)}</span>}
            <span className="nx-label" title={x.label}>{x.label}</span>
            <span className="nx-trilho"><span className="nx-cheio" style={{ width: `${pct}%` }} /></span>
            <span className="nx-valor">{x.texto ?? x.valor}</span>
          </div>
        );
      })}
    </div>
  );
}

// Colunas verticais com degradê e brilho, valor em cima. itens: {label, valor, texto?, cor?}
export function ColunasNeon({ itens, altura = 180, mesmaCor }) {
  if (!itens?.length) return <p className="vazio">Sem dados no período.</p>;
  const teto = Math.max(...itens.map((x) => Number(x.valor) || 0), 1);
  return (
    <div className="nx-colunas" style={{ height: altura }}>
      {itens.map((x, i) => {
        const c = x.cor || mesmaCor || corDe(i);
        const pct = Math.max(4, Math.round(((Number(x.valor) || 0) / teto) * 100));
        return (
          <div key={i} className="nx-col" style={vars(c)}>
            <span className="nx-col-valor">{x.texto ?? x.valor}</span>
            <span className="nx-col-trilho"><span className="nx-col-cheio" style={{ height: `${pct}%` }} /></span>
            <span className="nx-col-label">{x.label}</span>
          </div>
        );
      })}
    </div>
  );
}

// Anel de progresso com o % no meio. pct 0-100 (null = sem dado).
export function AnelNeon({ pct, label, sub, cor, i = 0 }) {
  const c = corDe(i, cor);
  const r = 40;
  const volta = 2 * Math.PI * r;
  const v = pct == null || isNaN(pct) ? null : Math.max(0, Math.min(100, Number(pct)));
  const id = useId().replace(/:/g, "");
  return (
    <div className="nx-anel" style={vars(c)}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={c[0]} />
            <stop offset="1" stopColor={c[1]} />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r={r} className="nx-anel-trilho" />
        {v != null && v > 0 && (
          <circle cx="50" cy="50" r={r} className="nx-anel-cheio" stroke={`url(#${id})`}
            strokeDasharray={`${(v / 100) * volta} ${volta}`} transform="rotate(-90 50 50)" />
        )}
      </svg>
      <div className="nx-anel-meio">{v == null ? "—" : `${Math.round(v)}%`}</div>
      {label && <div className="nx-anel-label">{label}</div>}
      {sub && <div className="nx-anel-sub">{sub}</div>}
    </div>
  );
}

// Rosca com legenda. itens: {label, valor, cor?}
export function RoscaNeon({ itens, centro, centroSub }) {
  const uid = useId().replace(/:/g, "");
  const total = itens.reduce((s, x) => s + (Number(x.valor) || 0), 0);
  if (!total) return <p className="vazio">Sem dados no período.</p>;
  const r = 38;
  const volta = 2 * Math.PI * r;
  let acumulado = 0;
  return (
    <div className="nx-rosca">
      <div className="nx-rosca-graf">
        <svg viewBox="0 0 100 100" aria-hidden="true">
          <defs>
            {itens.map((x, i) => {
              const c = corDe(i, x.cor);
              return (
                <linearGradient key={i} id={`${uid}r${i}`} x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor={c[0]} />
                  <stop offset="1" stopColor={c[1]} />
                </linearGradient>
              );
            })}
          </defs>
          <circle cx="50" cy="50" r={r} className="nx-anel-trilho" style={{ strokeWidth: 14 }} />
          {itens.map((x, i) => {
            const parte = (Number(x.valor) || 0) / total;
            const inicio = acumulado;
            acumulado += parte;
            if (!parte) return null;
            // 1px de folga entre fatias (só quando há mais de uma).
            const folga = parte < 1 ? 1.2 : 0;
            return (
              <circle key={i} cx="50" cy="50" r={r} className="nx-rosca-fatia" stroke={`url(#${uid}r${i})`}
                strokeDasharray={`${Math.max(0, parte * volta - folga)} ${volta}`}
                strokeDashoffset={-inicio * volta} transform="rotate(-90 50 50)" />
            );
          })}
        </svg>
        <div className="nx-rosca-meio"><strong>{centro ?? total}</strong>{centroSub && <span>{centroSub}</span>}</div>
      </div>
      <div className="nx-legenda">
        {itens.map((x, i) => {
          const c = corDe(i, x.cor);
          return (
            <div key={i} className="nx-legenda-item" style={vars(c)}>
              <span className="nx-ponto" />
              <span className="nx-legenda-nome">{x.label}</span>
              <span className="nx-legenda-num">{x.valor} <em>{Math.round(((Number(x.valor) || 0) / total) * 100)}%</em></span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Curva suave passando pelos pontos (Catmull-Rom convertido pra Bézier).
function curva(pts) {
  if (pts.length < 2) return pts.length ? `M${pts[0][0]},${pts[0][1]}` : "";
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${p2[0]},${p2[1]}`;
  }
  return d;
}

// Área com ondas (uma ou mais séries na mesma escala). series: {nome, valores[], cor?}
// rotulos: textos do eixo de baixo. Os números ficam em HTML por cima do SVG, então não
// encolhem no celular.
export function AreaNeon({ series, rotulos, altura = 190 }) {
  const uid = useId().replace(/:/g, "");
  const n = rotulos.length;
  if (!n) return <p className="vazio">Sem dados no período.</p>;
  const teto = Math.max(...series.flatMap((s) => s.valores.map((v) => Number(v) || 0)), 1);
  const L = 100, A = 100, topo = 18;
  const xDe = (i) => (n === 1 ? L / 2 : 4 + (i * (L - 8)) / (n - 1));
  const yDe = (v) => A - ((Number(v) || 0) / teto) * (A - topo);
  return (
    <div className="nx-area">
      {series.length > 1 && (
        <div className="nx-legenda nx-legenda-linha">
          {series.map((s, si) => (
            <div key={si} className="nx-legenda-item" style={vars(corDe(si, s.cor))}><span className="nx-ponto" /><span className="nx-legenda-nome">{s.nome}</span></div>
          ))}
        </div>
      )}
      <div className="nx-area-graf" style={{ height: altura }}>
        <svg viewBox={`0 0 ${L} ${A}`} preserveAspectRatio="none" aria-hidden="true">
          <defs>
            {series.map((s, si) => {
              const c = corDe(si, s.cor);
              return (
                <g key={si}>
                  <linearGradient id={`${uid}f${si}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor={c[0]} stopOpacity=".55" />
                    <stop offset="1" stopColor={c[1]} stopOpacity="0" />
                  </linearGradient>
                  <linearGradient id={`${uid}l${si}`} x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0" stopColor={c[1]} />
                    <stop offset="1" stopColor={c[0]} />
                  </linearGradient>
                </g>
              );
            })}
          </defs>
          {[0.25, 0.5, 0.75].map((f) => (
            <line key={f} x1="0" x2={L} y1={topo + (A - topo) * f} y2={topo + (A - topo) * f} className="nx-grade" vectorEffect="non-scaling-stroke" />
          ))}
          {series.map((s, si) => {
            const pts = s.valores.map((v, i) => [xDe(i), yDe(v)]);
            const linha = curva(pts);
            return (
              <g key={si}>
                <path d={`${linha} L${pts[pts.length - 1][0]},${A} L${pts[0][0]},${A} Z`} fill={`url(#${uid}f${si})`} />
                <path d={linha} fill="none" stroke={`url(#${uid}l${si})`} className="nx-area-linha" vectorEffect="non-scaling-stroke" />
              </g>
            );
          })}
        </svg>
        {series.map((s, si) => s.valores.map((v, i) => (
          <span key={`${si}-${i}`} className="nx-area-ponto" style={{ ...vars(corDe(si, s.cor)), left: `${xDe(i)}%`, top: `${yDe(v)}%` }}>
            <b>{s.textos?.[i] ?? v}</b>
          </span>
        )))}
      </div>
      <div className="nx-area-eixo">
        {rotulos.map((r, i) => <span key={i} style={{ left: `${xDe(i)}%` }}>{r}</span>)}
      </div>
    </div>
  );
}

// Uso do app por vendedor e gerente (2026-10-29, Felipe): quantas vezes por dia abre, quanto tempo
// fica, último acesso, mapa de calor por dia da semana e hora, telas mais usadas e as aberturas de
// hoje. Só proprietários veem. Mapa no neon dos gráficos (pedido dele): azul pouco, roxo médio,
// magenta muito.
import { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { NEON } from "./Graficos.jsx";

const DIAS = [[1, "seg"], [2, "ter"], [3, "qua"], [4, "qui"], [5, "sex"], [6, "sáb"], [0, "dom"]];
const TELAS = { crm: "CRM", rotina: "Rotina", agenda: "Agenda", followups: "Follow-up", veiculos: "Veículos",
  dashboard: "Dashboard", inicio: "Início", equipe: "Equipe", mensal: "Mensal", status: "Status", login: "Login" };
const FAIXAS = [NEON[2], NEON[1], NEON[0]]; // azul, roxo, magenta

function duracao(min) {
  if (!min) return "0 min";
  const h = Math.floor(min / 60), m = min % 60;
  return h ? `${h}h${m ? ` ${String(m).padStart(2, "0")}min` : ""}` : `${m} min`;
}
function quando(d) {
  if (!d) return "nunca";
  const min = Math.round((Date.now() - new Date(d)) / 60000);
  if (min < 2) return "agora";
  if (min < 60) return `há ${min} min`;
  if (min < 24 * 60) return `há ${Math.round(min / 60)}h`;
  return new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}
const hora = d => new Date(d).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
const primeiro = n => n.split(" ")[0];

function Metrica({ titulo, valor, sub }) {
  return (
    <div style={{ background: "var(--surface2)", borderRadius: 10, padding: "10px 12px", minWidth: 0 }}>
      <div style={{ fontSize: 11, color: "var(--muted)" }}>{titulo}</div>
      <div style={{ fontSize: 20, fontWeight: 700, fontVariantNumeric: "tabular-nums", marginTop: 2 }}>{valor}</div>
      {sub && <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 1 }}>{sub}</div>}
    </div>
  );
}

function Mapa({ calor }) {
  const cel = {};
  let max = 0, hMin = 8, hMax = 21;
  for (const [dow, h, m] of calor) {
    cel[`${dow}-${h}`] = m; max = Math.max(max, m);
    hMin = Math.min(hMin, h); hMax = Math.max(hMax, h);
  }
  const horas = Array.from({ length: hMax - hMin + 1 }, (_, i) => hMin + i);
  return (
    <div style={{ overflowX: "auto", paddingBottom: 4 }}>
      <div style={{ display: "grid", gridTemplateColumns: `34px repeat(${horas.length}, minmax(22px, 1fr))`, gap: 3, minWidth: 34 + horas.length * 25, fontSize: 10, color: "var(--muted)" }}>
        <div />
        {horas.map(h => <div key={h} style={{ textAlign: "center" }}>{h}h</div>)}
        {DIAS.map(([dow, nome]) => [
          <div key={nome} style={{ alignSelf: "center", fontSize: 11 }}>{nome}</div>,
          ...horas.map(h => {
            const m = cel[`${dow}-${h}`] || 0, t = max ? m / max : 0;
            const [c1, c2] = FAIXAS[Math.min(2, Math.floor(t * 3))];
            return <div key={`${dow}-${h}`} title={`${nome} ${h}h: ${duracao(m)}`} style={{
              height: 22, borderRadius: 4,
              background: m ? `linear-gradient(135deg, ${c1}, ${c2})` : "var(--nx-trilho)",
              opacity: m ? 0.35 + 0.65 * t : 1,
              boxShadow: t > 0.66 ? `0 0 10px ${c1}88` : "none",
            }} />;
          }),
        ])}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--muted)", marginTop: 8 }}>
        pouco {FAIXAS.map(([c1, c2]) => <span key={c1} style={{ width: 14, height: 10, borderRadius: 3, background: `linear-gradient(135deg, ${c1}, ${c2})` }} />)} muito
      </div>
    </div>
  );
}

export default function UsoDoApp() {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState(false);
  const [sel, setSel] = useState(null);
  useEffect(() => { api.getUsoApp(30).then(setDados).catch(() => setErro(true)); }, []);

  if (erro) return null;
  if (!dados) return null;
  const pessoas = dados.pessoas || [];
  const p = pessoas.find(x => x.id === sel) || pessoas[0];
  const totalTelas = p ? p.telas.reduce((s, t) => s + t.minutos, 0) : 0;

  return (
    <div className="card" style={{ marginTop: 20 }}>
      <div className="card-title"><i className="ti ti-device-mobile" /> Uso do app</div>
      {!dados.desde ? (
        <div style={{ fontSize: 13, color: "var(--muted)" }}>Começou a contar agora. Os números aparecem conforme a equipe abre o painel ou o app.</div>
      ) : (<>
        <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 10 }}>
          Contando desde {new Date(dados.desde).toLocaleDateString("pt-BR")} ({dados.dias_medidos} dia{dados.dias_medidos > 1 ? "s" : ""}). Só conta o tempo com o app aberto na tela.
        </div>
        <div style={{ overflowX: "auto", marginBottom: 14 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 420 }}>
            <thead><tr style={{ color: "var(--muted)", fontSize: 11, textAlign: "left" }}>
              <th style={{ padding: "6px 4px", fontWeight: 500 }}>Pessoa</th>
              <th style={{ padding: "6px 4px", fontWeight: 500, textAlign: "right" }}>Aberturas/dia</th>
              <th style={{ padding: "6px 4px", fontWeight: 500, textAlign: "right" }}>Tempo/dia</th>
              <th style={{ padding: "6px 4px", fontWeight: 500, textAlign: "right" }}>Último acesso</th>
            </tr></thead>
            <tbody>
              {pessoas.map(x => (
                <tr key={x.id} onClick={() => setSel(x.id)} style={{ cursor: "pointer", borderTop: "1px solid var(--border)", background: x.id === p?.id ? "var(--brand-soft)" : undefined }}>
                  <td style={{ padding: "8px 4px" }}>{x.nome}<span style={{ color: "var(--muted)", fontSize: 11 }}> · {x.role === "gerente" ? "gerente" : x.loja}</span></td>
                  <td style={{ padding: "8px 4px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{String(x.aberturas_dia).replace(".", ",")}</td>
                  <td style={{ padding: "8px 4px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{duracao(x.minutos_dia)}</td>
                  <td style={{ padding: "8px 4px", textAlign: "right", color: x.ultimo ? "var(--fg)" : "var(--danger)" }}>{quando(x.ultimo)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {p && (<>
          <div className="sec-label" style={{ marginTop: 6 }}>{p.nome}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 8, marginBottom: 14 }}>
            <Metrica titulo="Aberturas por dia" valor={String(p.aberturas_dia).replace(".", ",")} sub={`${p.sessoes} no total`} />
            <Metrica titulo="Tempo no app por dia" valor={duracao(p.minutos_dia)} sub={`usou em ${p.dias_com_uso} de ${dados.dias_medidos} dias`} />
            <Metrica titulo="Do aviso de lead até abrir" valor={p.aviso?.abertos ? duracao(p.aviso.mediana_min) : "–"}
              sub={p.aviso ? `abriu ${p.aviso.abertos} de ${p.aviso.avisos} avisos` : "sem aviso de lead ainda"} />
            <Metrica titulo="Último acesso" valor={quando(p.ultimo)} />
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>Tempo no app por dia da semana e hora</div>
          <Mapa calor={p.calor} />
          {totalTelas > 0 && (<>
            <div style={{ fontSize: 12, color: "var(--muted)", margin: "14px 0 6px" }}>Onde passa o tempo</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {p.telas.filter(t => t.minutos > 0).map(t => (
                <span key={t.tela} style={{ fontSize: 12, background: "var(--surface2)", borderRadius: 999, padding: "4px 10px" }}>
                  {TELAS[t.tela] || t.tela} <b>{Math.round((t.minutos / totalTelas) * 100)}%</b>
                </span>
              ))}
            </div>
          </>)}
          <div style={{ fontSize: 12, color: "var(--muted)", margin: "14px 0 4px" }}>Hoje</div>
          {p.hoje.length ? p.hoje.map(s => {
            const min = Math.round((new Date(s.fim) - new Date(s.inicio)) / 60000);
            const telas = Object.keys(s.telas || {}).map(k => TELAS[k] || k).join(", ");
            return (
              <div key={s.inicio} style={{ display: "flex", gap: 10, padding: "7px 0", borderTop: "1px solid var(--border)", fontSize: 13 }}>
                <span style={{ width: 44, color: "var(--muted)", fontVariantNumeric: "tabular-nums" }}>{hora(s.inicio)}</span>
                <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{telas || "Início"}<span style={{ color: "var(--muted)" }}> · {s.aparelho}</span></span>
                <span style={{ color: "var(--muted)", fontVariantNumeric: "tabular-nums" }}>{min < 1 ? "menos de 1 min" : duracao(min)}</span>
              </div>
            );
          }) : <div style={{ fontSize: 13, color: "var(--muted)" }}>Não abriu o app hoje.</div>}
        </>)}
      </>)}
    </div>
  );
}

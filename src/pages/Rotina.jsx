import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { getRotina } from "../api.js";
import { isOwner, isManager } from "../auth.js";
import { ChatwootLink } from "../components/ChatwootLink.jsx";

// Rotina do dia (2026-10-29, Felipe): "na rotina diária aparecem os relatórios por loja do que cada
// um tem pra fazer no dia, os leads que chegaram por loja e por vendedor; pros gerentes o resumo do
// que cada vendedor tem pra fazer ou atender, com botões de atalho pras mensagens e ligações, o que
// já fez, o que tem pra fazer e o que está acumulado". Vendedor vê só o dele, gerente a loja dele,
// admin as duas. Só leitura: os botões abrem a conversa no Chatwoot, o discador ou o card no CRM.
// Regras de cada lista: backend src/routes/rotina.js.

const LOJA_CURTA = { 1: "Curitibanos", 2: "Campos Novos" };
const TEMP = { quente: "badge-danger", morno: "badge-warning", frio: "badge-muted" };

function hojeISO(desloc = 0) {
  const d = new Date(); d.setDate(d.getDate() + desloc);
  return d.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
}
function dataBR(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const t = new Date(y, m - 1, d).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit" });
  return t[0].toUpperCase() + t.slice(1);
}
// "09:42" se foi no dia; "ontem", "há 5 dias" se foi antes.
function quando(ts, dia) {
  if (!ts) return "";
  const t = new Date(ts);
  const diaTs = t.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
  if (diaTs === dia) return t.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
  const dias = Math.round((new Date(dia) - new Date(diaTs)) / 864e5);
  return dias === 1 ? "ontem" : `há ${dias} dias`;
}
// Só número de telefone de verdade vira botão de ligar (contato @lid não tem número).
function telLink(tel) {
  const d = String(tel || "").replace(/\D/g, "");
  if (d.length < 10 || d.length > 13) return null;
  return `tel:+${d.startsWith("55") ? d : "55" + d}`;
}

function LinhaLead({ l, inbox, dia, info }) {
  const tel = telLink(l.telefone);
  return (
    <div className="rot-lead">
      <div className="rot-lead-info">
        <div className="rot-lead-nome">
          {l.nome || "Sem nome"}
          {l.temperatura && <span className={`badge ${TEMP[l.temperatura] || "badge-muted"}`}>{l.temperatura}</span>}
        </div>
        <div className="rot-lead-sub">{[l.veiculo || "carro não informado", info].filter(Boolean).join(" | ")}</div>
      </div>
      <div className="rot-acoes">
        {l.conv_id
          ? <ChatwootLink conv_id={l.conv_id} inbox_id={inbox}>Mensagem</ChatwootLink>
          : null}
        {tel && <a className="btn btn-ghost btn-sm rot-btn" href={tel}><i className="ti ti-phone" />Ligar</a>}
        <Link className="btn btn-ghost btn-sm rot-btn" to={`/crm?lead=${l.id}`} aria-label="Abrir card no CRM"><i className="ti ti-external-link" />Card</Link>
      </div>
    </div>
  );
}

function Grupo({ titulo, tom, itens, inbox, dia, info, total, vazio }) {
  const [todos, setTodos] = useState(false);
  if (!itens.length && !vazio) return null;
  const LIM = 8;
  const mostra = todos ? itens : itens.slice(0, LIM);
  return (
    <div className="rot-grupo">
      <div className="rot-grupo-tit">
        <span className={`rot-dot rot-${tom}`} />{titulo}
        <span className="rot-num">{total ?? itens.length}</span>
      </div>
      {!itens.length && <div className="rot-vazio">{vazio}</div>}
      {mostra.map(l => <LinhaLead key={`${l.id}-${l.agenda_id || ""}`} l={l} inbox={inbox} dia={dia} info={info(l)} />)}
      {itens.length > LIM && (
        <button type="button" className="btn btn-ghost btn-sm rot-mais" onClick={() => setTodos(!todos)}>
          {todos ? "Mostrar menos" : `Ver mais ${itens.length - LIM}`}
        </button>
      )}
    </div>
  );
}

function Vendedor({ v, inbox, dia, aberto, parado }) {
  const aFazer = v.responder_hoje.length + v.visitas.length + v.confirmar.length;
  const feito = v.feito.respondidos + v.feito.movidos + v.feito.visitas + v.feito.vendas;
  const emDia = !aFazer && !v.acumulado.length;
  return (
    <details className="card rot-vend" open={aberto}>
      <summary className="rot-vend-head">
        {v.foto_url ? <img className="rot-av" src={v.foto_url} alt="" /> : <span className="rot-av">{(v.nome || "?")[0]}</span>}
        <span className="rot-vend-nome">{v.nome}</span>
        <span className="rot-pills">
          {aFazer > 0 && <span className="badge badge-warning">{aFazer} pra hoje</span>}
          {v.acumulado.length > 0 && <span className="badge badge-danger">{v.acumulado.length} acumulado</span>}
          {v.retomar_total > 0 && <span className="badge badge-muted">{v.retomar_total} retomar</span>}
          {emDia && <span className="badge badge-success">em dia</span>}
          <span className="badge badge-brand">{feito} feito</span>
        </span>
        <i className="ti ti-chevron-down rot-seta" />
      </summary>

      <div className="rot-feito">
        <span><b>{v.chegaram}</b> chegaram</span>
        <span><b>{v.feito.respondidos}</b> respondidos</span>
        <span><b>{v.feito.movidos}</b> cards movidos</span>
        <span><b>{v.feito.visitas}</b> visitas feitas</span>
        <span><b>{v.feito.vendas}</b> vendas</span>
      </div>

      <Grupo titulo="Responder agora" tom="danger" itens={v.responder_hoje} inbox={inbox} dia={dia}
        info={l => `passado às ${quando(l.passado_em, dia)}`} vazio="Nenhum lead novo esperando resposta." />
      <Grupo titulo="Visitas do dia" tom="success" itens={v.visitas} inbox={inbox} dia={dia}
        info={l => `${quando(l.data_hora, dia)} | ${String(l.status || "").replace(/_/g, " ")}`} />
      <Grupo titulo="Confirmar visita que o cliente mencionou" tom="warning" itens={v.confirmar} inbox={inbox} dia={dia}
        info={l => `mencionou ${quando(l.data_hora, dia)}`} />
      <Grupo titulo="Acumulado sem resposta" tom="danger" itens={v.acumulado.slice().reverse()} inbox={inbox} dia={dia}
        info={l => `passado ${quando(l.passado_em, dia)}`} />
      <Grupo titulo={`Retomar contato (negociação parada há ${parado}+ dias)`} tom="muted" itens={v.retomar} total={v.retomar_total}
        inbox={inbox} dia={dia} info={l => `último contato ${quando(l.ultimo_em, dia)}`} />
    </details>
  );
}

function Loja({ loja, dia, souVendedor, parado }) {
  const vs = loja.vendedores;
  const soma = (f) => vs.reduce((s, v) => s + f(v), 0);
  const comIA = loja.chegaram.filter(c => !c.vendedor_nome).length;
  const porVend = vs.map(v => [v.nome, v.chegaram]).filter(([, n]) => n > 0);
  return (
    <section className="rot-loja">
      {!souVendedor && <h2 className="rot-loja-tit"><i className="ti ti-building-store" /> {LOJA_CURTA[loja.id] || loja.nome}</h2>}
      <div className="metrics-grid">
        {!souVendedor && <div className="metric-card"><div className="metric-label">Chegaram</div><div className="metric-value">{loja.chegaram.length}</div></div>}
        <div className="metric-card"><div className="metric-label">Responder</div><div className="metric-value">{soma(v => v.responder_hoje.length)}</div></div>
        <div className="metric-card"><div className="metric-label">Visitas</div><div className="metric-value">{soma(v => v.visitas.length + v.confirmar.length)}</div></div>
        <div className="metric-card"><div className="metric-label">Acumulado</div><div className="metric-value">{soma(v => v.acumulado.length)}</div></div>
        <div className="metric-card"><div className="metric-label">Retomar</div><div className="metric-value">{soma(v => v.retomar_total)}</div></div>
        <div className="metric-card"><div className="metric-label">Feito</div><div className="metric-value">{soma(v => v.feito.respondidos + v.feito.movidos + v.feito.visitas + v.feito.vendas)}</div></div>
      </div>

      {!souVendedor && (
        <details className="card rot-vend">
          <summary className="rot-vend-head">
            <span className="rot-vend-nome">Leads que chegaram</span>
            <span className="rot-pills">
              {porVend.map(([n, q]) => <span key={n} className="badge badge-muted">{n.split(" ")[0]} {q}</span>)}
              {comIA > 0 && <span className="badge badge-brand">com a IA {comIA}</span>}
              {!loja.chegaram.length && <span className="badge badge-muted">nenhum</span>}
            </span>
            <i className="ti ti-chevron-down rot-seta" />
          </summary>
          <Grupo titulo="Entraram no dia" tom="muted" itens={loja.chegaram} inbox={loja.inbox_id} dia={dia}
            info={l => `${quando(l.criado_em, dia)} | ${l.vendedor_nome || "com a IA"}`} vazio="Nenhum lead entrou." />
        </details>
      )}

      {vs.map(v => <Vendedor key={v.id} v={v} inbox={loja.inbox_id} dia={dia} aberto={souVendedor} parado={parado} />)}
      {!vs.length && <div className="empty-state"><p>Nenhum vendedor ativo nesta loja.</p></div>}
    </section>
  );
}

export default function Rotina() {
  const souVendedor = !isManager();
  const [desloc, setDesloc] = useState(0);
  const [loja, setLoja] = useState("todas");
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState(null);
  const [carregando, setCarregando] = useState(false);

  const carregar = useCallback(() => {
    setCarregando(true); setErro(null);
    getRotina(hojeISO(desloc), isOwner() && loja !== "todas" ? loja : null)
      .then(setDados)
      .catch(() => setErro("Erro ao carregar a rotina do dia. Tente novamente."))
      .finally(() => setCarregando(false));
  }, [desloc, loja]);
  useEffect(() => { carregar(); }, [carregar]);

  return (
    <div className="rotina">
      <div className="page-header">
        <h1 className="page-title"><i className="ti ti-list-check" /> Rotina do dia</h1>
        <div className="rot-filtros">
          <div className="seg">
            <button type="button" className={`seg-btn ${desloc === -1 ? "active" : ""}`} onClick={() => setDesloc(-1)}>Ontem</button>
            <button type="button" className={`seg-btn ${desloc === 0 ? "active" : ""}`} onClick={() => setDesloc(0)}>Hoje</button>
          </div>
          {isOwner() && (
            <div className="seg">
              {[["todas", "Todas"], ["1", "Curitibanos"], ["2", "Campos Novos"]].map(([k, n]) =>
                <button key={k} type="button" className={`seg-btn ${loja === k ? "active" : ""}`} onClick={() => setLoja(k)}>{n}</button>)}
            </div>
          )}
          <button type="button" className="btn btn-ghost btn-sm rot-atualizar" onClick={carregar} disabled={carregando} aria-label="Atualizar">
            {carregando ? <span className="spinner" /> : <i className="ti ti-refresh" />}
          </button>
        </div>
      </div>

      {dados && <p className="rot-sub">{dataBR(dados.dia)}</p>}
      {erro && <div className="empty-state"><i className="ti ti-alert-triangle" /><p>{erro}</p></div>}
      {!dados && !erro && <div className="empty-state"><span className="spinner" /><p>Carregando...</p></div>}
      {dados && dados.lojas.map(l => <Loja key={l.id} loja={l} dia={dados.dia} souVendedor={souVendedor} parado={dados.parado_dias} />)}
    </div>
  );
}

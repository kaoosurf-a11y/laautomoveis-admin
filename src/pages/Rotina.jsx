import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { getRotina, registrarAcaoRotina } from "../api.js";
import { isOwner, isManager, estaVendoComo } from "../auth.js";
import { ChatwootLink } from "../components/ChatwootLink.jsx";

// Rotina do dia (2026-10-29, Felipe): "na rotina diária aparecem os relatórios por loja do que cada
// um tem pra fazer no dia, os leads que chegaram por loja e por vendedor; pros gerentes o resumo do
// que cada vendedor tem pra fazer ou atender, com botões de atalho pras mensagens e ligações, o que
// já fez, o que tem pra fazer e o que está acumulado". Vendedor vê só o dele, gerente a loja dele,
// admin as duas. Só leitura: os botões abrem a conversa no Chatwoot, o discador ou o card no CRM.
// Regras de cada lista: backend src/routes/rotina.js.
//
// Corrida do dia (Felipe 29/10, "quero gamificado"): pista com carrinho e chegada ao lado do nome do
// vendedor; cada missão cumprida dá pontos (valores e chegada vêm do backend) e o carrinho avança;
// estrelas nos marcos. Toque em Mensagem ou Ligar marca o lead como "missão cumprida" (+2, 1 por lead
// por dia). Vendedor joga; gerente e admin veem a corrida de todos, em ordem de pontos.

const LOJA_CURTA = { 1: "Curitibanos", 2: "Campos Novos" };

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

// Nome só de emoji ou vazio vira "Sem nome" com o final do telefone, pra dar pra achar.
function nomeLead(l) {
  const n = String(l.nome || "").trim();
  if (/[A-Za-zÀ-ú]/.test(n)) return n;
  const d = String(l.telefone || "").replace(/\D/g, "");
  return d.length >= 4 ? `Sem nome (final ${d.slice(-4)})` : "Sem nome";
}

function LinhaLead({ l, inbox, info, cumprida, onAcao }) {
  const tel = telLink(l.telefone);
  return (
    <div className={`rot-lead ${cumprida ? "rot-cumprida" : ""}`}>
      <div className="rot-lead-info">
        <div className="rot-lead-nome">
          {nomeLead(l)}
          {/* Só quente ganha etiqueta: quase todo lead é "morno" e a etiqueta repetida virava ruído. */}
          {l.temperatura === "quente" && <span className="badge badge-danger">quente</span>}
          {cumprida && <span className="badge badge-success rot-selo"><i className="ti ti-circle-check" />Missão cumprida</span>}
        </div>
        <div className="rot-lead-sub">{[l.veiculo || "carro não informado", info].filter(Boolean).join(" | ")}</div>
      </div>
      <div className="rot-acoes">
        {l.conv_id ? <ChatwootLink conv_id={l.conv_id} inbox_id={inbox} onClick={() => onAcao?.(l, "mensagem")}>Mensagem</ChatwootLink> : null}
        {tel && <a className="btn btn-ghost btn-sm rot-btn" href={tel} onClick={() => onAcao?.(l, "ligar")}><i className="ti ti-phone" />Ligar</a>}
        <Link className="btn btn-ghost btn-sm rot-btn" to={`/crm?lead=${l.id}`} aria-label="Abrir card no CRM"><i className="ti ti-external-link" />Card</Link>
      </div>
    </div>
  );
}

function Grupo({ titulo, tom, itens, inbox, info, total, vazio, cumpridas, onAcao }) {
  const [todos, setTodos] = useState(false);
  if (!itens.length && !vazio) return null;
  const LIM = 10;
  const mostra = todos ? itens : itens.slice(0, LIM);
  return (
    <div className="rot-grupo">
      {titulo && (
        <div className="rot-grupo-tit">
          <span className={`rot-dot rot-${tom}`} />{titulo}
          <span className="rot-num">{total ?? itens.length}</span>
        </div>
      )}
      {!itens.length && <div className="rot-vazio">{vazio}</div>}
      <div className="rot-lista">
        {mostra.map(l => <LinhaLead key={`${l.id}-${l.agenda_id || ""}`} l={l} inbox={inbox} info={info(l)}
          cumprida={cumpridas?.has(l.id)} onAcao={onAcao} />)}
      </div>
      {itens.length > LIM && (
        <button type="button" className="btn btn-ghost btn-sm rot-mais" onClick={() => setTodos(!todos)}>
          {todos ? "Mostrar menos" : `Ver mais ${itens.length - LIM}`}
        </button>
      )}
    </div>
  );
}

const MISSAO = {
  respondeu: { nome: "Respondeu o lead", icone: "ti-message-circle" },
  moveu: { nome: "Moveu o card", icone: "ti-target" },
  visita: { nome: "Visita feita", icone: "ti-building-store" },
  venda: { nome: "Venda", icone: "ti-trophy" },
  contato: { nome: "Contato pelo atalho", icone: "ti-phone" },
};

// Pista da corrida: carrinho anda de 0 até a chegada (meta); estrelas nos marcos.
function Pista({ pontos, meta, marcos }) {
  const pct = Math.min(100, Math.round((pontos / meta) * 100));
  const chegou = pontos >= meta;
  const estrelas = marcos.filter(m => pontos >= m).length;
  return (
    <span className={`pista-wrap ${chegou ? "pista-chegou" : ""}`} title={`${pontos} de ${meta} pontos`}>
      <span className="pista" role="img" aria-label={`Corrida: ${pontos} de ${meta} pontos, ${estrelas} estrelas`}>
        <span className="pista-rastro" style={{ "--p": pct }} />
        {marcos.slice(0, -1).map(m => (
          <i key={m} className={`ti ti-star${pontos >= m ? " on" : ""} pista-marco`} style={{ "--p": Math.round((m / meta) * 100) }} />
        ))}
        <i className="ti ti-flag-3 pista-chegada" />
        <i className="ti ti-car pista-carro" style={{ "--p": pct }} />
      </span>
      <span className="pista-placar">
        <b>{pontos}</b><small>pts</small>
        <span className="pista-estrelas">
          {marcos.map((m, i) => <i key={m} className={`ti ti-star${i < estrelas ? " on" : ""}`} />)}
        </span>
      </span>
    </span>
  );
}

// Felipe 29/10 ("dá pra melhorar a organização"): uma lista por vez, em abas, em vez de tudo empilhado.
// Abre na primeira aba que tem coisa: Hoje, depois Acumulado, depois Retomar.
function Vendedor({ v, inbox, dia, aberto, parado, joga, posicao, regras, avisar }) {
  const aFazer = v.responder_hoje.length + v.visitas.length + v.confirmar.length;
  const emDia = !aFazer && !v.acumulado.length;
  const [aba, setAba] = useState(aFazer ? "hoje" : v.acumulado.length ? "acumulado" : v.retomar_total ? "retomar" : "hoje");
  // Placar local: o toque em Mensagem/Ligar já anda o carrinho na hora (o backend confirma os pontos).
  const [jogo, setJogo] = useState({ pontos: v.pontos, missoes: v.missoes });
  const placar = useRef(jogo);
  placar.current = jogo;
  useEffect(() => { setJogo({ pontos: v.pontos, missoes: v.missoes }); }, [v]);
  const cumpridas = new Set(jogo.missoes.map(m => m.id));
  const meta = v.meta;

  const onAcao = joga ? (l, tipo) => {
    if (placar.current.missoes.some(m => m.id === l.id && m.missao === "contato")) return;
    registrarAcaoRotina(l.id, tipo).then(r => {
      if (!r?.pontos) return;
      const antes = placar.current.pontos, pontos = antes + r.pontos;
      const estrela = regras.estrelas.find(e => antes < e && pontos >= e);
      placar.current = { pontos, missoes: [{ ...l, missao: "contato", pontos: r.pontos, em: new Date().toISOString() }, ...placar.current.missoes] };
      setJogo(placar.current);
      avisar(pontos >= meta && antes < meta ? `Chegou! ${pontos} pontos hoje.`
        : estrela ? `+${r.pontos} pontos. Nova estrela!` : `+${r.pontos} pontos. Missão cumprida!`);
    }).catch(() => {});
  } : null;

  const contar = (k) => jogo.missoes.filter(m => m.missao === k).length;
  const ABAS = [["hoje", "Hoje", aFazer], ["acumulado", "Acumulado", v.acumulado.length], ["retomar", "Retomar", v.retomar_total], ["feito", "Missões", jogo.missoes.length]];
  const g = { inbox, cumpridas, onAcao };
  return (
    <details className="card rot-vend" open={aberto}>
      <summary className="rot-vend-head">
        {posicao && <span className="rot-pos">{posicao}º</span>}
        {v.foto_url ? <img className="rot-av" src={v.foto_url} alt="" /> : <span className="rot-av">{(v.nome || "?")[0]}</span>}
        <span className="rot-vend-nome">{v.nome}</span>
        <Pista pontos={jogo.pontos} meta={meta} marcos={regras.estrelas} />
        <span className="rot-pills">
          {aFazer > 0 && <span className="badge badge-warning">{aFazer} pra hoje</span>}
          {v.acumulado.length > 0 && <span className="badge badge-danger">{v.acumulado.length} acumulado</span>}
          {v.retomar_total > 0 && <span className="badge badge-muted">{v.retomar_total} retomar</span>}
          {emDia && <span className="badge badge-success">em dia</span>}
        </span>
        <i className="ti ti-chevron-down rot-seta" />
      </summary>

      <div className="rot-abas">
        <div className="seg">
          {ABAS.map(([k, n, q]) => (
            <button key={k} type="button" className={`seg-btn ${aba === k ? "active" : ""}`} onClick={() => setAba(k)}>
              {n}<span className="rot-aba-num">{q}</span>
            </button>
          ))}
        </div>
      </div>

      {aba === "hoje" && <>
        <Grupo {...g} titulo="Responder agora" tom="danger" itens={v.responder_hoje}
          info={l => `passado às ${quando(l.passado_em, dia)}`} vazio="Nenhum lead novo esperando resposta." />
        <Grupo {...g} titulo="Visitas do dia" tom="success" itens={v.visitas}
          info={l => `${quando(l.data_hora, dia)} | ${String(l.status || "").replace(/_/g, " ")}`} />
        <Grupo {...g} titulo="Confirmar visita que o cliente mencionou" tom="warning" itens={v.confirmar}
          info={l => `mencionou ${quando(l.data_hora, dia)}`} />
      </>}
      {aba === "acumulado" && <Grupo {...g} titulo="Passados em outros dias e ainda sem resposta" tom="danger" itens={v.acumulado.slice().reverse()}
        info={l => `passado ${quando(l.passado_em, dia)}`} vazio="Nada acumulado. Tudo respondido." />}
      {aba === "retomar" && <Grupo {...g} titulo={`Em negociação, sem conversa há ${parado}+ dias (quentes primeiro)`} tom="muted" itens={v.retomar}
        total={v.retomar_total} info={l => `último contato ${quando(l.ultimo_em, dia)}`} vazio="Nenhuma negociação parada." />}
      {aba === "feito" && (
        <div className="rot-grupo">
          <div className="rot-feito-grade">
            {[["respondeu", "Respondidos"], ["moveu", "Cards movidos"], ["visita", "Visitas feitas"], ["venda", "Vendas"], ["contato", "Contatos"]].map(([k, n]) => (
              <div key={k} className="rot-feito-item"><b>{contar(k)}</b><span>{n}</span><small>+{regras.pontos[k]} cada</small></div>
            ))}
          </div>
          <div className="rot-grupo-tit rot-missoes-tit">
            <span className="rot-dot rot-success" />Missões cumpridas<span className="rot-num">{jogo.pontos} pts</span>
          </div>
          {!jogo.missoes.length && <div className="rot-vazio">{joga ? "Nenhuma missão ainda. Responda um lead ou toque em Mensagem ou Ligar pra largar na frente." : "Nenhuma missão cumprida ainda."}</div>}
          <div className="rot-lista">
            {jogo.missoes.map((m, i) => (
              <div key={`${m.missao}-${m.id}-${i}`} className="rot-lead rot-missao">
                <i className={`ti ${MISSAO[m.missao]?.icone || "ti-check"} rot-missao-ic`} />
                <div className="rot-lead-info">
                  <div className="rot-lead-nome">{MISSAO[m.missao]?.nome || m.missao}</div>
                  <div className="rot-lead-sub">{[nomeLead(m), quando(m.em, dia)].filter(Boolean).join(" | ")}</div>
                </div>
                <span className="rot-missao-pts">+{m.pontos}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </details>
  );
}

function Loja({ loja, dia, souVendedor, parado, regras, avisar }) {
  // Gerente e admin veem a corrida: vendedores em ordem de pontos, com a posição.
  const vs = souVendedor ? loja.vendedores : [...loja.vendedores].sort((a, b) => b.pontos - a.pontos);
  const soma = (f) => vs.reduce((s, v) => s + f(v), 0);
  const comIA = loja.chegaram.filter(c => !c.vendedor_nome).length;
  const porVend = vs.map(v => [v.nome, v.chegaram]).filter(([, n]) => n > 0);
  return (
    <section className="rot-loja">
      {!souVendedor && <h2 className="rot-loja-tit"><i className="ti ti-building-store" /> {LOJA_CURTA[loja.id] || loja.nome}</h2>}
      {/* Vendedor já vê os mesmos números nas abas do card dele. */}
      {!souVendedor && <div className="metrics-grid">
        <div className="metric-card"><div className="metric-label">Chegaram</div><div className="metric-value">{loja.chegaram.length}</div></div>
        <div className="metric-card"><div className="metric-label">Responder</div><div className="metric-value">{soma(v => v.responder_hoje.length)}</div></div>
        <div className="metric-card"><div className="metric-label">Visitas</div><div className="metric-value">{soma(v => v.visitas.length + v.confirmar.length)}</div></div>
        <div className="metric-card"><div className="metric-label">Acumulado</div><div className="metric-value">{soma(v => v.acumulado.length)}</div></div>
        <div className="metric-card"><div className="metric-label">Retomar</div><div className="metric-value">{soma(v => v.retomar_total)}</div></div>
        <div className="metric-card"><div className="metric-label">Pontos</div><div className="metric-value">{soma(v => v.pontos)}</div></div>
      </div>}

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
          <Grupo itens={loja.chegaram} inbox={loja.inbox_id}
            info={l => `${quando(l.criado_em, dia)} | ${l.vendedor_nome || "com a IA"}`} vazio="Nenhum lead entrou." />
        </details>
      )}

      {vs.map((v, i) => <Vendedor key={v.id} v={v} inbox={loja.inbox_id} dia={dia} aberto={souVendedor} parado={parado}
        joga={souVendedor && !estaVendoComo() && dia === hojeISO()} posicao={souVendedor ? null : i + 1} regras={regras} avisar={avisar} />)}
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
  const [aviso, setAviso] = useState(null);
  const tAviso = useRef(null);
  const avisar = useCallback((t) => { setAviso(t); clearTimeout(tAviso.current); tAviso.current = setTimeout(() => setAviso(null), 2800); }, []);

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
      {dados && dados.lojas.map(l => <Loja key={l.id} loja={l} dia={dados.dia} souVendedor={souVendedor} parado={dados.parado_dias}
        regras={{ pontos: dados.pontos, estrelas: dados.estrelas }} avisar={avisar} />)}
      {aviso && <div className="rot-aviso" role="status"><i className="ti ti-star" />{aviso}</div>}
    </div>
  );
}

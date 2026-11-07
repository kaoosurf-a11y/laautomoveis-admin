import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { getRotina, registrarAcaoRotina } from "../api.js";
import { isOwner, isManager, estaVendoComo } from "../auth.js";
import { ChatwootLink } from "../components/ChatwootLink.jsx";
import BotaoLigar from "../components/BotaoLigar.jsx";

// Rotina do dia. 2026-11-07 (Felipe): "a pagina de rotina deve ser simples, clara e objetiva, o que os vendedores
// precisam fazer e o que deixaram de fazer, deve ser intuitiva e simples". Refeita em cima da de 29/10:
// - Vendedor: uma frase no topo (quantos clientes esperam e há quanto tempo o mais antigo), UMA lista "Responder
//   agora" (quem espera há mais tempo primeiro, mesmo tempo do boletim dos gerentes, só loja aberta), visitas do dia,
//   negociações paradas fechadas por padrão e "Feito hoje" com os pontos.
// - Gerente e dono: por loja, 3 números e uma linha por vendedor (quem deve mais primeiro); toque abre a lista dele.
// - Saíram a pista grande, as abas e o "Ontem" (a lista é sempre o estado de agora, igual ao boletim).
// Quem está esperando vem da regra única la_vw_nao_atendidos (a mesma do boletim). Toque em Mensagem (+2) ou Ligar
// (+3) conta clique e pontua 1 vez por tipo por cliente no dia. Mensagem abre a conversa no Chatwoot (no celular,
// no navegador: o app oficial do Chatwoot não abre link de servidor próprio).

const LOJA_CURTA = { 1: "Curitibanos", 2: "Campos Novos" };
const DIA_LOJA = 480; // 1 dia = 8 horas de loja aberta

function dataBR(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const t = new Date(y, m - 1, d).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit" });
  return t[0].toUpperCase() + t.slice(1);
}
function hora(ts) {
  return ts ? new Date(ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }) : "";
}
function diasSem(ts) {
  if (!ts) return "";
  const d = Math.max(0, Math.round((Date.now() - new Date(ts)) / 864e5));
  return d <= 1 ? "1 dia" : `${d} dias`;
}
// Nome só de emoji ou vazio vira "Sem nome" com o final do telefone, pra dar pra achar.
function nomeLead(l) {
  const n = String(l.nome || "").trim();
  if (/[A-Za-zÀ-ú]/.test(n)) return n;
  const d = String(l.telefone || "").replace(/\D/g, "");
  return d.length >= 4 ? `Sem nome (final ${d.slice(-4)})` : "Sem nome";
}
const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
const tomEspera = (min) => (min == null ? "" : min >= DIA_LOJA ? "rot-tarde" : min >= 60 ? "rot-atencao" : "");

// Lista de quem espera: junta "hoje" e "acumulado", quem espera há mais tempo primeiro.
function esperando(v) {
  return [...v.responder_hoje, ...v.acumulado].sort((a, b) => (b.espera_min ?? -1) - (a.espera_min ?? -1));
}

function LinhaCliente({ l, inbox, sub, subTom, feito, onAcao }) {
  return (
    <div className={`rot-lead ${feito ? "rot-cumprida" : ""}`}>
      <div className="rot-lead-info">
        <div className="rot-lead-nome">
          {nomeLead(l)}
          {l.temperatura === "quente" && <span className="badge badge-danger">quente</span>}
          {feito && <i className="ti ti-circle-check rot-ok" aria-label="Você já tocou neste cliente hoje" />}
        </div>
        <div className="rot-lead-sub">{l.veiculo || "ainda não escolheu o carro"}</div>
        {sub && <div className={`rot-espera ${subTom || ""}`}>{sub}</div>}
      </div>
      <div className="rot-acoes">
        {l.conv_id ? <ChatwootLink conv_id={l.conv_id} inbox_id={inbox} onClick={() => onAcao?.(l, "mensagem")}>Mensagem</ChatwootLink> : null}
        {/* 2026-11-06: numero mascarado pro vendedor; o botao pede o numero ao backend (fica registrado) e abre o discador. */}
        <BotaoLigar leadId={l.id} telefone={l.telefone} origem="rotina" className="btn btn-ghost btn-sm rot-btn" onLigou={() => onAcao?.(l, "ligar")} />
        <Link className="btn btn-ghost btn-sm btn-icon rot-btn" to={`/crm?lead=${l.id}`} aria-label="Abrir o card no CRM" title="Abrir o card no CRM"><i className="ti ti-external-link" /></Link>
      </div>
    </div>
  );
}

function Lista({ itens, limite = 8, render }) {
  const [todos, setTodos] = useState(false);
  const mostra = todos ? itens : itens.slice(0, limite);
  return (
    <>
      <div className="rot-lista">{mostra.map(render)}</div>
      {itens.length > limite && (
        <button type="button" className="btn btn-ghost btn-sm rot-mais" onClick={() => setTodos(!todos)}>
          {todos ? "Mostrar menos" : `Ver mais ${itens.length - limite}`}
        </button>
      )}
    </>
  );
}

function Estrelas({ pontos, meta }) {
  const n = Math.min(5, Math.floor((pontos / meta) * 5));
  return (
    <span className="rot-estrelas" aria-label={`${pontos} pontos, ${n} de 5 estrelas`} title={`${pontos} de ${meta} pontos`}>
      {[0, 1, 2, 3, 4].map(i => <i key={i} className={`ti ti-star${i < n ? " on" : ""}`} />)}
      <b>{pontos}</b><small>pts</small>
    </span>
  );
}

function tempoPainel(min) {
  if (!min) return "não abriu";
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)}h${String(min % 60).padStart(2, "0")}`;
}

// 2026-11-07 (Felipe: "para os vendedores devem aparecer somente as metricas pertinentes a ele e que gerem pontos,
// coloca tambem o tempo de permanencia no painel, quantos cards ele moveu e quantos cards o sistema moveu automatico
// pra ele"). Cada métrica mostra quantas vezes e quantos pontos já rendeu; mensagem e ligação contam a que pontuou
// (1 por cliente por dia). Embaixo, o dia dele no painel (sem pontos).
function FeitoHoje({ v, jogo, pontos }) {
  const conta = (k) => jogo.missoes.filter(m => m.missao === k).length;
  const itens = [
    ["respondeu", "Clientes respondidos"], ["mensagem", "Mensagens pela rotina"], ["ligar", "Ligações pela rotina"],
    ["moveu", "Cartões que você moveu"], ["visita", "Visitas feitas"], ["venda", "Vendas"],
  ];
  return (
    <div className="rot-feito">
      <div className="rot-feito-grade">
        {itens.map(([k, n]) => (
          <div key={k} className="rot-feito-item">
            <b>{conta(k)}</b><span>{n}</span>
            <small className={conta(k) ? "rot-ganhou" : ""}>{conta(k) ? `+${conta(k) * pontos[k]} pts` : `vale ${pontos[k]} pts`}</small>
          </div>
        ))}
      </div>
      <div className="rot-feito-pts"><span>Total de hoje</span><Estrelas pontos={jogo.pontos} meta={v.meta} /></div>
      <div className="rot-seu-dia">
        <div><i className="ti ti-device-mobile" /><span>Tempo no painel hoje</span><b>{tempoPainel(v.painel_min)}</b></div>
        <div><i className="ti ti-robot" /><span>Cartões seus que o sistema moveu</span><b>{v.sistema_moveu || 0}</b></div>
      </div>
    </div>
  );
}

// Corpo do vendedor: o mesmo pro vendedor (a tela dele) e pro gerente (ao abrir a linha).
function Tarefas({ v, inbox, jogo, onAcao, parado }) {
  const lista = esperando(v);
  const tocados = new Set(jogo.missoes.filter(m => m.missao === "mensagem" || m.missao === "ligar").map(m => m.id));
  const visitas = [...v.visitas, ...v.confirmar];
  return (
    <div className="rot-corpo">
      <h3 className="rot-sec"><span className="rot-dot rot-danger" />Responder agora<span className="rot-num">{lista.length}</span></h3>
      {lista.length
        ? <Lista itens={lista} render={l => (
            <LinhaCliente key={l.id} l={l} inbox={inbox} sub={l.espera || `passado ${diasSem(l.passado_em)} atrás`}
              subTom={tomEspera(l.espera_min)} feito={tocados.has(l.id)} onAcao={onAcao} />)} />
        : <div className="rot-vazio rot-vazio-ok"><i className="ti ti-circle-check" />Nenhum cliente esperando resposta.</div>}

      {visitas.length > 0 && <>
        <h3 className="rot-sec"><span className="rot-dot rot-success" />Visitas<span className="rot-num">{visitas.length}</span></h3>
        <Lista itens={visitas} render={l => (
          <LinhaCliente key={`${l.id}-${l.agenda_id}`} l={l} inbox={inbox} onAcao={onAcao} feito={tocados.has(l.id)}
            sub={l.status === "intencao" ? "o cliente falou que vem: confirme a visita" : `visita hoje às ${hora(l.data_hora)}`} />)} />
      </>}

      {v.retomar_total > 0 && (
        <details className="rot-parados">
          <summary className="rot-sec rot-sec-toque">
            <span className="rot-dot rot-warning" />Negociações paradas há {parado}+ dias<span className="rot-num">{v.retomar_total}</span>
            <i className="ti ti-chevron-down rot-seta" />
          </summary>
          <Lista itens={v.retomar} render={l => (
            <LinhaCliente key={l.id} l={l} inbox={inbox} onAcao={onAcao} feito={tocados.has(l.id)}
              sub={`sem conversa há ${diasSem(l.ultimo_em)}`} />)} />
        </details>
      )}
    </div>
  );
}

// Placar do vendedor: o toque já conta na hora; o backend confirma os pontos.
function useJogo(v, joga, avisar) {
  const inicial = () => ({ pontos: v.pontos, missoes: v.missoes, cliques: { mensagem: 0, ligar: 0, ...(v.cliques || {}) } });
  const [jogo, setJogo] = useState(inicial);
  const ref = useRef(jogo);
  ref.current = jogo;
  useEffect(() => { setJogo(inicial()); }, [v]); // eslint-disable-line react-hooks/exhaustive-deps
  const onAcao = joga ? (l, tipo) => {
    ref.current = { ...ref.current, cliques: { ...ref.current.cliques, [tipo]: (ref.current.cliques[tipo] || 0) + 1 } };
    setJogo(ref.current);
    registrarAcaoRotina(l.id, tipo).then(r => {
      if (!r?.pontos) return;
      const antes = ref.current.pontos, pontos = antes + r.pontos;
      ref.current = { ...ref.current, pontos, missoes: [{ ...l, missao: tipo, pontos: r.pontos, em: new Date().toISOString() }, ...ref.current.missoes] };
      setJogo(ref.current);
      avisar(pontos >= v.meta && antes < v.meta ? `Meta do dia batida! ${pontos} pontos.` : `+${r.pontos} pontos`);
    }).catch(() => {});
  } : null;
  return [jogo, onAcao];
}

// Tela do vendedor: frase do topo, tarefas e o que já fez.
function MeuDia({ v, inbox, parado, pontos, avisar }) {
  const [jogo, onAcao] = useJogo(v, !estaVendoComo(), avisar);
  const lista = esperando(v);
  const antigo = lista[0];
  return (
    <section className="rot-meu">
      <div className={`card rot-resumo ${lista.length ? "rot-resumo-pend" : "rot-resumo-ok"}`}>
        <i className={`ti ${lista.length ? "ti-alert-triangle" : "ti-circle-check"}`} />
        <div>
          <div className="rot-resumo-tit">
            {lista.length ? `Você tem ${plural(lista.length, "cliente esperando", "clientes esperando")} resposta` : "Nenhum cliente esperando resposta"}
          </div>
          <div className="rot-resumo-sub">
            {lista.length
              ? (antigo?.espera ? `O mais antigo (${nomeLead(antigo)}) está ${antigo.espera}.` : "Responda primeiro quem está esperando há mais tempo.")
              : "Bom trabalho. Veja as visitas e as negociações paradas abaixo."}
          </div>
        </div>
      </div>
      <div className="card rot-bloco"><Tarefas v={v} inbox={inbox} jogo={jogo} onAcao={onAcao} parado={parado} /></div>
      <div className="card rot-bloco">
        <h3 className="rot-sec"><span className="rot-dot rot-success" />Seus pontos hoje</h3>
        <FeitoHoje v={v} jogo={jogo} pontos={pontos} />
      </div>
    </section>
  );
}

// Linha do vendedor na visão do gerente/dono: o que deve e o que fez; toque abre a lista dele.
function LinhaVendedor({ v, inbox, parado, avisar }) {
  const [jogo, onAcao] = useJogo(v, false, avisar);
  const lista = esperando(v);
  const antigo = lista[0];
  const conta = (k) => jogo.missoes.filter(m => m.missao === k).length;
  return (
    <details className="card rot-vend">
      <summary className="rot-vend-head">
        {v.foto_url ? <img className="rot-av" src={v.foto_url} alt="" /> : <span className="rot-av">{(v.nome || "?")[0]}</span>}
        <span className="rot-vend-nome">{v.nome}</span>
        <span className="rot-vend-deve">
          {lista.length
            ? <><span className="badge badge-danger">{plural(lista.length, "sem resposta", "sem resposta")}</span>
                {antigo?.espera && <span className={`rot-espera ${tomEspera(antigo.espera_min)}`}>mais antigo {antigo.espera.replace("esperando ", "")}</span>}</>
            : <span className="badge badge-success">em dia</span>}
          {v.retomar_total > 0 && <span className="badge badge-muted">{plural(v.retomar_total, "negociação parada", "negociações paradas")}</span>}
        </span>
        <span className="rot-vend-fez">
          <span className="rot-fez-rot">Hoje:</span>
          <span>{plural(conta("respondeu"), "respondido", "respondidos")}</span>
          <span>{plural(jogo.cliques.mensagem, "mensagem", "mensagens")}</span>
          <span>{plural(jogo.cliques.ligar, "ligação", "ligações")}</span>
          <Estrelas pontos={jogo.pontos} meta={v.meta} />
        </span>
        <i className="ti ti-chevron-down rot-seta" />
      </summary>
      <Tarefas v={v} inbox={inbox} jogo={jogo} onAcao={onAcao} parado={parado} />
    </details>
  );
}

function Loja({ loja, parado, avisar }) {
  // Quem deve mais aparece primeiro; empate, quem espera há mais tempo.
  const vs = [...loja.vendedores].sort((a, b) => esperando(b).length - esperando(a).length
    || (esperando(b)[0]?.espera_min ?? -1) - (esperando(a)[0]?.espera_min ?? -1));
  const todos = vs.flatMap(esperando);
  const antigo = todos.reduce((m, l) => ((l.espera_min ?? -1) > (m?.espera_min ?? -1) ? l : m), null);
  return (
    <section className="rot-loja">
      <h2 className="rot-loja-tit"><i className="ti ti-building-store" /> {LOJA_CURTA[loja.id] || loja.nome}</h2>
      <div className="metrics-grid rot-numeros">
        <div className="metric-card"><div className="metric-label">Esperando</div>
          <div className={`metric-value ${todos.length ? "rot-tarde" : ""}`}>{todos.length}</div></div>
        <div className="metric-card"><div className="metric-label">Mais antigo</div>
          <div className="metric-value rot-valor-texto">{antigo?.espera ? antigo.espera.replace("esperando ", "") : "ninguém"}</div></div>
        <div className="metric-card"><div className="metric-label">Chegaram hoje</div>
          <div className="metric-value">{loja.chegaram.length}</div></div>
      </div>
      {vs.map(v => <LinhaVendedor key={v.id} v={v} inbox={loja.inbox_id} parado={parado} avisar={avisar} />)}
      {!vs.length && <div className="empty-state"><p>Nenhum vendedor ativo nesta loja.</p></div>}
    </section>
  );
}

export default function Rotina() {
  const souVendedor = !isManager();
  const [loja, setLoja] = useState("todas");
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [aviso, setAviso] = useState(null);
  const tAviso = useRef(null);
  const avisar = useCallback((t) => { setAviso(t); clearTimeout(tAviso.current); tAviso.current = setTimeout(() => setAviso(null), 2800); }, []);

  const carregar = useCallback(() => {
    setCarregando(true); setErro(null);
    getRotina(null, isOwner() && loja !== "todas" ? loja : null)
      .then(setDados)
      .catch(() => setErro("Erro ao carregar a rotina do dia. Tente novamente."))
      .finally(() => setCarregando(false));
  }, [loja]);
  useEffect(() => { carregar(); }, [carregar]);

  const meu = souVendedor ? dados?.lojas.flatMap(l => l.vendedores.map(v => [v, l]))[0] : null;
  return (
    <div className="rotina">
      <div className="page-header">
        <h1 className="page-title"><i className="ti ti-list-check" /> Rotina do dia</h1>
        <div className={`rot-filtros ${isOwner() ? "" : "rot-filtros-so"}`}>
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

      {dados && <p className="rot-sub">{dataBR(dados.dia)}. O tempo de espera conta só com a loja aberta.</p>}
      {erro && <div className="empty-state"><i className="ti ti-alert-triangle" /><p>{erro}</p></div>}
      {!dados && !erro && <div className="empty-state"><span className="spinner" /><p>Carregando...</p></div>}
      {dados && souVendedor && (meu
        ? <MeuDia v={meu[0]} inbox={meu[1].inbox_id} parado={dados.parado_dias} pontos={dados.pontos} avisar={avisar} />
        : <div className="empty-state"><p>Sua conta não está como vendedor ativo.</p></div>)}
      {dados && !souVendedor && dados.lojas.map(l => <Loja key={l.id} loja={l} parado={dados.parado_dias} avisar={avisar} />)}
      {aviso && <div className="rot-aviso" role="status"><i className="ti ti-star" />{aviso}</div>}
    </div>
  );
}

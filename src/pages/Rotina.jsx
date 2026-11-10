import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { getRotina, registrarAcaoRotina, buscarLeadsRotina } from "../api.js";
import { isOwner, isManager, estaVendoComo } from "../auth.js";
import { ChatwootLink } from "../components/ChatwootLink.jsx";
import BotaoLigar from "../components/BotaoLigar.jsx";
import BotaoRepassar from "../components/BotaoRepassar.jsx";
import BotaoAtendiCelular from "../components/BotaoAtendiCelular.jsx";

// Rotina do dia. 2026-11-07 (Felipe): "a pagina de rotina deve ser simples, clara e objetiva, o que os vendedores
// precisam fazer e o que deixaram de fazer, deve ser intuitiva e simples". Refeita em cima da de 29/10:
// - Vendedor: uma frase no topo (quantos clientes esperam e há quanto tempo o mais antigo), UMA lista "Responder
//   agora" (quem espera há mais tempo primeiro, mesmo tempo do boletim dos gerentes, só loja aberta), visitas do dia,
//   negociações paradas fechadas por padrão e "Feito hoje" com os pontos.
// - Gerente e dono: por loja, 3 números e uma linha por vendedor (quem deve mais primeiro); toque abre a lista dele.
// - Saíram as abas e o "Ontem" (a lista é sempre o estado de agora, igual ao boletim). A pista do carrinho fica.
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

// Pista da corrida (Felipe 29/10, "quero gamificado"): carrinho anda de 0 a 100% até a chegada (meta), placar em
// porcentagem e 5 estrelas, uma a cada 20%. 07/11: tinha saído na tela simples sem ele pedir; voltou ("eu nao pedi pra
// remover o carrinho da gamificacao"), igual pra todos os vendedores: no topo da tela dele e na linha de cada um pro gerente.
const marcosDe = (meta) => [1, 2, 3, 4, 5].map(i => Math.round((meta * i) / 5));
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
        <b>{pct}%</b><small>{pontos} pts</small>
        <span className="pista-estrelas">
          {marcos.map((m, i) => <i key={m} className={`ti ti-star${i < estrelas ? " on" : ""}`} />)}
        </span>
      </span>
    </span>
  );
}

// 2026-11-09e: cliente que escreveu de novo depois da última resposta aparece igual, com o aviso.
function subEspera(l) {
  const t = l.espera || `passado ${diasSem(l.passado_em)} atrás`;
  return l.situacao === "voltou" ? `escreveu de novo, ${t}` : t;
}
// "hoje às 11:24", "ontem às 09:10", "sex 06/11 às 13:26"
function quando(ts) {
  if (!ts) return "";
  const d = new Date(ts), hoje = new Date();
  const dia = (x) => x.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
  const ontem = new Date(hoje.getTime() - 864e5);
  const h = hora(ts);
  if (dia(d) === dia(hoje)) return `hoje às ${h}`;
  if (dia(d) === dia(ontem)) return `ontem às ${h}`;
  return `${d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" })} às ${h}`;
}

// Lista de quem espera: junta "hoje" e "acumulado".
// 2026-11-10 (Felipe): quem pediu ligação é prioridade, vem antes de todo mundo, com o telefone vermelho.
// 2026-11-10 noite (Felipe: "lead novo deve ficar sempre em primeiro, seguido dos mais antigos nessa ordem, do lead que
// respondeu e tem pra responder ate o mais velho sem resposta, esquecido"): depois de quem pediu ligação, os que chegaram
// hoje (mais novo primeiro) e depois o resto do menor tempo de espera pro maior; o esquecido fica no fim.
function esperando(v) {
  const hoje = new Set(v.responder_hoje.map(l => l.id));
  const grupo = (l) => (l.pediu_ligacao ? 0 : hoje.has(l.id) ? 1 : 2);
  const t = (l) => l.espera_min ?? Number.MAX_SAFE_INTEGER;
  return [...v.responder_hoje, ...v.acumulado].sort((a, b) => grupo(a) - grupo(b) || t(a) - t(b)
    || String(b.passado_em || "").localeCompare(String(a.passado_em || "")));
}
// Quem espera há mais tempo (pra frase do topo e pro gerente), já que a lista agora começa pelo mais novo.
function maisAntigo(lista) {
  return lista.reduce((m, l) => ((l.espera_min ?? -1) > (m?.espera_min ?? -1) ? l : m), null);
}

function LinhaCliente({ l, inbox, sub, subTom, feito, onAcao, celular, onCelular }) {
  // 2026-11-09 (Felipe): "Transferir" passa o lead pro proximo vendedor; a linha mostra pra quem foi.
  const [passadoPara, setPassadoPara] = useState(null);
  // 2026-11-09 (Felipe): "Ja atendi pelo meu WhatsApp" (so em Responder agora); a linha mostra pra qual coluna foi.
  const [atendido, setAtendido] = useState(null);
  // 2026-11-10 (Felipe): a marca de "pediu ligação" some assim que o vendedor toca em Ligar.
  const [ligou, setLigou] = useState(false);
  const pedeLigacao = l.pediu_ligacao && !ligou;
  if (atendido) {
    return (
      <div className="rot-lead rot-cumprida">
        <div className="rot-lead-info">
          <div className="rot-lead-nome">{nomeLead(l)}<i className="ti ti-circle-check rot-ok" aria-hidden="true" /></div>
          <div className="rot-lead-sub">Atendido pelo seu WhatsApp, foi pra {atendido}</div>
        </div>
      </div>
    );
  }
  if (passadoPara) {
    return (
      <div className="rot-lead rot-cumprida">
        <div className="rot-lead-info">
          <div className="rot-lead-nome">{nomeLead(l)}</div>
          <div className="rot-lead-sub">Transferido para {passadoPara}</div>
        </div>
      </div>
    );
  }
  return (
    <div className={`rot-lead ${feito ? "rot-cumprida" : ""} ${pedeLigacao ? "rot-ligacao" : ""}`}>
      <div className="rot-lead-info">
        <div className="rot-lead-nome">
          {/* 2026-11-10 (Felipe): nome numa caixa de largura fixa pra etiqueta (quente, pediu ligação) ficar sempre no mesmo lugar. */}
          <span className="rot-nome-txt" title={nomeLead(l)}>
            {pedeLigacao && <i className="ti ti-phone rot-fone" role="img" aria-label="Pediu ligação" title="Pediu ligação" />}
            {nomeLead(l)}
          </span>
          {pedeLigacao && <span className="badge badge-danger">pediu ligação</span>}
          {l.temperatura === "quente" && <span className="badge badge-danger">quente</span>}
          {feito && <i className="ti ti-circle-check rot-ok" aria-label="Você já tocou neste cliente hoje" />}
        </div>
        <div className="rot-lead-sub">{l.veiculo || "ainda não escolheu o carro"}</div>
        {sub && <div className={`rot-espera ${subTom || ""}`}>{sub}</div>}
      </div>
      <div className="rot-acoes">
        {l.conv_id ? <ChatwootLink conv_id={l.conv_id} inbox_id={inbox} onClick={() => onAcao?.(l, "mensagem")}>Mensagem</ChatwootLink> : <span className="rot-vago" aria-hidden="true" />}
        {/* 2026-11-06: numero mascarado pro vendedor; o botao pede o numero ao backend (fica registrado) e abre o discador. */}
        <BotaoLigar leadId={l.id} telefone={l.telefone} origem="rotina" className="btn btn-ghost btn-sm rot-btn" onLigou={() => { setLigou(true); onAcao?.(l, "ligar"); }} />
        <BotaoRepassar leadId={l.id} estagio={l.estagio} nome={l.nome} className="btn btn-ghost btn-sm rot-btn" onRepassado={r => setPassadoPara(r?.para?.nome || "outro vendedor")} />
        <Link className="btn btn-ghost btn-sm btn-icon rot-btn" to={`/crm?lead=${l.id}`} aria-label="Abrir o card no CRM" title="Abrir o card no CRM"><i className="ti ti-external-link" /></Link>
      </div>
      {celular && <BotaoAtendiCelular leadId={l.id} nome={l.nome} className="btn btn-ghost btn-sm rot-celular"
        onFeito={r => { setAtendido(r.label); onCelular?.(l, r.pontos); }} />}
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

// 2026-11-07 (Felipe: "alem do tempo de painel aberto tambem tem que contar se ele fez alguma coisa dentro do
// painel"): ações que mudaram algo (backend painel_acoes), por área.
const AREA_ACAO = { carro: ["carro", "carros"], foto: ["foto", "fotos"], cliente: ["cliente", "clientes"],
  agenda: ["agenda", "agenda"], followup: ["follow-up", "follow-ups"], rotina: ["toque na rotina", "toques na rotina"],
  ligacao: ["ligação", "ligações"], campanha: ["campanha", "campanha"], outro: ["outra", "outras"] };
function detalheAcoes(areas) {
  return Object.entries(areas || {}).sort((a, b) => b[1] - a[1])
    .map(([k, n]) => `${n} ${(AREA_ACAO[k] || [k, k])[n === 1 ? 0 : 1]}`).join(", ");
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
  // 2026-11-10 (Felipe: "simplificado"): mesmas metricas, em pilulas pequenas dentro da corrida; o dia no painel numa linha.
  const itens = [
    ["respondeu", "respondidos"], ["mensagem", "mensagens"], ["ligar", "ligações"],
    ["moveu", "cartões"], ["visita", "visitas"], ["venda", "vendas"], ["celular", "seu WhatsApp"],
  ];
  const tr = v.transferencias || {};
  return (
    <div className="rot-feito rot-feito-simples">
      <div className="rot-pts">
        {itens.map(([k, n]) => (
          <span key={k} className={`rot-pt${conta(k) ? " rot-pt-on" : ""}`} title={`vale ${pontos[k]} pts cada`}>
            <b>{conta(k)}</b><span className="rot-pt-n">{n}</span><small>{conta(k) ? `+${conta(k) * pontos[k]}` : pontos[k]} pts</small>
          </span>
        ))}
      </div>
      <div className="rot-dia-linha">
        <span><i className="ti ti-device-mobile" />Painel hoje <b>{tempoPainel(v.painel_min)}</b></span>
        <span title={v.acoes ? detalheAcoes(v.acoes_area) : "abrir e não fazer nada não conta"}><i className="ti ti-circle-check" />Ações <b>{v.acoes || 0}</b></span>
        <span><i className="ti ti-robot" />Sistema moveu <b>{v.sistema_moveu || 0}</b></span>
        <span title={`${tr.fez_mes || 0} no mês, pode 3 por dia`}><i className="ti ti-arrow-forward-up" />Transferiu <b>{tr.fez_dia || 0}</b></span>
      </div>
    </div>
  );
}

// Corpo do vendedor: o mesmo pro vendedor (a tela dele) e pro gerente (ao abrir a linha).
function Tarefas({ v, inbox, jogo, onAcao, onCelular, parado }) {
  const lista = esperando(v);
  const tocados = new Set(jogo.missoes.filter(m => m.missao === "mensagem" || m.missao === "ligar").map(m => m.id));
  const visitas = [...v.visitas, ...v.confirmar];
  return (
    <div className="rot-corpo">
      {/* 2026-11-10 (Felipe): vazio some (o topo ja diz "Nenhum cliente esperando"). */}
      {lista.length > 0 && <>
        <h3 className="rot-sec"><span className="rot-dot rot-danger" />Responder agora<span className="rot-num">{lista.length}</span></h3>
        <Lista itens={lista} render={l => (
          <LinhaCliente key={l.id} l={l} inbox={inbox} sub={subEspera(l)}
            subTom={tomEspera(l.espera_min)} feito={tocados.has(l.id)} onAcao={onAcao} celular onCelular={onCelular} />)} />
      </>}

      {/* 2026-11-09e (Felipe: todo lead passado pro vendedor aparece na rotina): ja respondido, esperando o cliente. */}
      {v.aguardando?.length > 0 && <>
        <h3 className="rot-sec"><span className="rot-dot rot-info" />Aguardando cliente<span className="rot-num">{v.aguardando.length}</span></h3>
        <Lista itens={v.aguardando} limite={5} render={l => (
          <LinhaCliente key={l.id} l={l} inbox={inbox} onAcao={onAcao} feito={tocados.has(l.id)}
            sub={`respondido ${quando(l.respondido_em)}, esperando o cliente`} />)} />
      </>}

      {visitas.length > 0 && <>
        <h3 className="rot-sec"><span className="rot-dot rot-success" />Visitas<span className="rot-num">{visitas.length}</span></h3>
        <Lista itens={visitas} render={l => (
          <LinhaCliente key={`${l.id}-${l.agenda_id}`} l={l} inbox={inbox} onAcao={onAcao} feito={tocados.has(l.id)}
            sub={l.status === "intencao" ? "o cliente falou que vem: confirme a visita" : `visita hoje às ${hora(l.data_hora)}`} />)} />
      </>}

      {v.retomar_total > 0 && (
        // 2026-11-10 (Felipe): sempre aberta, sem seta pra esconder, em todos os vendedores.
        <div className="rot-parados rot-parados-fixa">
          <h3 className="rot-sec"><span className="rot-dot rot-warning" />Negociações paradas há {parado}+ dias<span className="rot-num">{v.retomar_total}</span></h3>
          <Lista itens={v.retomar} render={l => (
            <LinhaCliente key={l.id} l={l} inbox={inbox} onAcao={onAcao} feito={tocados.has(l.id)}
              sub={`sem conversa há ${diasSem(l.ultimo_em)}`} />)} />
        </div>
      )}
    </div>
  );
}

// 2026-11-10 (Felipe: "campo de busca que acha os leads por nome, numero, veiculos e puxa pra cima"):
// procura nos leads do vendedor (gerente: da loja; dono: das duas) e mostra o resultado no topo, com os mesmos botoes.
const COLUNA = { novo_lead: "Para atender", lista_vip: "Lista Vip", negociando: "Em negociação", sem_credito: "Sem crédito",
  vai_pensar: "Vai pensar", nao_achou_carro: "Não achou o carro", carros_baratos: "Carros baratos",
  parou_responder: "Parou de responder", feirao: "Feirão", fecha_mes: "Fecha mês", agendados: "Agendados",
  fechado_ganho: "Venda concluída", fechado_perdido: "Venda perdida", bau: "Baú", fornecedor: "Fornecedor",
  nao_qualificado: "Não qualificado" };
// O campo fica no cabeçalho, ao lado do título (Felipe 10/11: "sobe o campo de busca para o topo da tela");
// o resultado aparece logo abaixo do cabeçalho, antes de tudo.
function CampoBusca({ q, setQ, buscando }) {
  return (
    <label className="rot-busca-campo rot-busca-topo">
      <svg className="rot-busca-ic" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="10.5" cy="10.5" r="6.5" /><path d="M20 20l-4.8-4.8" /></svg>
      <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar cliente por nome, número ou carro"
        aria-label="Buscar cliente por nome, número ou carro" autoComplete="off" />
      {buscando ? <span className="spinner" /> : q && <button type="button" className="rot-busca-limpa" onClick={() => setQ("")} aria-label="Limpar busca"><i className="ti ti-x" /></button>}
    </label>
  );
}
function useBusca(loja) {
  const [q, setQ] = useState("");
  const [res, setRes] = useState(null);
  const [buscando, setBuscando] = useState(false);
  useEffect(() => {
    const t = q.trim();
    if (t.length < 2) { setRes(null); setBuscando(false); return; }
    let vivo = true;
    setBuscando(true);
    const id = setTimeout(() => {
      buscarLeadsRotina(t, loja).then(r => { if (vivo) setRes(r.leads || []); })
        .catch(() => { if (vivo) setRes([]); }).finally(() => { if (vivo) setBuscando(false); });
    }, 300);
    return () => { vivo = false; clearTimeout(id); };
  }, [q, loja]);
  return { q, setQ, res, buscando };
}
function ResultadoBusca({ busca, inboxDe, onAcao, comVendedor }) {
  const { q, res, buscando } = busca;
  if (!res) return null;
  const sub = (l) => [COLUNA[l.estagio] || l.estagio, comVendedor && (l.vendedor_nome || "sem vendedor"),
    l.ultimo_em && `último contato ${quando(l.ultimo_em)}`].filter(Boolean).join(" · ");
  return (
    <div className="card rot-busca">
      {res.length
        ? <><h3 className="rot-sec"><span className="rot-dot rot-info" />Encontrados<span className="rot-num">{res.length}{res.length === 20 ? "+" : ""}</span></h3>
            <div className="rot-lista">{res.map(l => <LinhaCliente key={l.id} l={l} inbox={inboxDe(l)} onAcao={onAcao} sub={sub(l)} />)}</div></>
        : !buscando && <p className="rot-busca-vazio">Nenhum cliente encontrado para "{q.trim()}".</p>}
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
    registrarAcaoRotina(l.id, tipo).then(r => somar(l, tipo, r?.pontos)).catch(() => {});
  } : null;
  function somar(l, tipo, pts) {
    if (!pts) return;
    const antes = ref.current.pontos, pontos = antes + pts;
    ref.current = { ...ref.current, pontos, missoes: [{ ...l, missao: tipo, pontos: pts, em: new Date().toISOString() }, ...ref.current.missoes] };
    setJogo(ref.current);
    avisar(pontos >= v.meta && antes < v.meta ? `Meta do dia batida! ${pontos} pontos.` : `+${pts} pontos`);
  }
  // 2026-11-09: "Ja atendi pelo meu WhatsApp" (o registro ja foi feito pelo botao; aqui so soma na corrida).
  const onCelular = joga ? (l, pts) => somar(l, "celular", pts) : null;
  return [jogo, onAcao, onCelular];
}

// Tela do vendedor: frase do topo, tarefas e o que já fez.
function MeuDia({ v, inbox, parado, pontos, avisar, busca }) {
  const [jogo, onAcao, onCelular] = useJogo(v, !estaVendoComo(), avisar);
  const lista = esperando(v);
  const antigo = maisAntigo(lista);
  return (
    <section className="rot-meu">
      <ResultadoBusca busca={busca} inboxDe={() => inbox} onAcao={onAcao} />
      <div className={`card rot-resumo ${lista.length ? "rot-resumo-pend" : "rot-resumo-ok"}`}>
        <i className={`ti ${lista.length ? "ti-alert-triangle" : "ti-circle-check"}`} />
        <div>
          <div className="rot-resumo-tit">
            {lista.length ? `Você tem ${plural(lista.length, "cliente esperando", "clientes esperando")} resposta` : "Nenhum cliente esperando resposta"}
          </div>
          <div className="rot-resumo-sub">
            {lista.length
              ? (antigo?.espera ? `O mais antigo (${nomeLead(antigo)}) está ${antigo.espera}.` : "Comece pelos que chegaram hoje.")
              : "Bom trabalho. Veja as visitas e as negociações paradas abaixo."}
          </div>
        </div>
      </div>
      <div className="card rot-corrida">
        <h3 className="rot-sec"><i className="ti ti-car rot-sec-ic" />Sua corrida hoje</h3>
        <Pista pontos={jogo.pontos} meta={v.meta} marcos={marcosDe(v.meta)} />
        <FeitoHoje v={v} jogo={jogo} pontos={pontos} />
      </div>
      <div className="card rot-bloco"><Tarefas v={v} inbox={inbox} jogo={jogo} onAcao={onAcao} onCelular={onCelular} parado={parado} /></div>
    </section>
  );
}

// Linha do vendedor na visão do gerente/dono: o que deve e o que fez; toque abre a lista dele.
function FezItem({ n, um, varios, title }) {
  return <span className={`rot-fez-item${n ? "" : " rot-fez-zero"}`} title={title}><b>{n}</b>{n === 1 ? um : varios}</span>;
}

function LinhaVendedor({ v, inbox, parado, avisar }) {
  const [jogo, onAcao] = useJogo(v, false, avisar);
  const lista = esperando(v);
  const antigo = maisAntigo(lista);
  const conta = (k) => jogo.missoes.filter(m => m.missao === k).length;
  return (
    // 2026-11-10 (Felipe): cartao do vendedor sempre aberto, sem seta.
    <div className="card rot-vend rot-vend-fixo">
      <div className="rot-vend-head">
        {v.foto_url ? <img className="rot-av" src={v.foto_url} alt="" /> : <span className="rot-av">{(v.nome || "?")[0]}</span>}
        <span className="rot-vend-nome">{v.nome}</span>
        <Pista pontos={jogo.pontos} meta={v.meta} marcos={marcosDe(v.meta)} />
        <span className="rot-vend-linha2">
        <span className="rot-vend-deve">
          {lista.length
            ? <><span className="badge badge-danger">{plural(lista.length, "sem resposta", "sem resposta")}</span>
                {antigo?.espera && <span className={`rot-espera ${tomEspera(antigo.espera_min)}`}>mais antigo {antigo.espera.replace("esperando ", "")}</span>}</>
            : <span className="badge badge-success">em dia</span>}
          {v.aguardando?.length > 0 && <span className="badge badge-muted">{plural(v.aguardando.length, "aguardando cliente", "aguardando cliente")}</span>}
          {v.retomar_total > 0 && <span className="badge badge-muted">{plural(v.retomar_total, "negociação parada", "negociações paradas")}</span>}
          {v.transferencias?.fez_mes > 0 && <span className="badge badge-muted" title={`Recebeu ${v.transferencias.recebeu_mes || 0} de colegas no mês`}>{plural(v.transferencias.fez_mes, "transferido no mês", "transferidos no mês")}</span>}
        </span>
        <span className="rot-vend-fez">
          <span className="rot-fez-rot">Hoje</span>
          <FezItem n={v.acoes || 0} um="ação no painel" varios="ações no painel" title={v.acoes ? detalheAcoes(v.acoes_area) : "Nenhuma ação no painel hoje"} />
          <FezItem n={conta("respondeu")} um="respondido" varios="respondidos" />
          <FezItem n={jogo.cliques.mensagem} um="mensagem" varios="mensagens" />
          <FezItem n={jogo.cliques.ligar} um="ligação" varios="ligações" />
          <FezItem n={v.transferencias?.fez_dia || 0} um="transferência" varios="transferências" />
        </span>
        </span>
      </div>
      <Tarefas v={v} inbox={inbox} jogo={jogo} onAcao={onAcao} parado={parado} />
    </div>
  );
}

function Loja({ loja, parado, avisar }) {
  // Quem deve mais aparece primeiro; empate, quem espera há mais tempo.
  const vs = [...loja.vendedores].sort((a, b) => esperando(b).length - esperando(a).length
    || (maisAntigo(esperando(b))?.espera_min ?? -1) - (maisAntigo(esperando(a))?.espera_min ?? -1));
  const todos = vs.flatMap(esperando);
  const antigo = todos.reduce((m, l) => ((l.espera_min ?? -1) > (m?.espera_min ?? -1) ? l : m), null);
  return (
    <section className="rot-loja">
      <div className="rot-loja-topo">
        <h2 className="rot-loja-tit"><i className="ti ti-building-store" /> {LOJA_CURTA[loja.id] || loja.nome}</h2>
        <div className="rot-loja-nums">
          <span>Esperando <b className={todos.length ? "rot-tarde" : ""}>{todos.length}</b></span>
          <span>Mais antigo <b>{antigo?.espera ? antigo.espera.replace("esperando ", "") : "ninguém"}</b></span>
          <span>Chegaram hoje <b>{loja.chegaram.length}</b></span>
        </div>
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
  const busca = useBusca(isOwner() && loja !== "todas" ? loja : null);
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
        <div className="rot-titulo">
          <h1 className="page-title"><i className="ti ti-list-check" /> Rotina do dia</h1>
          {dados && <p className="rot-sub">{dataBR(dados.dia)}. O tempo de espera conta só com a loja aberta.</p>}
        </div>
        <CampoBusca q={busca.q} setQ={busca.setQ} buscando={busca.buscando} />
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

      {erro && <div className="empty-state"><i className="ti ti-alert-triangle" /><p>{erro}</p></div>}
      {!dados && !erro && <div className="empty-state"><span className="spinner" /><p>Carregando...</p></div>}
      {dados && souVendedor && (meu
        ? <MeuDia v={meu[0]} inbox={meu[1].inbox_id} parado={dados.parado_dias} pontos={dados.pontos} avisar={avisar} busca={busca} />
        : <div className="empty-state"><p>Sua conta não está como vendedor ativo.</p></div>)}
      {dados && !souVendedor && <ResultadoBusca busca={busca} comVendedor
        inboxDe={l => dados.lojas.find(x => x.id === l.loja_id)?.inbox_id} />}
      {dados && !souVendedor && dados.lojas.map(l => <Loja key={l.id} loja={l} parado={dados.parado_dias} avisar={avisar} />)}
      {aviso && <div className="rot-aviso" role="status"><i className="ti ti-star" />{aviso}</div>}
    </div>
  );
}

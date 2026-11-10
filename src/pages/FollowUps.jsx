import { useState, useEffect, useRef, useMemo } from "react";
import { lembrado } from "../memoria.js";
import { getFollowups, moverLead } from "../api.js";
import { getRole } from "../auth.js";
import { LeadPhoneChatwoot } from "../components/ChatwootLink.jsx";
import { alertDialog } from "../components/Dialog.jsx";
import { useVisivel } from "../lib/useVisivel.js";

// Ordem das colunas — só preferência visual (mesmo padrão do CRM Kanban em CRM.jsx),
// localStorage já basta. Uma chave só (não por role): as 7 colunas são as mesmas pra
// todo mundo aqui, diferente do CRM que tem conjuntos de estágio distintos por papel.
const FU_ORDER_KEY="la_followups_col_order";
function carregarOrdemColunasFU(){
  try{const raw=localStorage.getItem(FU_ORDER_KEY);return raw?JSON.parse(raw):null;}catch{return null;}
}
function salvarOrdemColunasFU(keys){
  try{localStorage.setItem(FU_ORDER_KEY,JSON.stringify(keys));}catch{}
}
function ordenarTipos(base,savedKeys){
  if(!savedKeys||!savedKeys.length)return base;
  const ordenados=savedKeys.filter(k=>base.includes(k));
  const faltantes=base.filter(k=>!savedKeys.includes(k));
  return[...ordenados,...faltantes];
}

const MSG_STATUS_INFO = {
  agendada: ["#7ba7e0", "Agendada"], enviada: ["#25D366", "Enviada"],
  pausada: ["#C8A84B", "Pausada"], cancelada: ["#e05252", "Cancelada"], falhou: ["#e05252", "Falhou"],
};

// Sequência de mensagens do fluxo automático do estágio — pausar/cancelar/editar
// antes do envio (o sender em n8n roda a cada 15min e só manda o que ainda tá
// "agendada" e com o fluxo em "ativo").
// 2026-10-18 (Felipe: "as mensagens só aparecem se clicar no card; fora do card, o resumo do
// lead e quantas mensagens de follow-up recebeu"): o card mostra o resumo (situacaoFluxo)
// e a janela do lead mostra a lista inteira (FluxoMensagens).
function resumoFluxo(f) {
  const ms = f.mensagens || [];
  const enviadas = ms.filter(m => m.status === "enviada").length;
  const prox = ms.find(m => m.status === "agendada");
  const vencida = prox && new Date(prox.agendado_para) < new Date();
  return { total: ms.length, enviadas, prox, vencida };
}

// 2026-11-10 (Felipe: "os vendedores não usam os botões nem abrem essa aba, deve ficar só visual"):
// a lista de mensagens é só leitura. Mudar o que o lead recebe é mover o lead de coluna (ParaOnde).
function FluxoMensagens({ followup }) {
  const r = resumoFluxo(followup);
  return (
    <div className="fu-fluxo">
      <div className="fu-fluxo-fechar" style={{ marginBottom: 4 }}>Mensagens · recebeu {r.enviadas} de {r.total}</div>
      {followup.mensagens.map(m => {
        const [cor, label] = MSG_STATUS_INFO[m.status] || ["var(--muted)", m.status];
        return (
          <div key={m.id} className="fu-msg">
            <div className="fu-msg-top">
              <span className="badge" style={{ fontSize: 10, background: `${cor}22`, color: cor }}>{label}</span>
              <span className="fu-msg-data">{fmtData(m.agendado_para)}</span>
            </div>
            <div className="fu-msg-txt">{m.conteudo}</div>
          </div>
        );
      })}
    </div>
  );
}

// Parar envio = mover o lead de coluna (mesmo PATCH do Kanban). O backend fecha o follow-up da
// coluna antiga (o Sender só manda quando cl.estagio = f.tipo) e a coluna nova cria a sequência dela.
// Não qualificado fica fora: mover na mão pra lá não cria mensagem (o follow-up dela nasce pelas rotinas).
const DESTINOS=[
  {key:"bau",label:"Baú (descarte)",desc:"Para tudo. Ninguém manda mais mensagem automática.",cor:"#8d6e63"},
  {key:"vai_pensar",label:"Vai pensar",desc:"Lembrete de quem ficou de pensar."},
  {key:"sem_credito",label:"Sem crédito",desc:"Mensagens de quem não aprovou o financiamento."},
  {key:"nao_achou_carro",label:"Não achou o carro",desc:"Avisa quando chegar carro parecido."},
  {key:"parou_responder",label:"Parou de responder",desc:"Retomada de conversa."},
  {key:"feirao",label:"Feirão",desc:"Convite do feirão."},
  {key:"fecha_mes",label:"Fecha mês",desc:"Oferta de fechamento do mês."},
];
function ParaOnde({f,onClose,onMovido}){
  const[movendo,setMovendo]=useState(null);
  async function mover(d){
    setMovendo(d.key);
    try{
      const r=await moverLead(f.lead_id,d.key,"Parou o follow-up pela tela de Follow-ups");
      if(r&&r.skipped){await alertDialog("Não deu pra mover esse lead agora. Tente pelo CRM.");setMovendo(null);return;}
      onMovido(f.id);onClose();
    }catch{await alertDialog("Não deu pra mover (talvez esse lead não seja seu). Tente de novo.");setMovendo(null);}
  }
  return(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal fu-paraonde" onClick={e=>e.stopPropagation()}>
        <div className="modal-handle"/>
        <div className="fu-j-head">
          <div style={{flex:1,minWidth:0}}>
            <h2 className="modal-title" style={{margin:0}}>Parar envio</h2>
            <div className="fu-j-car">{f.cliente_nome} · hoje em {TIPO_LABEL[f.tipo]||f.tipo}</div>
          </div>
          <button className="modal-x" aria-label="Fechar" title="Fechar (Esc)" onClick={onClose}><i className="ti ti-x"/></button>
        </div>
        <p className="fu-po-txt">A mensagem programada não faz sentido? Escolha para onde o lead vai. A sequência atual para na hora.</p>
        <div className="fu-po-lista">
          {DESTINOS.filter(d=>d.key!==f.tipo).map(d=>(
            <button key={d.key} className={`fu-po-op${d.key==="bau"?" bau":""}`} disabled={!!movendo} onClick={()=>mover(d)} style={{"--cor":d.cor||TIPO_COR[d.key]}}>
              <span className="fu-po-dot"/>
              <span className="fu-po-l"><b>{d.label}</b><small>{d.desc}</small></span>
              {movendo===d.key?<span className="spinner"/>:<i className="ti ti-chevron-right"/>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

const TIPO_LABEL={
  sem_credito:"Sem crédito",vai_pensar:"Vai pensar",
  nao_achou_carro:"Não achou o carro",parou_responder:"Parou de responder",
  feirao:"Feirão",fecha_mes:"Fecha mês",nao_qualificado:"Não qualificado",
};
// Mesma cor do estágio no Kanban do CRM (CRM.jsx ESTAGIOS_ADMIN) — a coluna aqui é o
// mesmo estágio, só com o follow-up em detalhe, então a cor é o elo visual entre as
// duas telas. pos_venda_satisfacao não é estágio do Kanban (é follow-up à parte),
// cor própria pra não emprestar de nenhum estágio real.
// match_estoque não vira coluna própria: é o mesmo lead de "não achou o carro" só
// que já com o aviso de veículo compatível disparado — mostrar como coluna separada
// dava a impressão de lead duplicado (2026-07-16, pedido explícito pra remover e
// manter só "não achou o carro"). O follow-up em si continua rodando normal no
// backend (estoqueMatch.js), só não aparece mais como card próprio aqui.
const TIPO_COR={
  sem_credito:"#e67e22",vai_pensar:"#8E44AD",
  nao_achou_carro:"#17A2B8",parou_responder:"#82C91E",
  feirao:"#FFD43B",fecha_mes:"#E74C3C",nao_qualificado:"#6B7280",
};
// 2026-11-10: Pós-venda saiu (não existe mais follow-up de pós-venda, Felipe 22/10) e entrou
// Não qualificado (reengajamento de 2 mensagens, funil contínuo de 10/11), na ordem do funil.
const TIPO_ORDEM=["parou_responder","nao_achou_carro","vai_pensar","sem_credito","nao_qualificado","fecha_mes","feirao"];

function fmtData(iso){
  if(!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR",{day:"2-digit",month:"2-digit",year:"2-digit",hour:"2-digit",minute:"2-digit"});
}

// Card no mesmo padrão do Kanban do CRM (CRM.jsx, classes .kc): foto do cliente com selo
// de origem, nome e data em cima, carro em destaque, selos, e o rodapé com vendedor e
// Chatwoot. Editar nome/veículo e remover (só owner) continuam aqui (2026-07-16).
// 2026-10-18 (Felipe: "mesmo padrão do Kanban, com as fotinhos, tudo organizado").
function diaMesCurto(iso){if(!iso)return "";const d=new Date(iso);if(isNaN(d))return "";return String(d.getDate()).padStart(2,"0")+"/"+String(d.getMonth()+1).padStart(2,"0");}
const iniciaisDe=n=>String(n||"?").trim().split(/\s+/).map(x=>x[0]).slice(0,2).join("").toUpperCase();
const CANAL={anuncio:["#1877F2","ti-brand-meta","Anúncio"],site:["#5b6b7f","ti-world","Site"],organico:["#25D366","ti-brand-whatsapp","Orgânico (WhatsApp)"],presencial:["#b08a2e","ti-building-store","Presencial (loja)"],reativacao:["#8E44AD","ti-refresh","Campanha de reativação"],particular:["#128a43","ti-brand-whatsapp","WhatsApp particular do vendedor"]};
function FotoLead({nome,foto}){
  const[falhou,setFalhou]=useState(false);
  const[ref,visivel]=useVisivel();
  if(!foto||falhou)return <div className="kc-ini">{iniciaisDe(nome)}</div>;
  // Até o card chegar perto da tela fica só o círculo vazio (sem baixar a foto).
  if(!visivel)return <div ref={ref} className="kc-foto"/>;
  return <img className="kc-foto" src={foto} alt="" loading="lazy" decoding="async" draggable={false} referrerPolicy="no-referrer" onError={()=>setFalhou(true)}/>;
}

// Classificação do estágio: manual (vendedor arrastou o card) vs automática (Observador
// pós-handoff classificou por IA, com nível de confiança): usa estagio_definido_por
// (fonte confiável) e extrai a confiança do texto de motivo quando disponível.
function ClassificacaoTag({f}){
  if(f.estagio_definido_por==="humano")return <span className="kc-tag" title="Vendedor moveu o card pra essa coluna"><i className="ti ti-user"/> Manual</span>;
  if(f.estagio_definido_por==="ia_observador"){
    const m=/confianca[:\s]*([0-9.]+)/i.exec(f.motivo||"");
    const conf=m?Math.round(parseFloat(m[1])*100):null;
    return <span className="kc-tag" style={{color:"var(--info)"}} title="A IA classificou pela conversa"><i className="ti ti-robot"/> IA{conf!==null?` ${conf}%`:""}</span>;
  }
  return null;
}
// Situação do follow-up em uma frase + uma bolinha por mensagem da sequência
// (cheia = já recebeu; vazada = vai receber; vermelha = atrasada; riscada = cancelada).
function situacaoFluxo(f){
  const r=resumoFluxo(f);
  if(!r.total)return {r,texto:"Sem mensagem automática",cor:"var(--muted)",icone:"ti-message-off"};
  if(f.status_fluxo==="cancelado")return {r,texto:"Mensagens canceladas",cor:"var(--muted)",icone:"ti-circle-x"};
  if(f.status_fluxo==="pausado")return {r,texto:"Mensagens pausadas",cor:"var(--warning)",icone:"ti-player-pause"};
  // 2026-11-10 (Felipe: mostrar "Segurado" em vez de "atrasada"): o Sender segura de propósito
  // (nome que não dá pra usar ou 6 mensagens em 30 dias); o backend manda o motivo em f.segurado.
  if(r.prox&&r.vencida&&f.segurado)return {r,texto:f.segurado==="teto"?"Segurado: já recebeu 6 mensagens no mês":"Segurado: nome do contato não serve pra mensagem",cor:"var(--muted)",icone:"ti-lock"};
  if(r.prox)return {r,texto:`Próxima ${fmtData(r.prox.agendado_para)}${r.vencida?" (atrasada)":""}`,cor:r.vencida?"var(--danger)":"var(--info)",icone:"ti-send"};
  return {r,texto:"Sequência terminada",cor:"var(--success)",icone:"ti-circle-check"};
}
function BolinhasFluxo({mensagens,segurado}){
  const agora=new Date();
  return(
    <span className="fu-dots">
      {mensagens.map(m=>{
        const atrasada=m.status==="agendada"&&new Date(m.agendado_para)<agora;
        const c=m.status==="enviada"?"ok":atrasada&&segurado?"pause":atrasada||m.status==="falhou"?"late":m.status==="cancelada"?"off":m.status==="pausada"?"pause":"next";
        return <i key={m.id} className={`fu-dot ${c}`} title={`${MSG_STATUS_INFO[m.status]?.[1]||m.status} · ${fmtData(m.agendado_para)}`}/>;
      })}
    </span>
  );
}

// Só dá pra parar quando ainda tem mensagem pra sair (sequência ativa com próxima agendada).
const podeParar=(f,readOnly)=>!readOnly&&f.status_fluxo==="ativo"&&!!resumoFluxo(f).prox;

// 2026-11-10 (Felipe): card só visual, mesma altura em todas as colunas (linha de selos e caixa
// da situação sempre com 2 linhas) e um único botão, "Parar envio", quando ainda vai sair mensagem.
function FuCard({f,role,readOnly,onMovido}){
  const[aberto,setAberto]=useState(false);
  const[parando,setParando]=useState(false);
  const canal=CANAL[f.origem];
  const sit=situacaoFluxo(f);
  const parar=podeParar(f,readOnly);
  return(
    <>
    <div className="kanban-card kc fu-card" onClick={()=>setAberto(true)} title="Ver as mensagens do lead">
      <div className="kc-av">
        <FotoLead nome={f.cliente_nome} foto={f.foto_url}/>
        {canal&&<span className="kc-ch" style={{background:canal[0]}} title={`Origem: ${canal[2]}`}><i className={`ti ${canal[1]}`}/></span>}
      </div>
      <div className="kc-main">
        <div className="kc-top"><span>{f.cliente_nome}</span><time title={`Entrou em ${fmtData(f.criado_em)}`}>{diaMesCurto(f.criado_em)}</time></div>
        <div className="kc-car">{f.veiculo||"Sem carro definido"}</div>
      </div>
      <div className="kc-meta fu-meta">
        {f.temperatura==="quente"&&<span className="kc-tag hot">Quente</span>}
        {f.temperatura==="morno"&&<span className="kc-tag">Morno</span>}
        <ClassificacaoTag f={f}/>
      </div>
      <div className="fu-sit">
        <div className="fu-sit-l1">
          <span className="fu-sit-n">{sit.r.total>0?<>Recebeu <b>{sit.r.enviadas}</b> de {sit.r.total}</>:"Nenhuma mensagem"}</span>
          {sit.r.total>0&&<BolinhasFluxo mensagens={f.mensagens} segurado={f.segurado}/>}
        </div>
        <div className="fu-sit-l2" style={{color:sit.cor}}><i className={`ti ${sit.icone}`}/><span>{sit.texto}</span></div>
      </div>
      <div className="kc-foot">
        {f.vendedor_iniciais&&<div className="av" title={f.vendedor_nome||undefined} style={{width:20,height:20,fontSize:8,background:"var(--brand-soft)",color:"var(--brand)"}}>{f.vendedor_iniciais}</div>}
        <span className="kc-tempo">{f.vendedor_nome?.split(" ")[0]||"sem vendedor"}</span>
        {parar&&<button className="fu-parar" onClick={e=>{e.stopPropagation();setParando(true);}} title="Parar as mensagens programadas e mover o lead de coluna"><i className="ti ti-player-stop"/> Parar envio</button>}
      </div>
    </div>
    {aberto&&<FuJanela f={f} readOnly={readOnly} onParar={()=>{setAberto(false);setParando(true);}} onClose={()=>setAberto(false)}/>}
    {parando&&<ParaOnde f={f} onMovido={onMovido} onClose={()=>setParando(false)}/>}
    </>
  );
}

// Janela do lead (clique no card): resumo e a sequência inteira de mensagens, só leitura.
function FuJanela({f,readOnly,onParar,onClose}){
  const canal=CANAL[f.origem];
  const lead={...f,id:f.lead_id,nome:f.cliente_nome};
  const sit=situacaoFluxo(f);
  return(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal fu-janela" onClick={e=>e.stopPropagation()}>
        <div className="modal-handle"/>
        <div className="fu-j-head">
          <div className="kc-av fu-j-av">
            <FotoLead nome={f.cliente_nome} foto={f.foto_url}/>
            {canal&&<span className="kc-ch" style={{background:canal[0]}} title={`Origem: ${canal[2]}`}><i className={`ti ${canal[1]}`}/></span>}
          </div>
          <div style={{flex:1,minWidth:0}}>
            <h2 className="modal-title fu-j-nome">{f.cliente_nome}</h2>
            <div className="fu-j-car">{f.veiculo||"Sem carro definido"}</div>
          </div>
          <button className="modal-x" aria-label="Fechar" title="Fechar (Esc)" onClick={onClose}><i className="ti ti-x"/></button>
        </div>
        <div className="fu-j-info">
          <span><i className="ti ti-columns"/> {TIPO_LABEL[f.tipo]||f.tipo}</span>
          <span><i className="ti ti-user"/> {f.vendedor_nome||"sem vendedor"}</span>
          <span><i className="ti ti-calendar"/> Entrou em {fmtData(f.criado_em)}</span>
          {f.temperatura&&<span><i className="ti ti-flame"/> {f.temperatura}</span>}
          <ClassificacaoTag f={f}/>
        </div>
        <div className="fu-j-sit" style={{color:sit.cor}}>
          <i className={`ti ${sit.icone}`}/><span>{sit.r.total>0?`Recebeu ${sit.r.enviadas} de ${sit.r.total} mensagens. `:""}{sit.texto}</span>
        </div>
        {f.mensagens&&f.mensagens.length>0&&<FluxoMensagens followup={f}/>}
        <div className="fu-j-acoes">
          <LeadPhoneChatwoot lead={lead}> Chatwoot</LeadPhoneChatwoot>
          <span style={{flex:1}}/>
          {podeParar(f,readOnly)&&<button className="btn btn-ghost fu-parar-grande" onClick={onParar}><i className="ti ti-player-stop"/> Parar envio</button>}
        </div>
      </div>
    </div>
  );
}

export default function FollowUps(){
  const role=getRole();
  const readOnly=role==="gerente";
  // "Visitas mencionadas" e "Agendamentos" removidos como abas próprias (2026-07-28):
  // Agenda (menu lateral) já é a visão dedicada de compromissos — manter os dois
  // aqui era informação duplicada. Follow-ups agora é só "Por estágio".
  const[data,setData]=useState(()=>lembrado("followups")||{porTipo:{}});
  // Filtro de data dentro de "Por estágio" — antes eram 2 abas próprias (Agenda de
  // hoje / Vencidos), mas liam a MESMA tabela (followups) que já aparece aqui, só
  // com um WHERE de data diferente. Virou filtro em vez de aba: menos lugar pra
  // Dariana checar, mesma informação (2026-07-16).
  const[filtroData,setFiltroData]=useState("todos");
  const[loading,setLoading]=useState(()=>!lembrado("followups"));
  const[erro,setErro]=useState(null);

  const load=()=>getFollowups().then(d=>{setData(d);setLoading(false);})
    .catch(()=>{setErro("Erro ao carregar dados. Tente novamente.");setLoading(false);});
  useEffect(()=>{load();},[]);

  // Reordenar as colunas do board — mesmo padrão de drag no cabeçalho do Kanban do
  // CRM (CRM.jsx), só que aqui é sobre TIPO_ORDEM (array de string, não de objeto).
  const[colOrder,setColOrder]=useState(()=>carregarOrdemColunasFU());
  const tiposOrdenados=useMemo(()=>ordenarTipos(TIPO_ORDEM,colOrder),[colOrder]);
  const[colArrastando,setColArrastando]=useState(null);
  function onColHeaderDragStart(e,tipo){
    e.dataTransfer.setData("application/x-fu-col",tipo);
    e.dataTransfer.effectAllowed="move";
    setColArrastando(tipo);
  }
  function onColHeaderDragOver(e){
    if(e.dataTransfer.types.includes("application/x-fu-col")){e.preventDefault();e.stopPropagation();}
  }
  function onColHeaderDrop(e,targetTipo){
    if(!e.dataTransfer.types.includes("application/x-fu-col"))return;
    e.preventDefault();e.stopPropagation();
    const srcTipo=e.dataTransfer.getData("application/x-fu-col");
    setColArrastando(null);
    if(!srcTipo||srcTipo===targetTipo)return;
    const keys=[...tiposOrdenados];
    const from=keys.indexOf(srcTipo),to=keys.indexOf(targetTipo);
    if(from<0||to<0)return;
    keys.splice(from,1);keys.splice(to,0,srcTipo);
    setColOrder(keys);
    salvarOrdemColunasFU(keys);
  }
  function onColHeaderDragEnd(){setColArrastando(null);}

  // "Grab to scroll" horizontal, mesmo padrão do Kanban do CRM — clicar e arrastar
  // numa área vazia do board rola pros outros estágios sem precisar mirar na
  // scrollbar fina embaixo (2026-07-16, pedido pra facilitar ver as colunas fora
  // da tela).
  const boardRef=useRef(null);
  const arrastandoBoard=useRef({ativo:false,startX:0,startScroll:0});
  function onBoardMouseDown(e){
    if(e.button!==0)return;
    if(e.target.closest(".kanban-card")||e.target.closest(".kanban-col-header"))return;
    // Clique na barra de rolagem (fica fora do clientWidth/clientHeight do elemento): deixa o
    // navegador rolar sozinho. Antes o arrastar do quadro brigava com a barra e ela tremia (Felipe 10/11).
    const el=e.target;
    if((el.clientWidth&&e.offsetX>=el.clientWidth)||(el.clientHeight&&e.offsetY>=el.clientHeight))return;
    const board=boardRef.current;
    if(!board)return;
    arrastandoBoard.current={ativo:true,startX:e.pageX,startScroll:board.scrollLeft};
    board.classList.add("grabbing");
  }
  function onBoardMouseMove(e){
    if(!arrastandoBoard.current.ativo)return;
    const board=boardRef.current;
    if(!board)return;
    board.scrollLeft=arrastandoBoard.current.startScroll-(e.pageX-arrastandoBoard.current.startX);
  }
  function onBoardMouseUpOrLeave(){
    arrastandoBoard.current.ativo=false;
    boardRef.current?.classList.remove("grabbing");
  }


  // Lead movido pelo "Parar envio": sai da tela na hora (o follow-up dele foi fechado no backend).
  const tirar=id=>setData(d=>({...d,porTipo:Object.fromEntries(Object.entries(d.porTipo||{}).map(([k,v])=>[k,v.filter(f=>f.id!==id)]))}));

  const hoje=new Date().toDateString();
  // 2026-11-10 (Felipe: "na aba Hoje não tem nenhum follow-up pra hoje?" e "Vencido está certo?"):
  // os dois filtros olhavam followups.horario, que é só o prazo do card e não diz se sai mensagem.
  // Davam 135 cards "vencidos" sem mensagem nenhuma (quase todos Não achou o carro, que espera o
  // carro chegar e não tem sequência). Agora contam só mensagem de verdade (followup_mensagens):
  // Hoje = card com mensagem programada pra hoje (já enviada ou ainda na fila);
  // Vencidos = card com mensagem que já passou da hora e não saiu, com o fluxo ativo.
  // Card sem mensagem nunca entra em nenhum dos dois. Os números contam cards, igual às colunas.
  const msgs=f=>f.mensagens||[];
  // 2026-11-10 (Felipe: "Hoje só tem isso?"): conta também a mensagem que SAIU hoje mesmo marcada
  // pra outro dia (Jeferson: marcada 09/11, enviada 10/11 08:44 não aparecia em Hoje).
  const ehDeHoje=d=>d&&new Date(d).toDateString()===hoje;
  const ehHoje=f=>msgs(f).some(m=>(m.status==="agendada"&&ehDeHoje(m.agendado_para))||(m.status==="enviada"&&(ehDeHoje(m.enviado_em)||ehDeHoje(m.agendado_para))));
  const mensagemVencida=m=>m.status==="agendada"&&m.agendado_para&&new Date(m.agendado_para)<new Date();
  const ehVencido=f=>f.status_fluxo==="ativo"&&!f.segurado&&msgs(f).some(mensagemVencida);
  const passaFiltro=f=>filtroData==="todos"||(filtroData==="hoje"&&ehHoje(f))||(filtroData==="vencidos"&&ehVencido(f));
  const totalEmFollowup=Object.values(data.porTipo||{}).reduce((s,arr)=>s+arr.length,0);
  const totalHoje=Object.values(data.porTipo||{}).reduce((s,arr)=>s+arr.filter(ehHoje).length,0);
  const totalVencidos=Object.values(data.porTipo||{}).reduce((s,arr)=>s+arr.filter(ehVencido).length,0);

  if(erro)return <div className="empty-state"><i className="ti ti-alert-triangle"/><p>{erro}</p></div>;
  if(loading)return <div className="empty-state"><i className="ti ti-loader" style={{animation:"spin 1s linear infinite"}}/><p>Carregando...</p></div>;

  return(
    <div>
      {/* Filtro de data — substitui as antigas abas "Agenda de hoje"/"Vencidos"
              (mesma tabela de "Por estágio", só um recorte por data).
              2026-10-07: os filtros subiram pra linha do título (menos espaço em branco). */}
      <div className="page-header fu-header"><h1 className="page-title"><i className="ti ti-clock"/> Follow-ups</h1>
          <div className="fu-filtros">
            {/* 2026-10-28 (Felipe): número em pílula (o "111" não cabia na bolinha de 16px)
                e sem parênteses, pra os 3 filtros caberem na linha do título no celular. */}
            <button className={`tab-btn ${filtroData==="todos"?"active":""}`} onClick={()=>setFiltroData("todos")}>Todos <span className="fu-num">{totalEmFollowup}</span></button>
            <button className={`tab-btn ${filtroData==="hoje"?"active":""}`} onClick={()=>setFiltroData("hoje")}>Hoje <span className="fu-num">{totalHoje}</span></button>
            <button className={`tab-btn ${filtroData==="vencidos"?"active":""}`} onClick={()=>setFiltroData("vencidos")} style={{color:totalVencidos>0?"var(--danger)":undefined}}>
              Vencidos {totalVencidos>0&&<span className="fu-num fu-num-alerta">{totalVencidos}</span>}
            </button>
          </div>
      </div>
          {/* Board horizontal, uma coluna por tipo de follow-up, SEMPRE todas (mesmo
          vazias). 2026-10-18 (Felipe): mesmas classes do Kanban do CRM (.kanban-board/
          .kanban-col/.kanban-card.kc), então coluna, card, altura da tela e a barra de
          rolagem embaixo ficam iguais nas duas telas. match_estoque não tem coluna
          própria: ver comentário perto de TIPO_COR. 2026-10-28 (Felipe, teste em 360px):
          no celular a coluna vazia fica estreita (.kanban-col-vazia) pra coluna com
          follow-up aparecer logo do lado, em vez de a vazia ocupar a tela inteira. */}
          <div className="kanban-board fu-board" ref={boardRef}
            onMouseDown={onBoardMouseDown} onMouseMove={onBoardMouseMove}
            onMouseUp={onBoardMouseUpOrLeave} onMouseLeave={onBoardMouseUpOrLeave}>
            {tiposOrdenados.map(tipo=>{
              const leads=(data.porTipo?.[tipo]||[]).filter(passaFiltro);
              const cor=TIPO_COR[tipo];
              return (
              <div key={tipo} className={`kanban-col${leads.length===0?" kanban-col-vazia":""}`} style={{"--cor":cor}}>
                <div className="kanban-col-header" style={{"--cor":cor,opacity:colArrastando===tipo?.4:1}}
                  draggable
                  onDragStart={e=>onColHeaderDragStart(e,tipo)}
                  onDragOver={onColHeaderDragOver}
                  onDrop={e=>onColHeaderDrop(e,tipo)}
                  onDragEnd={onColHeaderDragEnd}
                  title="Arraste pra reordenar as colunas">
                  <span style={{display:"flex",alignItems:"center",gap:5,minWidth:0}}>
                    <i className="ti ti-grip-vertical" style={{fontSize:13,color:"var(--muted)",flexShrink:0}}/>
                    <span className="kanban-col-title">{TIPO_LABEL[tipo]||tipo}</span>
                  </span>
                  <span className="kanban-col-count">{leads.length}</span>
                </div>
                <div className="kanban-cards">
                  {leads.length===0&&<div style={{textAlign:"center",color:"var(--muted)",fontSize:12,padding:"12px 0"}}>—</div>}
                  {leads.map(f=><FuCard key={f.id} f={f} role={role} readOnly={readOnly} onMovido={tirar}/>)}
                </div>
              </div>
              );
            })}
          </div>

    </div>
  );
}

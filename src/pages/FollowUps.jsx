import { useState, useEffect, useRef, useMemo } from "react";
import { getFollowups, marcarFollowupRespondeu, atualizarFluxoFollowup, atualizarMensagemFollowup, atualizarLeadCRM, excluirLeadCRM } from "../api.js";
import { getRole } from "../auth.js";
import { LeadPhoneChatwoot } from "../components/ChatwootLink.jsx";
import { confirmDialog, alertDialog } from "../components/Dialog.jsx";
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

function FluxoMensagens({ followup, readOnly, onAtualizado }) {
  const [editandoId, setEditandoId] = useState(null);
  const [textoEdit, setTextoEdit] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function salvarTexto(msgId) {
    setSalvando(true);
    try { await atualizarMensagemFollowup(msgId, { conteudo: textoEdit }); onAtualizado(); }
    catch { await alertDialog("Erro ao salvar. Tente de novo."); }
    setSalvando(false); setEditandoId(null);
  }
  async function mudarStatusMsg(msgId, status) {
    try { await atualizarMensagemFollowup(msgId, { status }); onAtualizado(); }
    catch { await alertDialog("Erro ao atualizar mensagem."); }
  }
  async function mudarFluxo(status_fluxo) {
    try { await atualizarFluxoFollowup(followup.id, status_fluxo); onAtualizado(); }
    catch { await alertDialog("Erro ao atualizar fluxo."); }
  }

  const r = resumoFluxo(followup);

  return (
    <div className="fu-fluxo">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4, gap: 4 }}>
        <span className="fu-fluxo-fechar">Mensagens · recebeu {r.enviadas} de {r.total}</span>
        {!readOnly && (
          <div style={{ display: "flex", gap: 4 }}>
            {followup.status_fluxo === "ativo"
              ? <button className="fu-resp" onClick={() => mudarFluxo("pausado")}><i className="ti ti-player-pause" /> Pausar tudo</button>
              : followup.status_fluxo === "pausado"
              ? <button className="fu-resp" onClick={() => mudarFluxo("ativo")}><i className="ti ti-player-play" /> Retomar</button>
              : <span className="badge" style={{ fontSize: 10, background: "var(--danger)22", color: "var(--danger)" }}>Cancelado</span>}
            {followup.status_fluxo !== "cancelado" && <button className="fu-ico" style={{ color: "var(--danger)" }} title="Cancelar o fluxo todo" onClick={async () => { if (await confirmDialog("Cancelar todo o fluxo de mensagens desse follow-up?",{title:"Cancelar fluxo?",confirmLabel:"Cancelar fluxo"})) mudarFluxo("cancelado"); }}><i className="ti ti-x" /></button>}
          </div>
        )}
      </div>
      {followup.mensagens.map(m => {
        const [cor, label] = MSG_STATUS_INFO[m.status] || ["var(--muted)", m.status];
        const editavel = !readOnly && m.status !== "enviada";
        return (
          <div key={m.id} className="fu-msg">
            <div className="fu-msg-top">
              <span className="badge" style={{ fontSize: 10, background: `${cor}22`, color: cor }}>{label}</span>
              <span className="fu-msg-data">{fmtData(m.agendado_para)}</span>
              {editavel && m.status === "agendada" && <button className="fu-ico" onClick={() => mudarStatusMsg(m.id, "pausada")} title="Pausar essa mensagem"><i className="ti ti-player-pause" /></button>}
              {editavel && m.status === "pausada" && <button className="fu-ico" onClick={() => mudarStatusMsg(m.id, "agendada")} title="Retomar essa mensagem"><i className="ti ti-player-play" /></button>}
              {editavel && <button className="fu-ico" style={{ color: "var(--danger)" }} onClick={() => mudarStatusMsg(m.id, "cancelada")} title="Cancelar essa mensagem"><i className="ti ti-x" /></button>}
            </div>
            {editandoId === m.id ? (
              <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                <textarea className="form-input" style={{ marginBottom: 0, fontSize: 12, minHeight: 70 }} value={textoEdit} onChange={e => setTextoEdit(e.target.value)} />
                <button className="btn btn-primary" style={{ padding: "4px 8px" }} onClick={() => salvarTexto(m.id)} disabled={salvando}>{salvando ? <span className="spinner" /> : <i className="ti ti-check" />}</button>
              </div>
            ) : (
              <div className="fu-msg-txt" style={{ cursor: editavel ? "pointer" : "default" }}
                onClick={() => { if (editavel) { setEditandoId(m.id); setTextoEdit(m.conteudo); } }}
                title={editavel ? "Clique pra editar" : ""}>
                {m.conteudo} {editavel && <i className="ti ti-pencil" style={{ fontSize: 11, color: "var(--muted)" }} />}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const TIPO_LABEL={
  sem_credito:"Sem crédito",vai_pensar:"Vai pensar",
  nao_achou_carro:"Não achou o carro",parou_responder:"Parou de responder",
  feirao:"Feirão",fecha_mes:"Fecha mês",
  pos_venda_satisfacao:"Pós-venda",
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
  feirao:"#FFD43B",fecha_mes:"#E74C3C",
  pos_venda_satisfacao:"#d1637a",
};
const TIPO_ORDEM=["sem_credito","vai_pensar","nao_achou_carro","parou_responder","feirao","fecha_mes","pos_venda_satisfacao"];

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
  return <img className="kc-foto" src={foto} alt="" decoding="async" draggable={false} referrerPolicy="no-referrer" onError={()=>setFalhou(true)}/>;
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
  if(r.prox)return {r,texto:`Próxima ${fmtData(r.prox.agendado_para)}${r.vencida?" (atrasada)":""}`,cor:r.vencida?"var(--danger)":"var(--info)",icone:"ti-send"};
  return {r,texto:"Sequência terminada",cor:"var(--success)",icone:"ti-circle-check"};
}
function BolinhasFluxo({mensagens}){
  const agora=new Date();
  return(
    <span className="fu-dots">
      {mensagens.map(m=>{
        const atrasada=m.status==="agendada"&&new Date(m.agendado_para)<agora;
        const c=m.status==="enviada"?"ok":atrasada||m.status==="falhou"?"late":m.status==="cancelada"?"off":m.status==="pausada"?"pause":"next";
        return <i key={m.id} className={`fu-dot ${c}`} title={`${MSG_STATUS_INFO[m.status]?.[1]||m.status} · ${fmtData(m.agendado_para)}`}/>;
      })}
    </span>
  );
}

function FuCard({f,role,readOnly,onAtualizado,onRespondeu}){
  const[aberto,setAberto]=useState(false);
  const canal=CANAL[f.origem];
  const lead={...f,id:f.lead_id,nome:f.cliente_nome};
  const sit=situacaoFluxo(f);
  const parar=e=>e.stopPropagation();
  return(
    <>
    <div className="kanban-card kc fu-card" onClick={()=>setAberto(true)} title="Abrir o lead e as mensagens">
      <div className="kc-av">
        <FotoLead nome={f.cliente_nome} foto={f.foto_url}/>
        {canal&&<span className="kc-ch" style={{background:canal[0]}} title={`Origem: ${canal[2]}`}><i className={`ti ${canal[1]}`}/></span>}
      </div>
      <div className="kc-main">
        <div className="kc-top"><span>{f.cliente_nome}</span><time title={`Entrou em ${fmtData(f.criado_em)}`}>{diaMesCurto(f.criado_em)}</time></div>
        <div className="kc-car">{f.veiculo||"Sem carro definido"}</div>
      </div>
      <div className="kc-meta">
        {f.temperatura==="quente"&&<span className="kc-tag hot">Quente</span>}
        {f.temperatura==="morno"&&<span className="kc-tag">Morno</span>}
        <ClassificacaoTag f={f}/>
        {f.respondeu&&<span className="badge badge-success"><i className="ti ti-check" style={{fontSize:11}}/> Respondeu</span>}
      </div>
      <div className="fu-sit">
        {sit.r.total>0
          ?<div className="fu-sit-l1"><span className="fu-sit-n">Recebeu <b>{sit.r.enviadas}</b> de {sit.r.total}</span><BolinhasFluxo mensagens={f.mensagens}/></div>
          :null}
        <div className="fu-sit-l2" style={{color:sit.cor}}><i className={`ti ${sit.icone}`}/><span>{sit.texto}</span></div>
      </div>
      <div className="kc-foot">
        {f.vendedor_iniciais&&<div className="av" title={f.vendedor_nome||undefined} style={{width:20,height:20,fontSize:8,background:"var(--brand-soft)",color:"var(--brand)"}}>{f.vendedor_iniciais}</div>}
        <span className="kc-tempo">{f.vendedor_nome?.split(" ")[0]||"sem vendedor"}</span>
        <span className="kc-dir" onClick={parar}>
          {!f.respondeu&&!readOnly&&<button className="fu-resp" onClick={()=>onRespondeu(f.id)} title="O cliente respondeu: para o fluxo de mensagens">Marcar respondido</button>}
          <LeadPhoneChatwoot lead={lead} compact/>
        </span>
      </div>
    </div>
    {aberto&&<FuJanela f={f} role={role} readOnly={readOnly} onAtualizado={onAtualizado} onRespondeu={onRespondeu} onClose={()=>setAberto(false)}/>}
    </>
  );
}

// Janela do lead (clique no card): resumo, editar nome/veículo, remover (só owner) e a
// sequência inteira de mensagens com pausar/cancelar/editar.
function FuJanela({f,role,readOnly,onAtualizado,onRespondeu,onClose}){
  const[editando,setEditando]=useState(false);
  const[nome,setNome]=useState(f.cliente_nome||"");
  const[veiculo,setVeiculo]=useState(f.veiculo||"");
  const[salvando,setSalvando]=useState(false);
  async function salvar(){
    if(!nome.trim())return;
    setSalvando(true);
    try{await atualizarLeadCRM(f.lead_id,{nome:nome.trim(),veiculo_interesse:veiculo.trim()});onAtualizado();setEditando(false);}
    catch{await alertDialog("Erro ao salvar. Tente de novo (talvez esse lead não seja seu).");}
    setSalvando(false);
  }
  async function remover(){
    if(!await confirmDialog(`Remover ${f.cliente_nome} do CRM? Use só pra lead de teste ou cadastro errado.`,{title:"Remover lead?",confirmLabel:"Remover"}))return;
    try{await excluirLeadCRM(f.lead_id);onClose();onAtualizado();}
    catch{await alertDialog("Erro ao remover.");}
  }
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
          {editando?(
            <div style={{flex:1,minWidth:0}}>
              <input className="form-input" style={{marginBottom:6}} value={nome} onChange={e=>setNome(e.target.value)} placeholder="Nome"/>
              <input className="form-input" style={{marginBottom:6}} value={veiculo} onChange={e=>setVeiculo(e.target.value)} placeholder="Veículo de interesse"/>
              <div style={{display:"flex",gap:6}}>
                <button className="btn btn-primary" onClick={salvar} disabled={salvando}>{salvando?<span className="spinner"/>:<><i className="ti ti-check"/> Salvar</>}</button>
                <button className="btn btn-ghost" onClick={()=>{setEditando(false);setNome(f.cliente_nome||"");setVeiculo(f.veiculo||"");}}>Cancelar</button>
              </div>
            </div>
          ):(
            <div style={{flex:1,minWidth:0}}>
              <h2 className="modal-title fu-j-nome">{f.cliente_nome}</h2>
              <div className="fu-j-car">{f.veiculo||"Sem carro definido"}</div>
            </div>
          )}
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
        {f.mensagens&&f.mensagens.length>0&&<FluxoMensagens followup={f} readOnly={readOnly} onAtualizado={onAtualizado}/>}
        <div className="fu-j-acoes">
          {!readOnly&&!editando&&<button className="btn btn-ghost" onClick={()=>setEditando(true)}><i className="ti ti-pencil"/> Editar</button>}
          {role==="admin_master"&&<button className="btn btn-ghost" style={{color:"var(--danger)"}} onClick={remover}><i className="ti ti-trash"/> Remover</button>}
          <span style={{flex:1}}/>
          {!f.respondeu&&!readOnly&&<button className="btn btn-ghost" onClick={()=>{onRespondeu(f.id);onClose();}}>Marcar respondido</button>}
          <LeadPhoneChatwoot lead={lead}> Chatwoot</LeadPhoneChatwoot>
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
  const[data,setData]=useState({porTipo:{}});
  // Filtro de data dentro de "Por estágio" — antes eram 2 abas próprias (Agenda de
  // hoje / Vencidos), mas liam a MESMA tabela (followups) que já aparece aqui, só
  // com um WHERE de data diferente. Virou filtro em vez de aba: menos lugar pra
  // Dariana checar, mesma informação (2026-07-16).
  const[filtroData,setFiltroData]=useState("todos");
  const[loading,setLoading]=useState(true);
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

  const upd=(id,changes)=>setData(d=>({
    ...d,
    porTipo:Object.fromEntries(Object.entries(d.porTipo||{}).map(([k,v])=>[k,v.map(f=>f.id===id?{...f,...changes}:f)])),
  }));

  async function marcarRespondeu(id){try{await marcarFollowupRespondeu(id);}catch{}upd(id,{respondeu:true});}

  const hoje=new Date().toDateString();
  const ehHoje=f=>f.horario&&new Date(f.horario).toDateString()===hoje;
  // followups.enviado é uma coluna morta (achado 2026-08-01, auditoria Cursor confirmada
  // no banco: 0 linhas com enviado=true, nenhum processo automático escreve nela) — usar
  // ela aqui sempre dava vencido=true pra QUALQUER card com horario no passado, mesmo os
  // que já foram enviados de verdade (o envio real só fica registrado em
  // followup_mensagens.status/la_followup_envios_log). ehVencido fica só de fallback pros
  // tipos sem sequência de mensagens populada — ver vencidosDoCard/mensagemVencida abaixo.
  const ehVencido=f=>f.horario&&new Date(f.horario)<new Date()&&!f.enviado&&!ehHoje(f);
  // Auditoria 2026-07-30/31: o badge de "Vencidos" contava 1 por card (followups.horario,
  // um timestamp único por lead) mas um card pode ter várias mensagens agendadas em
  // sequência (followup_mensagens) — cada uma vencida conta separado pra quem processa
  // o envio de verdade (Kanban Sender), então o badge mostrava menos do que o real
  // (achado: contagem por card vs contagem por mensagem individual divergiam). Conta por
  // mensagem quando o card tem `mensagens` carregado; cai pro card-level (ehVencido) só
  // pros tipos que não têm sequência de mensagens populada (ex: match_estoque).
  const mensagemVencida=m=>m.status==="agendada"&&m.agendado_para&&new Date(m.agendado_para)<new Date();
  const vencidosDoCard=f=>(f.mensagens&&f.mensagens.length)?f.mensagens.filter(mensagemVencida).length:(ehVencido(f)?1:0);
  // 2026-08-01: a LISTA (aba "Vencidos") ainda filtrava só com ehVencido puro — mesmo bug
  // do badge, só que na lista de cards em vez do número. Reusa vencidosDoCard aqui também,
  // pra card com mensagens reais só aparecer como vencido quando tem mensagem
  // genuinamente vencida (não card_horario-no-passado-mas-já-enviado).
  const passaFiltro=f=>filtroData==="todos"||(filtroData==="hoje"&&ehHoje(f))||(filtroData==="vencidos"&&vencidosDoCard(f)>0);
  const totalEmFollowup=Object.values(data.porTipo||{}).reduce((s,arr)=>s+arr.length,0);
  const totalHoje=Object.values(data.porTipo||{}).reduce((s,arr)=>s+arr.filter(ehHoje).length,0);
  const totalVencidos=Object.values(data.porTipo||{}).reduce((s,arr)=>s+arr.reduce((s2,f)=>s2+vencidosDoCard(f),0),0);

  if(erro)return <div className="empty-state"><i className="ti ti-alert-triangle"/><p>{erro}</p></div>;
  if(loading)return <div className="empty-state"><i className="ti ti-loader" style={{animation:"spin 1s linear infinite"}}/><p>Carregando...</p></div>;

  return(
    <div>
      {/* Filtro de data — substitui as antigas abas "Agenda de hoje"/"Vencidos"
              (mesma tabela de "Por estágio", só um recorte por data).
              2026-10-07: os filtros subiram pra linha do título (menos espaço em branco). */}
      <div className="page-header fu-header"><h1 className="page-title"><i className="ti ti-clock"/> Follow-ups</h1>
          <div className="fu-filtros">
            <button className={`tab-btn ${filtroData==="todos"?"active":""}`} onClick={()=>setFiltroData("todos")}>Todos ({totalEmFollowup})</button>
            <button className={`tab-btn ${filtroData==="hoje"?"active":""}`} onClick={()=>setFiltroData("hoje")}>Hoje ({totalHoje})</button>
            <button className={`tab-btn ${filtroData==="vencidos"?"active":""}`} onClick={()=>setFiltroData("vencidos")} style={{color:totalVencidos>0?"var(--danger)":undefined}}>
              Vencidos {totalVencidos>0&&<span style={{background:"var(--danger)",color:"white",borderRadius:"50%",width:16,height:16,display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:10,marginLeft:4}}>{totalVencidos}</span>}
            </button>
          </div>
      </div>
          {/* Board horizontal, uma coluna por tipo de follow-up, SEMPRE todas (mesmo
          vazias). 2026-10-18 (Felipe): mesmas classes do Kanban do CRM (.kanban-board/
          .kanban-col/.kanban-card.kc), então coluna, card, altura da tela e a barra de
          rolagem embaixo ficam iguais nas duas telas. match_estoque não tem coluna
          própria: ver comentário perto de TIPO_COR. */}
          <div className="kanban-board fu-board" ref={boardRef}
            onMouseDown={onBoardMouseDown} onMouseMove={onBoardMouseMove}
            onMouseUp={onBoardMouseUpOrLeave} onMouseLeave={onBoardMouseUpOrLeave}>
            {tiposOrdenados.map(tipo=>{
              const leads=(data.porTipo?.[tipo]||[]).filter(passaFiltro);
              const cor=TIPO_COR[tipo];
              return (
              <div key={tipo} className="kanban-col" style={{"--cor":cor}}>
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
                  {leads.map(f=><FuCard key={f.id} f={f} role={role} readOnly={readOnly} onAtualizado={load} onRespondeu={marcarRespondeu}/>)}
                </div>
              </div>
              );
            })}
          </div>

    </div>
  );
}

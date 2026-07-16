import { useState, useEffect, useRef } from "react";
import { getFollowups, marcarFollowupRespondeu, atualizarFluxoFollowup, atualizarMensagemFollowup, concluirFollowupAgendado, atualizarLembreteAgendamento } from "../api.js";
import { getRole } from "../auth.js";

const MSG_STATUS_INFO = {
  agendada: ["#7ba7e0", "Agendada"], enviada: ["#25D366", "Enviada"],
  pausada: ["#C8A84B", "Pausada"], cancelada: ["#e05252", "Cancelada"], falhou: ["#e05252", "Falhou"],
};

// Sequência de mensagens do fluxo automático do estágio — pausar/cancelar/editar
// antes do envio (o sender em n8n roda a cada 15min e só manda o que ainda tá
// "agendada" e com o fluxo em "ativo").
function FluxoMensagens({ followup, readOnly, onAtualizado }) {
  const [editandoId, setEditandoId] = useState(null);
  const [textoEdit, setTextoEdit] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function salvarTexto(msgId) {
    setSalvando(true);
    try { await atualizarMensagemFollowup(msgId, { conteudo: textoEdit }); onAtualizado(); }
    catch { alert("Erro ao salvar. Tente de novo."); }
    setSalvando(false); setEditandoId(null);
  }
  async function mudarStatusMsg(msgId, status) {
    try { await atualizarMensagemFollowup(msgId, { status }); onAtualizado(); }
    catch { alert("Erro ao atualizar mensagem."); }
  }
  async function mudarFluxo(status_fluxo) {
    try { await atualizarFluxoFollowup(followup.id, status_fluxo); onAtualizado(); }
    catch { alert("Erro ao atualizar fluxo."); }
  }

  return (
    <div style={{ background: "var(--surface2)", borderRadius: 8, padding: "8px 10px", marginTop: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <span style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase" }}>Fluxo de mensagens</span>
        {!readOnly && (
          <div style={{ display: "flex", gap: 4 }}>
            {followup.status_fluxo === "ativo"
              ? <button className="btn btn-ghost" style={{ padding: "2px 8px", fontSize: 11 }} onClick={() => mudarFluxo("pausado")}><i className="ti ti-player-pause" style={{ fontSize: 12 }} /> Pausar</button>
              : followup.status_fluxo === "pausado"
              ? <button className="btn btn-ghost" style={{ padding: "2px 8px", fontSize: 11 }} onClick={() => mudarFluxo("ativo")}><i className="ti ti-player-play" style={{ fontSize: 12 }} /> Retomar</button>
              : <span className="badge" style={{ fontSize: 10, background: "var(--danger)22", color: "var(--danger)" }}>Cancelado</span>}
            {followup.status_fluxo !== "cancelado" && <button className="btn btn-ghost" style={{ padding: "2px 8px", fontSize: 11, color: "var(--danger)" }} onClick={() => { if (confirm("Cancelar todo o fluxo de mensagens desse follow-up?")) mudarFluxo("cancelado"); }}><i className="ti ti-x" style={{ fontSize: 12 }} /></button>}
          </div>
        )}
      </div>
      {followup.mensagens.map(m => {
        const [cor, label] = MSG_STATUS_INFO[m.status] || ["var(--muted)", m.status];
        const editavel = !readOnly && m.status !== "enviada";
        return (
          <div key={m.id} style={{ display: "flex", gap: 6, alignItems: "flex-start", padding: "4px 0", borderTop: "1px solid var(--border)" }}>
            <span className="badge" style={{ fontSize: 9, background: `${cor}22`, color: cor, flexShrink: 0, marginTop: 2 }}>{label}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 10, color: "var(--muted)" }}>{fmtData(m.agendado_para)}</div>
              {editandoId === m.id ? (
                <div style={{ display: "flex", gap: 4, marginTop: 2 }}>
                  <textarea className="form-input" style={{ marginBottom: 0, fontSize: 12, minHeight: 50 }} value={textoEdit} onChange={e => setTextoEdit(e.target.value)} />
                  <button className="btn btn-primary" style={{ padding: "4px 8px" }} onClick={() => salvarTexto(m.id)} disabled={salvando}>{salvando ? <span className="spinner" /> : <i className="ti ti-check" />}</button>
                </div>
              ) : (
                <div style={{ fontSize: 12, color: "var(--fg)", cursor: editavel ? "pointer" : "default" }}
                  onClick={() => { if (editavel) { setEditandoId(m.id); setTextoEdit(m.conteudo); } }}
                  title={editavel ? "Clique pra editar" : ""}>
                  {m.conteudo} {editavel && <i className="ti ti-pencil" style={{ fontSize: 11, color: "var(--muted)" }} />}
                </div>
              )}
            </div>
            {editavel && m.status === "agendada" && <button className="btn btn-ghost" style={{ padding: "2px 6px", fontSize: 10 }} onClick={() => mudarStatusMsg(m.id, "pausada")} title="Pausar essa mensagem"><i className="ti ti-player-pause" style={{ fontSize: 11 }} /></button>}
            {editavel && m.status === "pausada" && <button className="btn btn-ghost" style={{ padding: "2px 6px", fontSize: 10 }} onClick={() => mudarStatusMsg(m.id, "agendada")} title="Retomar essa mensagem"><i className="ti ti-player-play" style={{ fontSize: 11 }} /></button>}
            {editavel && <button className="btn btn-ghost" style={{ padding: "2px 6px", fontSize: 10, color: "var(--danger)" }} onClick={() => mudarStatusMsg(m.id, "cancelada")} title="Cancelar essa mensagem"><i className="ti ti-x" style={{ fontSize: 11 }} /></button>}
          </div>
        );
      })}
    </div>
  );
}

// Lembrete de agendamento (visita/test-drive) — mesmo estilo visual de card das
// outras colunas, mas ação mais simples (1 mensagem só, dispara 15-25min antes do
// horário marcado): editar o texto (ou deixar em branco pro padrão automático) e
// pausar/retomar o lembrete inteiro. Sem "fluxo de N mensagens" porque hoje só
// existe 1 disparo por agendamento — decisão explícita 2026-07-12 pra não
// reestruturar o mecanismo de envio (que já funciona ao vivo) só pra caber no
// mesmo formato de sequência editável por mensagem.
function AgendamentoItem({ag, readOnly, onAtualizado}){
  const[editando,setEditando]=useState(false);
  const[texto,setTexto]=useState(ag.lembrete_texto_cliente||"");
  const[salvando,setSalvando]=useState(false);
  async function salvarTexto(){
    setSalvando(true);
    try{await atualizarLembreteAgendamento(ag.id,{lembrete_texto_cliente:texto.trim()||null});onAtualizado();}
    catch{alert("Erro ao salvar. Tente de novo.");}
    setSalvando(false);setEditando(false);
  }
  async function alternarPausa(){
    try{await atualizarLembreteAgendamento(ag.id,{lembrete_pausado:!ag.lembrete_pausado});onAtualizado();}
    catch{alert("Erro ao atualizar o lembrete.");}
  }
  return(
    <div className="fu-item" style={{flexDirection:"column",alignItems:"stretch"}}>
      <div style={{display:"flex",alignItems:"flex-start",gap:10,width:"100%"}}>
        <div className="av" style={{background:"rgba(200,168,75,.15)",color:"var(--brand)",flexShrink:0,fontSize:10}}>{ag.vendedor_iniciais}</div>
        <div className="fu-info">
          <div className="fu-nome">{ag.cliente_nome}</div>
          <div className="fu-sub">{ag.veiculo||"—"} · {ag.vendedor_nome||"sem vendedor"} · {ag.tipo}</div>
          <div style={{fontSize:11,color:"var(--muted)",marginTop:2}}>Agendado pra {fmtData(ag.data_hora)}</div>
          {ag.lembrete_pausado&&<span className="badge" style={{fontSize:10,marginTop:4,background:"var(--warning)22",color:"var(--warning)",display:"inline-flex"}}><i className="ti ti-player-pause" style={{fontSize:11}}/> Lembrete pausado</span>}
        </div>
        {ag.chatwoot_conv_id&&<a href={`https://chat.laautomoveis.com.br/app/accounts/1/conversations/${ag.chatwoot_conv_id}`} target="_blank" rel="noopener noreferrer" className="btn-chatwoot"><i className="ti ti-message-2"/></a>}
      </div>
      <div style={{background:"var(--surface2)",borderRadius:8,padding:"8px 10px",marginTop:8}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
          <span style={{fontSize:10,color:"var(--muted)",textTransform:"uppercase"}}>Mensagem do lembrete</span>
          {!readOnly&&<div style={{display:"flex",gap:4}}>
            <button className="btn btn-ghost" style={{padding:"2px 8px",fontSize:11}} onClick={alternarPausa}>
              {ag.lembrete_pausado?<><i className="ti ti-player-play" style={{fontSize:12}}/> Retomar</>:<><i className="ti ti-player-pause" style={{fontSize:12}}/> Pausar</>}
            </button>
          </div>}
        </div>
        {editando?(
          <div style={{display:"flex",gap:4}}>
            <textarea className="form-input" style={{marginBottom:0,fontSize:12,minHeight:50}} value={texto} onChange={e=>setTexto(e.target.value)} placeholder="Deixe em branco pro texto padrão automático"/>
            <button className="btn btn-primary" style={{padding:"4px 8px"}} onClick={salvarTexto} disabled={salvando}>{salvando?<span className="spinner"/>:<i className="ti ti-check"/>}</button>
          </div>
        ):(
          <div style={{fontSize:12,color:ag.lembrete_texto_cliente?"var(--fg)":"var(--muted)",cursor:readOnly?"default":"pointer",fontStyle:ag.lembrete_texto_cliente?"normal":"italic"}}
            onClick={()=>{if(readOnly)return;setTexto(ag.lembrete_texto_cliente||"");setEditando(true);}}
            title={readOnly?"":"Clique pra editar"}>
            {ag.lembrete_texto_cliente||"Texto padrão automático (clique pra personalizar)"} {!readOnly&&<i className="ti ti-pencil" style={{fontSize:11,color:"var(--muted)"}}/>}
          </div>
        )}
      </div>
    </div>
  );
}

const TIPO_LABEL={
  sem_credito:"Sem crédito",vai_pensar:"Vai pensar",
  nao_achou_carro:"Não achou o carro",parou_responder:"Parou de responder",
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
  nao_achou_carro:"#2980B9",parou_responder:"#16a085",
  pos_venda_satisfacao:"#d1637a",
};
const TIPO_ORDEM=["sem_credito","vai_pensar","nao_achou_carro","parou_responder","pos_venda_satisfacao"];

function fmtData(iso){
  if(!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR",{day:"2-digit",month:"2-digit",year:"2-digit",hour:"2-digit",minute:"2-digit"});
}

// Classificação do estágio: manual (vendedor arrastou o card) vs automática (Observador
// pós-handoff classificou por IA, com nível de confiança) — usa estagio_definido_por
// (fonte confiável) e extrai a confiança do texto de motivo quando disponível.
function ClassificacaoBadge({f}){
  if(f.estagio_definido_por==="humano"){
    return <span className="badge" style={{fontSize:10,background:"var(--brand)22",color:"var(--brand)",display:"inline-flex",alignItems:"center",gap:3}}><i className="ti ti-user" style={{fontSize:11}}/>Definido manualmente</span>;
  }
  if(f.estagio_definido_por==="ia_observador"){
    const m=/confianca[:\s]*([0-9.]+)/i.exec(f.motivo||"");
    const conf=m?Math.round(parseFloat(m[1])*100):null;
    return <span className="badge" style={{fontSize:10,background:"#7ba7e022",color:"#7ba7e0",display:"inline-flex",alignItems:"center",gap:3}}><i className="ti ti-robot" style={{fontSize:11}}/>IA{conf!==null?` · ${conf}% confiança`:""}</span>;
  }
  return null;
}

export default function FollowUps(){
  const role=getRole();
  const readOnly=role==="manager";
  // "Agendados pela Lara" (silêncio pós-handoff, revisão de carro não encontrado etc)
  // é visão de administração — só owner/manager, nunca vendedor (2026-07-16).
  const podeVerAgendados=role!=="agent";
  // "Agendamentos" (lembrete de visita) é redundante pro vendedor — a página Agenda
  // (menu lateral) já é a visão dedicada de compromissos, sincronizada com o Kanban
  // dos dois lados. Só owner/manager continuam vendo aqui, útil pra auditoria cruzada
  // de todos os vendedores num só lugar (2026-07-16).
  const podeVerAgendamentos=role!=="agent";
  const[data,setData]=useState({porTipo:{}});
  const[aba,setAba]=useState("estagio");
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

  // "Grab to scroll" horizontal, mesmo padrão do Kanban do CRM — clicar e arrastar
  // numa área vazia do board rola pros outros estágios sem precisar mirar na
  // scrollbar fina embaixo (2026-07-16, pedido pra facilitar ver as colunas fora
  // da tela).
  const boardRef=useRef(null);
  const arrastandoBoard=useRef({ativo:false,startX:0,startScroll:0});
  function onBoardMouseDown(e){
    if(e.button!==0)return;
    if(e.target.closest(".fu-kanban-card")||e.target.closest(".fu-kanban-col-header"))return;
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
  const[concluindo,setConcluindo]=useState(null);
  async function concluirAgendado(id){
    setConcluindo(id);
    try{await concluirFollowupAgendado(id);setData(d=>({...d,agendados:d.agendados.filter(a=>a.id!==id)}));}
    catch{alert("Erro ao concluir. Tente de novo.");}
    setConcluindo(null);
  }

  const hoje=new Date().toDateString();
  const ehHoje=f=>f.horario&&new Date(f.horario).toDateString()===hoje;
  const ehVencido=f=>f.horario&&new Date(f.horario)<new Date()&&!f.enviado&&!ehHoje(f);
  const passaFiltro=f=>filtroData==="todos"||(filtroData==="hoje"&&ehHoje(f))||(filtroData==="vencidos"&&ehVencido(f));
  const totalEmFollowup=Object.values(data.porTipo||{}).reduce((s,arr)=>s+arr.length,0);
  const totalHoje=Object.values(data.porTipo||{}).reduce((s,arr)=>s+arr.filter(ehHoje).length,0);
  const totalVencidos=Object.values(data.porTipo||{}).reduce((s,arr)=>s+arr.filter(ehVencido).length,0);

  if(erro)return <div className="empty-state"><i className="ti ti-alert-triangle"/><p>{erro}</p></div>;
  if(loading)return <div className="empty-state"><i className="ti ti-loader" style={{animation:"spin 1s linear infinite"}}/><p>Carregando...</p></div>;

  // Chatwoot é o único link de conversa — já leva pra thread certa, não precisa do
  // atalho de WhatsApp Web ao lado (que abria a conversa "solta", sem contexto).
  function AcoesLead(f){
    return (
      <div className="fu-actions">
        {f.chatwoot_conv_id&&<a href={`https://chat.laautomoveis.com.br/app/accounts/1/conversations/${f.chatwoot_conv_id}`} target="_blank" rel="noopener noreferrer" className="btn-chatwoot"><i className="ti ti-message-2"/> Chatwoot</a>}
        {!f.respondeu&&!readOnly&&<button className="btn btn-ghost" style={{padding:"5px 10px",fontSize:12}} onClick={()=>marcarRespondeu(f.id)}>Marcar respondido</button>}
        {f.respondeu&&<span className="badge badge-success" style={{fontSize:11}}><i className="ti ti-check" style={{fontSize:12}}/> Respondeu</span>}
      </div>
    );
  }

  return(
    <div>
      <div className="page-header"><h1 className="page-title"><i className="ti ti-clock"/> Follow-ups</h1></div>
      <div className="tabs-wrap">
        <button className={`tab-btn ${aba==="estagio"?"active":""}`} onClick={()=>setAba("estagio")}>Por estágio ({totalEmFollowup})</button>
        {podeVerAgendados&&<button className={`tab-btn ${aba==="agendados"?"active":""}`} onClick={()=>setAba("agendados")}>Agendados pela Lara ({data.agendados?.length||0})</button>}
        {podeVerAgendamentos&&<button className={`tab-btn ${aba==="agendamentos"?"active":""}`} onClick={()=>setAba("agendamentos")}>Agendamentos ({data.agendamentos?.length||0})</button>}
      </div>

      {aba==="estagio"&&(<>
          {/* Filtro de data — substitui as antigas abas "Agenda de hoje"/"Vencidos"
              (mesma tabela de "Por estágio", só um recorte por data). */}
          <div style={{display:"flex",gap:8,marginBottom:14}}>
            <button className={`tab-btn ${filtroData==="todos"?"active":""}`} onClick={()=>setFiltroData("todos")}>Todos ({totalEmFollowup})</button>
            <button className={`tab-btn ${filtroData==="hoje"?"active":""}`} onClick={()=>setFiltroData("hoje")}>Hoje ({totalHoje})</button>
            <button className={`tab-btn ${filtroData==="vencidos"?"active":""}`} onClick={()=>setFiltroData("vencidos")} style={{color:totalVencidos>0?"var(--danger)":undefined}}>
              Vencidos {totalVencidos>0&&<span style={{background:"var(--danger)",color:"white",borderRadius:"50%",width:16,height:16,display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:10,marginLeft:4}}>{totalVencidos}</span>}
            </button>
          </div>
          {/* Board horizontal, uma coluna por tipo de follow-up, SEMPRE todas
          (mesmo vazias, igual ao Kanban do CRM). TIPO_ORDEM já bate 1:1 com os
          estágios-motivo do CRM (sem_credito/vai_pensar/nao_achou_carro/
          parou_responder são o mesmo estágio, não uma categoria à parte; só
          pos_venda_satisfacao não é coluna do Kanban). match_estoque não tem
          coluna própria — ver comentário perto de TIPO_COR.
          Diferenciação visual do Kanban do CRM (mesmas abas, telas diferentes):
          aqui a cor do estágio vira um acento (barra no topo da coluna + borda
          lateral no card) em vez do contorno completo que o CRM usa — o card é
          mais alto/detalhado (mostra a mensagem real), então um contorno inteiro
          ficaria pesado. Card sem duplicar informação: ClassificacaoBadge já
          resume o "motivo" (IA+confiança ou manual), não repete o texto cru. */}
          <div className="fu-kanban-board" ref={boardRef}
            onMouseDown={onBoardMouseDown} onMouseMove={onBoardMouseMove}
            onMouseUp={onBoardMouseUpOrLeave} onMouseLeave={onBoardMouseUpOrLeave}>
            {TIPO_ORDEM.map(tipo=>{
              const leads=(data.porTipo?.[tipo]||[]).filter(passaFiltro);
              const cor=TIPO_COR[tipo];
              return (
              <div key={tipo} className="fu-kanban-col">
                <div className="fu-kanban-col-header" style={{borderTopColor:cor}}>
                  <span className="fu-kanban-col-title" style={{color:cor}}>{TIPO_LABEL[tipo]||tipo}</span>
                  <span className="kanban-col-count">{leads.length}</span>
                </div>
                <div className="fu-kanban-cards">
                  {leads.length===0&&<div style={{textAlign:"center",color:"var(--muted)",fontSize:12,padding:"12px 0"}}>—</div>}
                  {leads.map(f=>(
                    <div key={f.id} className="fu-kanban-card" style={{border:`2px solid ${cor}`,boxShadow:`0 0 8px ${cor}4d`}}>
                      <div className="fu-item">
                        <div className="av" style={{background:"rgba(200,168,75,.15)",color:"var(--brand)",flexShrink:0,fontSize:10}}>{f.vendedor_iniciais}</div>
                        <div className="fu-info">
                          <div className="fu-nome">{f.cliente_nome}</div>
                          <div className="fu-sub">{f.veiculo||"—"} · {f.vendedor_nome||"sem vendedor"}</div>
                          <div style={{fontSize:11,color:"var(--muted)",marginTop:2}}>
                            Entrou em {fmtData(f.criado_em)} · Próximo follow-up: {fmtData(f.horario)}
                          </div>
                          <div style={{marginTop:4}}>
                            <ClassificacaoBadge f={f}/>
                            {!f.estagio_definido_por&&f.motivo&&<span style={{fontSize:11,color:"var(--muted)"}}>{f.motivo}</span>}
                          </div>
                        </div>
                        {AcoesLead(f)}
                      </div>
                      {f.mensagens&&f.mensagens.length>0
                        ?<FluxoMensagens followup={f} readOnly={readOnly} onAtualizado={load}/>
                        :<div style={{fontSize:11,color:"var(--muted)",fontStyle:"italic",marginTop:6,textAlign:"center"}}>Sem mensagem automática pra esse estágio</div>}
                    </div>
                  ))}
                </div>
              </div>
              );
            })}
          </div>
      </>)}

      {aba==="agendados"&&podeVerAgendados&&(
        <div className="card fu-scroll-list">
          {(!data.agendados||data.agendados.length===0)&&<div className="empty-state"><i className="ti ti-check"/><p>Nenhum follow-up agendado pela Lara no momento</p></div>}
          {data.agendados?.map(a=>(
            <div key={a.id} className="fu-item">
              <div className="av" style={{background:"rgba(200,168,75,.15)",color:"var(--brand)",flexShrink:0,fontSize:10}}>{a.vendedor_iniciais}</div>
              <div className="fu-info">
                <div className="fu-nome">{a.cliente_nome||a.phone}</div>
                <div className="fu-sub">{a.cenario} · {fmtData(a.agendado_para)}</div>
                {a.status==="pendente_revisao"&&<span className="badge badge-warning" style={{fontSize:10,marginTop:4,display:"inline-flex"}}><i className="ti ti-alert-triangle" style={{fontSize:11}}/> Revisão manual</span>}
              </div>
              <div className="fu-actions">
                {a.chatwoot_conv_id&&<a href={`https://chat.laautomoveis.com.br/app/accounts/1/conversations/${a.chatwoot_conv_id}`} target="_blank" rel="noopener noreferrer" className="btn-chatwoot"><i className="ti ti-message-2"/> Chatwoot</a>}
                {!readOnly&&<button className="btn btn-ghost" style={{padding:"5px 10px",fontSize:12}} onClick={()=>concluirAgendado(a.id)} disabled={concluindo===a.id}>{concluindo===a.id?<span className="spinner"/>:<><i className="ti ti-check" style={{fontSize:14}}/> Concluir</>}</button>}
              </div>
            </div>
          ))}
        </div>
      )}

      {aba==="agendamentos"&&podeVerAgendamentos&&(
        <div className="card fu-scroll-list">
          {(!data.agendamentos||data.agendamentos.length===0)&&<div className="empty-state"><i className="ti ti-check"/><p>Nenhum agendamento com lembrete pendente</p></div>}
          {data.agendamentos?.map(ag=>(
            <div key={ag.id} style={{marginBottom:8}}>
              <AgendamentoItem ag={ag} readOnly={readOnly} onAtualizado={load}/>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}

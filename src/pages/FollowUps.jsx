import { useState, useEffect } from "react";
import { getFollowups, marcarFollowupEnviado, marcarFollowupRespondeu, atualizarFluxoFollowup, atualizarMensagemFollowup, concluirFollowupAgendado, atualizarLembreteAgendamento } from "../api.js";
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
        {ag.telefone&&<a href={`https://wa.me/55${ag.telefone.replace(/\D/g,"")}`} target="_blank" rel="noopener noreferrer" className="btn-wa"><i className="ti ti-brand-whatsapp" style={{fontSize:16}}/></a>}
        {ag.chatwoot_conv_id&&<a href={`https://chat.laautomoveis.com.br/app/accounts/1/conversations/${ag.chatwoot_conv_id}`} target="_blank" rel="noopener noreferrer" className="btn btn-ghost" style={{padding:"5px 10px",fontSize:12}}><i className="ti ti-message-circle" style={{fontSize:14}}/></a>}
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
  pos_venda_satisfacao:"Pós-venda",match_estoque:"Veículo compatível chegou!",
};
const TIPO_ORDEM=["sem_credito","vai_pensar","nao_achou_carro","parou_responder","pos_venda_satisfacao","match_estoque"];

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
  const readOnly=getRole()==="manager";
  const[data,setData]=useState({hoje:[],vencidos:[],porTipo:{}});
  const[aba,setAba]=useState("estagio");
  const[loading,setLoading]=useState(true);
  const[erro,setErro]=useState(null);

  const load=()=>getFollowups().then(d=>{setData(d);setLoading(false);})
    .catch(()=>{setErro("Erro ao carregar dados. Tente novamente.");setLoading(false);});
  useEffect(()=>{load();},[]);

  const upd=(id,changes)=>setData(d=>({
    hoje:d.hoje.map(f=>f.id===id?{...f,...changes}:f),
    vencidos:d.vencidos.map(f=>f.id===id?{...f,...changes}:f),
    porTipo:Object.fromEntries(Object.entries(d.porTipo||{}).map(([k,v])=>[k,v.map(f=>f.id===id?{...f,...changes}:f)])),
  }));

  async function marcarEnviado(id){try{await marcarFollowupEnviado(id);}catch{}upd(id,{enviado:true});}
  async function marcarRespondeu(id){try{await marcarFollowupRespondeu(id);}catch{}upd(id,{respondeu:true});}
  const[concluindo,setConcluindo]=useState(null);
  async function concluirAgendado(id){
    setConcluindo(id);
    try{await concluirFollowupAgendado(id);setData(d=>({...d,agendados:d.agendados.filter(a=>a.id!==id)}));}
    catch{alert("Erro ao concluir. Tente de novo.");}
    setConcluindo(null);
  }

  const lista=aba==="hoje"?data.hoje:aba==="vencidos"?data.vencidos:null;
  const resumo={hoje:data.hoje?.length||0,pendentes:data.hoje?.filter(f=>!f.enviado)?.length||0,responderam:data.hoje?.filter(f=>f.respondeu)?.length||0};
  const totalEmFollowup=Object.values(data.porTipo||{}).reduce((s,arr)=>s+arr.length,0);

  if(erro)return <div className="empty-state"><i className="ti ti-alert-triangle"/><p>{erro}</p></div>;
  if(loading)return <div className="empty-state"><i className="ti ti-loader" style={{animation:"spin 1s linear infinite"}}/><p>Carregando...</p></div>;

  function AcoesLead(f){
    return (
      <div className="fu-actions">
        {f.telefone&&<a href={`https://wa.me/55${f.telefone.replace(/\D/g,"")}`} target="_blank" rel="noopener noreferrer" className="btn-wa"><i className="ti ti-brand-whatsapp" style={{fontSize:16}}/></a>}
        {f.chatwoot_conv_id&&<a href={`https://chat.laautomoveis.com.br/app/accounts/1/conversations/${f.chatwoot_conv_id}`} target="_blank" rel="noopener noreferrer" className="btn btn-ghost" style={{padding:"5px 10px",fontSize:12}}><i className="ti ti-message-circle" style={{fontSize:14}}/> Chatwoot</a>}
        {!f.respondeu&&!readOnly&&<button className="btn btn-ghost" style={{padding:"5px 10px",fontSize:12}} onClick={()=>marcarRespondeu(f.id)}>Marcar respondido</button>}
        {f.respondeu&&<span className="badge badge-success" style={{fontSize:11}}><i className="ti ti-check" style={{fontSize:12}}/> Respondeu</span>}
      </div>
    );
  }

  return(
    <div>
      <div className="page-header"><h1 className="page-title"><i className="ti ti-clock"/> Follow-ups</h1></div>
      <div className="metrics-grid" style={{marginBottom:20}}>
        <div className="metric-card"><div className="metric-label"><i className="ti ti-list-details"/>Em follow-up</div><div className="metric-value">{totalEmFollowup}</div><div className="metric-delta">aguardando resposta</div></div>
        <div className="metric-card"><div className="metric-label"><i className="ti ti-calendar"/>Hoje</div><div className="metric-value">{resumo.hoje}</div><div className="metric-delta">agendados</div></div>
        <div className="metric-card"><div className="metric-label"><i className="ti ti-send"/>Pendentes</div><div className="metric-value" style={{color:"var(--warning)"}}>{resumo.pendentes}</div><div className="metric-delta">não enviados</div></div>
        <div className="metric-card"><div className="metric-label"><i className="ti ti-message-check"/>Responderam</div><div className="metric-value" style={{color:"var(--success)"}}>{resumo.responderam}</div><div className="metric-delta">hoje</div></div>
      </div>
      <div className="tabs-wrap">
        <button className={`tab-btn ${aba==="estagio"?"active":""}`} onClick={()=>setAba("estagio")}>Por estágio ({totalEmFollowup})</button>
        <button className={`tab-btn ${aba==="hoje"?"active":""}`} onClick={()=>setAba("hoje")}>Agenda de hoje ({data.hoje?.length||0})</button>
        <button className={`tab-btn ${aba==="vencidos"?"active":""}`} onClick={()=>setAba("vencidos")} style={{color:data.vencidos?.length>0?"var(--danger)":undefined}}>
          Vencidos {data.vencidos?.length>0&&<span style={{background:"var(--danger)",color:"white",borderRadius:"50%",width:16,height:16,display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:10,marginLeft:4}}>{data.vencidos.length}</span>}
        </button>
        <button className={`tab-btn ${aba==="agendados"?"active":""}`} onClick={()=>setAba("agendados")}>Agendados pela Lara ({data.agendados?.length||0})</button>
        <button className={`tab-btn ${aba==="agendamentos"?"active":""}`} onClick={()=>setAba("agendamentos")}>Agendamentos ({data.agendamentos?.length||0})</button>
      </div>

      {aba==="estagio"&&(
          // Board horizontal, uma coluna por tipo de follow-up, SEMPRE as 6 (mesmo
          // vazias, igual ao Kanban do CRM — antes só mostrava coluna com lead dentro,
          // o que parecia quebrado quando só 1 tipo tinha dado). TIPO_ORDEM já bate 1:1
          // com os estágios-motivo do CRM (sem_credito/vai_pensar/nao_achou_carro/
          // parou_responder são o mesmo estágio, não uma categoria à parte; só
          // pos_venda_satisfacao e match_estoque não são coluna do Kanban, ver
          // FOLLOWUP_LABEL em CRM.jsx). Cada card já mostra a mensagem real que vai
          // ser mandada (FluxoMensagens), não só o motivo da classificação.
          <div className="fu-kanban-board">
            {TIPO_ORDEM.map(tipo=>{
              const leads=data.porTipo?.[tipo]||[];
              return (
              <div key={tipo} className="fu-kanban-col">
                <div className="kanban-col-header">
                  <span className="kanban-col-title">{TIPO_LABEL[tipo]||tipo}</span>
                  <span className="kanban-col-count">{leads.length}</span>
                </div>
                <div className="fu-kanban-cards">
                  {leads.length===0&&<div style={{textAlign:"center",color:"var(--muted)",fontSize:12,padding:"12px 0"}}>—</div>}
                  {leads.map(f=>(
                    <div key={f.id} className="fu-kanban-card">
                      <div className="fu-item">
                        <div className="av" style={{background:"rgba(200,168,75,.15)",color:"var(--brand)",flexShrink:0,fontSize:10}}>{f.vendedor_iniciais}</div>
                        <div className="fu-info">
                          <div className="fu-nome">{f.cliente_nome}</div>
                          <div className="fu-sub">{f.veiculo||"—"} · {f.vendedor_nome||"sem vendedor"}</div>
                          <div style={{fontSize:11,color:"var(--muted)",marginTop:2}}>
                            Entrou em {fmtData(f.criado_em)} · Próximo follow-up: {fmtData(f.horario)}
                          </div>
                          <div style={{marginTop:4}}><ClassificacaoBadge f={f}/></div>
                          {f.motivo&&<div style={{fontSize:11,color:"var(--muted)",marginTop:2}}>{f.motivo}</div>}
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
      )}

      {aba==="agendados"&&(
        <div className="card">
          {(!data.agendados||data.agendados.length===0)&&<div className="empty-state"><i className="ti ti-check"/><p>Nenhum follow-up agendado pela Lara no momento</p></div>}
          {data.agendados?.map(a=>(
            <div key={a.id} className="fu-item">
              <div className="av" style={{background:"rgba(200,168,75,.15)",color:"var(--brand)",flexShrink:0,fontSize:10}}>{a.vendedor_iniciais}</div>
              <div className="fu-info">
                <div className="fu-nome">{a.cliente_nome||a.phone}</div>
                <div className="fu-sub">{a.cenario} · {fmtData(a.agendado_para)}</div>
                <div style={{fontSize:11,color:"var(--muted)",marginTop:2}}>{a.mensagem}</div>
                {a.status==="pendente_revisao"&&<span className="badge badge-warning" style={{fontSize:10,marginTop:4,display:"inline-flex"}}><i className="ti ti-alert-triangle" style={{fontSize:11}}/> Revisão manual</span>}
              </div>
              <div className="fu-actions">
                {a.phone&&<a href={`https://wa.me/55${a.phone.replace(/\D/g,"")}`} target="_blank" rel="noopener noreferrer" className="btn-wa"><i className="ti ti-brand-whatsapp" style={{fontSize:16}}/></a>}
                {a.chatwoot_conv_id&&<a href={`https://chat.laautomoveis.com.br/app/accounts/1/conversations/${a.chatwoot_conv_id}`} target="_blank" rel="noopener noreferrer" className="btn btn-ghost" style={{padding:"5px 10px",fontSize:12}}><i className="ti ti-message-circle" style={{fontSize:14}}/> Chatwoot</a>}
                {!readOnly&&<button className="btn btn-ghost" style={{padding:"5px 10px",fontSize:12}} onClick={()=>concluirAgendado(a.id)} disabled={concluindo===a.id}>{concluindo===a.id?<span className="spinner"/>:<><i className="ti ti-check" style={{fontSize:14}}/> Concluir</>}</button>}
              </div>
            </div>
          ))}
        </div>
      )}

      {aba==="agendamentos"&&(
        <div className="card">
          {(!data.agendamentos||data.agendamentos.length===0)&&<div className="empty-state"><i className="ti ti-check"/><p>Nenhum agendamento com lembrete pendente</p></div>}
          {data.agendamentos?.map(ag=>(
            <div key={ag.id} style={{marginBottom:8}}>
              <AgendamentoItem ag={ag} readOnly={readOnly} onAtualizado={load}/>
            </div>
          ))}
        </div>
      )}

      {lista!==null&&(
        <div className="card">
          {lista?.length===0&&<div className="empty-state"><i className="ti ti-check"/><p>Nenhum follow-up {aba==="hoje"?"hoje":"vencido"}</p></div>}
          {lista?.map(f=>(
            <div key={f.id} className="fu-item" style={{borderLeft:aba==="vencidos"?"3px solid var(--danger)":"none",paddingLeft:aba==="vencidos"?10:0}}>
              <span style={{fontSize:12,color:"var(--muted)",minWidth:80,flexShrink:0}}>{f.horario}</span>
              <div className="av" style={{background:"rgba(200,168,75,.15)",color:"var(--brand)",flexShrink:0,fontSize:10}}>{f.vendedor_iniciais}</div>
              <div className="fu-info">
                <div className="fu-nome">{f.cliente_nome}</div>
                <div className="fu-sub">{f.veiculo} · <span style={{color:"var(--brand)"}}>{TIPO_LABEL[f.tipo]||f.tipo}</span></div>
                {f.motivo&&<div style={{fontSize:11,color:"var(--muted)",marginTop:2}}>{f.motivo}</div>}
              </div>
              <div className="fu-actions">
                {f.telefone&&<a href={`https://wa.me/55${f.telefone.replace(/\D/g,"")}`} target="_blank" rel="noopener noreferrer" className="btn-wa"><i className="ti ti-brand-whatsapp" style={{fontSize:16}}/></a>}
                {!f.enviado?(readOnly?null:<button className="btn btn-ghost" style={{padding:"5px 10px",fontSize:12}} onClick={()=>marcarEnviado(f.id)}><i className="ti ti-send" style={{fontSize:14}}/> Enviado</button>)
                  :<span className="badge badge-brand" style={{fontSize:11}}><i className="ti ti-check" style={{fontSize:12}}/> Enviado</span>}
                {f.enviado&&!f.respondeu&&!readOnly&&<button className="btn btn-ghost" style={{padding:"5px 10px",fontSize:12}} onClick={()=>marcarRespondeu(f.id)}>Respondeu</button>}
                {f.respondeu&&<span className="badge badge-success" style={{fontSize:11}}><i className="ti ti-check" style={{fontSize:12}}/> Respondeu</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

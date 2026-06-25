import { useState, useEffect } from "react";
import { getAgenda, criarAgendamento, atualizarStatusAgendamento } from "../api.js";
import { isManager, getUser } from "../auth.js";

const TIPOS={test_drive:{label:"Test drive",icon:"🚗",cor:"#C8A84B"},visita_patio:{label:"Visita ao pátio",icon:"🏢",cor:"#2980B9"},apresentacao:{label:"Apresentação",icon:"📋",cor:"#27AE60"},reuniao_fechamento:{label:"Reunião de fechamento",icon:"🤝",cor:"#8E44AD"}};
const SBORDA={confirmado:"var(--success)",pendente:"var(--warning)",em_breve:"var(--brand)",realizado:"var(--muted)",cancelado:"var(--danger)"};

function fmtH(iso){const d=new Date(iso);return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;}
function fmtHF(iso,dur){const d=new Date(iso);d.setMinutes(d.getMinutes()+dur);return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;}
function fmtDia(d){const ds=["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];return `${ds[d.getDay()]} ${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}`;}
function mesmoDia(a,b){return a.toDateString()===b.toDateString();}
function minAte(iso){return Math.round((new Date(iso)-Date.now())/60000);}
function getStatus(ag){const m=minAte(ag.data_hora);if(ag.status==="confirmado"&&m>0&&m<=30)return "em_breve";return ag.status;}

function AgendaCard({ag,onStatus}){
  const status=getStatus(ag);
  const tipo=TIPOS[ag.tipo]||{label:ag.tipo,icon:"📅",cor:"var(--muted)"};
  const min=minAte(ag.data_hora);
  return(
    <div className={`agenda-card ${status}`} style={{borderLeftColor:SBORDA[status]}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
        <span style={{fontSize:16,fontWeight:700,color:"var(--fg)"}}>
          {fmtH(ag.data_hora)} — {fmtHF(ag.data_hora,ag.duracao_min)}
          {status==="em_breve"&&<span style={{fontSize:11,color:"var(--brand)",marginLeft:8}}>⚠️ EM {min} MIN</span>}
        </span>
        <div style={{width:28,height:28,borderRadius:"50%",background:"rgba(200,168,75,.15)",color:"var(--brand)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700}}>{ag.vendedor_iniciais}</div>
      </div>
      <span style={{fontSize:11,padding:"3px 10px",borderRadius:99,background:`${tipo.cor}22`,color:tipo.cor,display:"inline-block",marginBottom:8}}>{tipo.icon} {tipo.label}</span>
      <div style={{fontSize:15,fontWeight:600,color:"var(--fg)",marginBottom:2}}>{ag.cliente_nome}</div>
      <div style={{fontSize:13,color:"var(--muted)",marginBottom:8}}>{ag.veiculo}</div>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:ag.observacoes?8:10}}>
        <span style={{fontSize:13,color:"var(--muted)",whiteSpace:"nowrap"}}>📱 {ag.cliente_tel}</span>
        <a href={`https://wa.me/55${ag.cliente_tel}`} target="_blank" rel="noopener noreferrer" className="btn-wa" style={{padding:"4px 10px"}}><i className="ti ti-brand-whatsapp" style={{fontSize:14}}/> WA</a>
      </div>
      {ag.observacoes&&<div style={{fontSize:12,color:"var(--muted)",fontStyle:"italic",marginBottom:10,padding:"6px 8px",background:"var(--surface2)",borderRadius:6}}>{ag.observacoes}</div>}
      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
        {ag.status==="pendente"&&<button className="btn btn-ghost" style={{fontSize:12,padding:"6px 12px",color:"var(--success)",borderColor:"rgba(76,175,125,.3)"}} onClick={()=>onStatus(ag.id,"confirmado")}><i className="ti ti-check"/> Confirmar</button>}
        {(ag.status==="confirmado"||ag.status==="pendente")&&<button className="btn btn-danger" style={{fontSize:12,padding:"6px 12px"}} onClick={()=>onStatus(ag.id,"cancelado")}><i className="ti ti-x"/> Cancelar</button>}
        {ag.status==="confirmado"&&new Date(ag.data_hora)<new Date()&&<>
          <button className="btn btn-ghost" style={{fontSize:12,padding:"6px 12px",color:"var(--success)",borderColor:"rgba(76,175,125,.3)"}} onClick={()=>onStatus(ag.id,"realizado")}><i className="ti ti-check"/> Realizado</button>
          <button className="btn btn-danger" style={{fontSize:12,padding:"6px 12px"}} onClick={()=>onStatus(ag.id,"cancelado")}><i className="ti ti-user-x"/> Não veio</button>
        </>}
      </div>
    </div>
  );
}

function NovoModal({onClose,onCriado}){
  const user=getUser();
  const[form,setForm]=useState({cliente_nome:"",cliente_tel:"",veiculo:"",tipo:"test_drive",data:new Date().toISOString().split("T")[0],horario:"09:00",duracao_min:45,vendedor_nome:isManager()?"":user?.nome,observacoes:""});
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  function slots(){const d=new Date(form.data+"T12:00:00");const dow=d.getDay();if(dow===0)return[];const fim=dow===6?12:18;const s=[];for(let h=8;h<fim;h++){s.push(`${String(h).padStart(2,"0")}:00`);s.push(`${String(h).padStart(2,"0")}:30`);}return s;}
  async function submit(){if(!form.cliente_nome||!form.veiculo)return;const data_hora=`${form.data}T${form.horario}:00`;try{await criarAgendamento({...form,data_hora});}catch{}onCriado();onClose();}
  return(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-handle"/>
        <div className="modal-header"><h2 className="modal-title">Novo agendamento</h2><button onClick={onClose} style={{background:"none",border:"none",color:"var(--muted)",fontSize:22,cursor:"pointer"}}><i className="ti ti-x"/></button></div>
        <div className="form-group"><label className="form-label">Cliente *</label><input className="form-input" value={form.cliente_nome} onChange={e=>set("cliente_nome",e.target.value)} placeholder="Nome do cliente"/></div>
        <div className="form-group"><label className="form-label">Telefone</label><input className="form-input" value={form.cliente_tel} onChange={e=>set("cliente_tel",e.target.value)} placeholder="49999999999"/></div>
        <div className="form-group"><label className="form-label">Veículo *</label><input className="form-input" value={form.veiculo} onChange={e=>set("veiculo",e.target.value)} placeholder="Ex: HB20 2022"/></div>
        <div className="form-grid">
          <div className="form-group"><label className="form-label">Tipo</label><select className="form-input" value={form.tipo} onChange={e=>set("tipo",e.target.value)}>{Object.entries(TIPOS).map(([k,v])=><option key={k} value={k}>{v.icon} {v.label}</option>)}</select></div>
          <div className="form-group"><label className="form-label">Duração</label><select className="form-input" value={form.duracao_min} onChange={e=>set("duracao_min",+e.target.value)}><option value={30}>30 min</option><option value={45}>45 min</option><option value={60}>1 hora</option><option value={90}>1h30</option></select></div>
          <div className="form-group"><label className="form-label">Data</label><input className="form-input" type="date" value={form.data} onChange={e=>set("data",e.target.value)} min={new Date().toISOString().split("T")[0]}/></div>
          <div className="form-group"><label className="form-label">Horário</label><select className="form-input" value={form.horario} onChange={e=>set("horario",e.target.value)}>{slots().map(s=><option key={s} value={s}>{s}</option>)}</select></div>
        </div>
        {isManager()&&<div className="form-group"><label className="form-label">Vendedor</label><select className="form-input" value={form.vendedor_nome} onChange={e=>set("vendedor_nome",e.target.value)}><option value="">Selecionar...</option>{["Dariana","Alex","Wolni"].map(n=><option key={n} value={n}>{n}</option>)}</select></div>}
        <div className="form-group"><label className="form-label">Observações</label><textarea className="form-input" value={form.observacoes} onChange={e=>set("observacoes",e.target.value)} rows={2} style={{resize:"vertical"}}/></div>
        <div style={{display:"flex",gap:8}}><button className="btn btn-ghost" onClick={onClose} style={{flex:1}}>Cancelar</button><button className="btn btn-primary" onClick={submit} style={{flex:1}}><i className="ti ti-calendar-plus"/> Agendar</button></div>
      </div>
    </div>
  );
}

export default function Agenda(){
  const[ags,setAgs]=useState([]);
  const[diaSel,setDiaSel]=useState(new Date());
  const[loading,setLoading]=useState(true);
  const[novoModal,setNovoModal]=useState(false);

  function load(){setLoading(true);const data=diaSel.toISOString().split("T")[0];getAgenda(data).then(a=>{setAgs(a);setLoading(false);}).catch(()=>setLoading(false));}
  useEffect(()=>{load();},[diaSel]);

  const dias=Array.from({length:7},(_,i)=>{const d=new Date();d.setDate(d.getDate()-3+i);return d;});
  const hoje=new Date();
  const doDia=ags.filter(ag=>mesmoDia(new Date(ag.data_hora),diaSel));
  const manha=doDia.filter(ag=>new Date(ag.data_hora).getHours()<12);
  const tarde=doDia.filter(ag=>new Date(ag.data_hora).getHours()>=12);

  async function handleStatus(id,status){try{await atualizarStatusAgendamento(id,status);}catch{}setAgs(a=>a.map(ag=>ag.id===id?{...ag,status}:ag));}

  return(
    <div>
      <div className="page-header"><h1 className="page-title"><i className="ti ti-calendar-event"/> Agenda</h1><button className="btn btn-primary" onClick={()=>setNovoModal(true)}><i className="ti ti-plus"/> Agendar</button></div>
      <div className="dias-nav">
        {dias.map((d,i)=>{const isHoje=mesmoDia(d,hoje);const isSel=mesmoDia(d,diaSel);const ns=["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];return(<button key={i} className={`dia-btn ${isHoje?"hoje":""} ${isSel?"selected":""}`} onClick={()=>setDiaSel(d)}><span className="dia-num">{d.getDate()}</span><span className="dia-nome">{ns[d.getDay()]}</span></button>);})}
      </div>
      <div style={{fontSize:13,color:"var(--muted)",marginBottom:16}}>{fmtDia(diaSel)} · {doDia.filter(a=>a.status!=="cancelado").length} agendamentos</div>
      {loading&&<div className="empty-state"><i className="ti ti-loader" style={{animation:"spin 1s linear infinite"}}/><p>Carregando...</p></div>}
      {!loading&&doDia.length===0&&<div className="empty-state"><i className="ti ti-calendar-off"/><p>Nenhum agendamento para {fmtDia(diaSel)}</p></div>}
      {manha.length>0&&<><div className="sec-label">Manhã</div>{manha.map(ag=><AgendaCard key={ag.id} ag={ag} onStatus={handleStatus}/>)}</>}
      {tarde.length>0&&<><div className="sec-label">Tarde</div>{tarde.map(ag=><AgendaCard key={ag.id} ag={ag} onStatus={handleStatus}/>)}</>}
      {novoModal&&<NovoModal onClose={()=>setNovoModal(false)} onCriado={()=>load()}/>}
    </div>
  );
}

import { useState, useEffect } from "react";
import { api as veiculosApi } from "../lib/api.js";
import { getUser } from "../auth.js";
import { alertDialog } from "./Dialog.jsx";

const semAcento=t=>String(t||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
const escRe=t=>t.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
const fmtR0=n=>"R$ "+Math.round(n).toLocaleString("pt-BR");
function diaMesCurto(iso){if(!iso)return "";const d=new Date(iso);if(isNaN(d))return "";return String(d.getDate()).padStart(2,"0")+"/"+String(d.getMonth()+1).padStart(2,"0");}

// 2026-10-28 (Felipe): card solto em "Venda concluída" pergunta qual carro o cliente
// comprou, pra venda, carro e lead ficarem num lugar só (veiculos_saidas):
//  1) carro do estoque: é o mesmo "Registrar venda" da tela Veículos, já com este lead
//     (tira do site, grava a venda no nome de quem confirmou e o servidor move o card);
//  2) já tirei do site: vincula este lead a uma venda dele que ficou sem cliente;
//  3) não estava no site: só move o card.
// Fechar sem escolher não move nada (igual ao "Vai pensar"). Usada no CRM (arrastar e
// menu do lead) e na Agenda ("Veio e comprou"). onFeito(motivo): motivo só vem na opção 3,
// pra quem chamou mover o card; nas outras o servidor já moveu.
export default function QualCarroComprou({lead,estoque:estoqueProp,onClose,onFeito}){
  const[estoqueBusca,setEstoqueBusca]=useState(null);
  useEffect(()=>{if(!estoqueProp)veiculosApi.getVeiculos().then(v=>setEstoqueBusca(Array.isArray(v)?v:[])).catch(()=>setEstoqueBusca([]));},[estoqueProp]);
  const estoque=estoqueProp||estoqueBusca;
  const[opcao,setOpcao]=useState("");
  const[busca,setBusca]=useState("");
  const[carro,setCarro]=useState(null);
  const[valor,setValor]=useState("");
  const[confirmo,setConfirmo]=useState(false);
  const[pendentes,setPendentes]=useState(null);
  const[saidaSel,setSaidaSel]=useState(null);
  const[salvando,setSalvando]=useState(false);
  // Loja da venda: a do lead; sem ela (Agenda), a de quem está logado; o dono sem loja escolhe.
  const lojaConhecida=Number(lead.loja_id)||Number(getUser()?.loja_id)||null;
  const[lojaEscolhida,setLojaEscolhida]=useState("");
  const lojaLead=lojaConhecida||Number(lojaEscolhida)||null;
  useEffect(()=>{
    if(opcao!=="removido"||pendentes||!lojaLead)return;
    veiculosApi.getVendasSemCliente().then(l=>setPendentes((Array.isArray(l)?l:[]).filter(x=>Number(x.loja_venda_id)===lojaLead))).catch(()=>setPendentes([]));
  },[opcao,pendentes,lojaLead]);
  // Carros à venda: primeiro os que casam com o interesse do lead (modelo e ano), depois a busca.
  const ativos=(estoque||[]).filter(v=>v.ativo!==false);
  const interesse=semAcento(lead.veiculo_interesse);
  const pontos=v=>{const m=semAcento(v.modelo).trim();if(!m||!interesse)return 0;
    return (new RegExp(`(^|[^a-z0-9])${escRe(m)}([^a-z0-9]|$)`).test(interesse)?2:0)+(v.ano&&interesse.includes(String(v.ano))?1:0);};
  const q=semAcento(busca).trim();
  const lista=q.length>=2
    ?ativos.filter(v=>semAcento(`${v.marca} ${v.modelo} ${v.versao||""} ${v.ano}`).includes(q)).slice(0,8)
    :ativos.map(v=>[v,pontos(v)]).filter(([,p])=>p>0).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([v])=>v);
  function escolherCarro(v){setCarro(v);setValor(String(Math.round(Number(v.preco)||0)||""));setConfirmo(false);}
  const pronto=!lojaLead&&opcao!=="fora"?false:opcao==="estoque"?(carro&&Number(valor)>0&&confirmo):opcao==="removido"?!!saidaSel:opcao==="fora";
  async function confirmar(){
    if(!pronto||salvando)return;
    setSalvando(true);
    try{
      if(opcao==="estoque"){
        await veiculosApi.removerVeiculo(carro.id,{motivo:"vendido",valor_venda:Number(valor),loja_venda_id:lojaLead,crm_lead_id:lead.id});
        await onFeito(null);
      }else if(opcao==="removido"){
        await veiculosApi.vincularCliente(saidaSel.id,lead.id);
        await onFeito(null);
      }else{
        await onFeito("Venda de carro que não estava no site");
      }
    }catch(e){setSalvando(false);await alertDialog("Não deu certo: "+e.message);}
  }
  const card=(sel,onClick,titulo,sub,key)=>(
    <button type="button" key={key} onClick={onClick}
      style={{display:"block",width:"100%",textAlign:"left",padding:"10px 12px",minHeight:44,background:sel?"var(--surface2)":"none",border:"none",borderBottom:"1px solid var(--border)",cursor:"pointer",color:"var(--fg)",fontSize:14}}>
      <strong>{titulo}</strong>{sub&&<div style={{fontSize:12,color:"var(--muted)"}}>{sub}</div>}
    </button>
  );
  const OPCOES=[["estoque","ti-car","Carro do estoque","Sai do site agora"],["removido","ti-link","Já tirei do site","Ligar a uma venda que ficou sem cliente"],["fora","ti-car-off","Não estava no site","Só move o card"]];
  return(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:440,maxHeight:"92vh",overflowY:"auto"}}>
        <div className="modal-handle"/>
        <div className="modal-header">
          <h2 className="modal-title">Qual carro ele comprou?</h2>
          <button className="modal-x" aria-label="Fechar" onClick={onClose}><i className="ti ti-x"/></button>
        </div>
        <p style={{color:"var(--muted)",margin:"0 0 12px",fontSize:14}}><strong style={{color:"var(--fg)"}}>{lead.nome||"Lead"}</strong>{lead.veiculo_interesse?` · interesse: ${lead.veiculo_interesse}`:""}</p>
        {!lojaConhecida&&(
          <div className="form-group">
            <label className="form-label">Loja que vendeu *</label>
            <select className="form-input" value={lojaEscolhida} onChange={e=>{setLojaEscolhida(e.target.value);setPendentes(null);setSaidaSel(null);}}>
              <option value="">Escolha</option>
              <option value="1">Curitibanos</option>
              <option value="2">Campos Novos</option>
            </select>
          </div>
        )}
        <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:14}}>
          {OPCOES.map(([k,ic,t,sub])=>(
            <button key={k} type="button" onClick={()=>{setOpcao(k);setSaidaSel(null);}}
              style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",minHeight:48,textAlign:"left",cursor:"pointer",borderRadius:10,
                border:`1px solid ${opcao===k?"var(--brand)":"var(--border)"}`,background:opcao===k?"var(--brand-soft)":"var(--surface)"}}>
              <i className={`ti ${ic}`} style={{fontSize:18,color:opcao===k?"var(--brand)":"var(--muted)"}}/>
              <span><span style={{fontWeight:600,color:"var(--fg)"}}>{t}</span><span style={{display:"block",fontSize:12,color:"var(--muted)",fontWeight:400}}>{sub}</span></span>
            </button>
          ))}
        </div>
        {opcao==="estoque"&&estoque===null&&<div style={{fontSize:13,color:"var(--muted)",marginBottom:14}}><span className="spinner" style={{marginRight:6}}/>Carregando estoque...</div>}
        {opcao==="estoque"&&estoque!==null&&(carro?(
          <div style={{marginBottom:14}}>
            <div style={{display:"flex",alignItems:"center",gap:8,padding:"10px 12px",border:"1px solid var(--brand-line)",background:"var(--brand-soft)",borderRadius:10,marginBottom:10}}>
              <div style={{flex:1,fontSize:14,color:"var(--fg)"}}><strong>{carro.marca} {carro.modelo} {carro.ano}</strong></div>
              <button type="button" className="btn btn-ghost btn-icon" title="Trocar" onClick={()=>setCarro(null)}><i className="ti ti-x"/></button>
            </div>
            <label className="form-label">Valor da venda (R$) *</label>
            <input className="form-input" inputMode="numeric" value={valor?Number(valor).toLocaleString("pt-BR"):""} onChange={e=>setValor(e.target.value.replace(/\D/g,"").slice(0,9))}/>
            <label style={{display:"flex",alignItems:"flex-start",gap:10,padding:12,marginTop:10,border:`1px solid ${confirmo?"var(--brand)":"var(--border)"}`,borderRadius:10,cursor:"pointer",fontSize:14,color:"var(--fg)",lineHeight:1.4}}>
              <input type="checkbox" style={{marginTop:3}} checked={confirmo} onChange={e=>setConfirmo(e.target.checked)}/>
              <span>Confirmo que este carro foi <strong>vendido</strong>. Ele sai do site e a venda fica no nome de <strong>{getUser()?.nome||"quem está logado"}</strong>.</span>
            </label>
          </div>
        ):(
          <div style={{marginBottom:14}}>
            {q.length<2&&lista.length>0&&<div style={{fontSize:12,color:"var(--muted)",marginBottom:6}}>Parecidos com o interesse</div>}
            {(q.length>=2||lista.length>0)&&(
              <div style={{marginBottom:8,maxHeight:200,overflowY:"auto",border:"1px solid var(--border)",borderRadius:10}}>
                {lista.length===0&&<div style={{padding:"10px 12px",fontSize:13,color:"var(--muted)"}}>Nenhum carro à venda com esse nome.</div>}
                {lista.map(v=>card(false,()=>escolherCarro(v),`${v.marca} ${v.modelo} ${v.ano}`,[v.versao,v.cor,v.preco?fmtR0(Number(v.preco)):""].filter(Boolean).join(" · "),v.id))}
              </div>
            )}
            <input className="form-input" placeholder="Buscar carro à venda" value={busca} onChange={e=>setBusca(e.target.value)}/>
          </div>
        ))}
        {opcao==="removido"&&lojaLead&&(
          <div style={{marginBottom:14}}>
            {pendentes===null?<div style={{fontSize:13,color:"var(--muted)"}}><span className="spinner" style={{marginRight:6}}/>Carregando...</div>
            :pendentes.length===0?<div style={{fontSize:13,color:"var(--muted)"}}>Nenhuma venda sem cliente nesta loja. Se o carro ainda está no site, use "Carro do estoque".</div>
            :<div style={{maxHeight:220,overflowY:"auto",border:"1px solid var(--border)",borderRadius:10}}>
              {pendentes.map(x=>card(saidaSel?.id===x.id,()=>setSaidaSel(x),`${x.marca} ${x.modelo}${x.ano?" "+x.ano:""}`,[x.vendedor,diaMesCurto(x.saiu_em),x.valor_venda?fmtR0(Number(x.valor_venda)):"",x.telefone_final?`comprador final ${x.telefone_final}`:""].filter(Boolean).join(" · "),x.id))}
            </div>}
          </div>
        )}
        {opcao==="fora"&&<p style={{fontSize:13,color:"var(--muted)",margin:"0 0 14px"}}>O card vai para Venda concluída sem carro ligado. Nada sai do site.</p>}
        <div style={{display:"flex",gap:10}}>
          <button className="btn btn-ghost" style={{flex:1}} onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" style={{flex:1,opacity:pronto?1:.45}} disabled={!pronto||salvando} onClick={confirmar}>
            {salvando?<span className="spinner"/>:<><i className="ti ti-check"/> Confirmar venda</>}
          </button>
        </div>
      </div>
    </div>
  );
}

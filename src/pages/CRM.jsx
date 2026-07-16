import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { getCRMKanban, moverLead, criarLeadCRM, agendarVisita, atualizarLeadCRM, atualizarTemperatura, atualizarResponsavel, criarAgendamento } from "../api.js";
import { api as veiculosApi } from "../lib/api.js";
import { getRole } from "../auth.js";

// Rótulos pro badge "Follow-up ativo" no card/modal. Pra sem_credito/vai_pensar/
// nao_achou_carro/parou_responder o rótulo é o mesmo da coluna do Kanban (o tipo
// de follow-up É o estágio, ver redesenho 2026-07) — só pos_venda_satisfacao e
// match_estoque não são estágio, por isso têm rótulo próprio aqui.
const FOLLOWUP_LABEL={
  sem_credito:"Sem crédito",
  vai_pensar:"Vai pensar",
  nao_achou_carro:"Não achou o carro",
  parou_responder:"Parou de responder",
  pos_venda_satisfacao:"Pós-venda",
  match_estoque:"Veículo compatível chegou!",
};

// Colunas do Kanban. Redesenho 2026-07: "Em contato"+"Negociando" viraram uma coluna
// só ("negociando"/"Em negociação" — eram só fases sequenciais sem gatilho). sem_credito/
// vai_pensar/nao_achou_carro/parou_responder são os "motivos pós-atendimento": arrastar
// o card pra uma delas JÁ dispara o follow-up automático correspondente no backend
// (routes/crm.js) — não tem passo separado de marcar tag.
// "fechado_perdido" removida (decisão do Felipe, 2026-07: não faz sentido pra jornada
// do cliente da loja). "bau" adicionada como novo catch-all genérico — vazia por
// padrão, o vendedor move pra lá manualmente quando fizer sentido.
// Paleta 2026-07: cada coluna tem uma cor própria e distinta (antes parou_responder/
// pos_venda/bau dividiam tons de cinza quase idênticos, difícil de diferenciar num
// piscar de olhos). Harmonizada com o tema escuro do admin — mesmo nível de saturação
// e brilho das cores já existentes (novo_lead/negociando/sem_credito/vai_pensar).
const ESTAGIOS_ADMIN=[
  {key:"novo_lead",label:"Novo lead",cor:"#7ba7e0"},
  {key:"negociando",label:"Em negociação",cor:"#C8A84B"},
  {key:"sem_credito",label:"Sem crédito",cor:"#e67e22"},
  {key:"vai_pensar",label:"Vai pensar",cor:"#8E44AD"},
  {key:"nao_achou_carro",label:"Não achou o carro",cor:"#2980B9"},
  {key:"parou_responder",label:"Parou de responder",cor:"#16a085"},
  {key:"feirao",label:"Feirão",cor:"#F39C12"},
  {key:"fecha_mes",label:"Fecha mês",cor:"#E74C3C"},
  {key:"agendados",label:"Agendados",cor:"#5DADE2"},
  {key:"fechado_ganho",label:"Venda concluída",cor:"#4caf7d"},
  {key:"pos_venda",label:"Pós-venda",cor:"#d1637a"},
  {key:"bau",label:"Baú",cor:"#8d6e63"},
];
// Vendedor 2026-07: quando o lead chega, a Lara já atendeu e qualificou, cai em
// "Para atender" (= estagio novo_lead, só com rótulo mais claro pro vendedor).
// 2026-07-16: "Em negociação" deixou de ser fundida em "Para atender" — agora é
// coluna própria também pro vendedor (igual já era pro admin), pra ficar visível
// quando a Lara ou o Observador identificam que o atendimento avançou pra negociação
// de verdade, e pro vendedor poder mover manualmente também.
const ESTAGIOS_VENDEDOR=[
  {key:"para_atender",label:"Para atender",cor:"#7ba7e0",estagiosDb:["novo_lead"]},
  {key:"negociando",label:"Em negociação",cor:"#C8A84B"},
  {key:"sem_credito",label:"Sem crédito",cor:"#e67e22"},
  {key:"vai_pensar",label:"Vai pensar",cor:"#8E44AD"},
  {key:"nao_achou_carro",label:"Não achou o carro",cor:"#2980B9"},
  {key:"parou_responder",label:"Parou de responder",cor:"#16a085"},
  {key:"feirao",label:"Feirão",cor:"#F39C12"},
  {key:"fecha_mes",label:"Fecha mês",cor:"#E74C3C"},
  {key:"agendados",label:"Agendados",cor:"#5DADE2"},
  {key:"fechado_ganho",label:"Venda concluída",cor:"#4caf7d"},
  {key:"pos_venda",label:"Pós-venda",cor:"#d1637a"},
  {key:"bau",label:"Baú",cor:"#8d6e63"},
];
function leadsDaColuna(est,kanban){
  return est.estagiosDb ? est.estagiosDb.flatMap(k=>kanban[k]||[]) : (kanban[est.key]||[]);
}
// 2026-07-15: leadBate quebrava a tela toda (crash React, sem error boundary) ao
// digitar qualquer coisa na busca — `l.veiculo_interesse.toLowerCase()` estourava
// TypeError pra qualquer lead sem veículo de interesse preenchido (15 de 58 leads
// reais hoje têm esse campo NULL), e telefone nem era comparado apesar do
// placeholder "Buscar..." sugerir que buscava por nome/telefone. `||""` cobre
// nome/veiculo_interesse/telefone null; telefone comparado sem formatação (só
// dígitos) já que o campo já vem só-dígitos do backend.
function leadBate(l,busca){
  if(!busca)return true;
  const q=busca.toLowerCase();
  return (l.nome||"").toLowerCase().includes(q)
    || (l.veiculo_interesse||"").toLowerCase().includes(q)
    || (l.telefone||"").includes(busca.replace(/\D/g,"")||busca);
}
function colunaVisual(estagios,estagioReal){
  return estagios.find(e=>e.key===estagioReal || e.estagiosDb?.includes(estagioReal));
}
// Ordem das colunas do board — só preferência visual, não é dado de negócio (por isso
// localStorage por navegador/role já basta, sem precisar de coluna nova no banco nem
// endpoint). Chave separada admin/vendedor porque os dois conjuntos de colunas são
// diferentes (ver ESTAGIOS_ADMIN/ESTAGIOS_VENDEDOR acima).
const ORDER_KEY=role=>`la_crm_col_order_${role==="agent"?"vendedor":"admin"}`;
function carregarOrdemColunas(role){
  try{const raw=localStorage.getItem(ORDER_KEY(role));return raw?JSON.parse(raw):null;}catch{return null;}
}
function salvarOrdemColunas(role,keys){
  try{localStorage.setItem(ORDER_KEY(role),JSON.stringify(keys));}catch{}
}
// Aplica a ordem salva sobre a lista base — colunas novas que não estavam salvas
// (ex: adicionadas depois) entram no final, na ordem original, em vez de sumir.
function ordenarColunas(base,savedKeys){
  if(!savedKeys||!savedKeys.length)return base;
  const porKey=Object.fromEntries(base.map(e=>[e.key,e]));
  const ordenadas=savedKeys.map(k=>porKey[k]).filter(Boolean);
  const faltantes=base.filter(e=>!savedKeys.includes(e.key));
  return[...ordenadas,...faltantes];
}
const AV={"DA":"#C8A84B","AL":"#7ba7e0","WO":"#4caf7d","FE":"#e05252","DI":"#8E44AD","WI":"#27AE60"};

function Score({s}){const c=s>=70?"var(--danger)":s>=40?"var(--warning)":"#7ba7e0";return <span className="score-pill" style={{background:`${c}22`,color:c}}>{s}</span>;}
function Temp({t}){if(t==="quente")return <i className="ti ti-flame" style={{color:"var(--danger)",fontSize:12}}/>;if(t==="morno")return <i className="ti ti-sun" style={{color:"var(--warning)",fontSize:12}}/>;return <i className="ti ti-snowflake" style={{color:"#7ba7e0",fontSize:12}}/>;}
function Orig({o}){const m={anuncio:["#5b7bc4","Anún"],site:["#7ba7e0","Site"],organico:["#25D366","Org"],presencial:["#C8A84B","Loja"]};const[c,l]=m[o]||["var(--muted)","?"];return <span className="badge" style={{background:`${c}22`,color:c,fontSize:10}}>{l}</span>;}
// Badge de responsável (IA/Humano/Pausado) — grava só em crm_leads.responsavel_atual,
// pra fins de indicador visual. Não controla de fato quem responde no WhatsApp (isso
// é la_leads.human_takeover_at, lido só pelo n8n) — ver aviso no seletor do modal.
const RESP_INFO={ia:["#25D366","IA"],humano:["#7ba7e0","Humano"],pausado:["#e05252","Pausado"]};
function Resp({r}){const[c,l]=RESP_INFO[r]||RESP_INFO.ia;return <span className="badge" style={{background:`${c}22`,color:c,fontSize:9}}>{l}</span>;}
// Tempo desde a última mudança no lead — proxy pro "tempo no estágio atual" (não existe
// histórico granular de transição por estágio ainda, ver achado da Fase 1).
function tempoDesde(iso){
  if(!iso)return "";
  const ms=Date.now()-new Date(iso).getTime();
  const h=ms/3600000;
  if(h<1)return `${Math.max(1,Math.round(ms/60000))}min`;
  if(h<24)return `${Math.round(h)}h`;
  return `${Math.round(h/24)}d`;
}
function followupAtrasado(lead){return lead.followup_tipo&&lead.followup_horario&&new Date(lead.followup_horario)<new Date();}
// Lead presencial sem WhatsApp: o follow-up é criado normalmente (routes/crm.js não
// depende de telefone), mas ninguém consegue contatar automaticamente — sinaliza pro
// vendedor que esse acompanhamento precisa ser manual/presencial, não vai sair sozinho.
function followupSemContato(lead){return lead.followup_tipo&&!lead.telefone;}
// Status do agendamento assistido pela Lara (agendamento_ia_status, espelhado de
// la_leads). "solicitado"/"em_andamento" = ela ainda tá tentando; os outros 3 são
// desfechos finais (ver n8n "LA - Agente Agendamento Restrito").
const AGENDAMENTO_IA_LABEL={
  solicitado:"Lara tentando agendar...", em_andamento:"Lara conversando sobre horário...",
  confirmado:"Agendamento confirmado pela Lara", sem_resposta:"Lara não teve resposta",
  desviou_assunto:"Cliente mudou de assunto — Lara parou",
};
const AGENDAMENTO_IA_INFO={
  solicitado:{background:"#7ba7e022",color:"#7ba7e0"}, em_andamento:{background:"#7ba7e022",color:"#7ba7e0"},
  confirmado:{background:"#25D36622",color:"#25D366"}, sem_resposta:{background:"#e0525222",color:"#e05252"},
  desviou_assunto:{background:"#e0525222",color:"#e05252"},
};

function LeadModal({lead,onClose,onMover,onAtualizado,readOnly,estagios}){
  const[est,setEst]=useState(lead.estagio||"novo_lead"); // sempre o valor REAL de estagio
  const[agendando,setAgendando]=useState(false);
  const[agendado,setAgendado]=useState(false);
  const colAtual=colunaVisual(estagios,est);
  // Nome do cliente — editável (mesmo padrão do Veículo abaixo). Corrige o campo
  // real (crm_leads.nome); o backend já marca editado_manualmente=true nessa
  // gravação, e o "Sync CRM Lead" (n8n) já respeita essa trava — depois de editado
  // aqui, o nome nunca mais é sobrescrito pelo que a Lara captura no WhatsApp. O CRM
  // é sempre o dono da verdade pra esse campo a partir da primeira edição manual.
  const[nomeAtual,setNomeAtual]=useState(lead.nome||"");
  const[editandoNome,setEditandoNome]=useState(false);
  const[nomeInput,setNomeInput]=useState(nomeAtual);
  const[salvandoNome,setSalvandoNome]=useState(false);
  async function salvarNome(){
    const v=nomeInput.trim();
    if(!v){setNomeInput(nomeAtual);setEditandoNome(false);return;}
    if(v===nomeAtual){setEditandoNome(false);return;}
    setSalvandoNome(true);
    try{
      await atualizarLeadCRM(lead.id,{nome:v});
      setNomeAtual(v);
      setEditandoNome(false);
      onAtualizado?.();
    }catch{
      alert("Erro ao atualizar o nome. Tente novamente.");
    }
    setSalvandoNome(false);
  }
  // Veículo associado ao lead — editável (ex: caso Santos, veio pelo anúncio do Gol
  // mas fechou em outro carro). Corrige o campo real (crm_leads.veiculo_interesse),
  // então reflete em todo lugar que lê esse campo (card do Kanban, relatório do
  // Dashboard, agendamento de visita) — não é só um ajuste de exibição.
  const[veiculoAtual,setVeiculoAtual]=useState(lead.veiculo_interesse||"");
  const[editandoVeiculo,setEditandoVeiculo]=useState(false);
  const[veiculoInput,setVeiculoInput]=useState(veiculoAtual);
  const[salvandoVeiculo,setSalvandoVeiculo]=useState(false);
  async function salvarVeiculo(){
    const v=veiculoInput.trim();
    if(!v){setVeiculoInput(veiculoAtual);setEditandoVeiculo(false);return;}
    if(v===veiculoAtual){setEditandoVeiculo(false);return;}
    setSalvandoVeiculo(true);
    try{
      await atualizarLeadCRM(lead.id,{veiculo_interesse:v});
      setVeiculoAtual(v);
      setEditandoVeiculo(false);
      onAtualizado?.();
    }catch{
      alert("Erro ao atualizar o veículo. Tente novamente.");
    }
    setSalvandoVeiculo(false);
  }
  const[temperaturaAtual,setTemperaturaAtual]=useState(lead.temperatura||"frio");
  const[salvandoTemp,setSalvandoTemp]=useState(false);
  async function mudarTemperatura(v){
    if(v===temperaturaAtual)return;
    setSalvandoTemp(true);
    try{await atualizarTemperatura(lead.id,v);setTemperaturaAtual(v);onAtualizado?.();}
    catch{alert("Erro ao atualizar temperatura. Tente novamente.");}
    setSalvandoTemp(false);
  }
  const[responsavelAtual,setResponsavelAtual]=useState(lead.responsavel_atual||"ia");
  const[salvandoResp,setSalvandoResp]=useState(false);
  async function mudarResponsavel(v){
    if(v===responsavelAtual)return;
    setSalvandoResp(true);
    try{await atualizarResponsavel(lead.id,v);setResponsavelAtual(v);onAtualizado?.();}
    catch{alert("Erro ao atualizar responsável. Tente novamente.");}
    setSalvandoResp(false);
  }
  async function handleAgendar(){
    if(!confirm(`A Lara vai tentar marcar um horário com ${nomeAtual} pelo WhatsApp (só pra agendar — não é uma retomada geral do atendimento). Confirma?`))return;
    setAgendando(true);
    try{await agendarVisita(lead.id);setAgendado(true);}catch{alert("Erro ao iniciar agendamento. Tente de novo.");}
    setAgendando(false);
  }
  const[manualAberto,setManualAberto]=useState(false);
  const[dataManual,setDataManual]=useState("");
  const[salvandoManual,setSalvandoManual]=useState(false);
  async function handleAgendarManual(){
    if(!dataManual)return;
    setSalvandoManual(true);
    try{
      await criarAgendamento({lead_id:lead.id,veiculo:veiculoAtual,tipo:"visita_patio",data_hora:`${dataManual}:00`});
      setManualAberto(false);
      onAtualizado?.();
    }catch{alert("Erro ao marcar agendamento. Tente de novo.");}
    setSalvandoManual(false);
  }
  // Fechado ganho pede o veículo específico do estoque (não só o texto livre de
  // veiculo_interesse) — pra saber exatamente qual carro saiu e pra qual cliente,
  // mesmo depois do veículo sair do painel (Veiculos.jsx marca ativo=false).
  const[pedindoVeiculoVenda,setPedindoVeiculoVenda]=useState(false);
  const[veiculosEstoque,setVeiculosEstoque]=useState(null);
  const[veiculoVendaId,setVeiculoVendaId]=useState("");
  const[confirmandoVenda,setConfirmandoVenda]=useState(false);
  function handleEstagio(novoKey){
    const alvo=estagios.find(e=>e.key===novoKey);
    // Coluna virtual ("Para atender"): manda pro último estagio real do grupo
    // (negociando) — o vendedor já deve ter conversado se está movendo de volta.
    const real=alvo?.estagiosDb ? alvo.estagiosDb[alvo.estagiosDb.length-1] : novoKey;
    if(real==="fechado_ganho"){
      setPedindoVeiculoVenda(true);
      if(!veiculosEstoque)veiculosApi.getVeiculos().then(setVeiculosEstoque).catch(()=>setVeiculosEstoque([]));
      return;
    }
    setEst(real);
    onMover(lead.id,real);
  }
  function confirmarVenda(){
    setConfirmandoVenda(true);
    setEst("fechado_ganho");
    onMover(lead.id,"fechado_ganho",null,veiculoVendaId||null);
    setPedindoVeiculoVenda(false);
    setConfirmandoVenda(false);
  }
  return(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-handle"/>
        <div className="modal-header">
          {editandoNome?(
            <div style={{display:"flex",gap:6,flex:1,marginRight:12}}>
              <input
                className="form-input" style={{marginBottom:0}} autoFocus
                value={nomeInput} onChange={e=>setNomeInput(e.target.value)}
                onKeyDown={e=>{if(e.key==="Enter")salvarNome();if(e.key==="Escape"){setNomeInput(nomeAtual);setEditandoNome(false);}}}
              />
              <button className="btn btn-primary" style={{padding:"6px 12px"}} onClick={salvarNome} disabled={salvandoNome}>
                {salvandoNome?<span className="spinner"/>:<i className="ti ti-check"/>}
              </button>
              <button className="btn btn-ghost" style={{padding:"6px 12px"}} onClick={()=>{setNomeInput(nomeAtual);setEditandoNome(false);}}>
                <i className="ti ti-x"/>
              </button>
            </div>
          ):(
            <h2 className="modal-title" style={{display:"flex",alignItems:"center",gap:8}}>
              {nomeAtual}
              {!readOnly&&
                <button onClick={()=>{setNomeInput(nomeAtual);setEditandoNome(true);}} title="Editar nome"
                  style={{background:"none",border:"none",color:"var(--muted)",cursor:"pointer",fontSize:14,display:"flex"}}>
                  <i className="ti ti-pencil"/>
                </button>
              }
            </h2>
          )}
          <button onClick={onClose} style={{background:"none",border:"none",color:"var(--muted)",fontSize:22,cursor:"pointer"}}><i className="ti ti-x"/></button>
        </div>
        <div style={{marginBottom:14}}>
          <div style={{fontSize:13,color:"var(--muted)",marginBottom:4}}>Veículo</div>
          {editandoVeiculo?(
            <div style={{display:"flex",gap:6}}>
              <input
                className="form-input" style={{marginBottom:0}} autoFocus
                value={veiculoInput} onChange={e=>setVeiculoInput(e.target.value)}
                onKeyDown={e=>{if(e.key==="Enter")salvarVeiculo();if(e.key==="Escape"){setVeiculoInput(veiculoAtual);setEditandoVeiculo(false);}}}
              />
              <button className="btn btn-primary" style={{padding:"6px 12px"}} onClick={salvarVeiculo} disabled={salvandoVeiculo}>
                {salvandoVeiculo?<span className="spinner"/>:<i className="ti ti-check"/>}
              </button>
              <button className="btn btn-ghost" style={{padding:"6px 12px"}} onClick={()=>{setVeiculoInput(veiculoAtual);setEditandoVeiculo(false);}}>
                <i className="ti ti-x"/>
              </button>
            </div>
          ):(
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <div style={{fontSize:15,fontWeight:600,color:"var(--fg)"}}>{veiculoAtual}</div>
              {!readOnly&&
                <button onClick={()=>{setVeiculoInput(veiculoAtual);setEditandoVeiculo(true);}} title="Trocar veículo"
                  style={{background:"none",border:"none",color:"var(--muted)",cursor:"pointer",fontSize:14,display:"flex"}}>
                  <i className="ti ti-pencil"/>
                </button>
              }
            </div>
          )}
          {lead.valor&&<div style={{fontSize:14,color:"var(--brand)",fontWeight:700}}>R$ {Number(lead.valor).toLocaleString("pt-BR")}</div>}
          {lead.veiculo_vendido_id&&
            <div style={{fontSize:12,color:"var(--success)",marginTop:4,display:"flex",alignItems:"center",gap:4}}>
              <i className="ti ti-check" style={{fontSize:13}}/> Vendido: {lead.veiculo_vendido_marca} {lead.veiculo_vendido_modelo} {lead.veiculo_vendido_ano}
            </div>
          }
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
          <div style={{background:"var(--surface2)",borderRadius:8,padding:"10px 12px"}}>
            <div style={{fontSize:10,color:"var(--muted)",marginBottom:2}}>SCORE</div>
            <div style={{fontSize:20,fontWeight:700,color:lead.score>=70?"var(--danger)":lead.score>=40?"var(--warning)":"#7ba7e0"}}>{lead.score}</div>
          </div>
          <div style={{background:"var(--surface2)",borderRadius:8,padding:"10px 12px"}}>
            <div style={{fontSize:10,color:"var(--muted)",marginBottom:2}}>TEMPERATURA</div>
            {readOnly?(
              <div style={{fontSize:13,fontWeight:600,color:"var(--fg)",display:"flex",alignItems:"center",gap:4}}><Temp t={temperaturaAtual}/>{temperaturaAtual}</div>
            ):(
              <select className="form-input" style={{marginBottom:0,fontSize:13,padding:"4px 8px"}} value={temperaturaAtual} disabled={salvandoTemp} onChange={e=>mudarTemperatura(e.target.value)}>
                <option value="quente">Quente</option><option value="morno">Morno</option><option value="frio">Frio</option>
              </select>
            )}
          </div>
        </div>
        {!readOnly&&
          <div className="form-group">
            <label className="form-label">
              Responsável atual
              <i className="ti ti-info-circle" style={{fontSize:12,marginLeft:4,color:"var(--muted)"}}
                 title="Isso só atualiza o indicador no CRM. Não pausa a IA de verdade no WhatsApp — quem controla isso é a transferência real pro atendimento humano."/>
            </label>
            <select className="form-input" value={responsavelAtual} disabled={salvandoResp} onChange={e=>mudarResponsavel(e.target.value)}>
              <option value="ia">IA</option><option value="humano">Humano</option><option value="pausado">Pausado</option>
            </select>
          </div>
        }
        {lead.telefone&&<div style={{marginBottom:14}}><a href={lead.chatwoot_conv_id?`https://chat.laautomoveis.com.br/app/accounts/1/conversations/${lead.chatwoot_conv_id}`:`https://wa.me/55${lead.telefone.replace(/\D/g,"")}`} target="_blank" rel="noopener noreferrer" className="btn-wa"><i className="ti ti-brand-whatsapp"/>{lead.telefone}</a></div>}
        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:16}}>
          {lead.troca&&<span className="badge badge-warning"><i className="ti ti-arrows-exchange" style={{fontSize:12}}/>Tem troca</span>}
          {lead.financiamento&&<span className="badge badge-brand"><i className="ti ti-credit-card" style={{fontSize:12}}/>Financiamento</span>}
          {lead.origem&&<Orig o={lead.origem}/>}
        </div>
        {lead.followup_tipo&&
          <div style={{marginBottom:14,display:"flex",gap:6,flexWrap:"wrap"}}>
            <div className="badge badge-warning" style={{display:"inline-flex"}}>
              <i className="ti ti-bell" style={{fontSize:12}}/>&nbsp;Follow-up ativo: {FOLLOWUP_LABEL[lead.followup_tipo]}
            </div>
            {followupSemContato(lead)&&
              <div className="badge" style={{display:"inline-flex",background:"var(--danger)22",color:"var(--danger)"}} title="Sem telefone cadastrado — esse follow-up não sai automático, precisa ser feito manualmente">
                <i className="ti ti-phone-off" style={{fontSize:12}}/>&nbsp;Sem contato
              </div>
            }
          </div>
        }
        {lead.agendamento_ia_status&&
          <div style={{marginBottom:10}}>
            <span className="badge" style={{display:"inline-flex",...(AGENDAMENTO_IA_INFO[lead.agendamento_ia_status]||AGENDAMENTO_IA_INFO.solicitado)}}>
              <i className="ti ti-robot" style={{fontSize:12}}/>&nbsp;{AGENDAMENTO_IA_LABEL[lead.agendamento_ia_status]||lead.agendamento_ia_status}
            </span>
          </div>
        }
        {!readOnly&&lead.vendedor_id&&(
          <div style={{marginBottom:14}}>
            {agendado?(
              <span className="badge badge-success" style={{display:"inline-flex"}}><i className="ti ti-check" style={{fontSize:12}}/>&nbsp;Lara vai iniciar o agendamento</span>
            ):manualAberto?(
              <div style={{display:"flex",gap:6,alignItems:"center"}}>
                <input type="datetime-local" className="form-input" style={{marginBottom:0,flex:1}} value={dataManual} onChange={e=>setDataManual(e.target.value)}/>
                <button className="btn btn-primary" style={{padding:"6px 12px"}} onClick={handleAgendarManual} disabled={!dataManual||salvandoManual}>{salvandoManual?<span className="spinner"/>:<i className="ti ti-check"/>}</button>
                <button className="btn btn-ghost" style={{padding:"6px 12px"}} onClick={()=>setManualAberto(false)}><i className="ti ti-x"/></button>
              </div>
            ):(
              <div style={{display:"flex",gap:6}}>
                <button className="btn btn-ghost" style={{flex:1}} onClick={handleAgendar} disabled={agendando||!lead.telefone} title={!lead.telefone?"Lead sem telefone":""}>
                  {agendando?<span className="spinner"/>:<><i className="ti ti-calendar-plus"/> Lara tenta agendar</>}
                </button>
                <button className="btn btn-ghost" style={{flex:1}} onClick={()=>setManualAberto(true)}>
                  <i className="ti ti-calendar-event"/> Marcar manualmente
                </button>
              </div>
            )}
          </div>
        )}
        <div className="form-group">
          <label className="form-label">Estágio {readOnly?"":"— arraste o card no board pra mudar, ou selecione aqui"}</label>
          {readOnly?(
            <div style={{fontSize:14,fontWeight:600,color:colAtual?.cor||"var(--fg)"}}>{colAtual?.label}</div>
          ):pedindoVeiculoVenda?(
            <div style={{background:"var(--surface2)",borderRadius:8,padding:"10px 12px"}}>
              <div style={{fontSize:13,color:"var(--muted)",marginBottom:8}}>Qual veículo do estoque foi vendido? (opcional, mas ajuda a fechar o histórico certo)</div>
              {veiculosEstoque===null?(
                <div style={{fontSize:13,color:"var(--muted)"}}><span className="spinner" style={{marginRight:6}}/>Carregando estoque...</div>
              ):(
                <select className="form-input" value={veiculoVendaId} onChange={e=>setVeiculoVendaId(e.target.value)}>
                  <option value="">— não vincular a um veículo específico —</option>
                  {veiculosEstoque.map(v=><option key={v.id} value={v.id}>{v.marca} {v.modelo} {v.ano}</option>)}
                </select>
              )}
              <div style={{display:"flex",gap:8,marginTop:8}}>
                <button className="btn btn-ghost" style={{flex:1}} onClick={()=>{setPedindoVeiculoVenda(false);setVeiculoVendaId("");}}>Cancelar</button>
                <button className="btn btn-primary" style={{flex:1}} onClick={confirmarVenda} disabled={confirmandoVenda}>
                  {confirmandoVenda?<span className="spinner"/>:"Confirmar venda"}
                </button>
              </div>
            </div>
          ):(<>
            <select className="form-input" value={colAtual?.key||est} onChange={e=>handleEstagio(e.target.value)}>
              {estagios.map(e=><option key={e.key} value={e.key}>{e.label}</option>)}
            </select>
          </>)}
        </div>
        <button className="btn btn-ghost" onClick={onClose} style={{width:"100%"}}>Fechar</button>
      </div>
    </div>
  );
}

function NovoModal({onClose,onCriado}){
  // Default "presencial": o botão "Novo lead" existe justamente pro vendedor cadastrar
  // quem chega na loja — o telefone pode não existir ainda, sem WhatsApp coletado.
  const[form,setForm]=useState({nome:"",telefone:"",veiculo_interesse:"",origem:"presencial"});
  const[loading,setLoading]=useState(false);
  const[erro,setErro]=useState(null);
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  async function submit(){
    if(!form.nome||!form.veiculo_interesse)return;
    setLoading(true);setErro(null);
    try{await criarLeadCRM(form);onCriado();onClose();}
    catch{setErro("Erro ao criar lead. Tente novamente.");}
    setLoading(false);
  }
  return(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-handle"/>
        <div className="modal-header">
          <h2 className="modal-title">Novo lead</h2>
          <button onClick={onClose} style={{background:"none",border:"none",color:"var(--muted)",fontSize:22,cursor:"pointer"}}><i className="ti ti-x"/></button>
        </div>
        <div className="form-group"><label className="form-label">Nome *</label><input className="form-input" value={form.nome} onChange={e=>set("nome",e.target.value)} placeholder="Nome do cliente"/></div>
        <div className="form-group"><label className="form-label">Telefone (opcional)</label><input className="form-input" value={form.telefone} onChange={e=>set("telefone",e.target.value)} placeholder="(49) 9 9999-9999 — deixe em branco se não tiver ainda"/></div>
        <div className="form-group"><label className="form-label">Veículo *</label><input className="form-input" value={form.veiculo_interesse} onChange={e=>set("veiculo_interesse",e.target.value)} placeholder="Ex: HB20 2022"/></div>
        <div className="form-group"><label className="form-label">Origem</label>
          <select className="form-input" value={form.origem} onChange={e=>set("origem",e.target.value)}>
            <option value="presencial">Presencial (loja)</option>
            <option value="organico">Orgânico</option><option value="site">Site</option><option value="anuncio">Anúncio</option>
          </select>
        </div>
        {erro&&<div style={{color:"var(--danger)",fontSize:13,marginBottom:10}}>{erro}</div>}
        <div style={{display:"flex",gap:8}}>
          <button className="btn btn-ghost" onClick={onClose} style={{flex:1}}>Cancelar</button>
          <button className="btn btn-primary" onClick={submit} disabled={loading} style={{flex:1}}>{loading?<span className="spinner"/>:"Adicionar"}</button>
        </div>
      </div>
    </div>
  );
}

export default function CRM(){
  const role=getRole();
  const readOnly=role==="manager";
  // Vendedor vê "Para atender" fundido; owner/manager continuam com o funil completo.
  const estagiosBase=role==="agent"?ESTAGIOS_VENDEDOR:ESTAGIOS_ADMIN;
  const[colOrder,setColOrder]=useState(()=>carregarOrdemColunas(role));
  // Reordenar coluna é preferência visual, não mutação de dado — liberado pra todo
  // mundo (inclusive manager/readOnly), diferente do drag de card entre estágios.
  const estagios=useMemo(()=>ordenarColunas(estagiosBase,colOrder),[estagiosBase,colOrder]);
  const[colArrastando,setColArrastando]=useState(null);
  function onColHeaderDragStart(e,key){
    e.dataTransfer.setData("application/x-kanban-col",key);
    e.dataTransfer.effectAllowed="move";
    setColArrastando(key);
  }
  function onColHeaderDragOver(e){
    if(e.dataTransfer.types.includes("application/x-kanban-col")){e.preventDefault();e.stopPropagation();}
  }
  function onColHeaderDrop(e,targetKey){
    if(!e.dataTransfer.types.includes("application/x-kanban-col"))return;
    e.preventDefault();e.stopPropagation();
    const srcKey=e.dataTransfer.getData("application/x-kanban-col");
    setColArrastando(null);
    if(!srcKey||srcKey===targetKey)return;
    const keys=estagios.map(e=>e.key);
    const from=keys.indexOf(srcKey),to=keys.indexOf(targetKey);
    if(from<0||to<0)return;
    keys.splice(from,1);keys.splice(to,0,srcKey);
    setColOrder(keys);
    salvarOrdemColunas(role,keys);
  }
  function onColHeaderDragEnd(){setColArrastando(null);}
  // "Grab to scroll": clicar e arrastar numa área vazia do board (não num card) rola
  // o board horizontalmente, tipo Miro/Trello mobile. Usa refs (não state) pro
  // mousemove não re-renderizar a cada pixel — só troca a classe CSS via DOM direto.
  const arrastandoBoard=useRef({ativo:false,startX:0,startScroll:0});
  function onBoardMouseDown(e){
    // Não inicia se o clique começou num card, no cabeçalho da coluna (que tem o
    // próprio drag de reordenar) ou não foi botão esquerdo do mouse.
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
  const[kanban,setKanban]=useState({});
  const[loading,setLoading]=useState(true);
  const[busca,setBusca]=useState("");
  const[leadSel,setLeadSel]=useState(null);
  const[novoModal,setNovoModal]=useState(false);
  const[isMobile,setIsMobile]=useState(window.innerWidth<768);
  const[erro,setErro]=useState(null);
  const[colunaSobre,setColunaSobre]=useState(null);
  const boardRef=useRef(null);

  useEffect(()=>{const fn=()=>setIsMobile(window.innerWidth<768);window.addEventListener("resize",fn);return()=>window.removeEventListener("resize",fn);},[]);
  // Sempre abre no início do board (coluna "Novo lead") — sem isso o scroll horizontal
  // podia ficar parado numa posição do carregamento anterior e dar a impressão de que
  // colunas diferentes aparecem pra cada pessoa, quando é só a posição do scroll.
  useEffect(()=>{if(boardRef.current)boardRef.current.scrollLeft=0;},[loading]);
  const load=useCallback((silent)=>{
    if(!silent) setLoading(true);
    setErro(null);
    getCRMKanban().then(k=>{setKanban(k);setLoading(false);})
      .catch(()=>{setErro("Erro ao carregar dados. Tente novamente.");setLoading(false);});
  },[]);
  useEffect(()=>{load();},[load]);

  // silent=true nos refreshes pós-ação: evita desmontar a página (e fechar o modal
  // aberto) toda vez que mover um card — antes voltava pro spinner de tela cheia
  // a cada clique. O follow-up automático (estágio-motivo) roda no backend, então
  // um PATCH de estágio já basta pra tudo — arrastar ou usar o dropdown têm o
  // mesmo efeito.
  async function handleMover(id,est,motivo,veiculo_vendido_id){try{await moverLead(id,est,motivo,veiculo_vendido_id);}catch{}load(true);}

  const todos=estagios.flatMap(e=>leadsDaColuna(e,kanban));
  const filtrados=todos.filter(l=>leadBate(l,busca));

  // 2026-07-16: auto-scroll horizontal ao arrastar um card até perto da borda do board —
  // antes precisava soltar o card, rolar manualmente e pegar de novo pra alcançar uma
  // coluna fora da tela (ex: arrastar "Novo lead" até "Baú"/"Fechado" pulando o funil).
  // Duas tentativas anteriores não funcionaram: (1) requestAnimationFrame fica suspenso
  // durante um arraste HTML5 nativo na maioria dos navegadores — trocado pra setInterval,
  // timer de verdade, não preso ao ciclo de paint; (2) scroll-snap-type:x mandatory no
  // .kanban-board brigava com os incrementos de scrollLeft, o navegador puxava de volta
  // pro encaixe mais próximo — resolvido desativando o snap (classe .grabbing) durante o
  // auto-scroll, mesmo truque que a função de arrastar-pra-rolar com o mouse já usava.
  // 3ª correção: o onDragOver preso ao JSX do board dependia do bubbling passar
  // corretamente pelos cards/colunas filhos durante um drag nativo — troca por um
  // listener nativo em `document` (fora do React), o padrão mais robusto pra isso,
  // ligado só enquanto um card está sendo arrastado (dragstart→dragend).
  const autoScrollRef=useRef({dir:0,timer:null,docListener:null});
  function pararAutoScroll(){
    autoScrollRef.current.dir=0;
    if(autoScrollRef.current.timer){clearInterval(autoScrollRef.current.timer);autoScrollRef.current.timer=null;}
    boardRef.current?.classList.remove("grabbing");
    if(autoScrollRef.current.docListener){
      document.removeEventListener("dragover",autoScrollRef.current.docListener);
      autoScrollRef.current.docListener=null;
    }
  }
  function iniciarAutoScrollListener(){
    const handler=(e)=>{
      const board=boardRef.current;
      if(!board)return;
      const rect=board.getBoundingClientRect();
      const zona=80;
      let dir=0;
      if(e.clientX<rect.left+zona)dir=-1;
      else if(e.clientX>rect.right-zona)dir=1;
      autoScrollRef.current.dir=dir;
      if(dir!==0&&!autoScrollRef.current.timer){
        board.classList.add("grabbing");
        autoScrollRef.current.timer=setInterval(()=>{
          const b=boardRef.current;
          if(!b||autoScrollRef.current.dir===0)return;
          b.scrollLeft+=autoScrollRef.current.dir*18;
        },16);
      }else if(dir===0&&autoScrollRef.current.timer){
        clearInterval(autoScrollRef.current.timer);
        autoScrollRef.current.timer=null;
        board.classList.remove("grabbing");
      }
    };
    document.addEventListener("dragover",handler);
    autoScrollRef.current.docListener=handler;
  }

  function onCardDragStart(e,lead){
    e.dataTransfer.setData("text/plain",String(lead.id));
    e.dataTransfer.effectAllowed="move";
    iniciarAutoScrollListener();
  }
  function onColDragOver(e,estKey){
    e.preventDefault();
    if(colunaSobre!==estKey)setColunaSobre(estKey);
  }
  function onColDrop(e,estKey){
    e.preventDefault();
    setColunaSobre(null);
    pararAutoScroll();
    const leadId=e.dataTransfer.getData("text/plain");
    if(!leadId)return;
    // Coluna virtual ("Para atender", vendedor) não é um estagio real — arrastar de
    // volta pra ela manda pro último estagio do grupo (negociando).
    const alvo=estagios.find(e=>e.key===estKey);
    const realKey=alvo?.estagiosDb ? alvo.estagiosDb[alvo.estagiosDb.length-1] : estKey;
    handleMover(leadId,realKey);
  }

  if(erro)return <div className="empty-state"><i className="ti ti-alert-triangle"/><p>{erro}</p></div>;
  if(loading)return <div className="empty-state"><i className="ti ti-loader" style={{animation:"spin 1s linear infinite"}}/><p>Carregando...</p></div>;

  return(
    <div>
      <div className="page-header">
        <h1 className="page-title"><i className="ti ti-target"/> CRM Pipeline</h1>
        {!readOnly&&<button className="btn btn-primary" onClick={()=>setNovoModal(true)}><i className="ti ti-plus" style={{fontSize:16}}/> Novo lead</button>}
      </div>
      <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
        <input className="form-input" style={{maxWidth:220,marginBottom:0,fontSize:13,padding:"7px 12px"}} placeholder="Buscar..." value={busca} onChange={e=>setBusca(e.target.value)}/>
      </div>
      <div style={{fontSize:13,color:"var(--muted)",marginBottom:12}}>{todos.length} leads · {filtrados.length} exibidos{!readOnly&&!isMobile&&" · arraste o card pra mudar o estágio"}</div>

      {isMobile?(
        <div className="crm-list">
          {filtrados.length===0&&<div className="empty-state"><i className="ti ti-inbox"/><p>Nenhum lead</p></div>}
          {filtrados.map(lead=>{
            const est=colunaVisual(estagios,lead.estagio);
            return(
              <div key={lead.id} className="crm-list-item" style={{borderLeft:`3px solid ${est?.cor||"var(--border)"}`}} onClick={()=>setLeadSel(lead)}>
                <div style={{flex:1,minWidth:0}}>
                  <div className="crm-list-nome">{lead.nome}</div>
                  <div className="crm-list-sub">{lead.veiculo_interesse} · {est?.label}</div>
                  <div style={{display:"flex",gap:6,marginTop:4,alignItems:"center"}}><Temp t={lead.temperatura}/><Score s={lead.score}/>{lead.origem&&<Orig o={lead.origem}/>}<Resp r={lead.responsavel_atual}/></div>
                  {lead.followup_tipo&&
                    <div style={{fontSize:10,color:followupAtrasado(lead)?"var(--danger)":"var(--warning)",marginTop:4,display:"flex",alignItems:"center",gap:3}}>
                      <i className="ti ti-bell" style={{fontSize:11}}/> {FOLLOWUP_LABEL[lead.followup_tipo]}
                      {followupAtrasado(lead)&&<span style={{width:6,height:6,borderRadius:"50%",background:"var(--danger)",display:"inline-block"}}/>}
                      {followupSemContato(lead)&&<i className="ti ti-phone-off" style={{fontSize:11,color:"var(--danger)"}} title="Sem telefone — follow-up manual"/>}
                    </div>
                  }
                </div>
                <div className="av" style={{background:`${AV[lead.vendedor_iniciais]||"#C8A84B"}22`,color:AV[lead.vendedor_iniciais]||"#C8A84B",fontSize:10}}>{lead.vendedor_iniciais}</div>
              </div>
            );
          })}
        </div>
      ):(
        <div
          className="kanban-board" ref={boardRef}
          onMouseDown={onBoardMouseDown} onMouseMove={onBoardMouseMove}
          onMouseUp={onBoardMouseUpOrLeave} onMouseLeave={onBoardMouseUpOrLeave}
        >
          {estagios.map(est=>{
            const leads=leadsDaColuna(est,kanban).filter(l=>leadBate(l,busca));
            return(
              <div key={est.key} className="kanban-col">
                <div
                  className="kanban-col-header"
                  style={{border:`3px solid ${est.cor}`,borderBottom:"none",opacity:colArrastando===est.key?.4:1}}
                  draggable
                  onDragStart={e=>onColHeaderDragStart(e,est.key)}
                  onDragOver={onColHeaderDragOver}
                  onDrop={e=>onColHeaderDrop(e,est.key)}
                  onDragEnd={onColHeaderDragEnd}
                  title="Arraste pra reordenar as colunas"
                >
                  <span style={{display:"flex",alignItems:"center",gap:5,minWidth:0}}>
                    <i className="ti ti-grip-vertical" style={{fontSize:13,color:"var(--muted)",flexShrink:0}}/>
                    <span className="kanban-col-title" style={{color:est.cor}}>{est.label}</span>
                  </span>
                  <span className="kanban-col-count">{leads.length}</span>
                </div>
                <div
                  className="kanban-cards"
                  style={{
                    border:`3px solid ${est.cor}`,borderTop:"none",
                    ...(colunaSobre===est.key?{outline:`2px dashed ${est.cor}`,outlineOffset:-2}:{}),
                  }}
                  onDragOver={readOnly?undefined:e=>onColDragOver(e,est.key)}
                  onDragLeave={readOnly?undefined:()=>setColunaSobre(null)}
                  onDrop={readOnly?undefined:e=>onColDrop(e,est.key)}
                >
                  {leads.length===0&&<div style={{textAlign:"center",color:"var(--muted)",fontSize:12,padding:"12px 0"}}>—</div>}
                  {leads.map(lead=>(
                    <div
                      key={lead.id}
                      className="kanban-card"
                      draggable={!readOnly}
                      onDragStart={readOnly?undefined:e=>onCardDragStart(e,lead)}
                      onDragEnd={readOnly?undefined:pararAutoScroll}
                      onClick={()=>setLeadSel(lead)}
                      style={{cursor:readOnly?"pointer":"grab"}}
                    >
                      <div className="kanban-card-nome">{lead.nome}</div>
                      <div className="kanban-card-veiculo">{lead.veiculo_interesse}</div>
                      {lead.followup_tipo&&
                        <div style={{fontSize:10,color:followupAtrasado(lead)?"var(--danger)":"var(--warning)",marginBottom:4,display:"flex",alignItems:"center",gap:3}}>
                          <i className="ti ti-bell" style={{fontSize:11}}/> {FOLLOWUP_LABEL[lead.followup_tipo]}
                          {followupAtrasado(lead)&&<span style={{width:6,height:6,borderRadius:"50%",background:"var(--danger)",display:"inline-block"}} title="Follow-up atrasado"/>}
                          {followupSemContato(lead)&&<i className="ti ti-phone-off" style={{fontSize:11,color:"var(--danger)"}} title="Sem telefone — follow-up manual"/>}
                        </div>
                      }
                      <div style={{display:"flex",gap:4,alignItems:"center",marginBottom:4}}>
                        <Resp r={lead.responsavel_atual}/>
                        <span style={{fontSize:9,color:"var(--muted)"}}><i className="ti ti-clock" style={{fontSize:10}}/> {tempoDesde(lead.atualizado_em)}</span>
                        {lead.agendamento_ia_status&&(lead.agendamento_ia_status==="solicitado"||lead.agendamento_ia_status==="em_andamento")&&
                          <i className="ti ti-calendar-time" style={{fontSize:11,color:"#7ba7e0"}} title="Lara tentando agendar"/>}
                      </div>
                      <div className="kanban-card-footer">
                        <div style={{display:"flex",gap:4,alignItems:"center"}}><Temp t={lead.temperatura}/>{lead.origem&&<Orig o={lead.origem}/>}</div>
                        <div style={{display:"flex",gap:6,alignItems:"center"}}>
                          <Score s={lead.score}/>
                          <div className="av" style={{width:24,height:24,fontSize:9,background:`${AV[lead.vendedor_iniciais]||"#C8A84B"}22`,color:AV[lead.vendedor_iniciais]||"#C8A84B"}}>{lead.vendedor_iniciais}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {leadSel&&<LeadModal lead={leadSel} onClose={()=>setLeadSel(null)} onMover={(id,est,motivo,veiculoVendidoId)=>{handleMover(id,est,motivo,veiculoVendidoId);setLeadSel(null);}} onAtualizado={()=>load(true)} readOnly={readOnly} estagios={estagios}/>}
      {!readOnly&&novoModal&&<NovoModal onClose={()=>setNovoModal(false)} onCriado={()=>{load();setNovoModal(false);}}/>}
    </div>
  );
}

import { authHeaders, getUser } from "./auth.js";
const API = import.meta.env.VITE_API_URL || "https://api.laautomoveis.com.br";

async function req(path, opts={}) {
  const res = await fetch(`${API}${path}`, { ...opts, headers:{...authHeaders(),...(opts.headers||{})} });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

export async function getVeiculos()        { try { return await req("/api/veiculos"); }               catch { return MOCK_VEICULOS; } }
export async function criarVeiculo(d)      { return req("/api/veiculos",{method:"POST",body:JSON.stringify(d)}); }
export async function atualizarVeiculo(id,d){ return req(`/api/veiculos/${id}`,{method:"PUT",body:JSON.stringify(d)}); }
export async function deletarVeiculo(id)   { return req(`/api/veiculos/${id}`,{method:"DELETE"}); }
export async function getLeads()           { try { return await req("/api/leads"); }                  catch { return {contato:MOCK_LEADS,financiamento:[]}; } }
export async function marcarLido(id,tipo)  { return req(`/api/leads/${id}/lido`,{method:"PATCH",body:JSON.stringify({tipo})}); }
export async function getCRMKanban() {
  try { const u=getUser(); const q=u?.role==="agent"?`?vendedor_id=${u.id}`:""; return await req(`/api/crm/kanban${q}`); }
  catch { return MOCK_KANBAN; }
}
export async function moverLead(id,est)    { return req(`/api/crm/leads/${id}/estagio`,{method:"PATCH",body:JSON.stringify({estagio:est})}); }
export async function criarLeadCRM(d)      { return req("/api/crm/leads",{method:"POST",body:JSON.stringify(d)}); }
export async function getDashboard(p="mes"){ try { return await req(`/api/dashboard?periodo=${p}`); } catch { return MOCK_DASH; } }
export async function getFollowups() {
  try { const u=getUser(); const q=u?.role==="agent"?`?vendedor_id=${u.id}`:""; return await req(`/api/followups${q}`); }
  catch { return MOCK_FU; }
}
export async function marcarFollowupEnviado(id)   { return req(`/api/followups/${id}/enviado`,{method:"PATCH"}); }
export async function marcarFollowupRespondeu(id) { return req(`/api/followups/${id}/respondeu`,{method:"PATCH"}); }
export async function getAgenda(data) {
  try { const u=getUser(); const q=new URLSearchParams(); if(data)q.set("data",data); if(u?.role==="agent")q.set("vendedor_id",u.id); return await req(`/api/agenda?${q}`); }
  catch { return MOCK_AG; }
}
export async function criarAgendamento(d)          { return req("/api/agenda",{method:"POST",body:JSON.stringify(d)}); }
export async function atualizarStatusAgendamento(id,s){ return req(`/api/agenda/${id}`,{method:"PATCH",body:JSON.stringify({status:s})}); }

const MOCK_VEICULOS=[
  {id:1,nome:"HB20 2022 1.0T Comfort",preco:52900,km:28000,cambio:"Automático",combustivel:"Flex",ano:2022,badge:"DESTAQUE",foto_url:null,publicado:true},
  {id:2,nome:"Onix 2021 Plus Premier",preco:67500,km:41000,cambio:"Automático",combustivel:"Flex",ano:2021,badge:null,foto_url:null,publicado:true},
  {id:3,nome:"Gol 2020 1.0 MPI Trendline",preco:41900,km:62000,cambio:"Manual",combustivel:"Flex",ano:2020,badge:null,foto_url:null,publicado:true},
  {id:4,nome:"Kwid 2023 Intense",preco:46900,km:12000,cambio:"Manual",combustivel:"Flex",ano:2023,badge:"NOVO",foto_url:null,publicado:true},
];
const MOCK_LEADS=[
  {id:1,nome:"Teste Site",telefone:"49977777777",email:null,mensagem:"teste integração completa",created_at:"2026-06-12T17:22:00",lido:true},
  {id:2,nome:"Felipe ortiz",telefone:"49988599357",email:"felipe@gmail.com",mensagem:"Oi, teste de mensagem",created_at:"2026-06-09T22:56:00",lido:true},
];
const MOCK_KANBAN={
  novo_lead:[
    {id:1,nome:"Carlos Mendes",veiculo_interesse:"HB20 2022",score:82,temperatura:"quente",vendedor_nome:"Dariana",vendedor_iniciais:"DA",vendedor_id:4,origem:"whatsapp",telefone:"(49) 99999-9999",valor:52900,troca:true},
    {id:2,nome:"Fernanda Lima",veiculo_interesse:"Onix Plus",score:28,temperatura:"frio",vendedor_nome:"Alex",vendedor_iniciais:"AL",vendedor_id:5,origem:"site",telefone:"(49) 98888-7777"},
  ],
  em_contato:[{id:3,nome:"Ana Costa",veiculo_interesse:"Kwid 2023",score:71,temperatura:"quente",vendedor_nome:"Alex",vendedor_iniciais:"AL",vendedor_id:5,origem:"site",telefone:"(49) 97777-1234"}],
  apresentacao:[],
  visita_agendada:[{id:4,nome:"Roberto Alves",veiculo_interesse:"Gol 2020",score:58,temperatura:"morno",vendedor_nome:"Wolni",vendedor_iniciais:"WO",vendedor_id:6,origem:"indicacao",telefone:"(49) 96666-5544"}],
  proposta:[{id:7,nome:"Lucia Ferreira",veiculo_interesse:"Kwid 2023",score:58,temperatura:"morno",vendedor_nome:"Dariana",vendedor_iniciais:"DA",vendedor_id:4,origem:"facebook"}],
  credito_analise:[],
  negociando:[{id:5,nome:"Patrícia Souza",veiculo_interesse:"Argo 2022",score:64,temperatura:"quente",vendedor_nome:"Dariana",vendedor_iniciais:"DA",vendedor_id:4,origem:"whatsapp"}],
  fechado:[{id:6,nome:"Diego Martins",veiculo_interesse:"Gol 2020",score:91,temperatura:"quente",vendedor_nome:"Wolni",vendedor_iniciais:"WO",vendedor_id:6,origem:"indicacao"}],
  pos_venda:[],
};
const MOCK_DASH={
  resumo:{total_leads:37,total_leads_delta:8,vendas:8,meta_vendas:12,conversao:21,conversao_delta:3,perdidas:6,resp_media_min:4,ticket_medio:38500,receita_total:308000},
  funil:[
    {estagio:"Leads recebidos",total:37,pct:100},{estagio:"Primeiro contato",total:31,pct:84},
    {estagio:"Visita agendada",total:18,pct:48},{estagio:"Proposta enviada",total:14,pct:38},
    {estagio:"Crédito análise",total:10,pct:27},{estagio:"Negociando",total:8,pct:21},{estagio:"Venda fechada",total:8,pct:21},
  ],
  vendedores:[
    {nome:"Dariana",iniciais:"DA",total_leads:16,vendas:4},
    {nome:"Alex",iniciais:"AL",total_leads:12,vendas:3},
    {nome:"Wolni",iniciais:"WO",total_leads:9,vendas:1},
  ],
  canais:[
    {nome:"WhatsApp",cor:"#25D366",total:18},{nome:"Site",cor:"#7ba7e0",total:10},
    {nome:"Indicação",cor:"#C8A84B",total:6},{nome:"Facebook",cor:"#5b7bc4",total:3},
  ],
};
function hoje(h,off=0){const d=new Date();d.setDate(d.getDate()+off);const[hh,mm]=h.split(":");d.setHours(+hh,+mm,0,0);return d.toISOString();}
function emMin(m){const d=new Date();d.setMinutes(d.getMinutes()+m,0,0);return d.toISOString();}
const MOCK_AG=[
  {id:1,cliente_nome:"Carlos Mendes",cliente_tel:"49999991111",lead_id:1,veiculo:"HB20 2022 1.0T Comfort",tipo:"test_drive",data_hora:hoje("09:00"),duracao_min:45,vendedor_nome:"Dariana",vendedor_id:4,vendedor_iniciais:"DA",status:"confirmado",observacoes:"Cliente vai com a esposa"},
  {id:2,cliente_nome:"Lucia Ferreira",cliente_tel:"49999995555",lead_id:5,veiculo:"Argo 2022 Drive",tipo:"visita_patio",data_hora:emMin(25),duracao_min:60,vendedor_nome:"Alex",vendedor_id:5,vendedor_iniciais:"AL",status:"confirmado",observacoes:""},
  {id:3,cliente_nome:"Roberto Alves",cliente_tel:"49999999999",lead_id:9,veiculo:"Gol 2020 1.0 MPI",tipo:"reuniao_fechamento",data_hora:hoje("10:00",1),duracao_min:60,vendedor_nome:"Wolni",vendedor_id:6,vendedor_iniciais:"WO",status:"pendente",observacoes:"Trazer documentos"},
];
const MOCK_FU={
  hoje:[
    {id:1,cliente_nome:"Carlos Mendes",veiculo:"HB20 2022",vendedor_nome:"Dariana",vendedor_iniciais:"DA",tipo:"D+1",horario:"09:00",enviado:false,respondeu:false,telefone:"49999991111"},
    {id:2,cliente_nome:"Lucia Ferreira",veiculo:"Kwid 2023",vendedor_nome:"Dariana",vendedor_iniciais:"DA",tipo:"D+3",horario:"11:00",enviado:false,respondeu:false,telefone:"49999995555"},
    {id:3,cliente_nome:"Diego Martins",veiculo:"Gol 2020",vendedor_nome:"Alex",vendedor_iniciais:"AL",tipo:"reativação",horario:"14:00",enviado:true,respondeu:false,telefone:"49999996666"},
    {id:4,cliente_nome:"Roberto Alves",veiculo:"Argo 2022",vendedor_nome:"Wolni",vendedor_iniciais:"WO",tipo:"D+7",horario:"16:30",enviado:false,respondeu:false,telefone:"49999997777"},
  ],
  vencidos:[
    {id:5,cliente_nome:"Ana Costa",veiculo:"Kwid 2023",vendedor_nome:"Alex",vendedor_iniciais:"AL",tipo:"D+7",horario:"Ontem 14:00",enviado:true,respondeu:false,telefone:"49999993333"},
    {id:6,cliente_nome:"Patrícia Souza",veiculo:"Argo 2022",vendedor_nome:"Dariana",vendedor_iniciais:"DA",tipo:"D+3",horario:"2d atrás",enviado:true,respondeu:false,telefone:"49999998888"},
  ],
};

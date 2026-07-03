import { authHeaders, getUser } from "./auth.js";
const API = import.meta.env.VITE_API_URL || "https://api.laautomoveis.com.br";

async function req(path, opts={}) {
  const res = await fetch(`${API}${path}`, { ...opts, headers:{...authHeaders(),...(opts.headers||{})} });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

// Normaliza veículo do backend real para o formato do admin
function normVeiculo(v) {
  return {
    id: v.id,
    nome: `${v.marca} ${v.modelo} ${v.ano}`,
    preco: parseFloat(v.preco),
    km: v.km,
    cambio: v.cambio,
    combustivel: v.combustivel,
    ano: v.ano,
    badge: v.badge,
    foto_url: v.fotos?.[0] || null,
    fotos: v.fotos || [],
    opcionais: v.opcionais || [],
    detalhe: v.detalhe,
    publicado: v.ativo,
    cor: v.cor,
  };
}

export async function getVeiculos() {
  try { const data = await req("/veiculos"); return Array.isArray(data) ? data.map(normVeiculo) : []; }
  catch { return MOCK_VEICULOS; }
}
export async function criarVeiculo(d)       { return req("/veiculos",{method:"POST",body:JSON.stringify(d)}); }
export async function atualizarVeiculo(id,d){ return req(`/veiculos/${id}`,{method:"PUT",body:JSON.stringify(d)}); }
export async function deletarVeiculo(id)    { return req(`/veiculos/${id}`,{method:"DELETE"}); }
export async function getLeads()            { try { return await req("/leads"); } catch { return {contato:MOCK_LEADS,financiamento:[]}; } }
export async function marcarLido(id,tipo)   { return req(`/leads/${id}/lido`,{method:"PATCH",body:JSON.stringify({tipo})}); }
export async function getCRMKanban() {
  const u=getUser(); const q=u?.role==="agent"?`?vendedor_id=${u.id}`:"";
  return req(`/api/crm/kanban${q}`);
}
export async function moverLead(id,est,motivo) { return req(`/api/crm/leads/${id}/estagio`,{method:"PATCH",body:JSON.stringify({estagio:est,motivo})}); }
export async function criarLeadCRM(d)      { return req("/api/crm/leads",{method:"POST",body:JSON.stringify(d)}); }
export async function getDashboard(p="mes"){ return req(`/api/dashboard?periodo=${p}`); }
export async function getFollowups() {
  const u=getUser(); const q=u?.role==="agent"?`?vendedor_id=${u.id}`:"";
  return req(`/api/followups${q}`);
}
export async function marcarFollowupEnviado(id)   { return req(`/api/followups/${id}/enviado`,{method:"PATCH"}); }
export async function marcarFollowupRespondeu(id) { return req(`/api/followups/${id}/respondeu`,{method:"PATCH"}); }
export async function criarFollowup(lead_id,tipo,motivo) { return req("/api/followups",{method:"POST",body:JSON.stringify({lead_id,tipo,motivo})}); }
export async function getAgenda(data) {
  const u=getUser(); const q=new URLSearchParams(); if(data)q.set("data",data); if(u?.role==="agent")q.set("vendedor_id",u.id);
  return req(`/api/agenda?${q}`);
}
export async function criarAgendamento(d)             { return req("/api/agenda",{method:"POST",body:JSON.stringify(d)}); }
export async function atualizarStatusAgendamento(id,s){ return req(`/api/agenda/${id}`,{method:"PATCH",body:JSON.stringify({status:s})}); }

const MOCK_VEICULOS=[
  {id:1,nome:"HB20 2022 1.0T Comfort",preco:52900,km:28000,cambio:"Automático",combustivel:"Flex",ano:2022,badge:"DESTAQUE",foto_url:null,publicado:true},
  {id:2,nome:"Onix 2021 Plus Premier",preco:67500,km:41000,cambio:"Automático",combustivel:"Flex",ano:2021,badge:null,foto_url:null,publicado:true},
];
const MOCK_LEADS=[
  {id:1,nome:"Teste Site",telefone:"49977777777",email:null,mensagem:"teste integração completa",created_at:"2026-06-12T17:22:00",lido:true},
  {id:2,nome:"Felipe ortiz",telefone:"49988599357",email:"felipe@gmail.com",mensagem:"Oi, teste de mensagem",created_at:"2026-06-09T22:56:00",lido:true},
];
const MOCK_KANBAN={
  novo_lead:[
    {id:1,nome:"Carlos Mendes",veiculo_interesse:"HB20 2022",score:82,temperatura:"quente",vendedor_nome:"Dariana",vendedor_iniciais:"DA",vendedor_id:4,origem:"whatsapp",telefone:"(49) 99999-9999",valor:52900,troca:true},
    {id:2,nome:"Fernanda Lima",veiculo_interesse:"Onix Plus",score:28,temperatura:"frio",vendedor_nome:"Alex",vendedor_iniciais:"AL",vendedor_id:5,origem:"site"},
  ],
  em_contato:[{id:3,nome:"Ana Costa",veiculo_interesse:"Kwid 2023",score:71,temperatura:"quente",vendedor_nome:"Alex",vendedor_iniciais:"AL",vendedor_id:5,origem:"site"}],
  apresentacao:[],visita_agendada:[{id:4,nome:"Roberto Alves",veiculo_interesse:"Gol 2020",score:58,temperatura:"morno",vendedor_nome:"Wolni",vendedor_iniciais:"WO",vendedor_id:6,origem:"indicacao"}],
  proposta:[{id:7,nome:"Lucia Ferreira",veiculo_interesse:"Kwid 2023",score:58,temperatura:"morno",vendedor_nome:"Dariana",vendedor_iniciais:"DA",vendedor_id:4,origem:"facebook"}],
  credito_analise:[],negociando:[{id:5,nome:"Patrícia Souza",veiculo_interesse:"Argo 2022",score:64,temperatura:"quente",vendedor_nome:"Dariana",vendedor_iniciais:"DA",vendedor_id:4,origem:"whatsapp"}],
  fechado:[{id:6,nome:"Diego Martins",veiculo_interesse:"Gol 2020",score:91,temperatura:"quente",vendedor_nome:"Wolni",vendedor_iniciais:"WO",vendedor_id:6,origem:"indicacao"}],
  pos_venda:[],
};
const MOCK_DASH={
  /* ── aba Oportunidades ── */
  resumo:{total_leads:37,total_leads_delta:8,vendas:8,meta_vendas:12,conversao:21,conversao_delta:3,perdidas:6,resp_media_min:4,ticket_medio:38500,receita_total:308000},
  funil:[
    {estagio:"Leads recebidos",  total:37,pct:100},
    {estagio:"Primeiro contato", total:31,pct:84},
    {estagio:"Visita agendada",  total:18,pct:48},
    {estagio:"Proposta enviada", total:14,pct:38},
    {estagio:"Crédito análise",  total:10,pct:27},
    {estagio:"Negociando",       total:8, pct:21},
    {estagio:"Venda fechada",    total:8, pct:21},
  ],
  vendedores:[
    {nome:"Dariana",iniciais:"DA",total_leads:16,vendas:4},
    {nome:"Alex",   iniciais:"AL",total_leads:12,vendas:3},
    {nome:"Wolni",  iniciais:"WO",total_leads:9, vendas:1},
  ],
  // canais alinhados com tags Chatwoot: whatsapp | site | indicacao | facebook
  canais:[
    {nome:"WhatsApp", cor:"#25D366",total:18},
    {nome:"Site",     cor:"#7ba7e0",total:10},
    {nome:"Indicação",cor:"#C8A84B",total:6},
    {nome:"Facebook", cor:"#5b7bc4",total:3},
  ],
  // últimas oportunidades (alimentado por tags Chatwoot + estágio CRM)
  ultimas_oportunidades:[
    {nome:"Carlos Mendes",veiculo:"HB20 2022",canal:"whatsapp",estagio:"Negociando",vendedor:"Dariana",vendedor_iniciais:"DA",score:82},
    {nome:"Lucia Ferreira",veiculo:"Kwid 2023",canal:"facebook",estagio:"Proposta",vendedor:"Dariana",vendedor_iniciais:"DA",score:58},
    {nome:"Roberto Alves",veiculo:"Gol 2020",canal:"indicacao",estagio:"Visita",vendedor:"Wolni",vendedor_iniciais:"WO",score:55},
  ],

  /* ── aba Jornada ── */
  jornada:{
    ciclo_medio_dias:4.8,
    etapas:[
      {icone:"📋",nome:"1º contato",  tempo:"4min"},
      {icone:"🚗",nome:"Interesse",   tempo:"1.2h"},
      {icone:"📄",nome:"Proposta",    tempo:"3.5h"},
      {icone:"🤝",nome:"Negociação",  tempo:"2.1d"},
      {icone:"✅",nome:"Fechamento",  tempo:"0.8d"},
    ],
  },
  agente_ia:{
    leads_qualif:29, leads_quentes:12,
    tempo_qualif_min:3.2,
    score_quente:12,
    mornos_reat:4,
    taxa_resposta:78,
    handoffs:12,
    followups:18,
    nps_medio:72,
  },
  // follow-ups de hoje (D+1, D+3, D+7…) — tags Chatwoot mapeadas
  followups_hoje:[
    {cliente_nome:"Carlos Mendes", motivo:"proposta HB20", tipo:"D+1", horario:"09:00", vendedor_iniciais:"DA"},
    {cliente_nome:"Lucia Ferreira",motivo:"fotos Kwid",    tipo:"D+3", horario:"11:00", vendedor_iniciais:"DA"},
    {cliente_nome:"Diego Martins", motivo:"recuperar oportunidade",tipo:"D+7",horario:"14:00",vendedor_iniciais:"AL"},
    {cliente_nome:"Roberto Alves", motivo:"assinatura",    tipo:"D+1", horario:"16:30", vendedor_iniciais:"WO"},
  ],
  // gráfico barras leads 7 dias
  leads_7dias:[
    {dia:"Seg",total:4},{dia:"Ter",total:7},{dia:"Qua",total:5},
    {dia:"Qui",total:9},{dia:"Sex",total:6},{dia:"Sáb",total:3},{dia:"Dom",total:3},
  ],
  // motivos de perda (alimentado por tag "motivo_perda_*" no Chatwoot)
  motivos_perda:[
    {motivo:"Preço acima do esperado",total:3},
    {motivo:"Comprou em outra loja",  total:2},
    {motivo:"Desistiu da compra",     total:1},
  ],

  /* ── aba Estoque ── */
  estoque:{
    no_patio:34,novos_patio:3,
    tempo_medio_dias:22,meta_dias:18,
    views_hoje:312,views_delta:47,
    parados_30d:5,
    mais_visualizados:[
      {nome:"HB20 2022 1.0T Comfort",   views:142,dias:8},
      {nome:"Gol 2020 1.0 MPI Trendline",views:98, dias:12},
      {nome:"Onix 2021 Plus Premier",   views:87, dias:19},
      {nome:"Kwid 2023 Intense",        views:61, dias:5},
      {nome:"Fiat Argo 2022 Drive",     views:54, dias:24},
    ],
    parados_lista:[
      {nome:"Sandero 2019 Expression",views:18,dias:38},
      {nome:"Celta 2011 LS",          views:7, dias:45},
      {nome:"Palio 2015 Attractive",  views:12,dias:33},
    ],
    por_marca:[
      {marca:"Volkswagen",total:9},
      {marca:"Chevrolet", total:7},
      {marca:"Fiat",      total:6},
      {marca:"Hyundai",   total:5},
      {marca:"Outros",    total:7},
    ],
    sugestao_ia:"Republique o Sandero 2019 Expression com ajuste de preço (−R$ 2.500) — parado há 38 dias com poucas visualizações.",
  },
};
function hoje(h,off=0){const d=new Date();d.setDate(d.getDate()+off);const[hh,mm]=h.split(":");d.setHours(+hh,+mm,0,0);return d.toISOString();}
function emMin(m){const d=new Date();d.setMinutes(d.getMinutes()+m,0,0);return d.toISOString();}
const MOCK_AG=[
  {id:1,cliente_nome:"Carlos Mendes",cliente_tel:"49999991111",lead_id:1,veiculo:"HB20 2022",tipo:"test_drive",data_hora:hoje("09:00"),duracao_min:45,vendedor_nome:"Dariana",vendedor_id:4,vendedor_iniciais:"DA",status:"confirmado",observacoes:""},
  {id:2,cliente_nome:"Lucia Ferreira",cliente_tel:"49999995555",lead_id:5,veiculo:"Argo 2022",tipo:"visita_patio",data_hora:emMin(25),duracao_min:60,vendedor_nome:"Alex",vendedor_id:5,vendedor_iniciais:"AL",status:"confirmado",observacoes:""},
];
const MOCK_FU={
  hoje:[
    {id:1,cliente_nome:"Carlos Mendes",veiculo:"HB20 2022",vendedor_nome:"Dariana",vendedor_iniciais:"DA",tipo:"D+1",horario:"09:00",enviado:false,respondeu:false,telefone:"49999991111"},
    {id:2,cliente_nome:"Lucia Ferreira",veiculo:"Kwid 2023",vendedor_nome:"Dariana",vendedor_iniciais:"DA",tipo:"D+3",horario:"11:00",enviado:false,respondeu:false,telefone:"49999995555"},
  ],
  vencidos:[],
};

// Vendedor do lead em pílula colorida (Felipe 10/11). Usado no card do CRM e no card de Follow-ups.
const AV={"DA":"#C8A84B","AL":"#7ba7e0","WO":"#4caf7d","FE":"#e05252","DI":"#8E44AD","WI":"#27AE60"};
const VEND_CORES=["#C8A84B","#7ba7e0","#4caf7d","#e07b7b","#a07be0","#3fb6b2","#e0995b"];
const corVendedor=(ini,nome)=>AV[ini]||VEND_CORES[[...String(nome||ini||"")].reduce((t,c)=>t+c.charCodeAt(0),0)%VEND_CORES.length];
export function VendChip({nome,ini}){
  if(!nome&&!ini)return <span className="kc-vend sem" title="Nenhum vendedor com este lead"><i className="ti ti-user-off"/>Sem vendedor</span>;
  const primeiro=String(nome||ini).trim().split(/\s+/)[0];
  return <span className="kc-vend" style={{"--vc":corVendedor(ini,nome)}} title={`Vendedor: ${nome||ini}`}><i className="ti ti-user"/>{primeiro}</span>;
}

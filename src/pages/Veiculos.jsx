import { useEffect, useState } from "react";
import { api } from "../lib/api.js";

// Editor inline de preço (2026-07-17) + exibição condicional de histórico: reaproveita
// PUT /api/veiculos/:id (mesma rota do modal, enviando o veículo inteiro com só o
// preço trocado) — toda a lógica de "quando guardar preco_anterior" mora no backend,
// aqui só decide COMO mostrar o resultado. Clique no preço (tabela ou card mobile)
// vira input; Enter ou blur salva, Esc cancela.
function PrecoInline({ v, brl, onSalvo }) {
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(String(v.preco));
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    const novo = Number(valor);
    if (!novo || novo <= 0) { setEditando(false); setValor(String(v.preco)); return; }
    if (novo === Number(v.preco)) { setEditando(false); return; }
    setSalvando(true);
    try {
      await api.editarVeiculo(v.id, { ...v, preco: novo });
      await onSalvo();
      setEditando(false);
    } catch (e) { alert("Erro ao salvar preço: " + e.message); }
    finally { setSalvando(false); }
  }

  if (editando) {
    return (
      <input
        autoFocus
        className="form-input"
        type="number"
        value={valor}
        disabled={salvando}
        style={{ padding: "4px 8px", fontSize: 14, width: 130 }}
        onChange={e => setValor(e.target.value)}
        onBlur={salvar}
        onKeyDown={e => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") { setValor(String(v.preco)); setEditando(false); }
        }}
        onClick={e => e.stopPropagation()}
      />
    );
  }

  const baixou = v.preco_anterior != null && Number(v.preco_anterior) > Number(v.preco);
  return (
    <span
      title="Clique pra editar o preço"
      style={{ cursor: "pointer", display: "inline-flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}
      onClick={() => setEditando(true)}
    >
      {baixou && <span style={{ fontSize: 12, color: "var(--muted)", textDecoration: "line-through" }}>{brl(v.preco_anterior)}</span>}
      <span>{brl(v.preco)}</span>
      <i className="ti ti-pencil" style={{ fontSize: 11, color: "var(--muted)" }} />
    </span>
  );
}

const CAMBIOS = ["Automático", "Manual", "CVT"];
const COMBUSTIVEIS = ["Flex", "Gasolina", "Diesel", "Elétrico", "Híbrido"];
const BADGES = ["", "Destaque", "Seminovo", "Oportunidade", "Novo"];
const TIPOS = ["Hatch", "Sedan", "SUV", "Picape", "Perua"];

const empty = {
  marca:"", modelo:"", versao:"", tipo:"", ano:new Date().getFullYear(), preco:"",
  km:"", cambio:"Automático", combustivel:"Flex", motorizacao:"", cor:"",
  portas:4, fotos:[], opcionais:[], badge:"", detalhe:"", ativo:true,
};

export default function Veiculos() {
  const [veiculos, setVeiculos] = useState([]);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(empty);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [erro, setErro] = useState("");
  const [confirmarDel, setConfirmarDel] = useState(null);

  async function load() {
    const data = await api.getVeiculos().catch(() => []);
    setVeiculos(data);
  }
  useEffect(() => { load(); }, []);
  useEffect(() => {
    const editarId = new URLSearchParams(window.location.search).get("editar");
    if (!editarId || !veiculos.length) return;
    const v = veiculos.find(v => String(v.id) === editarId);
    if (v) abrirEditar(v);
  }, [veiculos]);

  function abrirCriar() { setForm(empty); setErro(""); setModal("criar"); }
  function abrirEditar(v) { setForm({...v}); setErro(""); setModal(v); }
  function fechar() { setModal(null); }
  function set(k, v) { setForm(f => ({...f, [k]:v})); }

  async function uploadFotos(files) {
    setUploading(true);
    try {
      const fd = new FormData();
      [...files].forEach(f => fd.append("fotos", f));
      const { urls } = await api.uploadFotos(fd);
      set("fotos", [...form.fotos, ...urls]);
    } catch(e) { alert("Erro no upload: " + e.message); }
    finally { setUploading(false); }
  }

  function removerFoto(idx) { set("fotos", form.fotos.filter((_,i) => i!==idx)); }

  function addOpcional(e) {
    if (e.key==="Enter" && tagInput.trim()) {
      e.preventDefault();
      set("opcionais", [...form.opcionais, tagInput.trim()]);
      setTagInput("");
    }
  }
  function removerOpcional(idx) { set("opcionais", form.opcionais.filter((_,i) => i!==idx)); }

  async function salvar() {
    setErro("");
    if (!form.marca||!form.modelo||!form.tipo||!form.preco||!form.km) {
      setErro("Preencha: marca, modelo, categoria, preço e km.");
      return;
    }
    setLoading(true);
    try {
      const payload = {...form, preco:Number(form.preco), km:Number(form.km), ano:Number(form.ano), portas:Number(form.portas)};
      if (modal==="criar") await api.criarVeiculo(payload);
      else await api.editarVeiculo(modal.id, payload);
      await load(); fechar();
    } catch(e) { setErro(e.message); }
    finally { setLoading(false); }
  }

  async function confirmarRemover() {
    if (!confirmarDel) return;
    await api.removerVeiculo(confirmarDel.id).catch(() => {});
    setConfirmarDel(null);
    await load();
  }

  const brl = n => Number(n).toLocaleString("pt-BR", {style:"currency", currency:"BRL", maximumFractionDigits:0});

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title"><i className="ti ti-car"/> Veículos</h1>
        <button className="btn btn-primary" onClick={abrirCriar}>
          <i className="ti ti-plus"/> Novo veículo
        </button>
      </div>

      {/* DESKTOP: tabela */}
      <div className="card d-desktop" style={{padding:0,overflow:"hidden"}}>
        {veiculos.length===0 ? <div className="empty-state"><i className="ti ti-car"/><p>Nenhum veículo cadastrado.</p></div> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Foto</th><th>Veículo</th><th>Ano</th><th>Preço</th><th>KM</th><th>Badge</th><th></th></tr></thead>
              <tbody>
                {veiculos.map(v => (
                  <tr key={v.id}>
                    <td style={{width:70}}>
                      {v.fotos?.[0]
                        ? <img src={v.fotos[0]} alt="" style={{width:60,height:46,objectFit:"cover",borderRadius:8}}/>
                        : <div style={{width:60,height:46,background:"var(--surface2)",borderRadius:8}}/>}
                    </td>
                    <td>
                      <div style={{fontWeight:600,color:"var(--fg)",display:"flex",alignItems:"center",gap:8}}>
                        {v.marca} {v.modelo}{v.versao ? " " + v.versao : ""}
                        {!v.ativo && <span className="badge badge-muted" style={{fontSize:10}}>Oculto</span>}
                      </div>
                      <div style={{color:"var(--muted)",fontSize:12}}>{v.motorizacao ? v.motorizacao + " · " : ""}{v.cambio} · {v.combustivel} · {v.cor}</div>
                    </td>
                    <td style={{color:"var(--muted)"}}>{v.ano}</td>
                    <td style={{fontWeight:700,color:"var(--brand)"}}><PrecoInline v={v} brl={brl} onSalvo={load}/></td>
                    <td style={{color:"var(--muted)"}}>{Number(v.km).toLocaleString("pt-BR")} km</td>
                    <td>{v.badge ? <span className="badge badge-brand">{v.badge}</span> : <span className="badge badge-muted">—</span>}</td>
                    <td>
                      <div style={{display:"flex",gap:6}}>
                        <button className="btn btn-ghost btn-icon" onClick={() => abrirEditar(v)} title="Editar"><i className="ti ti-edit"/></button>
                        <button className="btn btn-danger btn-icon" onClick={() => setConfirmarDel(v)} title="Excluir"><i className="ti ti-trash"/></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MOBILE: cards */}
      <div className="d-mobile" style={{gap:12}}>
        {veiculos.length===0 ? <div className="empty-state"><i className="ti ti-car"/><p>Nenhum veículo cadastrado.</p></div>
        : veiculos.map(v => (
          <div key={v.id} style={{background:"var(--surface)",border:"1px solid var(--border)",borderRadius:16,overflow:"hidden",marginBottom:0}}>
            {/* Foto capa */}
            {v.fotos?.[0] && (
              <div style={{position:"relative"}}>
                <img src={v.fotos[0]} alt="" style={{width:"100%",height:200,objectFit:"cover",display:"block"}}/>
                {v.badge && <span className="badge badge-brand" style={{position:"absolute",top:10,right:10,fontSize:11}}>{v.badge}</span>}
                {!v.ativo && <span className="badge badge-muted" style={{position:"absolute",top:10,left:10}}>Oculto</span>}
              </div>
            )}
            <div style={{padding:"14px 14px 16px"}}>
              <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:8,marginBottom:8}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:17,fontWeight:700,color:"var(--fg)",lineHeight:1.2}}>{v.marca} {v.modelo}{v.versao ? " " + v.versao : ""}</div>
                  <div style={{fontSize:13,color:"var(--muted)",marginTop:4}}>{v.ano} · {v.motorizacao ? v.motorizacao + " · " : ""}{v.cambio} · {v.combustivel}</div>
                  {v.cor && <div style={{fontSize:12,color:"var(--muted)",marginTop:2}}>Cor: {v.cor}</div>}
                </div>
              </div>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
                <div>
                  <div style={{fontSize:20,fontWeight:800,color:"var(--brand)"}}><PrecoInline v={v} brl={brl} onSalvo={load}/></div>
                  <div style={{fontSize:12,color:"var(--muted)",marginTop:2}}>{Number(v.km).toLocaleString("pt-BR")} km</div>
                </div>
                <div style={{display:"flex",gap:8}}>
                  <button className="btn btn-ghost" style={{padding:"8px 14px",fontSize:13}} onClick={() => abrirEditar(v)}>
                    <i className="ti ti-edit"/> Editar
                  </button>
                  <button className="btn btn-danger" style={{padding:"8px 14px",fontSize:13}} onClick={() => setConfirmarDel(v)}>
                    <i className="ti ti-trash"/>
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal editar/criar */}
      {modal && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && fechar()}>
          <div className="modal" style={{maxWidth:560}}>
            <div className="modal-handle"/>
            <div className="modal-header">
              <h2 className="modal-title">{modal==="criar" ? "Novo veículo" : "Editar veículo"}</h2>
              <button onClick={fechar} style={{background:"none",border:"none",color:"var(--muted)",fontSize:24,cursor:"pointer",padding:4}}><i className="ti ti-x"/></button>
            </div>

            <div className="form-group"><label className="form-label">Marca *</label><input className="form-input" value={form.marca} onChange={e=>set("marca",e.target.value)} placeholder="Ex: Volkswagen"/></div>
            <div className="form-group"><label className="form-label">Modelo *</label><input className="form-input" value={form.modelo} onChange={e=>set("modelo",e.target.value)} placeholder="Ex: Nivus Highline"/></div>
            <div className="form-group"><label className="form-label">Versão</label><input className="form-input" value={form.versao} onChange={e=>set("versao",e.target.value)} placeholder="Ex: LT, Highline, Titanium"/></div>
            <div className="form-group">
              <label className="form-label">Categoria *</label>
              <select className="form-input" value={form.tipo} onChange={e=>set("tipo",e.target.value)}>
                <option value="" disabled>Selecione...</option>
                {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div className="form-grid">
              <div className="form-group"><label className="form-label">Ano *</label><input className="form-input" type="number" value={form.ano} onChange={e=>set("ano",e.target.value)}/></div>
              <div className="form-group"><label className="form-label">Preço (R$) *</label><input className="form-input" type="number" value={form.preco} onChange={e=>set("preco",e.target.value)} placeholder="119900"/></div>
              <div className="form-group"><label className="form-label">KM *</label><input className="form-input" type="number" value={form.km} onChange={e=>set("km",e.target.value)} placeholder="18500"/></div>
              <div className="form-group"><label className="form-label">Câmbio</label><select className="form-input" value={form.cambio} onChange={e=>set("cambio",e.target.value)}>{CAMBIOS.map(c=><option key={c}>{c}</option>)}</select></div>
              <div className="form-group"><label className="form-label">Combustível</label><select className="form-input" value={form.combustivel} onChange={e=>set("combustivel",e.target.value)}>{COMBUSTIVEIS.map(c=><option key={c}>{c}</option>)}</select></div>
              <div className="form-group"><label className="form-label">Motorização</label><input className="form-input" value={form.motorizacao} onChange={e=>set("motorizacao",e.target.value)} placeholder="Ex: 1.0, 1.6, 2.0 Turbo"/></div>
              <div className="form-group"><label className="form-label">Cor</label><input className="form-input" value={form.cor} onChange={e=>set("cor",e.target.value)} placeholder="Ex: Prata"/></div>
              <div className="form-group"><label className="form-label">Badge</label><select className="form-input" value={form.badge} onChange={e=>set("badge",e.target.value)}>{BADGES.map(b=><option key={b} value={b}>{b||"Sem badge"}</option>)}</select></div>
              <div className="form-group"><label className="form-label">Detalhe</label><input className="form-input" value={form.detalhe} onChange={e=>set("detalhe",e.target.value)} placeholder="Ex: Único dono"/></div>
            </div>

            <div className="form-group">
              <label className="form-label">Opcionais (Enter para adicionar)</label>
              <div className="tag-input-wrap">
                {form.opcionais.map((op,i) => (
                  <span key={i} className="tag">{op}<button onClick={()=>removerOpcional(i)}>×</button></span>
                ))}
                <input className="tag-input" value={tagInput} onChange={e=>setTagInput(e.target.value)} onKeyDown={addOpcional} placeholder="Ex: Câmera de ré..."/>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Fotos</label>
              <label className="btn btn-ghost" style={{cursor:"pointer",width:"fit-content",marginBottom:10}}>
                <i className="ti ti-upload"/> {uploading ? "Enviando..." : "Enviar fotos"}
                <input type="file" accept="image/*" multiple style={{display:"none"}} onChange={e=>uploadFotos(e.target.files)} disabled={uploading}/>
              </label>
              {form.fotos.length>0 && (
                <div className="foto-grid">
                  {form.fotos.map((url,i) => (
                    <div key={i} className="foto-item">
                      <img src={url} alt=""/>
                      {i===0 && <div style={{position:"absolute",bottom:4,left:4,background:"var(--brand)",color:"#0c0c0a",fontSize:9,padding:"2px 6px",borderRadius:4,fontWeight:700}}>CAPA</div>}
                      <button className="foto-remove" onClick={()=>removerFoto(i)}>×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <label style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer",marginBottom:16,padding:"10px 0"}}>
              <input type="checkbox" checked={form.ativo} onChange={e=>set("ativo",e.target.checked)} style={{width:18,height:18,accentColor:"var(--brand)"}}/>
              <span style={{fontSize:14,color:"var(--fg)"}}>Publicado no site</span>
            </label>

            {erro && <div style={{color:"var(--danger)",fontSize:13,marginBottom:12,padding:"10px 12px",background:"rgba(224,82,82,.1)",borderRadius:8}}>{erro}</div>}

            <div style={{display:"flex",gap:10}}>
              <button className="btn btn-ghost" onClick={fechar} style={{flex:1}}>Cancelar</button>
              <button className="btn btn-primary" onClick={salvar} disabled={loading} style={{flex:1}}>
                {loading ? <span className="spinner"/> : <><i className="ti ti-device-floppy"/> Salvar</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal confirmação excluir */}
      {confirmarDel && (
        <div className="modal-overlay" onClick={() => setConfirmarDel(null)}>
          <div className="modal" style={{maxWidth:360}} onClick={e=>e.stopPropagation()}>
            <div className="modal-handle"/>
            <div style={{textAlign:"center",padding:"10px 0 20px"}}>
              <i className="ti ti-alert-triangle" style={{fontSize:52,color:"var(--danger)",marginBottom:12,display:"block"}}/>
              <h2 style={{fontSize:17,fontWeight:700,color:"var(--fg)",marginBottom:8}}>Excluir veículo?</h2>
              <p style={{fontSize:14,color:"var(--muted)",lineHeight:1.5}}>
                <strong style={{color:"var(--fg)"}}>{confirmarDel.marca} {confirmarDel.modelo} {confirmarDel.ano}</strong><br/>
                será removido do estoque e do site.<br/>
                <span style={{color:"var(--danger)",fontSize:13}}>Esta ação não pode ser desfeita.</span>
              </p>
            </div>
            <div style={{display:"flex",gap:10}}>
              <button className="btn btn-ghost" onClick={() => setConfirmarDel(null)} style={{flex:1}}>Cancelar</button>
              <button className="btn btn-danger" onClick={confirmarRemover} style={{flex:1,background:"var(--danger)",color:"white"}}>
                <i className="ti ti-trash"/> Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

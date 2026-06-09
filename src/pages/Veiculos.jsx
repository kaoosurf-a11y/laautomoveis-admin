import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, X, Upload } from "lucide-react";
import { api } from "../lib/api.js";

const CAMBIOS = ["Automático", "Manual"];
const COMBUSTIVEIS = ["Flex", "Gasolina", "Diesel", "Híbrido"];
const BADGES = ["", "Destaque", "Seminovo", "Oportunidade"];

const empty = {
  marca: "", modelo: "", ano: new Date().getFullYear(), preco: "",
  km: "", cambio: "Automático", combustivel: "Flex", cor: "",
  portas: 4, fotos: [], opcionais: [], badge: "", detalhe: "", ativo: true,
};

export default function Veiculos() {
  const [veiculos, setVeiculos] = useState([]);
  const [modal, setModal] = useState(null); // null | "criar" | veículo
  const [form, setForm] = useState(empty);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [erro, setErro] = useState("");

  async function load() {
    const data = await api.getVeiculos().catch(() => []);
    setVeiculos(data);
  }

  useEffect(() => { load(); }, []);

  function abrirCriar() {
    setForm(empty); setErro(""); setModal("criar");
  }

  function abrirEditar(v) {
    setForm({ ...v, preco: v.preco, km: v.km });
    setErro(""); setModal(v);
  }

  function fechar() { setModal(null); }

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function uploadFotos(files) {
    setUploading(true);
    try {
      const fd = new FormData();
      [...files].forEach(f => fd.append("fotos", f));
      const { urls } = await api.uploadFotos(fd);
      set("fotos", [...form.fotos, ...urls]);
    } catch (e) {
      alert("Erro no upload: " + e.message);
    } finally {
      setUploading(false);
    }
  }

  function removerFoto(idx) {
    set("fotos", form.fotos.filter((_, i) => i !== idx));
  }

  function addOpcional(e) {
    if (e.key === "Enter" && tagInput.trim()) {
      e.preventDefault();
      set("opcionais", [...form.opcionais, tagInput.trim()]);
      setTagInput("");
    }
  }

  function removerOpcional(idx) {
    set("opcionais", form.opcionais.filter((_, i) => i !== idx));
  }

  async function salvar() {
    setErro("");
    if (!form.marca || !form.modelo || !form.preco || !form.km) {
      setErro("Preencha os campos obrigatórios: marca, modelo, preço e km.");
      return;
    }
    setLoading(true);
    try {
      const payload = { ...form, preco: Number(form.preco), km: Number(form.km), ano: Number(form.ano), portas: Number(form.portas) };
      if (modal === "criar") await api.criarVeiculo(payload);
      else await api.editarVeiculo(modal.id, payload);
      await load();
      fechar();
    } catch (e) {
      setErro(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function remover(id) {
    if (!confirm("Remover este veículo do estoque?")) return;
    await api.removerVeiculo(id);
    await load();
  }

  const brl = n => Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

  return (
    <div>
      <div className="page-header">
        <h1>Veículos</h1>
        <button className="btn btn-primary" onClick={abrirCriar}>
          <Plus size={15} /> Novo veículo
        </button>
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {veiculos.length === 0 ? (
          <div className="empty">Nenhum veículo cadastrado.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Foto</th>
                <th>Veículo</th>
                <th>Ano</th>
                <th>Preço</th>
                <th>KM</th>
                <th>Badge</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {veiculos.map(v => (
                <tr key={v.id}>
                  <td style={{ width: 60 }}>
                    {v.fotos?.[0] ? (
                      <img src={v.fotos[0]} alt="" style={{ width: 52, height: 40, objectFit: "cover", borderRadius: 6 }} />
                    ) : (
                      <div style={{ width: 52, height: 40, background: "var(--surface2)", borderRadius: 6 }} />
                    )}
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{v.marca} {v.modelo}</div>
                    <div style={{ color: "var(--muted)", fontSize: 12 }}>{v.cambio} · {v.combustivel} · {v.cor}</div>
                  </td>
                  <td>{v.ano}</td>
                  <td style={{ fontWeight: 600, color: "var(--brand)" }}>{brl(v.preco)}</td>
                  <td>{Number(v.km).toLocaleString("pt-BR")} km</td>
                  <td>
                    {v.badge ? <span className="badge badge-yellow">{v.badge}</span> : <span className="badge badge-gray">—</span>}
                  </td>
                  <td style={{ width: 90 }}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => abrirEditar(v)}><Pencil size={13} /></button>
                      <button className="btn btn-danger btn-sm" onClick={() => remover(v.id)}><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && fechar()}>
          <div className="modal">
            <div className="modal-header">
              <h2>{modal === "criar" ? "Novo Veículo" : "Editar Veículo"}</h2>
              <button className="btn btn-ghost btn-sm" onClick={fechar}><X size={16} /></button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div className="form-row cols-2">
                <div className="form-group">
                  <label>Marca *</label>
                  <input value={form.marca} onChange={e => set("marca", e.target.value)} placeholder="Ex: Volkswagen" />
                </div>
                <div className="form-group">
                  <label>Modelo *</label>
                  <input value={form.modelo} onChange={e => set("modelo", e.target.value)} placeholder="Ex: Nivus Highline" />
                </div>
              </div>

              <div className="form-row cols-3">
                <div className="form-group">
                  <label>Ano *</label>
                  <input type="number" value={form.ano} onChange={e => set("ano", e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Preço (R$) *</label>
                  <input type="number" value={form.preco} onChange={e => set("preco", e.target.value)} placeholder="119900" />
                </div>
                <div className="form-group">
                  <label>KM *</label>
                  <input type="number" value={form.km} onChange={e => set("km", e.target.value)} placeholder="18500" />
                </div>
              </div>

              <div className="form-row cols-3">
                <div className="form-group">
                  <label>Câmbio</label>
                  <select value={form.cambio} onChange={e => set("cambio", e.target.value)}>
                    {CAMBIOS.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Combustível</label>
                  <select value={form.combustivel} onChange={e => set("combustivel", e.target.value)}>
                    {COMBUSTIVEIS.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Cor</label>
                  <input value={form.cor} onChange={e => set("cor", e.target.value)} placeholder="Ex: Prata" />
                </div>
              </div>

              <div className="form-row cols-2">
                <div className="form-group">
                  <label>Badge</label>
                  <select value={form.badge} onChange={e => set("badge", e.target.value)}>
                    {BADGES.map(b => <option key={b} value={b}>{b || "Sem badge"}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Detalhe (ex: Único dono)</label>
                  <input value={form.detalhe} onChange={e => set("detalhe", e.target.value)} />
                </div>
              </div>

              {/* Opcionais */}
              <div className="form-group">
                <label>Opcionais (Enter para adicionar)</label>
                <div className="tag-input-wrap">
                  {form.opcionais.map((op, i) => (
                    <span key={i} className="tag">
                      {op}
                      <button onClick={() => removerOpcional(i)}>×</button>
                    </span>
                  ))}
                  <input
                    className="tag-input"
                    value={tagInput}
                    onChange={e => setTagInput(e.target.value)}
                    onKeyDown={addOpcional}
                    placeholder="Ex: Câmera de ré..."
                  />
                </div>
              </div>

              {/* Fotos */}
              <div className="form-group">
                <label>Fotos</label>
                <label className="btn btn-ghost" style={{ cursor: "pointer", width: "fit-content" }}>
                  <Upload size={14} />
                  {uploading ? "Enviando..." : "Enviar fotos"}
                  <input type="file" accept="image/*" multiple style={{ display: "none" }}
                    onChange={e => uploadFotos(e.target.files)} disabled={uploading} />
                </label>
                {form.fotos.length > 0 && (
                  <div className="foto-grid">
                    {form.fotos.map((url, i) => (
                      <div key={i} className="foto-item">
                        <img src={url} alt="" />
                        <button className="foto-remove" onClick={() => removerFoto(i)}>×</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {erro && <div style={{ color: "var(--danger)", fontSize: 13 }}>{erro}</div>}

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button className="btn btn-ghost" onClick={fechar}>Cancelar</button>
                <button className="btn btn-primary" onClick={salvar} disabled={loading}>
                  {loading ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

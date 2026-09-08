import { useEffect, useState } from "react";
import { getCampanha, salvarCampanha, uploadFotoCampanha, getLojas } from "../api.js";
import { getRole } from "../auth.js";

// Wire no admin de produção (não substituir App/Layout inteiros se o EasyPanel estiver à frente):
// App.jsx:
//   import Campanha from "./pages/Campanha.jsx";
//   <Route path="/campanha" element={<OwnerOnly><Campanha /></OwnerOnly>} />
// Layout.jsx navItems, depois de Veículos:
//   ...(isManager() ? [{ to:"/campanha", icon:"ti-speakerphone", label:"Campanha do site", section:"ESTOQUE" }] : []),

const EMPTY_COPY = {
  sobre_eyebrow: "",
  sobre_titulo: "",
  sobre: "",
  beneficios: [],
  passos: [
    { titulo: "", texto: "" },
    { titulo: "", texto: "" },
    { titulo: "", texto: "" },
    { titulo: "", texto: "" },
  ],
  agentes_titulo: "",
  agentes_subtitulo: "",
  agentes: [
    { nome: "", missao: "" },
    { nome: "", missao: "" },
    { nome: "", missao: "" },
    { nome: "", missao: "" },
  ],
  diferenciais_titulo: "",
  diferenciais: [],
  diferenciais_nota: "",
  urgencia: { titulo: "", texto: "", stat1: "", stat1_label: "", stat2: "", stat2_label: "" },
  cta: { titulo: "", botao: "", nota: "" },
  ficha_titulo: "",
  ficha_botao: "",
  ficha_aviso: "",
  banner_pills: [],
  banner_tags: [],
  rodape_linha1: "",
  disclaimer: "",
};

function padList(arr, n, factory) {
  const out = Array.isArray(arr) ? [...arr] : [];
  while (out.length < n) out.push(factory());
  return out.slice(0, n);
}

function normalize(raw, lojaId) {
  const copy = { ...EMPTY_COPY, ...(raw?.copy || {}) };
  copy.passos = padList(copy.passos, 4, () => ({ titulo: "", texto: "" }));
  copy.agentes = padList(copy.agentes, 4, () => ({ nome: "", missao: "" }));
  return {
    loja_id: raw?.loja_id || lojaId,
    ativa: raw?.ativa !== false,
    nav_label: raw?.nav_label || "Promoções",
    slug: raw?.slug || "",
    titulo: raw?.titulo || "",
    eyebrow: raw?.eyebrow || "",
    headline: raw?.headline || "",
    banner_url: raw?.banner_url || "",
    whatsapp_numero: raw?.whatsapp_numero || "",
    whatsapp_mensagem: raw?.whatsapp_mensagem || "",
    grupo_whatsapp_url: raw?.grupo_whatsapp_url || "",
    copy,
  };
}

export default function Campanha() {
  const role = getRole();
  const [lojas, setLojas] = useState([]);
  const [lojaId, setLojaId] = useState(1);
  const [form, setForm] = useState(() => normalize(null, 1));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState(null);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    if (role === "admin_master") {
      getLojas().then(setLojas).catch(() => {});
    }
  }, [role]);

  useEffect(() => {
    setLoading(true);
    setErro(null);
    getCampanha(lojaId)
      .then((d) => { setForm(normalize(d, lojaId)); setLoading(false); })
      .catch(() => { setForm(normalize(null, lojaId)); setLoading(false); });
  }, [lojaId]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setCopy = (k, v) => setForm((f) => ({ ...f, copy: { ...f.copy, [k]: v } }));
  const setPasso = (i, k, v) => setForm((f) => {
    const passos = [...f.copy.passos];
    passos[i] = { ...passos[i], [k]: v };
    return { ...f, copy: { ...f.copy, passos } };
  });
  const setAgente = (i, k, v) => setForm((f) => {
    const agentes = [...f.copy.agentes];
    agentes[i] = { ...agentes[i], [k]: v };
    return { ...f, copy: { ...f.copy, agentes } };
  });
  const setUrg = (k, v) => setForm((f) => ({
    ...f, copy: { ...f.copy, urgencia: { ...f.copy.urgencia, [k]: v } },
  }));
  const setCta = (k, v) => setForm((f) => ({
    ...f, copy: { ...f.copy, cta: { ...f.copy.cta, [k]: v } },
  }));

  async function onUpload(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    setMsg(null);
    try {
      const { url } = await uploadFotoCampanha(file);
      set("banner_url", url);
      setMsg({ tipo: "ok", texto: "Banner enviado. Clique em Salvar para publicar." });
    } catch {
      setMsg({ tipo: "erro", texto: "Falha no upload do banner." });
    }
    setUploading(false);
  }

  async function salvar() {
    setSaving(true);
    setMsg(null);
    try {
      const payload = {
        ...form,
        loja_id: lojaId,
        copy: {
          ...form.copy,
          beneficios: String(form.copy.beneficios_text ?? (form.copy.beneficios || []).join("\n"))
            .split("\n").map((s) => s.trim()).filter(Boolean),
          diferenciais: String(form.copy.diferenciais_text ?? (form.copy.diferenciais || []).join("\n"))
            .split("\n").map((s) => s.trim()).filter(Boolean),
          banner_pills: String(form.copy.pills_text ?? (form.copy.banner_pills || []).join("\n"))
            .split("\n").map((s) => s.trim()).filter(Boolean),
          banner_tags: String(form.copy.tags_text ?? (form.copy.banner_tags || []).join("\n"))
            .split("\n").map((s) => s.trim()).filter(Boolean),
        },
      };
      delete payload.copy.beneficios_text;
      delete payload.copy.diferenciais_text;
      delete payload.copy.pills_text;
      delete payload.copy.tags_text;
      const saved = await salvarCampanha(payload);
      setForm(normalize(saved, lojaId));
      setMsg({ tipo: "ok", texto: "Promoções salvas. O site de Curitibanos atualiza em até 1 minuto." });
    } catch {
      setMsg({ tipo: "erro", texto: "Não deu pra salvar. Tente de novo." });
    }
    setSaving(false);
  }

  if (erro) return <div className="empty-state"><i className="ti ti-alert-triangle" /><p>{erro}</p></div>;
  if (loading) return <div className="empty-state"><i className="ti ti-loader" style={{ animation: "spin 1s linear infinite" }} /><p>Carregando campanha...</p></div>;

  const c = form.copy;

  return (
    <div>
      <div className="page-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <h1 className="page-title"><i className="ti ti-speakerphone" /> Promoções</h1>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {role === "admin_master" && lojas.length > 1 && (
            <select className="form-input" style={{ width: "auto" }} value={lojaId} onChange={(e) => setLojaId(+e.target.value)}>
              {lojas.map((l) => <option key={l.id} value={l.id}>{l.nome || l.cidade || `Loja ${l.id}`}</option>)}
            </select>
          )}
          <a className="btn btn-ghost" href="https://laautomoveis.com.br/promocoes" target="_blank" rel="noreferrer">
            <i className="ti ti-external-link" /> Ver no site
          </a>
          <button className="btn btn-primary" onClick={salvar} disabled={saving}>
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>

      {msg && (
        <div className="card" style={{ marginBottom: 16, borderColor: msg.tipo === "ok" ? "#4caf7d55" : "var(--danger)" }}>
          {msg.texto}
        </div>
      )}

      <div className="card" style={{ marginBottom: 16, background: "#C8A84B14", borderColor: "#C8A84B55" }}>
        O formulário da landing <strong>não muda</strong> (nome, telefone e e-mail). Troque aqui o <strong>texto</strong>, a <strong>imagem</strong> e o <strong>link do grupo</strong> do WhatsApp. Toda promoção nova usa o mesmo cadastro e libera o grupo só depois do lead gravar na Lista Vip.
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
          <input type="checkbox" checked={form.ativa} onChange={(e) => set("ativa", e.target.checked)} />
          <span>Campanha ativa — mostra <strong>Promoções</strong> no menu do site</span>
        </label>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="form-label" style={{ marginBottom: 10 }}>Banner</div>
        {form.banner_url && (
          <img src={form.banner_url} alt="Banner da campanha" style={{ width: "100%", maxWidth: 480, borderRadius: 8, marginBottom: 12 }} />
        )}
        <input className="form-input" style={{ marginBottom: 8 }} placeholder="URL do banner" value={form.banner_url} onChange={(e) => set("banner_url", e.target.value)} />
        <label className="btn btn-ghost" style={{ display: "inline-flex", cursor: "pointer" }}>
          <i className="ti ti-upload" /> {uploading ? "Enviando..." : "Enviar imagem"}
          <input type="file" accept="image/*" hidden onChange={onUpload} disabled={uploading} />
        </label>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="form-grid">
          <div className="form-group"><label className="form-label">Nome no menu</label><input className="form-input" value={form.nav_label} onChange={(e) => set("nav_label", e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Slug</label><input className="form-input" value={form.slug} onChange={(e) => set("slug", e.target.value)} /></div>
          <div className="form-group" style={{ gridColumn: "1 / -1" }}><label className="form-label">Título da campanha</label><input className="form-input" value={form.titulo} onChange={(e) => set("titulo", e.target.value)} /></div>
          <div className="form-group" style={{ gridColumn: "1 / -1" }}><label className="form-label">Código / eyebrow</label><input className="form-input" value={form.eyebrow} onChange={(e) => set("eyebrow", e.target.value)} /></div>
          <div className="form-group" style={{ gridColumn: "1 / -1" }}><label className="form-label">Headline</label><textarea className="form-input" rows={3} value={form.headline} onChange={(e) => set("headline", e.target.value)} /></div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="form-label" style={{ marginBottom: 10 }}>Grupo VIP do WhatsApp</div>
        <div className="form-grid">
          <div className="form-group" style={{ gridColumn: "1 / -1" }}>
            <label className="form-label">Link do convite (liberado só depois do cadastro)</label>
            <input className="form-input" value={form.grupo_whatsapp_url} onChange={(e) => set("grupo_whatsapp_url", e.target.value)} placeholder="https://chat.whatsapp.com/..." />
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="form-label" style={{ marginBottom: 10 }}>WhatsApp da campanha</div>
        <div className="form-grid">
          <div className="form-group"><label className="form-label">Número (DDI+DDD)</label><input className="form-input" value={form.whatsapp_numero} onChange={(e) => set("whatsapp_numero", e.target.value)} placeholder="5549988420734" /></div>
          <div className="form-group" style={{ gridColumn: "1 / -1" }}><label className="form-label">Mensagem (legado — o boas-vindas VIP agora sai pelo backend)</label><textarea className="form-input" rows={5} value={form.whatsapp_mensagem} onChange={(e) => set("whatsapp_mensagem", e.target.value)} /></div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="form-label" style={{ marginBottom: 10 }}>O que é</div>
        <div className="form-group"><label className="form-label">Eyebrow</label><input className="form-input" value={c.sobre_eyebrow} onChange={(e) => setCopy("sobre_eyebrow", e.target.value)} /></div>
        <div className="form-group" style={{ marginTop: 10 }}><label className="form-label">Título</label><input className="form-input" value={c.sobre_titulo} onChange={(e) => setCopy("sobre_titulo", e.target.value)} /></div>
        <div className="form-group" style={{ marginTop: 10 }}><label className="form-label">Texto</label><textarea className="form-input" rows={4} value={c.sobre} onChange={(e) => setCopy("sobre", e.target.value)} /></div>
        <div className="form-group" style={{ marginTop: 10 }}><label className="form-label">Benefícios (um por linha)</label><textarea className="form-input" rows={5} value={c.beneficios_text ?? (c.beneficios || []).join("\n")} onChange={(e) => setCopy("beneficios_text", e.target.value)} /></div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="form-label" style={{ marginBottom: 10 }}>Como funciona (4 passos)</div>
        {c.passos.map((p, i) => (
          <div key={i} className="form-grid" style={{ marginBottom: 10 }}>
            <div className="form-group"><label className="form-label">Passo {i + 1}</label><input className="form-input" value={p.titulo} onChange={(e) => setPasso(i, "titulo", e.target.value)} /></div>
            <div className="form-group"><label className="form-label">Texto</label><input className="form-input" value={p.texto} onChange={(e) => setPasso(i, "texto", e.target.value)} /></div>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="form-group"><label className="form-label">Título dos agentes</label><input className="form-input" value={c.agentes_titulo} onChange={(e) => setCopy("agentes_titulo", e.target.value)} /></div>
        <div className="form-group" style={{ marginTop: 10 }}><label className="form-label">Subtítulo</label><input className="form-input" value={c.agentes_subtitulo} onChange={(e) => setCopy("agentes_subtitulo", e.target.value)} /></div>
        {c.agentes.map((a, i) => (
          <div key={i} className="form-grid" style={{ marginTop: 10 }}>
            <div className="form-group"><label className="form-label">Agente {i + 1}</label><input className="form-input" value={a.nome} onChange={(e) => setAgente(i, "nome", e.target.value)} /></div>
            <div className="form-group"><label className="form-label">Missão</label><input className="form-input" value={a.missao} onChange={(e) => setAgente(i, "missao", e.target.value)} /></div>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="form-group"><label className="form-label">Título dos diferenciais</label><input className="form-input" value={c.diferenciais_titulo} onChange={(e) => setCopy("diferenciais_titulo", e.target.value)} /></div>
        <div className="form-group" style={{ marginTop: 10 }}><label className="form-label">Diferenciais (um por linha)</label><textarea className="form-input" rows={4} value={c.diferenciais_text ?? (c.diferenciais || []).join("\n")} onChange={(e) => setCopy("diferenciais_text", e.target.value)} /></div>
        <div className="form-group" style={{ marginTop: 10 }}><label className="form-label">Nota de rodapé</label><input className="form-input" value={c.diferenciais_nota} onChange={(e) => setCopy("diferenciais_nota", e.target.value)} /></div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="form-label" style={{ marginBottom: 10 }}>Urgência / prazo</div>
        <div className="form-group"><label className="form-label">Título</label><input className="form-input" value={c.urgencia.titulo} onChange={(e) => setUrg("titulo", e.target.value)} /></div>
        <div className="form-group" style={{ marginTop: 10 }}><label className="form-label">Texto</label><textarea className="form-input" rows={3} value={c.urgencia.texto} onChange={(e) => setUrg("texto", e.target.value)} /></div>
        <div className="form-grid" style={{ marginTop: 10 }}>
          <div className="form-group"><label className="form-label">Número 1</label><input className="form-input" value={c.urgencia.stat1} onChange={(e) => setUrg("stat1", e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Label 1</label><input className="form-input" value={c.urgencia.stat1_label} onChange={(e) => setUrg("stat1_label", e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Número 2</label><input className="form-input" value={c.urgencia.stat2} onChange={(e) => setUrg("stat2", e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Label 2</label><input className="form-input" value={c.urgencia.stat2_label} onChange={(e) => setUrg("stat2_label", e.target.value)} /></div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="form-label" style={{ marginBottom: 10 }}>Ficha e CTA</div>
        <div className="form-grid">
          <div className="form-group"><label className="form-label">Título da ficha</label><input className="form-input" value={c.ficha_titulo} onChange={(e) => setCopy("ficha_titulo", e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Botão da ficha</label><input className="form-input" value={c.ficha_botao} onChange={(e) => setCopy("ficha_botao", e.target.value)} /></div>
          <div className="form-group" style={{ gridColumn: "1 / -1" }}><label className="form-label">Aviso da ficha</label><textarea className="form-input" rows={2} value={c.ficha_aviso} onChange={(e) => setCopy("ficha_aviso", e.target.value)} /></div>
          <div className="form-group"><label className="form-label">CTA título</label><input className="form-input" value={c.cta.titulo} onChange={(e) => setCta("titulo", e.target.value)} /></div>
          <div className="form-group"><label className="form-label">CTA botão</label><input className="form-input" value={c.cta.botao} onChange={(e) => setCta("botao", e.target.value)} /></div>
          <div className="form-group" style={{ gridColumn: "1 / -1" }}><label className="form-label">CTA nota</label><input className="form-input" value={c.cta.nota} onChange={(e) => setCta("nota", e.target.value)} /></div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="form-group"><label className="form-label">Rodapé</label><input className="form-input" value={c.rodape_linha1} onChange={(e) => setCopy("rodape_linha1", e.target.value)} /></div>
        <div className="form-group" style={{ marginTop: 10 }}><label className="form-label">Disclaimer</label><textarea className="form-input" rows={2} value={c.disclaimer} onChange={(e) => setCopy("disclaimer", e.target.value)} /></div>
        <div className="form-group" style={{ marginTop: 10 }}><label className="form-label">Pills do banner (um por linha)</label><textarea className="form-input" rows={2} value={c.pills_text ?? (c.banner_pills || []).join("\n")} onChange={(e) => setCopy("pills_text", e.target.value)} /></div>
        <div className="form-group" style={{ marginTop: 10 }}><label className="form-label">Tags do banner (um por linha)</label><textarea className="form-input" rows={3} value={c.tags_text ?? (c.banner_tags || []).join("\n")} onChange={(e) => setCopy("tags_text", e.target.value)} /></div>
      </div>

      <button className="btn btn-primary" onClick={salvar} disabled={saving} style={{ width: "100%", maxWidth: 320 }}>
        {saving ? "Salvando..." : "Salvar promoções"}
      </button>
    </div>
  );
}

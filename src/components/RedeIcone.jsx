// 2026-10-21 (Felipe: "ícones das redes sociais em miniatura em alto padrão dentro do card", modelo com logo colorido
// ao lado da data). Facebook e Instagram em SVG com as cores oficiais (exceção pedida por ele à regra "só Tabler" e
// "sem degradê" do DESIGN.md: o logo do Instagram é o degradê). O resto usa Tabler na cor da marca.
// Anúncio com app conhecido (crm_lead_canal, gravado no recebimento) mostra Facebook/Instagram/WhatsApp; sem app, Meta.
const TABLER = {
  whatsapp_ad: ["ti-brand-whatsapp", "#25D366", "Anúncio no WhatsApp"],
  anuncio:     ["ti-brand-meta", "#0866FF", "Anúncio (Meta)"],
  organico:    ["ti-brand-whatsapp", "#25D366", "WhatsApp (orgânico)"],
  site:        ["ti-world", "#3b82f6", "Site"],
  presencial:  ["ti-building-store", "var(--brand)", "Presencial (loja)"],
  reativacao:  ["ti-refresh", "#8E44AD", "Campanha de reativação"],
  particular:  ["ti-brand-whatsapp", "#128a43", "WhatsApp particular do vendedor"],
};

function Facebook() {
  return (
    <svg className="kc-rede" viewBox="0 0 24 24" role="img" aria-label="Anúncio no Facebook">
      <title>Anúncio no Facebook</title>
      <circle cx="12" cy="12" r="12" fill="#1877F2"/>
      <path fill="#fff" d="M16.67 15.47 17.2 12h-3.33V9.75c0-.95.47-1.88 1.95-1.88h1.51V4.92s-1.37-.23-2.68-.23c-2.74 0-4.53 1.66-4.53 4.66V12H7.08v3.47h3.04V24a12.1 12.1 0 0 0 3.75 0v-8.53h2.8Z"/>
    </svg>
  );
}

function Instagram() {
  return (
    <svg className="kc-rede" viewBox="0 0 24 24" role="img" aria-label="Anúncio no Instagram">
      <title>Anúncio no Instagram</title>
      <defs>
        <radialGradient id="kc-ig" cx="30%" cy="107%" r="150%">
          <stop offset="0" stopColor="#FFDD55"/>
          <stop offset=".1" stopColor="#FFDD55"/>
          <stop offset=".5" stopColor="#FF543E"/>
          <stop offset="1" stopColor="#C837AB"/>
        </radialGradient>
      </defs>
      <rect width="24" height="24" rx="6.5" fill="url(#kc-ig)"/>
      <rect x="5.2" y="5.2" width="13.6" height="13.6" rx="4" fill="none" stroke="#fff" strokeWidth="1.9"/>
      <circle cx="12" cy="12" r="3.3" fill="none" stroke="#fff" strokeWidth="1.9"/>
      <circle cx="16.3" cy="7.7" r="1.05" fill="#fff"/>
    </svg>
  );
}

export function chaveRede(lead) {
  if (lead.origem === "anuncio" && lead.canal_app) return lead.canal_app === "whatsapp" ? "whatsapp_ad" : lead.canal_app;
  return lead.origem;
}

export default function RedeIcone({ lead }) {
  const k = chaveRede(lead);
  if (k === "facebook") return <Facebook/>;
  if (k === "instagram") return <Instagram/>;
  const t = TABLER[k];
  if (!t) return null;
  return <i className={`ti ${t[0]} kc-rede kc-rede-ti`} style={{ color: t[1] }} title={t[2]} aria-label={t[2]}/>;
}

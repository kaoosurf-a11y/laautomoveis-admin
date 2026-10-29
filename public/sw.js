// 2026-10-28 (Felipe): avisos do app (lead novo, mensagem do cliente, agendamento, cliente esperando).
// SÓ notificação: sem "fetch" e sem cache, de propósito. O painel continua vindo sempre do servidor,
// nada de versão velha presa no aparelho.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));

self.addEventListener("push", e => {
  let a = {};
  try { a = e.data ? e.data.json() : {}; } catch { a = { corpo: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(a.titulo || "LA Automóveis", {
    body: a.corpo || "",
    icon: "/icon-192.png?v=2",
    badge: "/badge-96.png?v=2",
    tag: a.tag || undefined,
    renotify: !!a.tag,
    vibrate: [200, 100, 200],
    data: { url: a.url || "/" },
  }));
});

// Tocar no aviso: usa o painel que já está aberto (vai pra tela do aviso) ou abre um novo.
self.addEventListener("notificationclick", e => {
  e.notification.close();
  // Painel na raiz do app.laautomoveis.com.br desde 28/10: aviso com endereço antigo (/admin/...) vira o novo.
  const caminho = ((e.notification.data && e.notification.data.url) || "/").replace(/^\/admin(?=\/|$)/, "") || "/";
  const url = new URL(caminho, self.location.origin).href;
  // 29/10 (Felipe): aviso de mensagem do cliente abre a conversa direto no Chatwoot (fora do painel).
  if (url.startsWith("https://chat.laautomoveis.com.br/")) {
    e.waitUntil(self.clients.openWindow(url));
    return;
  }
  e.waitUntil((async () => {
    const abertos = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const aba = abertos.find(c => c.url.startsWith(self.location.origin));
    if (aba) {
      await aba.focus();
      aba.postMessage({ tipo: "abrir", url });
      return;
    }
    await self.clients.openWindow(url);
  })());
});

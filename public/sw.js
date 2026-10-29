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
    icon: "/admin/icon-192.png?v=2",
    badge: "/admin/badge-96.png?v=2",
    tag: a.tag || undefined,
    renotify: !!a.tag,
    vibrate: [200, 100, 200],
    data: { url: a.url || "/admin/" },
  }));
});

// Tocar no aviso: usa o painel que já está aberto (vai pra tela do aviso) ou abre um novo.
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || "/admin/", self.location.origin).href;
  e.waitUntil((async () => {
    const abertos = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const aba = abertos.find(c => c.url.includes("/admin"));
    if (aba) {
      await aba.focus();
      aba.postMessage({ tipo: "abrir", url });
      return;
    }
    await self.clients.openWindow(url);
  })());
});

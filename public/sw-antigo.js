// 2026-10-28: o painel saiu de admin.laautomoveis.com.br/admin e foi pra app.laautomoveis.com.br.
// Este arquivo substitui o service worker do endereço antigo: desliga os avisos de lá e se remove,
// pra ninguém receber aviso em dobro nem cair no endereço velho ao tocar num aviso.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil((async () => {
  try { const s = await self.registration.pushManager.getSubscription(); if (s) await s.unsubscribe(); } catch {}
  await self.registration.unregister();
})()));

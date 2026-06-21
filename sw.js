// =====================================================================
// sw.js — service worker mínimo
//
// Faz cache só dos arquivos do PRÓPRIO app (HTML, CSS, JS, ícones).
// Chamadas ao Supabase (login, dados) NUNCA passam pelo cache — sempre
// vão direto pra rede, senão você arriscaria ver saldo desatualizado.
//
// IMPORTANTE: sempre que você alterar algum arquivo do app, troque o
// número da versão abaixo (v1 -> v2 ...). Sem isso, o iPhone pode
// continuar mostrando a versão antiga em cache por um bom tempo.
// =====================================================================

const CACHE_NAME = "financas-shell-v6";

const ARQUIVOS_DO_APP = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./config.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2",
];

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ARQUIVOS_DO_APP))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches.keys().then((nomes) =>
      Promise.all(
        nomes
          .filter((nome) => nome !== CACHE_NAME)
          .map((nome) => caches.delete(nome))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (evento) => {
  const url = new URL(evento.request.url);

  // chamadas ao Supabase: sempre rede, nunca cache
  if (url.hostname.includes("supabase.co")) {
    return;
  }

  // resto: cache primeiro, com a rede como reforço/atualização
  evento.respondWith(
    caches.match(evento.request).then((respostaCache) => {
      return (
        respostaCache ||
        fetch(evento.request).then((respostaRede) => {
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(evento.request, respostaRede.clone());
            return respostaRede;
          });
        })
      );
    })
  );
});

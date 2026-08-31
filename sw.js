// ===========================================
// Este es el "service worker" — un archivo que corre en segundo
// plano, aparte de la página normal. Chrome exige que exista uno
// (con al menos un manejador de "fetch") como parte de sus
// requisitos para ofrecer el botón de "Instalar app": es su forma
// de comprobar que la app puede seguir funcionando aunque la
// conexión falle un poquito, no que la vayamos a usar sin internet
// por completo.
//
// Lo dejamos SÚPER simple a propósito: no guardamos nada en caché
// todavía (eso sería un paso más avanzado, "modo sin conexión" de
// verdad) — por ahora, solo deja pasar cada pedido directo a
// internet, tal cual, para cumplir el requisito sin complicar nada.
// ===========================================

self.addEventListener("install", function (evento) {
  // activamos el service worker nuevo de inmediato, sin esperar
  // a que se cierren todas las pestañas viejas
  self.skipWaiting();
});

self.addEventListener("activate", function (evento) {
  self.clients.claim();
});

self.addEventListener("fetch", function (evento) {
  // Dejamos pasar cada pedido tal cual, directo a internet
  evento.respondWith(fetch(evento.request));
});

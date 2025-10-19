// ============================================================================
//  Middleware Ambrea Atomic Clock
//  Appliqué à toutes les routes /functions (ex : /api/time, /api/sync-check…)
//  Objectif : forcer JSON, désactiver le cache et autoriser le CORS
// ============================================================================

export const onRequest: PagesFunction = async ({ next }) => {
  const resp = await next();

  // Forcer le format JSON et empêcher le cache
  resp.headers.set("content-type", "application/json; charset=utf-8");
  resp.headers.set("cache-control", "no-store, no-cache, must-revalidate, proxy-revalidate");

  // Autoriser l’accès depuis toutes origines (utile pour les fetch externes)
  resp.headers.set("access-control-allow-origin", "*");
  resp.headers.set("access-control-allow-headers", "content-type");
  resp.headers.set("access-control-allow-methods", "GET,HEAD,OPTIONS");

  return resp;
};

// ============================================================================
//  Ambrea Atomic Clock - Synchronisation Check API
//  Endpoint: /api/sync-check
//  Objectif : comparer l'heure locale Europe/Paris avec 3 sources externes
//  Sources : quelle-heure-est-il.com, time.is, timeanddate.com
//  Auteur : Ambrea (Cyril x Ambrea Project)
// ============================================================================

const SOURCES = [
  { name: "quelle-heure-est-il.com", url: "https://quelle-heure-est-il.com/fr/heure/paris" },
  { name: "time.is",                 url: "https://time.is/Paris" },
  { name: "timeanddate.com",         url: "https://www.timeanddate.com/worldclock/france/paris" },
];

const TIMEOUT_MS = 6000;
const TZ = "Europe/Paris";
const THRESHOLD_SECONDS = 120; // tolérance max avant alerte ⚠

// -- Petit utilitaire timeout --
function withTimeout(promise: Promise<Response>, ms = TIMEOUT_MS): Promise<Response> {
  return new Promise((resolve, reject) => {
    const id = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(
      (res) => {
        clearTimeout(id);
        resolve(res);
      },
      (err) => {
        clearTimeout(id);
        reject(err);
      }
    );
  });
}

// -- Lecture de l'en-tête HTTP "Date" et conversion en epoch seconds --
function parseHttpDate(dateHeader: string | null): number | null {
  if (!dateHeader) return null;
  const t = Date.parse(dateHeader);
  return Number.isNaN(t) ? null : Math.floor(t / 1000);
}

// -- Fonction principale Cloudflare Pages --
export const onRequestGet: PagesFunction = async () => {
  // @ts-ignore : Temporal disponible sur Cloudflare Workers/Pages
  const now = Temporal.Now.zonedDateTimeISO(TZ);
  const nowEpoch = Math.floor(now.epochSeconds);

  const checks = await Promise.allSettled(
    SOURCES.map(async (s) => {
      try {
        // Certains sites refusent les requêtes HEAD → fallback en GET
        let res = await withTimeout(fetch(s.url, { method: "HEAD" }));
        if (!res.ok || !res.headers.get("date")) {
          res = await withTimeout(fetch(s.url, { method: "GET" }));
        }

        const dateHeader = res.headers.get("date");
        const epoch = parseHttpDate(dateHeader);
        if (!epoch) {
          return { name: s.name, url: s.url, ok: false, error: "Aucun en-tête Date trouvé" };
        }

        const delta = epoch - nowEpoch; // en secondes (+ = source en avance)
        const status = Math.abs(delta) <= THRESHOLD_SECONDS ? "OK" : "⚠ DÉCALAGE";

        return {
          name: s.name,
          url: s.url,
          httpDate: dateHeader,
          epoch,
          deltaSeconds: delta,
          status,
        };
      } catch (e: any) {
        return { name: s.name, url: s.url, ok: false, error: String(e?.message || e) };
      }
    })
  );

  // -- Résumé des résultats --
  const results = checks.map((r) =>
    r.status === "fulfilled" ? r.value : { ok: false, error: r.reason }
  );

  const deltas = results
    .filter((r: any) => typeof r?.deltaSeconds === "number")
    .map((r: any) => r.deltaSeconds);

  const maxAbsDelta = deltas.length ? Math.max(...deltas.map((d) => Math.abs(d))) : null;
  const overall = maxAbsDelta !== null && maxAbsDelta

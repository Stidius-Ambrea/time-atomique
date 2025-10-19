// ============================================================================
//  Ambrea Atomic Clock - Synchronisation Check API
//  Endpoint: /api/sync-check
//  Compare l'heure locale Europe/Paris à 3 sources externes (HTTP Date)
// ============================================================================

const SOURCES = [
  { name: "quelle-heure-est-il.com", url: "https://quelle-heure-est-il.com/fr/heure/paris" },
  { name: "time.is",                 url: "https://time.is/Paris" },
  { name: "timeanddate.com",         url: "https://www.timeanddate.com/worldclock/france/paris" },
];

const TIMEOUT_MS = 6000;
const TZ = "Europe/Paris";
const THRESHOLD_SECONDS = 120; // tolérance max avant alerte

function withTimeout(promise: Promise<Response>, ms = TIMEOUT_MS): Promise<Response> {
  return new Promise((resolve, reject) => {
    const id = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then((res) => { clearTimeout(id); resolve(res); },
                 (err) => { clearTimeout(id); reject(err); });
  });
}

function parseHttpDate(dateHeader: string | null): number | null {
  if (!dateHeader) return null;
  const t = Date.parse(dateHeader);
  return Number.isNaN(t) ? null : Math.floor(t / 1000);
}

export const onRequestGet: PagesFunction = async () => {
  // @ts-ignore Temporal dispo sur Cloudflare
  const now = Temporal.Now.zonedDateTimeISO(TZ);
  const nowEpoch = Math.floor(now.epochSeconds);

  const checks = await Promise.allSettled(
    SOURCES.map(async (s) => {
      try {
        let res = await withTimeout(fetch(s.url, { method: "HEAD" }));
        if (!res.ok || !res.headers.get("date")) {
          res = await withTimeout(fetch(s.url, { method: "GET" }));
        }
        const dateHeader = res.headers.get("date");
        const epoch = parseHttpDate(dateHeader);
        if (!epoch) {
          return { name: s.name, url: s.url, ok: false, error: "Aucun en-tête Date trouvé" };
        }
        const delta = epoch - nowEpoch; // (+ = source en avance)
        const status = Math.abs(delta) <= THRESHOLD_SECONDS ? "OK" : "⚠ DÉCALAGE";
        return { name: s.name, url: s.url, httpDate: dateHeader, epoch, deltaSeconds: delta, status };
      } catch (e: any) {
        return { name: s.name, url: s.url, ok: false, error: String(e?.message || e) };
      }
    })
  );

  const results = checks.map((r) => (r.status === "fulfilled" ? r.value : { ok: false, error: r.reason }));
  const deltas = results.filter((r: any) => typeof r?.deltaSeconds === "number").map((r: any) => r.deltaSeconds);
  const maxAbsDelta = deltas.length ? Math.max(...deltas.map((d) => Math.abs(d))) : null;
  const overall = maxAbsDelta !== null && maxAbsDelta <= THRESHOLD_SECONDS ? "OK" : "⚠ WARN";

  const body = {
    source: "Ambrea Atomic Clock",
    timezone: TZ,
    nowISO: now.toString(),
    nowUnix: nowEpoch,
    thresholdSeconds: THRESHOLD_SECONDS,
    results,
    maxAbsDelta,
    overall,
  };

  return new Response(JSON.stringify(body, null, 2), {
    status: 200,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
};

export const onRequestGet: PagesFunction = async () => {
  const tz = "Europe/Paris";
  // @ts-ignore Temporal disponible sur Cloudflare Pages
  const now = Temporal.Now.zonedDateTimeISO(tz);
  const iso = now.toString();
  const epoch = Math.floor(now.epochSeconds);
  const offsetSeconds = now.offsetNanoseconds / 1_000_000_000;

  const body = {
    source: "Ambrea Atomic Clock",
    timezone: tz,
    datetime: iso,
    unix: epoch,
    offsetSeconds,
    status: "OK"
  };
  return new Response(JSON.stringify(body, null, 2), { status: 200 });
};

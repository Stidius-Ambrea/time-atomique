export async function onRequest(context) {
  const now = new Date();
  
  // Conversion Europe/Paris
  const options = {
    timeZone: "Europe/Paris",
    hour12: false
  };
  const parisTime = new Date(now.toLocaleString("en-US", options));

  return new Response(JSON.stringify({
    iso: parisTime.toISOString(),
    timestamp: parisTime.getTime(),
    timezone: "Europe/Paris",
    source: "Ambrea Horloge Atomique",
    status: "OK"
  }), {
    headers: { "Content-Type": "application/json" }
  });
}

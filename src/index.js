export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/status") {
      const start = Number(env.START_TIME_MS);
      const startIndex = Number(env.START_INDEX ?? "0");
      if (!Number.isFinite(start) || !Number.isFinite(startIndex)) {
        return Response.json({ error: "START_TIME_MS/START_INDEX is not configured." }, { status: 500 });
      }

      const elapsedMinutes = Math.max(0, Math.floor((Date.now() - start) / 60000));
      const digitIndex = startIndex + elapsedMinutes;

      const piUrl = new URL("/pi.txt", url.origin);
      const piResponse = await env.ASSETS.fetch(new Request(piUrl));
      const pi = await piResponse.text();

      if (digitIndex >= pi.length) {
        return Response.json({
          error: "The local Pi dataset has ended.",
          digitIndex,
          availableDigits: pi.length
        }, { status: 500 });
      }

      return Response.json({
        startTimeMs: start,
        startIndex,
        elapsedMinutes,
        digitIndex,
        digit: pi[digitIndex],
        piPosition: digitIndex === 0 ? "integer digit (3)" : "decimal digit " + digitIndex
      }, {
        headers: { "Cache-Control": "no-store" }
      });
    }

    if (url.pathname === "/api/scratch") {
      if (!env.SCRATCH_KV) {
        return Response.json({
          error: "SCRATCH_KV baÄŸlÄ± deÄŸil. wrangler.json iÃ§indeki kv_namespaces kÄ±smÄ±nÄ± ve KV id'sini kontrol et."
        }, { status: 500 });
      }
      return scratch(request, env);
    }

    return env.ASSETS.fetch(request);
  }
};

// Ã‡izik ÅŸekli: "x,y x,y ..." (0-100 arasÄ±, en fazla 1 ondalÄ±k, 2-300 nokta)
const NUM = "\\d{1,3}(?:\\.\\d)?";
const PATH_RE = new RegExp("^" + NUM + "," + NUM + "(?: " + NUM + "," + NUM + "){1,299}$");

// Ã‡izik TahtasÄ±: gÃ¼nde en fazla 1 Ã§izik, geri alma yok.
// TÃ¼m Ã§izikler KV'de "board" anahtarÄ±nda [{ day, path }, ...] olarak durur.
async function scratch(request, env) {
  if (request.method !== "GET" && request.method !== "POST") {
    return Response.json({ error: "Method not allowed." }, { status: 405 });
  }

  let status = 200;
  let error;
  let path = null;

  if (request.method === "POST") {
    let body = null;
    try { body = await request.json(); } catch {}
    path = body && typeof body.path === "string" ? body.path : "";
    if (path.length > 4000 || !PATH_RE.test(path)) {
      status = 400;
      error = "Ã‡izik okunamadÄ±, tekrar Ã§iz.";
    }
  }

  const today = todayIn(env.SCRATCH_TZ || "Europe/Istanbul");
  const list = (await env.SCRATCH_KV.get("board", { type: "json", cacheTtl: 30 })) || [];
  const usedToday = list.some((r) => r.day === today);

  if (request.method === "POST" && !error) {
    if (usedToday) {
      status = 409;
      error = "BugÃ¼nkÃ¼ Ã§izik hakkÄ± zaten kullanÄ±ldÄ±.";
    } else {
      list.push({ day: today, path });
      list.sort((a, b) => (a.day < b.day ? -1 : 1));
      await env.SCRATCH_KV.put("board", JSON.stringify(list));
    }
  }

  const days = list.map((r) => r.day);
  const paths = list.map((r) => r.path || null);
  return Response.json(
    { days, paths, today, canScratch: !days.includes(today), ...(error ? { error } : {}) },
    { status, headers: { "Cache-Control": "no-store" } }
  );
}

// Verilen saat diliminde bugÃ¼nÃ¼n tarihi (YYYY-MM-DD)
function todayIn(timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(new Date());
  const get = (type) => parts.find((p) => p.type === type).value;
  return get("year") + "-" + get("month") + "-" + get("day");
}

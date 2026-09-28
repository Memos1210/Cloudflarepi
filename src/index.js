import { DurableObject } from "cloudflare:workers";

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
      const board = env.SCRATCH.get(env.SCRATCH.idFromName("board"));
      return board.fetch(request);
    }

    return env.ASSETS.fetch(request);
  }
};

// Çizik Tahtası: günde en fazla 1 çizik, geri alma yok.
// Veri tek bir Durable Object'te (SQLite) durur. "Günde bir" kuralı hem
// PRIMARY KEY ile hem de kontrol/ekleme arasında await olmamasıyla korunur.
export class ScratchBoard extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec("CREATE TABLE IF NOT EXISTS scratch (day TEXT PRIMARY KEY)");
  }

  async fetch(request) {
    if (request.method !== "GET" && request.method !== "POST") {
      return Response.json({ error: "Method not allowed." }, { status: 405 });
    }

    const today = todayIn(this.env.SCRATCH_TZ || "Europe/Istanbul");
    const usedToday = this.sql.exec("SELECT 1 FROM scratch WHERE day = ?", today).toArray().length > 0;

    let status = 200;
    let error;
    if (request.method === "POST") {
      if (usedToday) {
        status = 409;
        error = "Bugünkü çizik hakkı zaten kullanıldı.";
      } else {
        this.sql.exec("INSERT OR IGNORE INTO scratch (day) VALUES (?)", today);
      }
    }

    const days = this.sql.exec("SELECT day FROM scratch ORDER BY day").toArray().map((r) => r.day);
    return Response.json(
      { days, today, canScratch: !days.includes(today), ...(error ? { error } : {}) },
      { status, headers: { "Cache-Control": "no-store" } }
    );
  }
}

// Verilen saat diliminde bugünün tarihi (YYYY-MM-DD)
function todayIn(timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(new Date());
  const get = (type) => parts.find((p) => p.type === type).value;
  return get("year") + "-" + get("month") + "-" + get("day");
}

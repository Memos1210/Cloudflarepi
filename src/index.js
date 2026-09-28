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
      if (!env.SCRATCH) {
        return Response.json({
          error: "Kayıt yeri (SCRATCH Durable Object) bağlı değil. Projeyi wrangler.json ile `npx wrangler deploy` kullanarak yayınla."
        }, { status: 500 });
      }
      const board = env.SCRATCH.get(env.SCRATCH.idFromName("board"));
      return board.fetch(request);
    }

    return env.ASSETS.fetch(request);
  }
};

// Çizik şekli: "x,y x,y ..." (0-100 arası, en fazla 1 ondalık, 2-300 nokta)
const NUM = "\\d{1,3}(?:\\.\\d)?";
const PATH_RE = new RegExp("^" + NUM + "," + NUM + "(?: " + NUM + "," + NUM + "){1,299}$");

// Çizik Tahtası: günde en fazla 1 çizik, geri alma yok.
// Her çizik günün tarihi + elle çizilen şekil olarak SQLite'ta durur.
export class ScratchBoard extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec("CREATE TABLE IF NOT EXISTS scratch (day TEXT PRIMARY KEY)");
    // Eski tabloya şekil sütununu ekle (zaten varsa hata verir, yok sayılır)
    try { this.sql.exec("ALTER TABLE scratch ADD COLUMN path TEXT"); } catch {}
  }

  async fetch(request) {
    if (request.method !== "GET" && request.method !== "POST") {
      return Response.json({ error: "Method not allowed." }, { status: 405 });
    }

    let status = 200;
    let error;
    let path = null;

    // Gövde en başta okunur; böylece kontrol ile ekleme arasında await kalmaz.
    if (request.method === "POST") {
      let body = null;
      try { body = await request.json(); } catch {}
      path = body && typeof body.path === "string" ? body.path : "";
      if (path.length > 4000 || !PATH_RE.test(path)) {
        status = 400;
        error = "Çizik okunamadı, tekrar çiz.";
      }
    }

    const today = todayIn(this.env.SCRATCH_TZ || "Europe/Istanbul");
    const usedToday = this.sql.exec("SELECT 1 FROM scratch WHERE day = ?", today).toArray().length > 0;

    if (request.method === "POST" && !error) {
      if (usedToday) {
        status = 409;
        error = "Bugünkü çizik hakkı zaten kullanıldı.";
      } else {
        this.sql.exec("INSERT OR IGNORE INTO scratch (day, path) VALUES (?, ?)", today, path);
      }
    }

    const rows = this.sql.exec("SELECT day, path FROM scratch ORDER BY day").toArray();
    const days = rows.map((r) => r.day);
    const paths = rows.map((r) => r.path || null);

    return Response.json(
      { days, paths, today, canScratch: !days.includes(today), ...(error ? { error } : {}) },
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

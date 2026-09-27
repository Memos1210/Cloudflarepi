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

    return env.ASSETS.fetch(request);
  }
};

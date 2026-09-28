// src/index.js

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 1. DAKİKA SAYACI API'SI (/api/status)
    if (url.pathname === "/api/status") {
      try {
        // Değişkenleri güvenli bir şekilde sayıya çeviriyoruz
        const startTimeMs = Number(env.START_TIME_MS || 1790542800000);
        const startIndex = Number(env.START_INDEX || 0);
        const now = Date.now();
        
        const elapsedMinutes = Math.max(0, Math.floor((now - startTimeMs) / 60000));
        const digitIndex = startIndex + elapsedMinutes;

        // pi.txt'yi çekmeyi deneyelim, hata alırsak çökmesin diye try-catch içindeyiz
        let digit = "3"; 
        try {
          if (env.ASSETS) {
            const piRes = await env.ASSETS.fetch(new URL("/pi.txt", url.origin));
            if (piRes.ok) {
              const piText = (await piRes.text()).trim();
              if (digitIndex < piText.length && digitIndex >= 0) {
                digit = piText.charAt(digitIndex);
              }
            }
          }
        } catch (piErr) {
          // pi.txt okunamazsa veya bulunamazsa hata logu yerine varsayılan "3" bassın
          digit = "?"; 
        }

        return new Response(JSON.stringify({
          startTimeMs,
          elapsedMinutes,
          digitIndex,
          startIndex,
          digit
        }), {
          status: 200,
          headers: { 
            "Content-Type": "application/json", 
            "Access-Control-Allow-Origin": "*" 
          }
        });
      } catch (err) {
        // En dıştaki hata yakalayıcı: 500 dönmek yerine hatayı JSON olarak gösterir
        return new Response(JSON.stringify({ error: err.message, stack: err.stack }), { 
          status: 200, // Bilerek 200 dönüyoruz ki ekranda hatanın ne olduğunu görebiliniz
          headers: { "Content-Type": "application/json" }
        });
      }
    }

    // 2. ÇİZİK TAHTASI API'SI (/api/scratch)
    if (url.pathname === "/api/scratch") {
      try {
        const mockData = {
          days: [], 
          canScratch: true
        };

        if (request.method === "POST") {
          const bugun = new Date().toISOString().slice(0, 10);
          mockData.days.push(bugun);
          mockData.canScratch = false;
        }

        return new Response(JSON.stringify(mockData), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      } catch (scratchErr) {
        return new Response(JSON.stringify({ error: scratchErr.message }), { 
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
    }

    // İstek API değilse HTML/Varlıklara yönlendir
    try {
      if (env.ASSETS) {
        return await env.ASSETS.fetch(request);
      }
    } catch (assetsErr) {
      return new Response("Assets yuklenirken hata olustu: " + assetsErr.message, { status: 500 });
    }

    return new Response("Sayfa Bulunamadi (Not Found)", { status: 404 });
  }
};

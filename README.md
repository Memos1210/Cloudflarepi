# π / Dakika Sayacı

Bu proje Cloudflare Workers Static Assets + Worker API ile çalışır.

## İçerik

- `public/index.html` — telefon arayüzü
- `public/pi.txt` — 1,000,001 adet π rakamı
- `src/index.js` — dakika hesabı ve API
- `wrangler.json` — Cloudflare yapılandırması

## Mantık

Sistem gerçek başlangıç zamanını `START_TIME_MS` olarak tutar.
Her istekte:

elapsedMinutes = floor((şimdi - başlangıç) / 60000)

olur. Böylece telefon kapalıyken bile sistem dakikaları kaçırmaz.

## Kurulum

1. Cloudflare hesabında Workers kullan.
2. Bilgisayar kullanmadan yapmak istersen Cloudflare'ın web tabanlı editörüyle de dosyaları oluşturabilirsin; ancak bu paket Wrangler tabanlıdır.
3. `wrangler.json` içindeki:
   - `START_TIME_MS`
   - `START_INDEX`
   değerlerini ayarla.
4. `public/pi.txt` hazırdır.
5. Worker'ı deploy et.

### START_TIME_MS nasıl bulunur?

JavaScript konsolunda:

Date.now()

çıktısını kullanabilirsin.

Örnek:
`179...`

`START_INDEX=0` seçersen ilk kayıt `3` olur.
`START_INDEX=1` seçersen ilk kayıt π'nin virgülden sonraki ilk basamağı olan `1` olur.

## Önemli

Bu sürüm her dakika ağır bir π hesaplaması yapmaz. Hazır π basamaklarından sıradakini seçer. Bu özellikle senin istediğin "telefonun sistemi yemesin" amacı için tasarlandı.

TXT butonu başlangıçtan şu ana kadar bütün dakikaları oluşturur.

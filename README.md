# Custom Speedometer (gaya Haltech) untuk JG Garage / FiveM

Speedometer HTML + CSS + JS murni, tanpa library eksternal, ukuran kecil.

## File
- `index.html` – struktur dashboard
- `style.css` – tampilan
- `script.js` – logika, menerima data lewat `window.postMessage`

## Cara pakai di JG Garage
1. Upload folder ini ke repo GitHub.
2. Aktifkan **GitHub Pages** (Settings → Pages → Deploy from branch → `main` / root).
3. Tunggu beberapa menit, lalu salin URL-nya, contoh:
   `https://USERNAME.github.io/NAMA-REPO/index.html`
4. Tempel URL itu di kolom "custom speedometer" di JG Garage, klik **Save**.

## Tes tanpa game
Buka `index.html?demo=1` di browser. Tekan **D** untuk on/off demo.

## Opsi URL
| Parameter | Contoh | Fungsi |
|---|---|---|
| `scale` | `?scale=0.7` | Ukuran dashboard (default 0.55) |
| `pos` | `?pos=bl` / `?pos=center` | Posisi (default kanan bawah) |
| `unit` | `?unit=mph` | Ganti satuan ke MPH |
| `demo` | `?demo=1` | Mode demo |

Contoh: `.../index.html?scale=0.65&unit=mph`

## Menyesuaikan format data
Buka `script.js` bagian `CONFIG` dan fungsi `applyData`. Field yang dikenali:

`rpm` (0–1 atau RPM penuh), `speed` / `kmh` / `kph` / `mph`, `gear` (angka, `N`, `R`),
`lights`, `boost`, `fuel`, `throttle`, `engineHealth`, `bodyHealth`, `coolant`, `oil`, `brake`,
dan `show` / `visible` / `inVehicle` untuk menampilkan/menyembunyikan.

Kalau speed yang masuk dalam m/s (native `GetEntitySpeed`), ubah `speedMultiplier` jadi `3.6`.
Kalau script server mengirim nama field lain, tambahkan di `applyData`.

## Catatan
Desain terinspirasi tampilan dashboard digital racing; logo/merek Haltech tidak disertakan.

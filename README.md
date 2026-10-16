# Kingdom

Üç boyutlu şehir kurma ve savunma oyunu (Three.js + Electron).

## Tarayıcıda oyna (GitHub Pages)
1. Bu klasördeki dosyaları GitHub deposunun ana dizinine yükle.
2. **Settings → Pages → Build and deployment → Source: Deploy from a branch**, branch: `main`, klasör: `/ (root)` seç, kaydet.
3. Birkaç dakika sonra `https://KULLANICI-ADIN.github.io/DEPO-ADI/` adresinden oyun açılır (telefonda da çalışır).

## Uygulama olarak yükle (PWA)
GitHub Pages adresini telefonda Chrome ile aç → menü (⋮) → **Ana ekrana ekle / Uygulamayı yükle**. iPhone'da Safari → Paylaş → **Ana Ekrana Ekle**. Kingdom logosuyla ana ekrana eklenir, tam ekran ve yatay açılır, ilk açılıştan sonra internetsiz de çalışır.

## Bilgisayarda oyna (Windows)
- `OYNA.bat` → Electron penceresinde açar (Node.js kurulu olmalı: https://nodejs.org).
- `EXE-YAP.bat` → `dist` klasörüne taşınabilir `.exe` oluşturur.

## Dosyalar
- `index.html` — oyun mantığı ve arayüz
- `models.js` — 3B bina/karakter modellerini birleştiren kütüphane
- `assets.js` — gömülü modeller, dokular ve sesler (~10 MB)
- `three.min.js`, `GLTFLoader.js`, `SkeletonUtils.js` — Three.js r128

## Emeği geçenler
3B modeller ve sesler: [Kenney.nl](https://kenney.nl) (CC0) — Castle Kit, Fantasy Town Kit, Nature Kit, Survival Kit, RPG Audio, Impact Sounds, Music Jingles.
Karakterler: [KayKit — Kay Lousberg](https://kaylousberg.itch.io) (CC0) — Adventurers, Skeletons, Medieval Hexagon.

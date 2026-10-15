@echo off
chcp 65001 >nul
echo Bagimliliklar yukleniyor (ilk seferde birkac dakika surer)...
call npm install
echo EXE olusturuluyor...
call npm run dist
echo.
echo Bitti! "dist" klasorundeki dosyayi calistirabilirsin.
pause

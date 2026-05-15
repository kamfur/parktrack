@echo off
echo Przebudowywanie serwera PHP...
echo.

echo 1. Zatrzymywanie kontenera...
docker-compose -f docker-compose-php.yml down

echo 3. Uruchamianie kontenera...
docker-compose -f docker-compose-php.yml up -d

echo.
echo ✅ Serwer PHP został przebudowany!
echo 🌐 Otwórz: http://localhost:8080/rezerwacja.php
echo.
pause

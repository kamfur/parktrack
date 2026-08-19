# Build & Publish

## Wymagania

- Docker Desktop uruchomiony
- Zalogowany do rejestru DigitalOcean w Dockerze (`~/.docker/config.json` zawiera auth dla `registry.digitalocean.com`)

## Build

Wykonaj z katalogu `parksite/` (gdzie leży `Dockerfile`):

```bash
docker build -t registry.digitalocean.com/parksite/parksite:latest .
```

## Publish

```bash
docker push registry.digitalocean.com/parksite/parksite:latest
```

## Build + Publish jedną komendą

```bash
docker build -t registry.digitalocean.com/parksite/parksite:latest . && docker push registry.digitalocean.com/parksite/parksite:latest
```

## Tagowanie wersji

```bash
docker build -t registry.digitalocean.com/parksite/parksite:1.0.0 -t registry.digitalocean.com/parksite/parksite:latest .
docker push registry.digitalocean.com/parksite/parksite:1.0.0
docker push registry.digitalocean.com/parksite/parksite:latest
```

## Logowanie do rejestru (jednorazowo)

Jeśli auth wygasł, zaloguj się ponownie przy użyciu tokenu API DigitalOcean:

```bash
docker login registry.digitalocean.com
# login: <email>
# password: <token API z panelu DigitalOcean>
```
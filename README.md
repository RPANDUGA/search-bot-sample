# search-bot-sample

Static Search Bot web app packaged for Docker.

## Run Locally

Open `outputs/search-bot/index.html` directly, or serve it with Python:

```bash
python3 -m http.server 5173 --directory outputs/search-bot
```

Then open `http://127.0.0.1:5173`.

## Run With Docker

```bash
docker build -t search-bot-sample .
docker run --rm -p 8080:80 search-bot-sample
```

Then open `http://127.0.0.1:8080`.

## CI/CD

- `.github/workflows/cicd.yml` validates the static app and builds/runs the Docker image.
- `.github/workflows/docker-publish.yml` publishes the Docker image to GitHub Container Registry after CI succeeds on `main`.
- Both workflows can notify Slack channel `C0BC3DWKUCA` when repository secret `SLACK_BOT_TOKEN` is configured.

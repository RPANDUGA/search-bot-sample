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
- `.github/workflows/deploy.yml` deploys the published Docker image to a server over SSH.
- The CI, Docker publish, and deploy workflows can notify Slack channel `C0BC3DWKUCA` when repository secret `SLACK_BOT_TOKEN` is configured.

## Deployments

The deploy workflow uses GitHub Environments named `dev`, `qa`, `staging`, and `prod`.

- A successful Docker publish on `main` automatically deploys `latest` to `dev`.
- Manual workflow runs can deploy any image tag to `dev`, `qa`, `staging`, or `prod`.
- Add environment protection rules in GitHub for approvals before `qa`, `staging`, or `prod`.

Each GitHub Environment needs these secrets:

- `DEPLOY_HOST`: server hostname or IP address.
- `DEPLOY_USER`: SSH user on the server.
- `DEPLOY_SSH_KEY`: private SSH key for that user.
- `DEPLOY_PORT`: SSH port, optional, defaults to `22`.
- `GHCR_USERNAME`: GitHub username for pulling private GHCR images, optional for public images.
- `GHCR_TOKEN`: GitHub token with package read access, optional for public images.

Optional environment variable:

- `APP_PORT`: host port to publish, defaults to `80`.

Server requirements:

- Docker installed and running.
- `DEPLOY_USER` can run Docker commands.

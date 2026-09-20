# Development Environment

Here are the steps to set up the development environment for the project. The easiest way to set up the development environment is to use Visual Studio Code with Remote Containers extension. This will create a Docker container with all the necessary tools and dependencies.

## Visual Studio Code with Remote Containers

1. Install [Docker](https://docs.docker.com/get-docker/) and run it
2. Install [Visual Studio Code](https://code.visualstudio.com/)
3. Install [Remote - Containers](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers) extension for Visual Studio Code
4. Open the project in Visual Studio Code and execute (`Ctrl+Shift+P` or `Cmd+Shift+P`) the command `Reopen in Container`

## Environment variables

`make dev` starts the infrastructure containers (`modules/docker-compose.dev.yml`) and the API and admin on the host. The API needs `VIDYA_JWT_SECRET` — a 32+ character key it signs and verifies session tokens with — and refuses to start without one, so a deployment that forgets it fails loud instead of running with a well-known key. `make dev` exports a fixture value for local use (see the "Local stand" section of the root `Makefile`); running the API any other way — outside `make dev`, or anywhere beyond one developer's machine — needs its own value set in the environment, for example:

```sh
export VIDYA_JWT_SECRET=$(openssl rand -base64 32)
```

Every replica behind the same load balancer must be given the *same* secret — there is no fallback that generates one at boot, because each process would then sign with a different key and a token would only be valid on the process that issued it.

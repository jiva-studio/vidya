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

## Storage for media

The stand runs MinIO on `7804` (console on `7805`), and `make dev-up` creates its bucket, because a bucket that has to be made by hand is a bucket the next person does not have. It plays two roles: the installation's **default storage**, which every school that hands over no credentials of its own writes into under `school/<schoolId>`, and the S3 the `*.storage.spec.ts` suites run against (`make test-storage-required`).

The API reads it through `VIDYA_MEDIA_DEFAULT_ENDPOINT` / `_REGION` / `_BUCKET` / `_ACCESS_KEY_ID` / `_SECRET`, which `make dev` exports as fixtures for the stand. Two more matter beyond it:

```sh
export VIDYA_MEDIA_MASTER_KEY=$(openssl rand -base64 32)   # seals a school's own credentials
export VIDYA_MEDIA_ENDPOINT_ALLOWLIST=storage.example.com  # extra endpoint suffixes a school may be pointed at
```

`VIDYA_MEDIA_MASTER_KEY` must decode to exactly 32 bytes — it is the AES-256-GCM key wrapping each school's storage secret — and the API refuses to start when sealed profiles exist and the key does not. Absence alone is not an error: an installation where no school has handed over credentials has nothing to seal. Losing the key means every school re-enters its keys, so it belongs wherever the rest of the deployment's secrets live, not in a checkout.

Beyond the built-in provider suffixes (`amazonaws.com`, `storage.bunnycdn.com`, `r2.cloudflarestorage.com`), an endpoint a school supplies is refused: the address is one the API dials from inside its own network, so it is resolved before the request and turned down for private, loopback, link-local, CGNAT and ULA ranges, and for anything that is not `https`. The allowlist is how a deployment opts into a provider we do not name — in the stand it is how `127.0.0.1` is allowed at all.

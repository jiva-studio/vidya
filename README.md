<p align="center">
  <img src="docs/images/logo.png" height="184px"/>
</p>

<p align="center"><i>
Vidya is a Learning Management System (LMS) crafted to revolutionize education by enabling you to establish and manage your own schools, complete with students, teachers, and more. It empowers students with the flexibility to learn anytime, anywhere through a state-of-the-art mobile application.
</i></p>

<p align="center">
  <a href="#">
    <img src="docs/images/splash.png"/>
  </a>
  <a href="#">
    <img src="docs/images/download-app-store.png" height="50">
  </a>
  <a href="#">
    <img src="docs/images/download-google-play.png" height="50">
  </a>
</p>

## Features

1. 🏫 **School Management Made Easy** Open and manage your own school. Invite students, onboard teachers, and handle everything from one dashboard.

2. 📚 **Course Creation** Build structured courses with lessons and homework. Organize your curriculum exactly the way you want.

3. 🌐 **Multi-Platform Access**
Students can join your school via a user-friendly website or mobile app — learning made simple and accessible.

4. 🛠️ **Your Brand, Your Domain**
Want a fully branded school on your custom domain? Need a dedicated mobile app? No problem — Vidya generates it for you automatically.

## Get involved
If you'd like to help develop the project, here's a list of links to get you started:

1. [Development Environment](<docs/Development Environment.md>) – Configure your development enviroment to get started.
2. [Good First Issues](https://github.com/jiva-studio/vidya/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22) – a list of simple issues any developer could start from.
3. [Roadmap](https://github.com/orgs/akdasa-studios/projects/13/views/4) - list of tasks we are working on.

## Repository Structure

```text
modules/
├── libs/       domain, entities, protocol   # reusable, no transport or deployment
├── apps/       admin, mobile                # user-facing clients
└── services/   api, database, gateway, seeder
```

Libs never depend on apps or services. Cross-package imports use the `@vidya/*`
specifiers declared in `modules/tsconfig.base.json`.

## Development

```bash
make install              # install workspace dependencies

make check                # the full quality gate — run before every commit
make typecheck            # tsc --noEmit across every workspace
make lint                 # ESLint (structural limits, purity rules, import order)
make lint-fix             # autofix what ESLint can
make format               # Prettier

make api-run              # start the API in watch mode
make api-test             # Jest for the API only

make db-run               # start Postgres
make db-migrate           # apply migrations
make db-migrate-generate  # generate a migration from entity changes
make seed                 # populate development data
```

`make check` chains typecheck, lint, format-check and test. A change is not done
until it exits 0.

## Working with AI agents

Conventions that coding agents must follow live in [`AGENTS.md`](./AGENTS.md) and
[`.agents/`](./.agents):

- [`.agents/rules/architecture.md`](./.agents/rules/architecture.md) — monorepo layout, layering, dependency rules
- [`.agents/rules/coding-style-backend.md`](./.agents/rules/coding-style-backend.md) — NestJS and TypeScript conventions
- [`.agents/rules/coding-style-frontend.md`](./.agents/rules/coding-style-frontend.md) — Vue component conventions
- [`.agents/skills/`](./.agents/skills) — the coder, makefile and 4-stage review workflows

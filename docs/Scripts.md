# Scripts

Here is a list of all the scripts that are available in the project. You can run
them directly, because `./scripts` is in the `PATH` of the project.

Names follow `vidya-<area>-<object>-<action>`, and are meant to answer "what
will this run", not "which flag does it set".

| Script                    | Description                                                          |
| ------------------------- | -------------------------------------------------------------------- |
| vidya-workspace-build     | Builds every workspace                                                |
| vidya-workspace-check     | Runs typecheck, lint, format and tests for one workspace              |
| vidya-test-suite-run      | Runs the test suites against `memory`, `postgres` or `postgres-required` |
| vidya-mutation-suite-run  | Runs mutation testing, on the branch diff or over a whole package     |
| vidya-db-server-start     | Starts the local Postgres server                                      |
| vidya-db-schema-drop      | Drops the development schema                                          |
| vidya-db-migrations-apply | Applies all pending DB migrations                                     |
| vidya-db-testdb-drop      | Drops the databases the test suite created                            |

Each script documents its own arguments at the top of the file, and `make`
targets delegate to these rather than reimplementing them.

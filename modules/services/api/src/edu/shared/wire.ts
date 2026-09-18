/**
 * What the client actually receives, for comparing against a mapper's output.
 *
 * A response object holds `undefined` for an absent optional field, and JSON
 * drops the key entirely. `supertest` compares the parsed body key by key, so
 * an expectation built straight from a mapper fails on exactly the fields the
 * server correctly left out.
 */
export const onTheWire = <T>(value: T): T => JSON.parse(JSON.stringify(value))

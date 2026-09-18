# Comments & Docblocks

A comment is read by someone who has the code in front of them. It earns its
place by saying something the code cannot.

---

## 1. No references to documents that are not in the repository

Tags like `(D-14)`, `(I-2, AC-22f)` or `(T-S-35)` point at plans and specs that
live outside git or under `.gitignore`. To anyone who opens the file they are a
link to nowhere, and they rot the moment the document is renumbered.

Forbidden in comments, in docblocks, in commit-adjacent code, and in test names.

```ts
// Bad
/** Resolves the server id for a queued row (D-14, AC-22f). */

// Good
/** Resolves the server id for a queued row. */
```

```ts
// Bad
it('T-S-35: rejects a push whose clock is behind the last ack', ...)

// Good
it('rejects a push whose clock is behind the last ack', ...)
```

A test name states what breaks, not where the requirement is filed. If you need
to point at a document, point at one that is committed and link it by path.

---

## 2. Describe the code, not the defect that led to it

The history of a bug belongs in the commit message, where it is attached to the
change that fixed it. A docblock that narrates a past incident goes stale on the
next refactor and buries the one sentence a reader needed.

```ts
// Bad
/**
 * Without this field the answer named the id that was sent: the second device
 * kept a local row the server had never heard of, so the next pull re-created
 * it, and the duplicate only surfaced after the third sync...
 */

// Good
/** Server-assigned id, echoed back so the client can replace its local one. */
```

"Why it is this way" is welcome when the reason is not obvious from the code.
"What went wrong in July" is not.

---

## 3. Size is proportional to what is being explained

| What it explains | What it gets |
| --- | --- |
| One field, one flag, one constant | One line, maybe two |
| A non-obvious decision or trade-off | Two or three lines |
| A non-trivial algorithm or invariant | One paragraph |
| More than that | It is documentation — put it in `docs/` and link it |

Twenty lines of docblock on one optional field is not thoroughness, it is a
document filed in the wrong place.

```ts
// Bad: twenty lines above one field
/**
 * The identifier the server assigned to this row.
 * ... fourteen more lines of background ...
 */
serverDocId?: string

// Good
/** Set once the server has accepted the row; absent while it is still queued. */
serverDocId?: string
```

---

## 4. What to write instead

Comments answer **why this and not the obvious alternative**, where the answer
is not visible in the code:

- a constraint imposed from outside (a protocol, a driver quirk, a deadline);
- an invariant the reader must preserve when editing;
- a trade-off that was deliberately taken.

What the code *does* is the job of the code and its names. If a comment is
needed to explain what a function does, rename the function.

```ts
// Bad
// Increment the counter by one.
counter += 1

// Bad
// Loop over users and check permissions.
for (const user of users) { ... }

// Good
// pg's driver names the role `user`; TypeORM names it `username`. Passing the
// wrong shape does not throw — it silently falls back to the OS user.
```

---

## Checklist before handing a diff over

- [ ] No `(D-n)`, `(I-n)`, `(AC-n)`, `(T-*-n)` or similar tags anywhere, tests included.
- [ ] No comment narrating a defect, a review round, or who asked for what.
- [ ] Every docblock is proportional to what it documents.
- [ ] Every remaining comment says *why*, not *what*.

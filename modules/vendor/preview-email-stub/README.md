# preview-email stub

`@nestjs-modules/mailer` lists `preview-email` as an optional dependency and an optional peer dependency. It loads it lazily, wrapped in a try/catch, and only calls the result when `MailerOptions.preview` is truthy — a setting this codebase never uses.

The real `preview-email` depends on `mailparser`, which pins its own copy of `nodemailer` at a version carrying several advisories, independent of the `nodemailer` version `@vidya/api` declares. Since `preview-email` is never imported, the root `package.json` overrides it with this package instead, so the real one — and its vulnerable nested `nodemailer` — is never installed.

The export matches the real package's signature (`(mailData, options) -> Promise`) so the mailer's code path stays valid even if `preview` were ever turned on by mistake; it rejects instead of previewing anything.

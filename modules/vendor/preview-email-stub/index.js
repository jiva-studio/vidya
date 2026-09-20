'use strict'

/**
 * Inert stand-in for `preview-email`, kept out of installs by an npm
 * `overrides` entry. See README.md for why.
 */
module.exports = function previewEmail() {
  return Promise.reject(new Error('preview-email is stubbed out; do not set MailerOptions.preview'))
}

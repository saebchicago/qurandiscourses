# Security policy

_Last updated: 2026-08-20_

## Scope

Divine Discourses is primarily a static reading and research site. Reading,
search, study-depth preferences, and other ordinary use do not require an
account, payment flow, or analytics cookie. Browser preferences such as depth
selection remain local to the reader.

The site does, however, provide an optional correction/reporting form. When a
reader deliberately submits that form, the hosting provider can receive and
store the submitted correction text and any optional contact information. The
form should therefore never be used to send passwords, access tokens, private
keys, highly sensitive personal information, or other secrets.

Reports are welcome for anything that could:

- execute unexpected script on divinediscourses.org (XSS through API
  responses, URL parameters, or bundled data);
- weaken or bypass the Content-Security-Policy, security headers, or
  redirect rules in `netlify.toml` or `_headers`;
- corrupt the integrity of published datasets or the pipeline in
  `scripts/` that generates them;
- expose readers through bundled assets, the service worker, manifest, or
  client-side storage;
- expose or mishandle correction-form submissions through project-controlled
  configuration.

## Reporting

Use GitHub's private vulnerability reporting on this repository ("Report a
vulnerability" under the Security tab). If that is not available to you, open a
plain issue saying only that you have a security report and how to reach you; do
not put vulnerability details in the public issue.

You can expect acknowledgement within two working days. Please give the project
a reasonable remediation window before public disclosure. Deployment timing
depends on the hosting build status; production builds may be intentionally
paused to control infrastructure cost and then explicitly re-enabled for a
verified release.

## Security and publication controls

- Page-specific CSP is generated and audited rather than hand-maintained.
- Browser security headers and framing policy are defined in Netlify
  configuration; source-only paths are marked not for indexing.
- Generated pages, static fallbacks, citation metadata, navigation, headers,
  and provenance artifacts have deterministic integrity checks.
- External evidence checks are intentionally separated from deterministic
  repository checks so third-party downtime cannot masquerade as a local
  integrity failure.
- GitHub Actions may be scoped to `main`, pull requests, schedules, and manual
  dispatch to avoid duplicate runner consumption on the same change.

## Not in scope

- The third-party APIs the site reads (including Qur'an text/translation and
  media providers); report provider-side vulnerabilities upstream. The site
  treats their responses as untrusted, and a failure in this project's handling
  or escaping of those responses remains in scope.
- Volume-based denial of service against Netlify's CDN.
- Vulnerabilities entirely inside GitHub or Netlify infrastructure that are not
  caused by this project's configuration.

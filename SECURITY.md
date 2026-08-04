# Security policy

## Scope

Divine Discourses is a static site: no server code, no accounts, no
cookies, no stored user data. Everything a reader types stays in their
own browser's localStorage. That shrinks the attack surface, but does
not remove it. Reports are welcome for anything that could:

- execute unexpected script on divinediscourses.org (XSS through API
  responses, URL parameters, or bundled data);
- weaken or bypass the Content-Security-Policy, security headers, or
  redirect rules in `netlify.toml`;
- corrupt the integrity of the published datasets or the pipeline in
  `scripts/` that generates them;
- expose readers through a bundled dependency-free asset (fonts,
  service worker, manifest).

## Reporting

Use GitHub's private vulnerability reporting on this repository
("Report a vulnerability" under the Security tab). If that is not
available to you, open a plain issue saying only that you have a
security report and how to reach you; do not put details in the public
issue.

You can expect acknowledgement within two working days. Please give the
project a reasonable window to fix before public disclosure; because
deploys are a git push, fixes typically ship within days.

## Not in scope

- The third-party APIs the site reads (alquran.cloud, quran.com,
  islamic.network CDN); report those upstream. The site treats their
  responses as untrusted and escapes them; a failure of that escaping
  IS in scope.
- Volume-based denial of service against Netlify's CDN.

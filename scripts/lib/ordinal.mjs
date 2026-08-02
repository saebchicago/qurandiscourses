// ordinal.mjs — English ordinal suffix for a number ("13th").
//
// Shared because two generators put the same phrase in front of a
// reader: build-share-pages.mjs writes "13th in the Cairo 1924
// revelation order" into a share page's description, and
// build-og-images.mjs writes it onto the matching social card. They
// must not drift.
export function ordinal(n) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

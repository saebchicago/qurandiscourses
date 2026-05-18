/* Inline glossary — wraps first per-page occurrence of each term in a .gloss span */
window.GLOSSARY = {
  nazm: "Arabic for 'coherence' or 'structural order'. A method of Qur'anic exegesis that reads each surah as a unified composition with deliberate thematic structure, developed by Farahi, Islahi, Mir, and Khan.",
  mutashabihat:
    "Phrases or formulations that recur across the Qur'an with small variations. The classical science of tracking these parallels is a subfield of 'ulum al-Qur'an.",
  iltifat:
    "Grammatical shift, especially person or tense, treated by classical Arabic rhetoricians as a deliberate rhetorical device rather than a textual irregularity.",
  hapax:
    "From 'hapax legomenon' (Greek: 'said once'). A word or form occurring exactly once in a corpus. The Qur'an has roughly 12,000 surface-form hapax legomena and roughly 395 root-level hapax.",
  lemma:
    "The dictionary or canonical form of a word. In Arabic morphology, lemmas are derived from triliteral roots according to fixed patterns.",
  basmala:
    "The opening formula bismillah al-rahman al-rahim ('In the name of God, the Most Merciful, the Especially Merciful'). It heads 113 of the 114 surahs and appears mid-surah once, at 27:30.",
  buckwalter:
    "A one-to-one Latin-character transliteration system for Arabic, used by the Leeds Quranic Arabic Corpus to encode the consonantal and vowel structure of every word in machine-readable form.",
  tafsir:
    "Qur'anic exegesis or commentary. A scholarly genre going back to the earliest generations of Islam.",
  tafaseer: "Plural of tafsir.",
  khitab:
    "Direct address from speaker to hearer. Khan translated this term as 'discourse' and treated the speaker-to-hearer address as the proper unit of Qur'anic reading.",
  surah:
    "A chapter of the Qur'an. There are 114, varying in length from 3 verses to 286.",
  ayah: "A verse of the Qur'an. The plural is ayat. The same word also means 'sign'.",
  verified:
    "A claim on this site backed by direct corpus data, primary text, or peer-reviewed scholarship. The strongest confidence label.",
  nuanced:
    "A claim that is defensible but depends on a specific counting rule, classification scheme, or interpretive choice. Both the headline figure and the underlying ambiguity are presented.",
  pending:
    "A claim awaiting triangulation. Useful as a working figure but not yet verified against primary sources.",
};

(function () {
  if (window.__glossaryDone) return;
  window.__glossaryDone = true;

  function escapeRe(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function shouldSkip(node) {
    var el = node.parentElement;
    while (el && el !== document.body) {
      var tag = el.tagName;
      if (tag === "A" || tag === "CODE" || tag === "SCRIPT" || tag === "STYLE")
        return true;
      if (el.classList) {
        if (
          el.classList.contains("ar") ||
          el.classList.contains("notranslate") ||
          el.classList.contains("badge") ||
          el.classList.contains("gloss")
        )
          return true;
      }
      if (el.getAttribute && el.getAttribute("translate") === "no") return true;
      el = el.parentElement;
    }
    return false;
  }

  document.addEventListener("DOMContentLoaded", function () {
    var main = document.getElementById("main");
    if (!main) return;

    var terms = Object.keys(window.GLOSSARY).sort(function (a, b) {
      return b.length - a.length;
    });
    var used = {};

    var walker = document.createTreeWalker(
      main,
      NodeFilter.SHOW_TEXT,
      null,
      false,
    );
    var nodes = [];
    var n;
    while ((n = walker.nextNode())) nodes.push(n);

    nodes.forEach(function (node) {
      if (!node.parentNode) return;
      if (shouldSkip(node)) return;
      var text = node.textContent;
      for (var i = 0; i < terms.length; i++) {
        var term = terms[i];
        if (used[term]) continue;
        var re = new RegExp("\\b" + escapeRe(term) + "\\b", "i");
        var m = re.exec(text);
        if (m) {
          used[term] = true;
          var before = text.slice(0, m.index);
          var matched = m[0];
          var after = text.slice(m.index + matched.length);
          var frag = document.createDocumentFragment();
          if (before) frag.appendChild(document.createTextNode(before));
          var span = document.createElement("span");
          span.className = "gloss";
          span.tabIndex = 0;
          span.title = window.GLOSSARY[term];
          span.textContent = matched;
          frag.appendChild(span);
          if (after) frag.appendChild(document.createTextNode(after));
          node.parentNode.replaceChild(frag, node);
          return;
        }
      }
    });
  });
})();

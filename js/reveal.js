/* Subtle reveal-on-scroll + re-scan hook for async-rendered content. */
window.__reveal = (function () {
  "use strict";
  const reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const io = reduce ? null : new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
  }, { threshold: 0.08, rootMargin: "0px 0px -40px 0px" });

  const SELECTOR = ".section, .about-card, .post, .doc, .att-doc";
  function scan(root) {
    (root || document).querySelectorAll(SELECTOR).forEach((el) => {
      if (el.dataset.rev) return;
      el.dataset.rev = "1";
      if (reduce) { el.classList.add("in"); return; }
      el.classList.add("reveal");
      io.observe(el);
    });
  }
  document.addEventListener("DOMContentLoaded", () => scan());
  return { scan };
})();

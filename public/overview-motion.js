/**
 * SKYVANTA — Overview (Beranda) Motion & Sky Parallax Engine
 * Scoped strictly to #view-landing. Respects prefers-reduced-motion.
 */
(function initOverviewMotion() {
  const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const prefersReducedMotion = reducedMotionQuery.matches;

  const landingView = document.getElementById("view-landing");
  const skyBg = document.querySelector(".app-global-bg");
  if (!landingView) return;

  const targets = Array.from(
    landingView.querySelectorAll(
      ".landing-seamless-hero > div, .grid > .liquid-glass-card"
    )
  );

  // 1. Scroll Reveal with IntersectionObserver (stagger 40-80ms -> 60ms step)
  if (prefersReducedMotion || typeof IntersectionObserver === "undefined") {
    targets.forEach((el) => el.classList.add("ov-revealed"));
  } else {
    targets.forEach((el, idx) => {
      const delayMs = (idx % 4) * 60;
      el.style.setProperty("--ov-reveal-delay", `${delayMs}ms`);
      el.classList.add("ov-reveal-item");
    });

    const revealObserver = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("ov-revealed");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: "0px 0px -20px 0px" }
    );

    targets.forEach((el) => revealObserver.observe(el));

    // Safety fallback for elements already in the initial viewport
    requestAnimationFrame(() => {
      targets.forEach((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.top < window.innerHeight * 0.95) {
          el.classList.add("ov-revealed");
          revealObserver.unobserve(el);
        }
      });
    });
  }

  // 2. Light Sky Background Parallax ONLY, synced via requestAnimationFrame
  if (!prefersReducedMotion && skyBg) {
    let rafPending = false;

    const updateSkyParallax = () => {
      rafPending = false;
      const isOverviewActive = landingView.classList.contains("is-active-view");
      if (!isOverviewActive) {
        skyBg.style.transform = "";
        return;
      }
      const scrollY = window.scrollY || window.pageYOffset || 0;
      const offsetY = Math.max(-24, Math.min(0, -scrollY * 0.08));
      skyBg.style.transform = `translate3d(0, ${offsetY.toFixed(2)}px, 0) scale(1.04)`;
    };

    const onScroll = () => {
      if (!rafPending) {
        rafPending = true;
        requestAnimationFrame(updateSkyParallax);
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });

    if (typeof MutationObserver !== "undefined") {
      const viewObserver = new MutationObserver(() => {
        if (!rafPending) {
          rafPending = true;
          requestAnimationFrame(updateSkyParallax);
        }
      });
      viewObserver.observe(landingView, { attributes: true, attributeFilter: ["class"] });
    }

    requestAnimationFrame(updateSkyParallax);
  }
})();

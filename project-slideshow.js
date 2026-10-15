/* ============================================================
   project-slideshow.js
   Tagged image galleries on the Project Portfolio cards.

   - BBT and TFSRP-H (design stage / 0% progress): gallery stays on.
   - C-SDTP and AFDP (active): gallery alternates with the live stats.
   - Once a design-stage project starts (progress > 0 and no longer
     "Design Stage"), it switches to the alternating mode by itself.

   Binds to:  #portfolioGrid .project-card   (built by script.js)
   Needs:     project-slideshow.css
   ============================================================ */

(function () {
  "use strict";

  /* ----------------------------------------------------------
     CONFIG — edit image paths / captions here
     ---------------------------------------------------------- */
  const CONFIG = {
    interval: 5000, // ms each image is shown
    stagger: 1500, // offset between cards so they don't all change together
    galleryMs: 20000, // active projects: how long the gallery shows
    statsMs: 12000, // active projects: how long the stats show

    projects: {
      "C-SDTP": {
        name: "Climate-Smart Smallholder Dairy",
        color: "#4f7942",
        images: [
          { src: "assets/projects/c-sdtp/1.jpg", caption: "Smallholder dairy farmers" },
          { src: "assets/projects/c-sdtp/2.jpg", caption: "Milk collection centres" },
          { src: "assets/projects/c-sdtp/3.jpg", caption: "Women and youth in dairy" },
        ],
      },
      AFDP: {
        name: "Agriculture & Fisheries Development",
        color: "#f7c948",
        images: [
          { src: "assets/projects/afdp/1.jpg", caption: "Crop and seed production" },
          { src: "assets/projects/afdp/2.jpg", caption: "Fisheries and aquaculture" },
          { src: "assets/projects/afdp/3.jpg", caption: "Value addition" },
        ],
      },
      BBT: {
        name: "Building a Better Tomorrow – Coffee",
        color: "#ef7d2d",
        images: [
          { src: "assets/projects/bbt/1.jpg", caption: "Coffee farmers" },
          { src: "assets/projects/bbt/2.jpg", caption: "Coffee processing" },
          { src: "assets/projects/bbt/3.jpg", caption: "Smallholder cooperatives" },
        ],
      },
      "TFSRP-H": {
        name: "Food Systems Resilience – Horticulture",
        color: "#3b82f6",
        images: [
          { src: "assets/projects/tfsrp-h/1.jpg", caption: "Horticulture production" },
          { src: "assets/projects/tfsrp-h/2.jpg", caption: "Market access" },
          { src: "assets/projects/tfsrp-h/3.jpg", caption: "Climate-resilient farming" },
        ],
      },
    },
  };

  /* Project name in the Google Sheet -> key used in CONFIG.projects */
  const KEY_MAP = {
    csdtp: "C-SDTP",
    csdp: "C-SDTP",
    climatesmartsmallholderdairytransformationproject: "C-SDTP",
    afdp: "AFDP",
    bbt: "BBT",
    bbtcoffee: "BBT",
    buildingabettertomorrow: "BBT",
    tfsrph: "TFSRP-H",
    tfsrp: "TFSRP-H",
    trsp: "TFSRP-H",
    tfsrphorticulture: "TFSRP-H",
    foodsystemsresilience: "TFSRP-H",
  };

  const slug = (text) => String(text || "").toLowerCase().replace(/[^a-z0-9]/g, "");

  /* ----------------------------------------------------------
     CARD HELPERS
     ---------------------------------------------------------- */
  function getCode(card) {
    const title = card.querySelector("h3");
    return title ? KEY_MAP[slug(title.textContent)] || null : null;
  }

  function isDesignStage(card) {
    const pct = parseFloat(card.querySelector(".progress-header strong")?.textContent) || 0;
    const text = card.textContent.replace(/\s+/g, " ");
    return pct <= 0 || /design\s*stage/i.test(text);
  }

  function overlayTop(card) {
    const anchor = card.querySelector(".progress-header");
    return anchor ? Math.max(0, anchor.offsetTop - 6) : 120;
  }

  /* ----------------------------------------------------------
     BUILD ONE GALLERY
     ---------------------------------------------------------- */
  function buildOverlay(card, code, cfg, delay) {
    const color = getComputedStyle(card).borderTopColor || cfg.color;

    const overlay = document.createElement("div");
    overlay.className = "ps-overlay";
    overlay.style.top = overlayTop(card) + "px";
    overlay.innerHTML = `
      <span class="ps-tag" style="--tag:${color}">
        <b>${code}</b><small>${cfg.name}</small>
      </span>
      <div class="ps-caption"></div>
      <div class="ps-dots"></div>`;
    card.appendChild(overlay);

    const captionEl = overlay.querySelector(".ps-caption");
    const dotsEl = overlay.querySelector(".ps-dots");
    const slides = [];
    let index = 0;
    let pending = cfg.images.length;

    function show(i) {
      index = i;
      slides.forEach((s, n) => s.classList.toggle("active", n === i));
      [...dotsEl.children].forEach((d, n) => d.classList.toggle("active", n === i));
      captionEl.textContent = slides[i] ? slides[i].dataset.caption : "";
    }

    function settle() {
      pending--;
      // No usable image at all -> remove the overlay so the card keeps its normal stats
      if (pending === 0 && !slides.length) overlay.remove();
    }

    cfg.images.forEach((img) => {
      const probe = new Image();
      probe.onload = () => {
        const slide = document.createElement("div");
        slide.className = "ps-slide";
        slide.style.backgroundImage = `url("${img.src}")`;
        slide.dataset.caption = img.caption || "";
        overlay.insertBefore(slide, overlay.firstChild);
        slides.push(slide);
        dotsEl.appendChild(document.createElement("span"));
        if (slides.length === 1) {
          show(0);
          overlay.classList.add("ps-ready");
        }
        settle();
      };
      probe.onerror = () => {
        console.warn("Slideshow image missing:", img.src);
        settle();
      };
      probe.src = img.src;
    });

    /* Slide rotation */
    setTimeout(() => {
      const timer = setInterval(() => {
        if (!overlay.isConnected) return clearInterval(timer);
        if (slides.length > 1) show((index + 1) % slides.length);
      }, CONFIG.interval);
    }, delay);

    /* Gallery <-> stats alternation (only for projects past design stage) */
    (function cycle(galleryVisible) {
      if (!overlay.isConnected) return;

      if (isDesignStage(card)) {
        overlay.classList.remove("ps-hidden");
        return setTimeout(() => cycle(true), 5000);
      }

      overlay.classList.toggle("ps-hidden", !galleryVisible);
      setTimeout(
        () => cycle(!galleryVisible),
        galleryVisible ? CONFIG.galleryMs : CONFIG.statsMs,
      );
    })(true);
  }

  /* ----------------------------------------------------------
     SYNC — runs whenever script.js re-renders the project cards
     ---------------------------------------------------------- */
  function sync() {
    const grid = document.getElementById("portfolioGrid");
    if (!grid) return;

    let n = 0;

    grid.querySelectorAll(".project-card").forEach((card) => {
      const code = getCode(card);
      const cfg = code && CONFIG.projects[code];

      if (cfg && !card.querySelector(":scope > .ps-overlay")) {
        buildOverlay(card, code, cfg, CONFIG.stagger * n);
      }

      n++;
    });
  }

  function reposition() {
    document.querySelectorAll(".ps-overlay").forEach((overlay) => {
      const card = overlay.parentElement;
      if (card) overlay.style.top = overlayTop(card) + "px";
    });
  }

  function start() {
    const grid = document.getElementById("portfolioGrid");

    if (!grid) {
      console.warn("project-slideshow: #portfolioGrid not found");
      return;
    }

    // script.js replaces the grid's cards on every Google Sheets sync (every 5 min)
    new MutationObserver(() => requestAnimationFrame(sync)).observe(grid, {
      childList: true,
    });

    window.addEventListener("resize", reposition);

    sync();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();

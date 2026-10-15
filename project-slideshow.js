/* ============================================================
   project-slideshow.js  (v7 - auto-syncs with the photo folders)

   Photos are read from  assets/projects/gallery.json , which a GitHub
   Action rebuilds every time files change in assets/projects/.
   Add a photo to a project folder, commit, and it appears on the
   dashboard on its own (the TV re-checks every 10 minutes).

   If gallery.json is missing or a project has no entries, the script looks
   for numbered files in the folder (1.jpg, 2.JPG, 3.png ...) in any case.

   Binds to:  #portfolioGrid .project-card   (built by script.js)
   Needs:     project-slideshow.css
   ============================================================ */

(function () {
  "use strict";

  const CONFIG = {
    interval: 5000, // ms each image is shown
    stagger: 1500, // offset between cards so they don't all change together
    galleryMs: 20000, // active projects: how long the gallery shows
    statsMs: 12000, // active projects: how long the stats show
    manifestUrl: "assets/projects/gallery.json",
    // Fallback when gallery.json is not available: look for 1, 2, 3 ... in each folder
    maxNumbered: 20,
    extensions: ["jpg", "JPG", "jpeg", "JPEG", "png", "PNG", "webp"],
    manifestRefreshMs: 10 * 60 * 1000, // re-check for new photos every 10 min

    /* Folder name = project code in lower case: c-sdtp, afdp, bbt, tfsrp-h
       enabled: false  -> no gallery on that card (leave out or set true to show it) */
    projects: {
      "C-SDTP": {
        enabled: true, // gallery ON (set to false to hide it on this card)
        name: "Climate-Smart Smallholder Dairy",
        color: "#4f7942",
      },
      AFDP: {
        enabled: true, // gallery ON (set to false to hide it on this card)
        name: "Agriculture & Fisheries Development",
        color: "#f7c948",
      },
      BBT: {
        enabled: true, // gallery ON (set to false to hide it on this card)
        name: "Building a Better Tomorrow – Coffee",
        color: "#ef7d2d",
      },
      "TFSRP-H": {
        enabled: true, // gallery ON (set to false to hide it on this card)
        name: "Food Systems Resilience – Horticulture",
        color: "#3b82f6",
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
     MANIFEST (auto-generated list of photos per project folder)
     ---------------------------------------------------------- */
  let manifest = null;
  let ready = false;

  async function loadManifest() {
    try {
      const res = await fetch(`${CONFIG.manifestUrl}?t=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      manifest = await res.json();
    } catch (error) {
      console.warn("project-slideshow: gallery.json not available, looking for numbered files instead.", error);
    }
  }

  function canLoad(src) {
    return new Promise((resolve) => {
      const probe = new Image();
      probe.onload = () => resolve(true);
      probe.onerror = () => resolve(false);
      probe.src = encodeURI(src);
    });
  }

  /* No gallery.json: find 1.jpg, 2.JPG, 3.png ... (any case / extension) until a number is missing */
  async function discover(code) {
    const folder = `assets/projects/${code.toLowerCase()}`;
    const found = [];

    for (let n = 1; n <= CONFIG.maxNumbered; n++) {
      let hit = null;

      for (const ext of CONFIG.extensions) {
        const src = `${folder}/${n}.${ext}`;
        if (await canLoad(src)) {
          hit = src;
          break;
        }
      }

      if (!hit) break;
      found.push({ src: hit, caption: "" });
    }

    return found;
  }

  async function imagesFor(code) {
    const list = manifest && manifest[code.toLowerCase()];
    return Array.isArray(list) && list.length ? list : discover(code);
  }

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
  async function buildOverlay(card, code, cfg, delay) {
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

    const images = await imagesFor(code);
    if (!images.length) {
      overlay.remove(); // no photos yet: the card keeps its normal stats
      return;
    }

    const captionEl = overlay.querySelector(".ps-caption");
    const dotsEl = overlay.querySelector(".ps-dots");
    const tagEl = overlay.querySelector(".ps-tag");
    const slides = [];
    let index = 0;

    // Load every photo first, then build the slides in the original order
    const loaded = await Promise.all(
      images.map(
        (img) =>
          new Promise((resolve) => {
            const probe = new Image();
            probe.onload = () => resolve(img);
            probe.onerror = () => {
              console.warn("Slideshow image missing:", img.src);
              resolve(null);
            };
            probe.src = encodeURI(img.src);
          }),
      ),
    );

    loaded.filter(Boolean).forEach((img) => {
      const slide = document.createElement("div");
      slide.className = "ps-slide";
      slide.style.backgroundImage = `url("${encodeURI(img.src)}")`;
      slide.dataset.caption = img.caption || "";
      overlay.insertBefore(slide, tagEl);
      slides.push(slide);
      dotsEl.appendChild(document.createElement("span"));
    });

    // No usable image at all -> remove the overlay so the card keeps its normal stats
    if (!slides.length) {
      overlay.remove();
      return;
    }

    function show(i) {
      index = i;
      slides.forEach((s, n) => s.classList.toggle("active", n === i));
      [...dotsEl.children].forEach((d, n) => d.classList.toggle("active", n === i));
      captionEl.textContent = slides[i].dataset.caption;
    }

    show(0);
    overlay.classList.add("ps-ready");

    /* Slide rotation - pauses while the gallery is hidden, so no photo is skipped */
    setTimeout(() => {
      const timer = setInterval(() => {
        if (!overlay.isConnected) return clearInterval(timer);
        if (overlay.classList.contains("ps-hidden")) return;
        if (slides.length > 1) show((index + 1) % slides.length);
      }, CONFIG.interval);
    }, delay);

    /* Gallery <-> stats alternation (only for projects past design stage).
       The gallery phase lasts long enough to show every photo once. */
    const galleryDuration = Math.min(
      60000,
      Math.max(CONFIG.galleryMs, slides.length * CONFIG.interval),
    );

    (function cycle(galleryVisible) {
      if (!overlay.isConnected) return;

      if (isDesignStage(card)) {
        overlay.classList.remove("ps-hidden");
        return setTimeout(() => cycle(true), 5000);
      }

      overlay.classList.toggle("ps-hidden", !galleryVisible);
      setTimeout(
        () => cycle(!galleryVisible),
        galleryVisible ? galleryDuration : CONFIG.statsMs,
      );
    })(true);
  }

  /* ----------------------------------------------------------
     SYNC — runs whenever script.js re-renders the project cards
     ---------------------------------------------------------- */
  function sync() {
    if (!ready) return;

    const grid = document.getElementById("portfolioGrid");
    if (!grid) return;

    let n = 0;

    grid.querySelectorAll(".project-card").forEach((card) => {
      const code = getCode(card);
      const cfg = code && CONFIG.projects[code];

      if (cfg && cfg.enabled !== false && !card.querySelector(":scope > .ps-overlay")) {
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

  async function start() {
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

    await loadManifest();
    ready = true;
    sync();

    // Pick up newly added photos without anyone touching the TV
    setInterval(async () => {
      const before = JSON.stringify(manifest);
      await loadManifest();
      if (JSON.stringify(manifest) !== before) {
        document.querySelectorAll(".ps-overlay").forEach((o) => o.remove());
        sync();
      }
    }, CONFIG.manifestRefreshMs);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();

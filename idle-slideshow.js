/* ============================================================
   idle-slideshow.js
   Full-screen photo slideshow when nobody is using the dashboard.

   - After 1 minute with no mouse / keyboard / touch activity, a
     full-screen slideshow of ALL project photos starts (every photo
     carries its project tag and caption).
   - Move the mouse (or press a key / touch the screen) and the
     dashboard data comes straight back.

   Photos come from project-slideshow.js (window.ProjectGallery),
   so new photos added to assets/projects/<project>/ show up here
   automatically.

   Test quickly:  index.html?idle=10   (starts after 10 seconds)
   ============================================================ */

(function () {
  "use strict";

  const params = new URLSearchParams(location.search);

  const CONFIG = {
    idleMs: (Number(params.get("idle")) || 60) * 1000, // inactivity before the slideshow starts
    slideMs: 8000, // time each photo stays on screen
    returnToDataAfterMs: 0, // 0 = stay in the slideshow until the mouse moves
    dataPeekMs: 30000, // only used when returnToDataAfterMs > 0
  };

  /* ----------------------------------------------------------
     STYLES (injected, so no extra CSS file is needed)
     ---------------------------------------------------------- */
  const style = document.createElement("style");
  style.textContent = `
    html.idle-on, html.idle-on * { cursor: none !important; }
    #idleSlideshow {
      position: fixed; inset: 0; z-index: 99999; overflow: hidden;
      background: #050b09; color: #fff; font-family: Inter, sans-serif;
      opacity: 0; transition: opacity .6s ease;
    }
    #idleSlideshow.on { opacity: 1; }
    #idleSlideshow .idle-layer {
      position: absolute; inset: 0; background-size: cover; background-position: center;
      opacity: 0; transform: scale(1.06);
      transition: opacity 1.2s ease, transform 9s ease-out;
    }
    #idleSlideshow .idle-layer.show { opacity: 1; transform: scale(1); }
    #idleSlideshow .idle-shade {
      position: absolute; inset: 0;
      background:
        linear-gradient(to top, rgba(0,0,0,.7), transparent 38%),
        linear-gradient(to bottom, rgba(0,0,0,.45), transparent 22%);
    }
    #idleSlideshow .idle-tag {
      position: absolute; top: 3vh; left: 3vw; display: flex; flex-direction: column; gap: .3vh;
      padding: 1.2vh 1.8vw; border-radius: 1.2vh;
      background: var(--tag, #0b6e4f); color: var(--tagText, #fff);
      box-shadow: 0 .6vh 2.4vh rgba(0,0,0,.4);
    }
    #idleSlideshow .idle-tag b { font-size: clamp(20px, 2.4vw, 46px); letter-spacing: .06em; }
    #idleSlideshow .idle-tag small { font-size: clamp(12px, 1.2vw, 24px); opacity: .92; font-weight: 500; }
    #idleSlideshow .idle-caption {
      position: absolute; left: 3vw; right: 3vw; bottom: 6vh;
      font-size: clamp(18px, 2.2vw, 42px); font-weight: 700; text-shadow: 0 .3vh 1.6vh rgba(0,0,0,.6);
    }
    #idleSlideshow .idle-brand {
      position: absolute; right: 3vw; bottom: 2.4vh; opacity: .75;
      font-size: clamp(10px, .9vw, 17px); letter-spacing: .04em;
    }
    #idleSlideshow .idle-bar { position: absolute; left: 0; right: 0; bottom: 0; height: .6vh; background: rgba(255,255,255,.18); }
    #idleSlideshow .idle-bar i { display: block; height: 100%; width: 0; background: #fff; }
    #idleSlideshow .idle-bar i.run { width: 100%; transition: width var(--slide, 8000ms) linear; }
  `;
  document.head.appendChild(style);

  /* ----------------------------------------------------------
     HELPERS
     ---------------------------------------------------------- */
  // One photo from each project in turn, so every project gets equal screen time
  function interleave(photos) {
    const groups = {};
    photos.forEach((p) => (groups[p.code] = groups[p.code] || []).push(p));
    const lists = Object.values(groups);
    const out = [];
    const longest = Math.max(0, ...lists.map((l) => l.length));
    for (let i = 0; i < longest; i++) lists.forEach((l) => l[i] && out.push(l[i]));
    return out;
  }

  // Dark text on light tag colours (e.g. the yellow AFDP tag)
  function textColorFor(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ""));
    if (!m) return "#fff";
    const n = parseInt(m[1], 16);
    const lum = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
    return lum > 0.68 ? "#1f2937" : "#fff";
  }

  /* ----------------------------------------------------------
     SLIDESHOW
     ---------------------------------------------------------- */
  let overlay = null;
  let layers = [];
  let active = false;
  let slides = [];
  let position = 0; // where to continue next time, so it does not always start on the same photo
  let slideTimer = null;
  let idleTimer = null;
  let returnTimer = null;
  let token = 0; // changes on every activity, so a slow start can tell it has been cancelled
  let failStreak = 0;

  function showSlide(i) {
    if (!active) return;

    const photo = slides[i % slides.length];
    const probe = new Image();

    probe.onload = () => {
      if (!active) return;
      failStreak = 0;
      position = i + 1;

      const next = layers[i % 2];
      const prev = layers[(i + 1) % 2];
      next.style.backgroundImage = `url("${encodeURI(photo.src)}")`;
      next.classList.add("show");
      prev.classList.remove("show");

      const tag = overlay.querySelector(".idle-tag");
      tag.style.setProperty("--tag", photo.color);
      tag.style.setProperty("--tagText", textColorFor(photo.color));
      tag.querySelector("b").textContent = photo.code;
      tag.querySelector("small").textContent = photo.name;
      overlay.querySelector(".idle-caption").textContent = photo.caption;

      const bar = overlay.querySelector(".idle-bar i");
      bar.classList.remove("run");
      void bar.offsetWidth;
      bar.style.setProperty("--slide", CONFIG.slideMs + "ms");
      bar.classList.add("run");

      slideTimer = setTimeout(() => showSlide(i + 1), CONFIG.slideMs);
    };

    probe.onerror = () => {
      if (!active) return;
      failStreak++;
      if (failStreak > slides.length) return stop(); // nothing loads: give the dashboard back
      slideTimer = setTimeout(() => showSlide(i + 1), 300);
    };

    probe.src = encodeURI(photo.src);
  }

  async function start() {
    if (active) return;
    const myToken = token;

    let photos = [];
    try {
      photos = window.ProjectGallery ? await window.ProjectGallery.all() : [];
    } catch (error) {
      console.warn("idle-slideshow: could not read the photo list", error);
    }

    // Activity happened while the list was loading, or there is nothing to show
    if (myToken !== token || active) return;
    if (!photos.length) return armTimer();

    slides = interleave(photos);
    active = true;
    failStreak = 0;

    overlay = document.createElement("div");
    overlay.id = "idleSlideshow";
    overlay.innerHTML = `
      <div class="idle-layer"></div>
      <div class="idle-layer"></div>
      <div class="idle-shade"></div>
      <div class="idle-tag"><b></b><small></small></div>
      <div class="idle-caption"></div>
      <div class="idle-brand">IFAD Tanzania · Programme Management Office</div>
      <div class="idle-bar"><i></i></div>`;
    document.body.appendChild(overlay);
    layers = [...overlay.querySelectorAll(".idle-layer")];
    document.documentElement.classList.add("idle-on");
    requestAnimationFrame(() => overlay.classList.add("on"));

    showSlide(position % slides.length);

    if (CONFIG.returnToDataAfterMs > 0) {
      returnTimer = setTimeout(() => {
        stop();
        idleTimer = setTimeout(start, CONFIG.dataPeekMs);
      }, CONFIG.returnToDataAfterMs);
    }
  }

  function stop() {
    if (!active) return;
    active = false;
    clearTimeout(slideTimer);
    clearTimeout(returnTimer);
    document.documentElement.classList.remove("idle-on");

    const old = overlay;
    overlay = null;
    old.classList.remove("on");
    setTimeout(() => old.remove(), 650);
  }

  function armTimer() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(start, CONFIG.idleMs);
  }

  /* ----------------------------------------------------------
     ACTIVITY DETECTION
     ---------------------------------------------------------- */
  let lastX = null;
  let lastY = null;

  function onActivity(event) {
    if (event.type === "mousemove") {
      // Browsers fire a "fake" mousemove when the page changes under a still cursor; ignore those
      const moved =
        lastX === null || Math.abs(event.screenX - lastX) > 2 || Math.abs(event.screenY - lastY) > 2;
      lastX = event.screenX;
      lastY = event.screenY;
      if (!moved) return;
    }

    token++;
    clearTimeout(returnTimer);
    if (active) stop();
    armTimer();
  }

  ["mousemove", "mousedown", "wheel", "keydown", "touchstart", "pointerdown"].forEach((name) =>
    window.addEventListener(name, onActivity, { passive: true }),
  );

  armTimer();
})();

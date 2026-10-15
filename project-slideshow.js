// project-slideshow.js — tagged image galleries on all project cards
(function () {
  const CONFIG = {
    interval: 5000,        // ms per slide
    stagger: 1500,         // offset between cards so they don't all change together
    galleryMs: 20000,      // active projects: how long the gallery shows
    statsMs: 12000,        // active projects: how long the stats show
    projects: {
      'C-SDTP': {
        name: 'Climate-Smart Smallholder Dairy',
        color: '#2e5e2f',
        images: [
          { src: 'assets/projects/c-sdtp/1.jpg', caption: 'Smallholder dairy farmers' },
          { src: 'assets/projects/c-sdtp/2.jpg', caption: 'Milk collection centres' },
          { src: 'assets/projects/c-sdtp/3.jpg', caption: 'Women and youth in dairy' }
        ]
      },
      'AFDP': {
        name: 'Agriculture & Fisheries Development',
        color: '#d9a400',
        images: [
          { src: 'assets/projects/afdp/1.jpg', caption: 'Crop and seed production' },
          { src: 'assets/projects/afdp/2.jpg', caption: 'Fisheries and aquaculture' },
          { src: 'assets/projects/afdp/3.jpg', caption: 'Value addition' }
        ]
      },
      'BBT': {
        name: 'Building a Better Tomorrow – Coffee',
        color: '#e67e22',
        images: [
          { src: 'assets/projects/bbt/1.jpg', caption: 'Coffee farmers' },
          { src: 'assets/projects/bbt/2.jpg', caption: 'Coffee processing' },
          { src: 'assets/projects/bbt/3.jpg', caption: 'Smallholder cooperatives' }
        ]
      },
      'TFSRP-H': {
        name: 'Food Systems Resilience – Horticulture',
        color: '#3b82f6',
        images: [
          { src: 'assets/projects/tfsrp-h/1.jpg', caption: 'Horticulture production' },
          { src: 'assets/projects/tfsrp-h/2.jpg', caption: 'Market access' },
          { src: 'assets/projects/tfsrp-h/3.jpg', caption: 'Climate-resilient farming' }
        ]
      }
    }
  };

  const norm = el => el.textContent.replace(/\s+/g, ' ');
  const isDesignStage = card => /Design Stage/i.test(norm(card)) || /Progress\s*0%/i.test(norm(card));

  // Walk up from the project code to the smallest ancestor that looks like a project card
  function findCard(code) {
    const leaves = [...document.querySelectorAll('*')].filter(
      el => el.children.length === 0 && el.textContent.trim() === code
    );
    for (const leaf of leaves) {
      let el = leaf.parentElement;
      while (el && el !== document.body) {
        const t = norm(el);
        if (/Progress/i.test(t) && /Duration/i.test(t) && /Investment/i.test(t)) return el;
        el = el.parentElement;
      }
    }
    return null;
  }

  function buildOverlay(card, code, cfg, delay) {
    const progressLabel = [...card.querySelectorAll('*')].find(
      el => el.children.length === 0 && /^Progress$/i.test(el.textContent.trim())
    );
    const top = progressLabel
      ? progressLabel.getBoundingClientRect().top - card.getBoundingClientRect().top - 4
      : 90;

    if (getComputedStyle(card).position === 'static') card.style.position = 'relative';

    const overlay = document.createElement('div');
    overlay.className = 'ps-overlay';
    overlay.style.top = top + 'px';
    overlay.innerHTML = `
      <span class="ps-tag" style="--tag:${cfg.color}">
        <b>${code}</b><small>${cfg.name}</small>
      </span>
      <div class="ps-caption"></div>
      <div class="ps-dots"></div>`;
    card.appendChild(overlay);

    const captionEl = overlay.querySelector('.ps-caption');
    const dotsEl = overlay.querySelector('.ps-dots');
    const slides = [];
    let index = 0;

    function show(i) {
      index = i;
      slides.forEach((s, n) => s.classList.toggle('active', n === i));
      [...dotsEl.children].forEach((d, n) => d.classList.toggle('active', n === i));
      captionEl.textContent = slides[i] ? slides[i].dataset.caption : '';
    }

    cfg.images.forEach(img => {
      const probe = new Image();
      probe.onload = () => {
        const slide = document.createElement('div');
        slide.className = 'ps-slide';
        slide.style.backgroundImage = `url("${img.src}")`;
        slide.dataset.caption = img.caption || '';
        overlay.insertBefore(slide, overlay.firstChild);
        slides.push(slide);
        dotsEl.appendChild(document.createElement('span'));
        if (slides.length === 1) show(0);
      };
      probe.onerror = () => console.warn('Slideshow image missing:', img.src);
      probe.src = img.src;
    });

    // Slide rotation
    setTimeout(() => {
      const timer = setInterval(() => {
        if (!overlay.isConnected) return clearInterval(timer);
        if (slides.length > 1) show((index + 1) % slides.length);
      }, CONFIG.interval);
    }, delay);

    // Gallery <-> stats alternation for projects that are no longer in design stage
    (function cycle(galleryVisible) {
      if (!overlay.isConnected) return;
      if (isDesignStage(card)) {
        overlay.classList.remove('ps-hidden');
        return setTimeout(() => cycle(true), 5000);
      }
      overlay.classList.toggle('ps-hidden', !galleryVisible);
      setTimeout(() => cycle(!galleryVisible), galleryVisible ? CONFIG.galleryMs : CONFIG.statsMs);
    })(true);
  }

  function sync() {
    let n = 0;
    Object.entries(CONFIG.projects).forEach(([code, cfg]) => {
      const card = findCard(code);
      if (card && !card.querySelector(':scope > .ps-overlay')) {
        buildOverlay(card, code, cfg, CONFIG.stagger * n);
      }
      n++;
    });
  }

  // Cards are re-rendered on every Google Sheets sync, so re-check on DOM changes
  let debounce;
  new MutationObserver(() => {
    clearTimeout(debounce);
    debounce = setTimeout(sync, 400);
  }).observe(document.body, { childList: true, subtree: true });

  window.addEventListener('load', () => setTimeout(sync, 800));
})();

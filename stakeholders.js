/* stakeholders.js - compact stakeholder panel with logos. Load AFTER script.js (no edits to script.js needed).
   It replaces renderStakeholders(); the Google Sheet fetch in script.js is unchanged.
   Optional sheet column "Logo": a file name saved in assets/stakeholders/ (e.g. afd.png) or a full image URL. */
(function () {
  "use strict";

  var ROTATE_MS = 4500; // spotlight moves to the next stakeholder
  var PROJECT_MS = 20000; // "All Projects": switch project this often
  var PAUSE_MS = 20000; // pause after a click
  var LOGO_DIR = "assets/stakeholders/";
  var PALETTE = [
    "#0b6e4f",
    "#3b82f6",
    "#8b5cf6",
    "#ef7d2d",
    "#e0ab1f",
    "#0ea5a4",
    "#db2777",
    "#64748b",
  ];
  var catIdx = {};
  var V = {
    groups: [],
    gi: 0,
    si: 0,
    hover: false,
    pauseUntil: 0,
    rot: null,
    proj: null,
    multi: false,
  };

  function catColor(c) {
    var k = String(c || "Other")
      .toLowerCase()
      .trim();
    if (!(k in catIdx)) catIdx[k] = Object.keys(catIdx).length;
    return PALETTE[catIdx[k] % PALETTE.length];
  }
  function initials(name) {
    var w = String(name)
      .replace(/\(.*?\)/g, "")
      .split(/[\s\-\/&,]+/)
      .filter(function (x) {
        return x && !/^(of|and|the|for|de|la)$/i.test(x);
      });
    if (w.length > 1) return (w[0][0] + w[1][0]).toUpperCase();
    return String(w[0] || "?")
      .slice(0, 3)
      .toUpperCase();
  }
  function logoSrc(v) {
    if (!v) return "";
    return /^(https?:|\/|\.\/|assets\/)/i.test(v) ? v : LOGO_DIR + v;
  }
  function model(row) {
    var name =
      getRowValue(row, [
        "Stakeholder",
        "Stakeholder Name",
        "Organisation",
        "Organization",
        "Institution",
        "Partner",
        "Partner Name",
        "Name",
      ]) || "Unnamed stakeholder";
    var cat =
      getRowValue(row, [
        "Category",
        "Stakeholder Category",
        "Type",
        "Stakeholder Type",
        "Partner Type",
      ]) || "Partner";
    return {
      name: name,
      cat: cat,
      color: catColor(cat),
      ini: initials(name),
      role: getRowValue(row, [
        "Role",
        "Responsibility",
        "Description",
        "Function",
      ]),
      eng: getRowValue(row, ["Engagement", "Engagement Level"]),
      inf: getRowValue(row, ["Influence", "Influence Level"]),
      status: getRowValue(row, ["Status", "Status Label"]),
      next: getRowValue(row, [
        "Next Action",
        "NextAction",
        "Next Step",
        "NextStep",
        "Action",
      ]),
      logo: logoSrc(
        getRowValue(row, ["Logo", "Logo File", "Logo URL", "Image"]),
      ),
    };
  }
  function avatar(it, big) {
    return (
      '<span class="sh-av' +
      (big ? " big" : "") +
      '" style="--cc:' +
      escapeHtml(it.color) +
      '">' +
      escapeHtml(it.ini) +
      (it.logo
        ? '<img src="' +
          escapeHtml(it.logo) +
          '" alt="" onerror="this.remove()">'
        : "") +
      "</span>"
    );
  }

  /* ---------- build groups ---------- */
  function build(filter) {
    var rows = typeof stakeholderRows !== "undefined" ? stakeholderRows : [];
    if (filter && filter !== "ALL")
      rows = rows.filter(function (r) {
        return (
          normalizeProjectKey(getStakeholderProject(r)) ===
          normalizeProjectKey(filter)
        );
      });
    var map = new Map();
    rows.forEach(function (r) {
      var p = getStakeholderProject(r);
      if (!map.has(p)) map.set(p, []);
      map.get(p).push(model(r));
    });
    return Array.from(map.entries()).map(function (e) {
      var cats = new Map();
      e[1].forEach(function (it) {
        if (!cats.has(it.cat)) cats.set(it.cat, []);
        cats.get(it.cat).push(it);
      });
      var items = [];
      cats.forEach(function (a) {
        items = items.concat(a);
      }); // visual order = rotation order
      return {
        project: e[0],
        color: getProjectColor(e[0]),
        items: items,
        cats: Array.from(cats.entries()),
      };
    });
  }

  /* ---------- paint ---------- */
  function spotHTML(it, g) {
    var st = it.status
      ? '<span class="sh-chip st-' +
        escapeHtml(toStatusClass(it.status)) +
        '">' +
        escapeHtml(it.status) +
        "</span>"
      : "";
    return (
      '<div class="sh-spot-in"><div class="sh-spot-top">' +
      avatar(it, true) +
      '<div class="sh-spot-id"><strong>' +
      escapeHtml(it.name) +
      "</strong>" +
      (it.role ? "<span>" + escapeHtml(it.role) + "</span>" : "") +
      "</div></div>" +
      '<div class="sh-chips"><span class="sh-chip" style="--cc:' +
      escapeHtml(it.color) +
      '"><i></i>' +
      escapeHtml(it.cat) +
      "</span>" +
      (it.eng
        ? '<span class="sh-chip"><small>Engagement</small> ' +
          escapeHtml(it.eng) +
          "</span>"
        : "") +
      (it.inf
        ? '<span class="sh-chip"><small>Influence</small> ' +
          escapeHtml(it.inf) +
          "</span>"
        : "") +
      st +
      "</div>" +
      (it.next
        ? '<div class="sh-next"><span>Next action</span><strong>' +
          escapeHtml(it.next) +
          "</strong></div>"
        : "") +
      '<em class="sh-counter">' +
      (V.si + 1) +
      " / " +
      g.items.length +
      "</em></div>"
    );
  }
  function spot() {
    var el = document.getElementById("stakeholders"),
      g = V.groups[V.gi];
    if (!el || !g) return;
    var box = el.querySelector(".sh-spot");
    if (!box) return;
    box.innerHTML = spotHTML(g.items[V.si], g);
    el.querySelectorAll(".sh-tile").forEach(function (t) {
      t.classList.toggle("on", +t.dataset.i === V.si);
    });
    var wall = el.querySelector(".sh-wall"),
      on = el.querySelector(".sh-tile.on"); // keep the active tile in view
    if (
      wall &&
      on &&
      (on.offsetTop < wall.scrollTop ||
        on.offsetTop + on.offsetHeight > wall.scrollTop + wall.clientHeight)
    )
      wall.scrollTop = Math.max(0, on.offsetTop - 18);
  }
  function paint() {
    var el = document.getElementById("stakeholders"),
      g = V.groups[V.gi];
    if (!el || !g) return;
    var total = g.items.length,
      idx = 0;
    var mix = g.cats
      .map(function (c) {
        return (
          '<i style="width:' +
          ((c[1].length / total) * 100).toFixed(1) +
          "%;background:" +
          escapeHtml(c[1][0].color) +
          '" title="' +
          escapeHtml(c[0]) +
          " (" +
          c[1].length +
          ')"></i>'
        );
      })
      .join("");
    var wall = g.cats
      .map(function (c) {
        return (
          '<div class="sh-grp"><div class="sh-gl" style="--cc:' +
          escapeHtml(c[1][0].color) +
          '"><i></i>' +
          escapeHtml(c[0]) +
          " &middot; " +
          c[1].length +
          '</div><div class="sh-tiles">' +
          c[1]
            .map(function (it) {
              var i = idx++;
              return (
                '<button class="sh-tile" data-i="' +
                i +
                '" title="' +
                escapeHtml(it.name) +
                '">' +
                avatar(it) +
                "<small>" +
                escapeHtml(it.name) +
                "</small></button>"
              );
            })
            .join("") +
          "</div></div>"
        );
      })
      .join("");
    var pills = V.multi
      ? '<div class="sh-pills">' +
        V.groups
          .map(function (x, i) {
            return (
              '<button class="sh-pill' +
              (i === V.gi ? " on" : "") +
              '" data-g="' +
              i +
              '" style="--pc:' +
              escapeHtml(x.color) +
              '">' +
              escapeHtml(x.project) +
              "</button>"
            );
          })
          .join("") +
        "</div>"
      : "";
    el.innerHTML =
      '<div class="sh-card" style="--pc:' +
      escapeHtml(g.color) +
      '"><div class="sh-top"><div class="sh-name"><i class="sh-dot"></i><h3>' +
      escapeHtml(g.project) +
      '</h3><span class="sh-count">' +
      total +
      " stakeholder" +
      (total === 1 ? "" : "s") +
      "</span></div>" +
      pills +
      '<div class="sh-mix">' +
      mix +
      "</div></div>" +
      '<div class="sh-main"><div class="sh-wall">' +
      wall +
      '</div><div class="sh-spot"></div></div></div>';
    el.classList.add("populated");
    spot();
  }

  /* ---------- timers + events ---------- */
  function idle() {
    return V.hover || Date.now() < V.pauseUntil;
  }
  function stop() {
    clearInterval(V.rot);
    clearInterval(V.proj);
    V.rot = V.proj = null;
  }
  function start() {
    stop();
    V.rot = setInterval(function () {
      var g = V.groups[V.gi];
      if (idle() || !g || g.items.length < 2) return;
      V.si = (V.si + 1) % g.items.length;
      spot();
    }, ROTATE_MS);
    if (V.multi)
      V.proj = setInterval(function () {
        if (idle()) return;
        V.gi = (V.gi + 1) % V.groups.length;
        V.si = 0;
        paint();
      }, PROJECT_MS);
  }
  function bind(el) {
    el.onmouseenter = function () {
      V.hover = true;
    };
    el.onmouseleave = function () {
      V.hover = false;
    };
    el.onclick = function (e) {
      var t = e.target.closest(".sh-tile"),
        p = e.target.closest(".sh-pill");
      if (t) {
        V.si = +t.dataset.i;
        V.pauseUntil = Date.now() + PAUSE_MS;
        spot();
      }
      if (p) {
        V.gi = +p.dataset.g;
        V.si = 0;
        V.pauseUntil = Date.now() + PAUSE_MS;
        paint();
      }
    };
  }

  window.renderStakeholders = function (filter) {
    var el = document.getElementById("stakeholders");
    if (!el) return;
    if (typeof stopStakeholderRotation === "function")
      stopStakeholderRotation(); // switch off the old rotation
    stop();
    V.groups = build(filter);
    V.gi = 0;
    V.si = 0;
    V.multi = V.groups.length > 1;
    if (!V.groups.length) {
      el.innerHTML = '<div class="empty-state">No stakeholders found.</div>';
      return;
    }
    bind(el);
    paint();
    start();
  };
})();

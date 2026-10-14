/* disbursements.js - Disbursement & Contracts panel for the Project Portfolio Command Centre
   Load AFTER script.js (and after awpb.js). Reads CONFIG.DISBURSEMENTS_CSV_URL and CONFIG.SYNC_MINUTES from script.js.
   Uses the dashboard's own getSheetRows / getRowValue / parseNumber / getProjectColor.

   Sheet columns used (same tab as before, no changes needed):
   Project | Current IFAD Amount | Cumulative Disbursed | Remaining Balance | Yearly Envelope |
   Disbursed YTD | Open Contracts | Contracts Value | Planned Contract Payments

   MOUNT: put <div id="disbursement-panel"></div> inside the Disbursement card in index.html.
   If that div is missing, the panel takes over the card that holds the old project dropdown / chart. */
(function () {
  "use strict";

  var MOUNT_ID = "disbursement-panel";
  var cfg = typeof CONFIG !== "undefined" ? CONFIG : {};
  var URL = cfg.DISBURSEMENTS_CSV_URL || "";
  var REFRESH_MS = (cfg.SYNC_MINUTES || 5) * 60 * 1000;
  var ACCENT = "#0b6e4f";

  var state = { rows: [], project: "PORTFOLIO", updated: "", failed: false };

  var ALIASES = {
    project: ["Project", "Project Name", "ProjectName", "Programme", "Program"],
    current: [
      "Current IFAD Amount",
      "Current IFAD",
      "IFAD Amount",
      "Current Amount",
      "Approved Amount",
      "Financing Amount",
      "Total Financing",
      "IFAD Financing",
    ],
    cumulative: [
      "Cumulative Disbursed",
      "Cumulative Disbursement",
      "Cumulative",
      "Disbursed",
      "Disbursed Amount",
      "Total Disbursed",
    ],
    remaining: [
      "Remaining Balance",
      "Remaining",
      "Balance",
      "Undisbursed",
      "Undisbursed Balance",
    ],
    envelope: [
      "Yearly Envelope",
      "Annual Envelope",
      "Annual Allocation",
      "Yearly Allocation",
      "Yearly",
    ],
    ytd: ["Disbursed YTD", "YTD Disbursed", "YTD", "Disbursement YTD"],
    contracts: [
      "Open Contracts",
      "Contracts",
      "Number of Contracts",
      "Active Contracts",
    ],
    contractValue: [
      "Contracts Value",
      "Contract Value",
      "Total Contract Value",
    ],
    planned: [
      "Planned Contract Payments",
      "Planned Payments",
      "Planned Payment",
      "Planned",
    ],
  };
  var NUMERIC = [
    "current",
    "cumulative",
    "remaining",
    "envelope",
    "ytd",
    "contracts",
    "contractValue",
    "planned",
  ];

  /* ---------- helpers ---------- */
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function money(v) {
    if (!v) return "\u2014";
    var a = Math.abs(v);
    if (a >= 1e9) return "$" + (v / 1e9).toFixed(2) + "B";
    if (a >= 1e6) return "$" + (v / 1e6).toFixed(2) + "M";
    if (a >= 1e3) return "$" + (v / 1e3).toFixed(0) + "K";
    return "$" + Math.round(v);
  }
  function pct(r) {
    return r == null || !isFinite(r) ? "\u2014" : (r * 100).toFixed(1) + "%";
  }
  function whole(v) {
    return v ? Math.round(v).toLocaleString() : "\u2014";
  }
  function clamp01(r) {
    return Math.min(Math.max(isFinite(r) ? r : 0, 0), 1);
  }
  function toRecord(row) {
    var o = {
      project: getRowValue(row, ALIASES.project),
    };
    NUMERIC.forEach(function (k) {
      o[k] = parseNumber(getRowValue(row, ALIASES[k]));
    });
    return o;
  }
  function hasData(o) {
    return NUMERIC.some(function (k) {
      return o[k];
    });
  }
  function add(rows) {
    var t = {};
    NUMERIC.forEach(function (k) {
      t[k] = rows.reduce(function (s, r) {
        return s + r[k];
      }, 0);
    });
    return t;
  }
  /* fill gaps: total financing = disbursed + remaining when the sheet leaves it blank */
  function derive(o) {
    var t = {};
    Object.keys(o).forEach(function (k) {
      t[k] = o[k];
    });
    if (!t.current) t.current = t.cumulative + t.remaining;
    if (!t.remaining && t.current > t.cumulative)
      t.remaining = t.current - t.cumulative;
    t.rate = t.current ? t.cumulative / t.current : null;
    t.envUse = t.envelope ? t.ytd / t.envelope : null;
    t.avg = t.contracts ? t.contractValue / t.contracts : 0;
    t.committed = t.remaining ? t.contractValue / t.remaining : null;
    t.plannedShare = t.remaining ? t.planned / t.remaining : null;
    return t;
  }
  function color(name) {
    return typeof getProjectColor === "function"
      ? getProjectColor(name)
      : ACCENT;
  }

  /* ---------- pieces ---------- */
  function ring(p) {
    var C = 2 * Math.PI * 48;
    return (
      '<svg viewBox="0 0 120 120" aria-hidden="true">' +
      '<circle cx="60" cy="60" r="48" fill="none" stroke="#e5ece9" stroke-width="12"/>' +
      '<circle cx="60" cy="60" r="48" fill="none" stroke="' +
      ACCENT +
      '" stroke-width="12" stroke-linecap="round" transform="rotate(-90 60 60)" stroke-dasharray="' +
      (C * clamp01(p)).toFixed(1) +
      " " +
      C.toFixed(1) +
      '"/></svg>'
    );
  }
  function tile(label, value, sub, tone) {
    return (
      '<div class="dv-tile' +
      (tone ? " " + tone : "") +
      '"><span>' +
      esc(label) +
      "</span><b>" +
      esc(value) +
      "</b>" +
      (sub ? "<small>" + esc(sub) + "</small>" : "") +
      "</div>"
    );
  }
  function bar(label, detail, ratio, tone) {
    return (
      '<div class="dv-bar' +
      (tone ? " " + tone : "") +
      '"><div class="dv-bar-top"><span>' +
      esc(label) +
      "</span><em>" +
      esc(detail) +
      '</em></div><div class="dv-track"><div class="dv-fill" style="width:' +
      (clamp01(ratio) * 100).toFixed(1) +
      '%"></div></div></div>'
    );
  }
  function projectRow(r) {
    var t = derive(r),
      col = color(r.project);
    return (
      '<div class="dv-pr"><div class="dv-pr-top"><span class="dv-dot" style="background:' +
      esc(col) +
      '"></span><b>' +
      esc(r.project) +
      "</b><em>" +
      pct(t.rate) +
      ' disbursed</em></div><div class="dv-track"><div class="dv-fill" style="background:' +
      esc(col) +
      ";width:" +
      (clamp01(t.rate) * 100).toFixed(1) +
      '%"></div></div><div class="dv-pr-meta"><span>' +
      money(t.cumulative) +
      " of " +
      money(t.current) +
      "</span><span>YTD " +
      money(t.ytd) +
      "</span><span>" +
      whole(t.contracts) +
      " contracts &middot; " +
      money(t.contractValue) +
      "</span></div></div>"
    );
  }

  /* ---------- render ---------- */
  function render() {
    var el = mount();
    if (!el) return;

    var all = state.rows;
    var sel =
      state.project === "PORTFOLIO"
        ? all
        : all.filter(function (r) {
            return r.project === state.project;
          });

    var head =
      '<div class="dv-head"><h2>&#128176; Disbursement &amp; Contracts</h2>' +
      '<select id="dv-select" aria-label="Project">' +
      '<option value="PORTFOLIO"' +
      (state.project === "PORTFOLIO" ? " selected" : "") +
      ">Portfolio</option>" +
      all
        .map(function (r) {
          return (
            '<option value="' +
            esc(r.project) +
            '"' +
            (r.project === state.project ? " selected" : "") +
            ">" +
            esc(r.project) +
            "</option>"
          );
        })
        .join("") +
      "</select></div>";

    if (!sel.length) {
      el.innerHTML =
        '<div class="dv">' +
        head +
        '<div class="dv-empty">' +
        (state.failed
          ? "Disbursement data could not be loaded"
          : "No disbursement data yet") +
        "</div></div>";
      return;
    }

    var t = derive(add(sel));
    var envTone = t.envUse != null && t.envUse > 1 ? "warn" : "";

    var h = '<div class="dv">' + head;

    /* 1. DISBURSEMENT */
    h += '<div class="dv-sec">Disbursement</div>';
    h +=
      '<div class="dv-top"><div class="dv-ring">' +
      ring(t.rate) +
      '<div class="dv-ring-c"><b>' +
      pct(t.rate) +
      "</b><span>disbursed</span></div></div>" +
      '<div class="dv-tiles three">' +
      tile("IFAD financing", money(t.current), "total approved") +
      tile("Disbursed to date", money(t.cumulative), "", "good") +
      tile("Remaining balance", money(t.remaining), "still to disburse") +
      "</div></div>";
    if (t.envelope) {
      h += bar(
        "Disbursed this year vs yearly envelope",
        money(t.ytd) +
          " / " +
          money(t.envelope) +
          " \u00b7 " +
          pct(t.envUse) +
          (envTone ? " \u00b7 envelope reached" : ""),
        t.envUse,
        envTone,
      );
    }

    /* 2. CONTRACTS */
    h += '<div class="dv-sec">Contracts</div>';
    h +=
      '<div class="dv-tiles four">' +
      tile("Open contracts", whole(t.contracts)) +
      tile("Contracts value", money(t.contractValue)) +
      tile("Average contract", money(t.avg)) +
      tile("Planned payments", money(t.planned), "upcoming") +
      "</div>";
    if (t.remaining) {
      h += bar(
        "Contracts value vs remaining balance",
        money(t.contractValue) +
          " / " +
          money(t.remaining) +
          " \u00b7 " +
          pct(t.committed),
        t.committed,
      );
      h += bar(
        "Planned payments vs remaining balance",
        money(t.planned) + " / " + money(t.remaining) + " \u00b7 " + pct(t.plannedShare),
        t.plannedShare,
      );
    }

    /* 3. BY PROJECT (portfolio view only) */
    if (state.project === "PORTFOLIO" && all.length > 1) {
      h +=
        '<div class="dv-sec">By project</div>' +
        all.map(projectRow).join("");
    }

    h +=
      '<div class="dv-foot">' +
      (state.updated ? "Updated " + esc(state.updated) : "") +
      (state.failed ? " \u00b7 showing last data" : "") +
      "</div></div>";

    el.innerHTML = h;
  }

  /* ---------- mount (explicit div, else take over the old card) ---------- */
  var mountEl = null;
  function mount() {
    if (mountEl && document.body.contains(mountEl)) return mountEl;
    var m = document.getElementById(MOUNT_ID);
    if (!m) {
      var anchor =
        document.getElementById("disbursementProjectSelect") ||
        document.getElementById("disbursementChart") ||
        document.getElementById("disb-cumulative");
      var card =
        anchor &&
        anchor.closest(".panel, .card, .dashboard-card, section, article");
      if (card) {
        card.innerHTML = '<div id="' + MOUNT_ID + '"></div>';
        m = document.getElementById(MOUNT_ID);
      }
    }
    if (m && !m.__dvBound) {
      m.__dvBound = true;
      m.addEventListener("change", function (e) {
        if (e.target && e.target.id === "dv-select") {
          state.project = e.target.value;
          render();
        }
      });
    }
    mountEl = m || null;
    return mountEl;
  }

  /* ---------- data ---------- */
  function stamp() {
    var d = new Date();
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  function load() {
    if (!URL) return Promise.resolve();
    return getSheetRows(URL)
      .then(function (rows) {
        state.rows = rows.map(toRecord).filter(function (r) {
          return r.project && hasData(r);
        });
        if (
          state.project !== "PORTFOLIO" &&
          !state.rows.some(function (r) {
            return r.project === state.project;
          })
        )
          state.project = "PORTFOLIO";
        state.failed = false;
        state.updated = stamp();
      })
      .catch(function (e) {
        console.warn("Disbursement panel sync failed, keeping last data:", e);
        state.failed = true;
      })
      .then(render);
  }

  function init() {
    render();
    load();
    setInterval(load, REFRESH_MS);
  }
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", init);
  else init();
})();

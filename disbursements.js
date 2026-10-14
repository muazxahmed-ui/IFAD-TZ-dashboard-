/* disbursements.js - Disbursement & Contracts panel for the Project Portfolio Command Centre
   Load AFTER script.js. Reads CONFIG.DISBURSEMENTS_CSV_URL and CONFIG.SYNC_MINUTES from script.js.
   Uses the dashboard's own getSheetRows / getRowValue / parseNumber / getProjectColor.

   SELF-CONTAINED: this file injects its own styles (classes start with "dx-"), so nothing needs to be
   added to styles.css and a cached stylesheet cannot break it. The old "dv-" block in styles.css can be deleted.

   Sheet columns used (same tab as before):
   Project | Current IFAD Amount | Cumulative Disbursed | Remaining Balance | Yearly Envelope |
   Disbursed YTD | Open Contracts | Contracts Value | Planned Contract Payments

   MOUNT: <div id="disbursement-panel"></div> inside the Disbursement card in index.html. */
(function () {
  "use strict";

  var MOUNT_ID = "disbursement-panel";
  var cfg = typeof CONFIG !== "undefined" ? CONFIG : {};
  var URL = cfg.DISBURSEMENTS_CSV_URL || "";
  var REFRESH_MS = (cfg.SYNC_MINUTES || 5) * 60 * 1000;
  var ACCENT = "#0b6e4f";

  var state = { rows: [], project: "PORTFOLIO", updated: "", failed: false };

  /* ---------- styles (injected once; narrow-first, widens via container query) ---------- */
  var CSS = `
.dx{container-type:inline-size;display:flex;flex-direction:column;gap:9px;min-width:0;color:#172033;font-family:Inter,sans-serif}
.dx *{box-sizing:border-box}
.dx-head{display:flex;align-items:center;justify-content:space-between;gap:8px}
.dx-head h2{margin:0 !important}
.dx-head select{appearance:none;-webkit-appearance:none;-moz-appearance:none;font:600 9px Inter,sans-serif;color:#172033;min-height:28px;max-width:55%;cursor:pointer;border:1px solid #d6dee5;border-radius:8px;padding:6px 24px 6px 9px;background:#fbfcfd url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' fill='none' stroke='%23475569' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") no-repeat right 8px center}
.dx-sec{font-size:8px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#64748b;border-bottom:1px solid #e4eaf0;padding-bottom:3px;margin-top:2px}

.dx-top{display:flex;align-items:center;gap:12px}
.dx-ring{position:relative;flex:0 0 92px;width:92px;height:92px}
.dx-ring svg{width:100%;height:100%;display:block}
.dx-ring-c{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}
.dx-ring-c b{font-size:17px;font-weight:800;letter-spacing:-.4px;line-height:1}
.dx-ring-c span{font-size:8px;color:#697586;margin-top:3px}
.dx-fin{flex:1;min-width:0;display:flex;flex-direction:column;gap:5px}
.dx-fr{display:flex;justify-content:space-between;align-items:baseline;gap:8px;padding:6px 9px;background:#f8fafb;border:1px solid #e4eaf0;border-radius:9px;min-width:0}
.dx-fr span{font-size:8px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:#64748b;white-space:nowrap}
.dx-fr b{font-size:14px;font-weight:800;letter-spacing:-.2px;color:#172033;white-space:nowrap}
.dx-fr.good b{color:#0b6e4f}

.dx-tiles{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}
.dx-tile{display:flex;flex-direction:column;gap:2px;min-width:0;padding:7px 9px;background:#f8fafb;border:1px solid #e4eaf0;border-radius:9px}
.dx-tile span{font-size:8px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:#64748b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dx-tile b{font-size:14px;font-weight:800;letter-spacing:-.2px;color:#172033;line-height:1.15}
.dx-tile small{font-size:8px;color:#94a3b8}

.dx-bar{display:flex;flex-direction:column;gap:3px}
.dx-bar-top{display:flex;justify-content:space-between;gap:8px;font-size:9px}
.dx-bar-top span{font-weight:600;color:#334155}
.dx-bar-top em{font-style:normal;font-weight:700;color:#172033;text-align:right;font-variant-numeric:tabular-nums}
.dx-track{height:5px;border-radius:99px;background:#e5ece9;overflow:hidden}
.dx-fill{height:100%;border-radius:99px;background:#0b6e4f;transition:width .6s}
.dx-bar.warn .dx-fill{background:#d97706}
.dx-bar.warn .dx-bar-top em{color:#b45309}

.dx-pr{display:flex;flex-direction:column;gap:3px;padding:5px 0;border-bottom:1px dashed #e4eaf0}
.dx-pr:last-of-type{border-bottom:0}
.dx-pr-top{display:flex;align-items:center;gap:6px;font-size:10px}
.dx-pr-top b{font-weight:800}
.dx-pr-top em{margin-left:auto;font-style:normal;font-weight:700;color:#334155}
.dx-dot{width:8px;height:8px;border-radius:50%;flex:0 0 8px}
.dx-pr-meta{display:flex;flex-wrap:wrap;gap:2px 12px;font-size:8px;color:#697586}

.dx-foot{font-size:8px;color:#94a3b8;text-align:right}
.dx-empty{padding:26px 8px;text-align:center;color:#94a3b8;font-size:11px}

@container (min-width:560px){
  .dx-ring{flex-basis:112px;width:112px;height:112px}
  .dx-ring-c b{font-size:21px}
  .dx-tiles{grid-template-columns:repeat(4,minmax(0,1fr))}
  .dx-fin{flex-direction:row}
  .dx-fr{flex:1;flex-direction:column;align-items:flex-start;gap:3px}
}
`;
  function injectCss() {
    if (document.getElementById("dx-style")) return;
    var s = document.createElement("style");
    s.id = "dx-style";
    s.textContent = CSS;
    document.head.appendChild(s);
  }

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
    var o = { project: getRowValue(row, ALIASES.project) };
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
  function finRow(label, value, tone) {
    return (
      '<div class="dx-fr' +
      (tone ? " " + tone : "") +
      '"><span>' +
      esc(label) +
      "</span><b>" +
      esc(value) +
      "</b></div>"
    );
  }
  function tile(label, value, sub) {
    return (
      '<div class="dx-tile"><span>' +
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
      '<div class="dx-bar' +
      (tone ? " " + tone : "") +
      '"><div class="dx-bar-top"><span>' +
      esc(label) +
      "</span><em>" +
      esc(detail) +
      '</em></div><div class="dx-track"><div class="dx-fill" style="width:' +
      (clamp01(ratio) * 100).toFixed(1) +
      '%"></div></div></div>'
    );
  }
  function projectRow(r) {
    var t = derive(r),
      col = color(r.project);
    return (
      '<div class="dx-pr"><div class="dx-pr-top"><span class="dx-dot" style="background:' +
      esc(col) +
      '"></span><b>' +
      esc(r.project) +
      "</b><em>" +
      pct(t.rate) +
      ' disbursed</em></div><div class="dx-track"><div class="dx-fill" style="background:' +
      esc(col) +
      ";width:" +
      (clamp01(t.rate) * 100).toFixed(1) +
      '%"></div></div><div class="dx-pr-meta"><span>' +
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
    injectCss();

    var all = state.rows;
    var sel =
      state.project === "PORTFOLIO"
        ? all
        : all.filter(function (r) {
            return r.project === state.project;
          });

    var head =
      '<div class="dx-head"><h2>&#128176; Disbursement &amp; Contracts</h2>' +
      '<select id="dx-select" aria-label="Project">' +
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
        '<div class="dx">' +
        head +
        '<div class="dx-empty">' +
        (state.failed
          ? "Disbursement data could not be loaded"
          : "No disbursement data yet") +
        "</div></div>";
      return;
    }

    var t = derive(add(sel));
    var envTone = t.envUse != null && t.envUse > 1 ? "warn" : "";
    var h = '<div class="dx">' + head;

    /* 1. DISBURSEMENT */
    h += '<div class="dx-sec">Disbursement</div>';
    h +=
      '<div class="dx-top"><div class="dx-ring">' +
      ring(t.rate) +
      '<div class="dx-ring-c"><b>' +
      pct(t.rate) +
      "</b><span>disbursed</span></div></div>" +
      '<div class="dx-fin">' +
      finRow("IFAD financing", money(t.current)) +
      finRow("Disbursed to date", money(t.cumulative), "good") +
      finRow("Remaining balance", money(t.remaining)) +
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
    h += '<div class="dx-sec">Contracts</div>';
    h +=
      '<div class="dx-tiles">' +
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
        money(t.planned) +
          " / " +
          money(t.remaining) +
          " \u00b7 " +
          pct(t.plannedShare),
        t.plannedShare,
      );
    }

    /* 3. BY PROJECT (portfolio view only) */
    if (state.project === "PORTFOLIO" && all.length > 1) {
      h +=
        '<div class="dx-sec">By project</div>' + all.map(projectRow).join("");
    }

    h +=
      '<div class="dx-foot">' +
      (state.updated ? "Updated " + esc(state.updated) : "") +
      (state.failed ? " \u00b7 showing last data" : "") +
      "</div></div>";

    el.innerHTML = h;
  }

  /* ---------- mount ---------- */
  var mountEl = null;
  function mount() {
    if (mountEl && document.body.contains(mountEl)) return mountEl;
    var m = document.getElementById(MOUNT_ID);
    if (m && !m.__dxBound) {
      m.__dxBound = true;
      m.addEventListener("change", function (e) {
        if (e.target && e.target.id === "dx-select") {
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
    return new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
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

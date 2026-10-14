/* awpb.js - AWPB panel (replaces Portfolio Timeline) for the Project Portfolio Command Centre
   Load AFTER script.js. Reads AWPB_CSV_URL / AWPB_COMPONENTS_CSV_URL / SYNC_MINUTES from CONFIG in script.js.

   AWPB tab columns:  Project Code | FY | Quarter | Planned | Actual | Last Updated | Funds Received (optional)
   "Funds Received" is read from the Annual row only; when it is blank the Funds position section stays hidden. */
(function () {
  "use strict";

  var MOUNT_ID = "awpb-panel";
  var ROTATE_MS = 15000; // TV auto-cycle through projects (0 = off); a click pauses it for 60s
  var PROJECTS = [
    // order + accent colour (brightened for the dark card)
    { key: "csdtp", label: "C-SDTP", color: "#4f7942" },
    { key: "tfsrph", label: "Food Systems", color: "#3b82f6" },
    { key: "bbt", label: "BBT Coffee", color: "#ef7d2d" },
    { key: "afdp", label: "AFDP", color: "#e0ab1f" },
  ];
  var ALIAS = {
    csdp: "csdtp",
    tfsrp: "tfsrph",
    trsp: "tfsrph",
    foodsystemsresilience: "tfsrph",
    bbtcoffee: "bbt",
  };

  var cfg = typeof CONFIG !== "undefined" ? CONFIG : {};
  function usable(u) {
    return u && u.indexOf("PASTE") < 0 ? u : "";
  }
  var AWPB_URL = usable(cfg.AWPB_CSV_URL),
    COMP_URL = usable(cfg.AWPB_COMPONENTS_CSV_URL);
  var REFRESH_MS = (cfg.SYNC_MINUTES || 5) * 60 * 1000;

  /* Fallback shown until the sheet loads (C-SDTP FY 2025/26, USD, from the revised AWPB and the progress report) */
  var state = {
    project: "csdtp",
    fy: null,
    pauseUntil: 0,
    awpb: [
      {
        key: "csdtp",
        fy: "2025/26",
        quarter: "Annual",
        planned: 17203460,
        actual: 3250000,
        received: 7984197,
        updated: "2026-10-14",
      },
    ],
    comps: [
      {
        key: "csdtp",
        fy: "2025/26",
        name: "1. Climate-smart productivity & resilience",
        planned: 5049420,
        actual: 487500,
      },
      {
        key: "csdtp",
        fy: "2025/26",
        name: "2. Inclusive value chains, investment & policy",
        planned: 6201500,
        actual: 206050,
      },
      {
        key: "csdtp",
        fy: "2025/26",
        name: "3. Project planning & management",
        planned: 5952540,
        actual: 2556450,
      },
    ],
  };

  /* ---------- helpers ---------- */
  function keyOf(code) {
    var n = String(code || "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
    if (typeof PROJECT_ALIASES !== "undefined" && PROJECT_ALIASES[n])
      return PROJECT_ALIASES[n];
    return ALIAS[n] || n;
  }
  function num(v) {
    return parseFloat(String(v).replace(/[^0-9.\-]/g, "")) || 0;
  }
  /* like num(), but a blank / non-numeric cell gives null instead of 0 */
  function numOrNull(v) {
    var t = String(v == null ? "" : v).replace(/[^0-9.\-]/g, "");
    if (t === "" || t === "-" || t === ".") return null;
    var n = parseFloat(t);
    return isNaN(n) ? null : n;
  }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function money(v) {
    return v >= 1e6
      ? "$" + (v / 1e6).toFixed(v >= 1e7 ? 1 : 2) + "M"
      : "$" + Math.round(v / 1e3) + "K";
  }
  function sum(a, k) {
    return a.reduce(function (s, x) {
      return s + x[k];
    }, 0);
  }
  function color(key) {
    var p = PROJECTS.filter(function (x) {
      return x.key === key;
    })[0];
    return p ? p.color : "#4f7942";
  }

  function rows(url) {
    return fetchWithRetry(url).then(parseCSV); // reuses the dashboard's own fetch + CSV parser
  }
  function load() {
    var jobs = [];
    if (AWPB_URL)
      jobs.push(
        rows(AWPB_URL).then(function (r) {
          state.awpb = r
            .map(function (o) {
              return {
                key: keyOf(getRowValue(o, ["Project Code", "Project"])),
                fy: getRowValue(o, ["FY"]),
                quarter: getRowValue(o, ["Quarter"]),
                planned: num(getRowValue(o, ["Planned"])),
                actual: num(getRowValue(o, ["Actual"])),
                received: numOrNull(
                  getRowValue(o, ["Funds Received", "FundsReceived"]),
                ),
                updated: getRowValue(o, ["Last Updated"]),
              };
            })
            .filter(function (x) {
              return x.key && x.fy;
            });
        }),
      );
    if (COMP_URL)
      jobs.push(
        rows(COMP_URL).then(function (r) {
          state.comps = r
            .map(function (o) {
              return {
                key: keyOf(getRowValue(o, ["Project Code", "Project"])),
                fy: getRowValue(o, ["FY"]),
                name: getRowValue(o, ["Component"]),
                planned: num(getRowValue(o, ["Planned"])),
                actual: num(getRowValue(o, ["Actual"])),
              };
            })
            .filter(function (x) {
              return x.key && x.fy;
            });
        }),
      );
    return Promise.all(jobs)
      .catch(function (e) {
        console.warn("AWPB sync failed, keeping last data:", e);
      })
      .then(function () {
        pickFY();
        render();
      });
  }

  /* ---------- data logic ---------- */
  function yearsFor(k) {
    var s = {};
    state.awpb.forEach(function (x) {
      if (x.key === k) s[x.fy] = 1;
    });
    return Object.keys(s).sort();
  }
  function currentFY() {
    var d = new Date(),
      y = d.getMonth() >= 6 ? d.getFullYear() : d.getFullYear() - 1;
    return y + "/" + String((y + 1) % 100).padStart(2, "0");
  }
  function qStart(fy, q) {
    var y = parseInt(fy.slice(0, 4), 10);
    return [
      new Date(y, 6, 1),
      new Date(y, 9, 1),
      new Date(y + 1, 0, 1),
      new Date(y + 1, 3, 1),
    ][q - 1];
  }
  function pickFY() {
    var ys = yearsFor(state.project);
    if (!ys.length) {
      state.fy = null;
      return;
    }
    if (!state.fy || ys.indexOf(state.fy) < 0)
      state.fy = ys.indexOf(currentFY()) > -1 ? currentFY() : ys[ys.length - 1];
  }
  function summary(k, fy) {
    var r = state.awpb.filter(function (x) {
      return x.key === k && x.fy === fy;
    });
    if (!r.length) return null;
    var annual = r.filter(function (x) {
      return /^annual$/i.test(x.quarter);
    })[0];
    var qs = r
      .filter(function (x) {
        return /^Q[1-4]$/i.test(x.quarter);
      })
      .sort(function (a, b) {
        return a.quarter.localeCompare(b.quarter);
      });
    var warn = [];
    qs.forEach(function (x) {
      if (x.actual > 0 && qStart(fy, +x.quarter.slice(1)) > new Date())
        warn.push(
          x.quarter.toUpperCase() + " shows actuals but has not started yet",
        );
    });
    return {
      planned: annual ? annual.planned : sum(qs, "planned"),
      actual: annual ? annual.actual : sum(qs, "actual"),
      received: annual ? annual.received : null,
      qs: qs,
      warn: warn,
      updated: r
        .map(function (x) {
          return x.updated;
        })
        .sort()
        .pop(),
      comps: state.comps.filter(function (x) {
        return x.key === k && x.fy === fy;
      }),
    };
  }

  /* One progress row for the Funds position section.
     Re-uses the component-bar classes (aw-c / aw-ct / aw-track / aw-fill) so no new CSS is needed. */
  function fundsRow(label, detail, ratio) {
    var p = isFinite(ratio) ? ratio : 0;
    return (
      '<div class="aw-c"><div class="aw-ct"><span>' +
      esc(label) +
      "</span><em>" +
      esc(detail) +
      " &middot; " +
      (p * 100).toFixed(1) +
      "%</em></div>" +
      '<div class="aw-track"><div class="aw-fill" style="width:' +
      (Math.min(Math.max(p, 0), 1) * 100).toFixed(1) +
      '%"></div></div></div>'
    );
  }

  /* ---------- render ---------- */
  function render() {
    var el = document.getElementById(MOUNT_ID);
    if (!el) return;
    var k = state.project,
      fy = state.fy,
      s = fy ? summary(k, fy) : null,
      C = 2 * Math.PI * 50;
    el.style.setProperty("--act", color(k));
    var h =
      '<div class="aw-head"><h2>&#128197; AWPB &middot; Annual Work Plan &amp; Budget</h2><span class="aw-sub">' +
      (s && s.updated ? "Updated " + esc(s.updated) : "") +
      "</span></div>";
    h +=
      '<div class="aw-row">' +
      PROJECTS.map(function (p) {
        return (
          '<button data-p="' +
          p.key +
          '"' +
          (p.key === k ? ' class="on"' : "") +
          ">" +
          esc(p.label) +
          "</button>"
        );
      }).join("") +
      "</div>";
    h +=
      '<div class="aw-row">' +
      yearsFor(k)
        .map(function (y) {
          return (
            '<button data-fy="' +
            esc(y) +
            '"' +
            (y === fy ? ' class="on"' : "") +
            ">FY " +
            esc(y) +
            "</button>"
          );
        })
        .join("") +
      "</div>";
    if (!s) {
      el.innerHTML =
        h + '<div class="aw-empty">No AWPB data yet for this project</div>';
      return;
    }

    var pct = s.planned ? s.actual / s.planned : 0;
    h +=
      '<div class="aw-body"><div class="aw-gauge"><svg viewBox="0 0 120 120">' +
      '<circle cx="60" cy="60" r="50" fill="none" stroke="#e5ece9" stroke-width="11"/>' +
      '<circle cx="60" cy="60" r="50" fill="none" stroke-width="11" stroke-linecap="round" style="stroke:' +
      (pct > 1 ? "#dc2626" : "var(--act)") +
      '" ' +
      'stroke-dasharray="' +
      (C * Math.min(pct, 1)).toFixed(1) +
      " " +
      C.toFixed(1) +
      '"/></svg>' +
      '<div class="c"><div class="aw-pct">' +
      (pct * 100).toFixed(1) +
      '%</div><div class="aw-lbl">utilised</div></div></div>' +
      '<div class="aw-stats"><div class="aw-stat"><span>AWPB</span><b>' +
      money(s.planned) +
      "</b></div>" +
      '<div class="aw-stat"><span>Actual</span><b>' +
      money(s.actual) +
      "</b></div>" +
      '<div class="aw-stat"><span>' +
      (s.planned >= s.actual ? "Unspent" : "Overspent") +
      "</span><b>" +
      money(Math.abs(s.planned - s.actual)) +
      "</b></div>" +
      '<div class="aw-stat"><span>Year</span><b>FY ' +
      esc(fy) +
      "</b></div></div></div>";

    /* Funds position: shown only when the Annual row has a Funds Received value */
    if (s.received != null && s.received > 0) {
      var bal = s.received - s.actual;
      h +=
        '<div><div class="aw-sec">Funds position &middot; received vs spent</div>' +
        fundsRow(
          "Funds received vs AWPB",
          money(s.received) + " / " + money(s.planned),
          s.planned ? s.received / s.planned : 0,
        ) +
        fundsRow(
          "Spent vs funds received",
          money(s.actual) + " / " + money(s.received),
          s.actual / s.received,
        ) +
        '<div class="aw-note">' +
        (bal >= 0
          ? "Unspent funds received: "
          : "Spent beyond funds received: ") +
        "<b>" +
        money(Math.abs(bal)) +
        "</b></div></div>";
    }

    if (s.qs.length) {
      var mx =
        Math.max.apply(
          null,
          s.qs.map(function (x) {
            return Math.max(x.planned, x.actual);
          }),
        ) || 1;
      h +=
        '<div><div class="aw-sec">Quarterly phasing &middot; planned vs actual</div><div class="aw-q">' +
        s.qs
          .map(function (x) {
            return (
              '<div class="aw-qc"><div class="aw-bars"><div class="aw-bp" style="height:' +
              (x.planned / mx) * 100 +
              '%"></div>' +
              '<div class="aw-ba" style="height:' +
              (x.actual / mx) * 100 +
              '%"></div></div><small>' +
              esc(x.quarter.toUpperCase()) +
              " &middot; " +
              money(x.actual) +
              "</small></div>"
            );
          })
          .join("") +
        "</div></div>";
    }
    if (s.comps.length) {
      h +=
        '<div><div class="aw-sec">By component</div>' +
        s.comps
          .map(function (c) {
            var w = c.planned ? Math.min(c.actual / c.planned, 1) * 100 : 0;
            return (
              '<div class="aw-c"><div class="aw-ct"><span>' +
              esc(c.name) +
              "</span><em>" +
              money(c.actual) +
              " / " +
              money(c.planned) +
              "</em></div>" +
              '<div class="aw-track"><div class="aw-fill" style="width:' +
              w.toFixed(1) +
              '%"></div></div></div>'
            );
          })
          .join("") +
        "</div>";
    }
    if (s.warn.length)
      h +=
        '<div class="aw-note warn">&#9888; Check sheet: ' +
        esc(s.warn.join("; ")) +
        "</div>";
    el.innerHTML = h;
  }

  /* ---------- interaction + boot ---------- */
  function init() {
    var el = document.getElementById(MOUNT_ID);
    if (!el) return;
    el.addEventListener("click", function (e) {
      var b = e.target.closest("button");
      if (!b) return;
      state.pauseUntil = Date.now() + 60000;
      if (b.dataset.p) {
        state.project = b.dataset.p;
        state.fy = null;
        pickFY();
      }
      if (b.dataset.fy) state.fy = b.dataset.fy;
      render();
    });
    pickFY();
    render();
    load();
    setInterval(load, REFRESH_MS);
    if (ROTATE_MS)
      setInterval(function () {
        if (Date.now() < state.pauseUntil) return;
        var withData = PROJECTS.filter(function (p) {
          return yearsFor(p.key).length;
        });
        if (withData.length < 2) return;
        var i = withData
          .map(function (p) {
            return p.key;
          })
          .indexOf(state.project);
        state.project = withData[(i + 1) % withData.length].key;
        state.fy = null;
        pickFY();
        render();
      }, ROTATE_MS);
  }
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", init);
  else init();
})();

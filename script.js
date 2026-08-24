/* ============================================================
   IFAD TANZANIA — PROJECT PORTFOLIO COMMAND CENTRE
   CLEAN GOOGLE SHEETS CONNECTED VERSION

   IMPORTANT:
   Run index.html through VS Code Live Server.

   This file intentionally contains:
   - ONE CONFIG
   - ONE set of dashboard functions
   - ONE initializeDashboard()
   - ONE DOMContentLoaded listener
   ============================================================ */

/* ============================================================
   1. GOOGLE SHEETS CONFIGURATION
   ============================================================ */

const CONFIG = {
  KPI_CSV_URL:
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vRutNgZhOKTDMh98xxopabd4f-Eo683y-PHrEP-HvEA2DKqe8jCCNqElgH8zZK81A9zbkn7eHX_7sUK/pub?gid=0&single=true&output=csv",

  PROJECTS_CSV_URL:
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vRutNgZhOKTDMh98xxopabd4f-Eo683y-PHrEP-HvEA2DKqe8jCCNqElgH8zZK81A9zbkn7eHX_7sUK/pub?gid=1332765699&single=true&output=csv",

  MILESTONES_CSV_URL:
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vRutNgZhOKTDMh98xxopabd4f-Eo683y-PHrEP-HvEA2DKqe8jCCNqElgH8zZK81A9zbkn7eHX_7sUK/pub?gid=1467867682&single=true&output=csv",

  TIMELINE_CSV_URL:
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vRutNgZhOKTDMh98xxopabd4f-Eo683y-PHrEP-HvEA2DKqe8jCCNqElgH8zZK81A9zbkn7eHX_7sUK/pub?gid=996381250&single=true&output=csv",

  STAKEHOLDERS_CSV_URL:
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vRutNgZhOKTDMh98xxopabd4f-Eo683y-PHrEP-HvEA2DKqe8jCCNqElgH8zZK81A9zbkn7eHX_7sUK/pub?gid=793167100&single=true&output=csv",

  DISBURSEMENTS_CSV_URL:
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vRutNgZhOKTDMh98xxopabd4f-Eo683y-PHrEP-HvEA2DKqe8jCCNqElgH8zZK81A9zbkn7eHX_7sUK/pub?gid=1250461334&single=true&output=csv",

  ANNOUNCEMENTS_CSV_URL:
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vRutNgZhOKTDMh98xxopabd4f-Eo683y-PHrEP-HvEA2DKqe8jCCNqElgH8zZK81A9zbkn7eHX_7sUK/pub?gid=1917123801&single=true&output=csv",

  GEOJSON_URL: "./tanzania-regions.geojson.json",

  SYNC_MINUTES: 5,

  ANNOUNCEMENT_SECONDS: 8,
};

/* ============================================================
   2. GENERAL HELPERS
   ============================================================ */

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function normalizeHeader(value) {
  return String(value || "")
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function getRowValue(row, aliases) {
  if (!row) {
    return "";
  }

  const wanted = aliases.map(normalizeHeader);

  for (const [key, value] of Object.entries(row)) {
    if (wanted.includes(normalizeHeader(key))) {
      return String(value ?? "").trim();
    }
  }

  return "";
}

function cleanName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function normalizeProjectKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function toStatusClass(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function setText(id, value) {
  const element = document.getElementById(id);

  if (element) {
    element.textContent = value;
  }
}

function parseNumber(value) {
  if (value === null || value === undefined || value === "") {
    return 0;
  }

  let text = String(value)
    .replace(/[$€£,\s]/g, "")
    .replace(/%/g, "")
    .trim();

  if (text.startsWith("(") && text.endsWith(")")) {
    text = "-" + text.slice(1, -1);
  }

  const number = parseFloat(text);

  return Number.isFinite(number) ? number : 0;
}

/* ============================================================
   3. CLOCK
   ============================================================ */

function updateClock() {
  const now = new Date();

  setText("clock", now.toLocaleTimeString());

  setText("date", now.toDateString());
}

function markSynced() {
  const now = new Date();

  setText(
    "lastSync",
    now.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    }),
  );
}

/* ============================================================
   4. CSV PARSER
   ============================================================ */

function parseCSV(text) {
  const source = String(text || "").replace(/^\uFEFF/, "");

  if (!source.trim()) {
    return [];
  }

  const rows = [];

  let row = [];

  let cell = "";

  let insideQuotes = false;

  for (let i = 0; i < source.length; i++) {
    const character = source[i];

    if (character === '"') {
      if (insideQuotes && source[i + 1] === '"') {
        cell += '"';

        i++;
      } else {
        insideQuotes = !insideQuotes;
      }

      continue;
    }

    if (character === "," && !insideQuotes) {
      row.push(cell.trim());

      cell = "";

      continue;
    }

    if ((character === "\n" || character === "\r") && !insideQuotes) {
      if (character === "\r" && source[i + 1] === "\n") {
        i++;
      }

      row.push(cell.trim());

      cell = "";

      if (row.some((value) => String(value).trim() !== "")) {
        rows.push(row);
      }

      row = [];

      continue;
    }

    cell += character;
  }

  row.push(cell.trim());

  if (row.some((value) => String(value).trim() !== "")) {
    rows.push(row);
  }

  if (!rows.length) {
    return [];
  }

  const headers = rows[0].map((header) =>
    String(header || "")
      .replace(/^\uFEFF/, "")
      .trim(),
  );

  return rows
    .slice(1)

    .filter((values) => values.some((value) => String(value).trim() !== ""))

    .map((values) => {
      const object = {};

      headers.forEach((header, index) => {
        object[header] = values[index] ?? "";
      });

      return object;
    });
}

/* ============================================================
   5. GOOGLE SHEETS FETCH
   ============================================================ */

async function fetchCSV(url) {
  if (!url) {
    throw new Error("No Google Sheet URL supplied");
  }

  const separator = url.includes("?") ? "&" : "?";

  const finalURL = `${url}${separator}_=${Date.now()}`;

  const response = await fetch(finalURL, {
    method: "GET",
    cache: "no-store",
    redirect: "follow",
  });

  if (!response.ok) {
    throw new Error(`Google Sheets HTTP ${response.status}`);
  }

  const text = await response.text();

  if (/^\s*<!doctype html/i.test(text) || /^\s*<html/i.test(text)) {
    throw new Error(
      "Google returned HTML instead of CSV. Make sure this tab is Published to the web.",
    );
  }

  return text;
}

async function fetchWithRetry(url, attempts = 3) {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fetchCSV(url);
    } catch (error) {
      console.warn(
        `Google Sheet fetch failed - attempt ${attempt}/${attempts}`,
        error,
      );

      if (attempt === attempts) {
        throw error;
      }

      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
    }
  }
}

async function getSheetRows(url) {
  const text = await fetchWithRetry(url);

  return parseCSV(text);
}

/* ============================================================
   6. KPI CARDS
   ============================================================ */

function findKPIElement(label) {
  const cards = document.querySelectorAll(".kpi-card");

  for (const card of cards) {
    const labelElement = card.querySelector("span");

    if (normalizeHeader(labelElement?.textContent) === normalizeHeader(label)) {
      return card.querySelector("h2");
    }
  }

  return null;
}

function setKPI(id, label, value) {
  const element = document.getElementById(id);

  if (element) {
    element.textContent = value;

    return;
  }

  const fallback = findKPIElement(label);

  if (fallback) {
    fallback.textContent = value;
  }
}

async function refreshKPIs() {
  try {
    const rows = await getSheetRows(CONFIG.KPI_CSV_URL);

    const kpi = rows[0];

    if (!kpi) {
      throw new Error("KPI tab contains no data");
    }

    console.log("📊 KPI DATA FROM GOOGLE:", kpi);

    const totalInvestment =
      getRowValue(kpi, ["TotalInvestment", "Total Investment"]) || "—";

    const totalProjects =
      getRowValue(kpi, ["TotalProjects", "Total Projects", "Projects"]) || "—";

    const activeProjects =
      getRowValue(kpi, ["ActiveProjects", "Active Projects"]) || "—";

    const beneficiaries =
      getRowValue(kpi, ["Beneficiaries", "Total Beneficiaries"]) || "—";

    const districts = getRowValue(kpi, ["Districts", "Total Districts"]) || "—";

    const jobs = getRowValue(kpi, ["Jobs", "Total Jobs"]) || "—";

    const progressRaw =
      getRowValue(kpi, [
        "PortfolioProgress",
        "Portfolio Progress",
        "Progress",
      ]) || "0";

    const progress = Math.max(
      0,
      Math.min(100, parseFloat(progressRaw.replace("%", "")) || 0),
    );

    setKPI("kpi-investment", "Total Investment", totalInvestment);

    setKPI("kpi-projects", "Projects", totalProjects);

    setKPI("kpi-active", "Active Projects", activeProjects);

    setKPI("kpi-beneficiaries", "Beneficiaries", beneficiaries);

    setKPI("kpi-districts", "Districts", districts);

    setKPI("kpi-jobs", "Jobs", jobs);

    const progressValue =
      document.getElementById("kpi-progress-value") ||
      findKPIElement("Portfolio Progress");

    if (progressValue) {
      progressValue.textContent = `${progress}%`;
    }

    const progressFill =
      document.getElementById("kpi-progress-fill") ||
      document.querySelector(".progress-fill");

    if (progressFill) {
      progressFill.style.width = `${progress}%`;
    }

    const portfolioCount = document.getElementById("portfolio-count");

    if (portfolioCount) {
      portfolioCount.textContent = `${activeProjects} Active Projects`;
    }

    markSynced();

    console.log("✅ KPI tab loaded successfully");
  } catch (error) {
    console.error("❌ KPI SHEET ERROR:", error);
  }
}

/* ============================================================
   7. PROJECT DEFINITIONS
   ============================================================ */

const DEFAULT_PROJECT_COLORS = [
  "#4f7942",
  "#f7c948",
  "#ef7d2d",
  "#3b82f6",
  "#8b5cf6",
];

const PROJECT_ALIASES = {
  csdtp: "csdtp",

  csdp: "csdtp",

  climatesmartdairytransformationprogramme: "csdtp",

  climatesmartdairytransformationprogram: "csdtp",

  climatesmartdairytransformationproject: "csdtp",

  climatesmartsmallholderdairytransformationproject: "csdtp",

  afdp: "afdp",

  agriculturefisheriesdevelopment: "afdp",

  agricultureandfisheriesdevelopment: "afdp",

  agricultureandfooddevelopmentproject: "afdp",

  agriculturefisheriesdevelopmentprogramme: "afdp",

  bbt: "bbt",

  bbtcoffee: "bbt",

  buildingabettertomorrow: "bbt",

  buildingabettertomorrowprogramme: "bbt",

  buildingabettertomorrowprogram: "bbt",

  tfsrph: "tfsrph",

  tfsrp: "tfsrph",

  trsp: "tfsrph",

  tfsrphorticulture: "tfsrph",

  foodsystemsresilience: "tfsrph",

  foodsystemresilience: "tfsrph",

  tanzaniafoodsystemsresilienceproject: "tfsrph",

  tanzaniafoodsystemsresilienceprojecth: "tfsrph",
};

const PROJECT_COVERAGE_OVERRIDES = {
  csdtp: {
    displayName: "C-SDTP",

    color: "#4f7942",

    description: "Climate Smart Smallholder Dairy Transformation Project",

    regions: [
      "Kagera",
      "Kigoma",
      "Katavi",
      "Rukwa",
      "Songwe",
      "Mbeya",
      "Njombe",
      "Ruvuma",
      "Morogoro",
      "Pwani",
      "Tanga",
      "Manyara",
      "Arusha",
      "Kilimanjaro",
      "Dar es Salaam",
      "Lindi",
    ],
  },

  afdp: {
    displayName: "AFDP",

    color: "#f7c948",

    description: "Agriculture & Fisheries Development Programme",

    regions: [
      "Geita",
      "Mwanza",
      "Shinyanga",
      "Tabora",
      "Singida",
      "Dodoma",
      "Morogoro",
      "Pwani",
      "Dar es Salaam",
      "Lindi",
      "Tanga",
      "Kilimanjaro",
      "Manyara",
      "Ruvuma",

      "Pemba",
      "Unguja",
    ],
  },

  bbt: {
    displayName: "BBT Coffee",

    color: "#ef7d2d",

    description: "Building a Better Tomorrow Programme",

    regions: ["Kagera", "Kigoma", "Rukwa"],
  },

  tfsrph: {
    displayName: "Food Systems Resilience",

    color: "#3b82f6",

    description: "Tanzania Food Systems Resilience Project",

    regions: [
      "Kagera",
      "Kigoma",
      "Katavi",
      "Rukwa",
      "Songwe",
      "Mbeya",
      "Iringa",
      "Ruvuma",
      "Arusha",
      "Kilimanjaro",
      "Manyara",
      "Tanga",
      "Pwani",
      "Dar es Salaam",
      "Mwanza",
      "Morogoro",
      "Dodoma",

      "Pemba",
      "Unguja",
    ],
  },
};

const PROJECT_ORDER = [
  "C-SDTP",
  "Food Systems Resilience",
  "BBT Coffee",
  "AFDP",
];

function getProjectOverride(projectName) {
  const normalized = normalizeProjectKey(projectName);

  const alias = PROJECT_ALIASES[normalized] || normalized;

  return PROJECT_COVERAGE_OVERRIDES[alias];
}

function getProjectColor(projectName) {
  const override = getProjectOverride(projectName);

  return override?.color || "#0b6e4f";
}

function getProjectName(project) {
  return getRowValue(project, [
    "Name",
    "Project",
    "ProjectName",
    "Project Name",
    "Title",
    "Short Name",
    "Project Short Name",
  ]);
}

function getProjectRegions(project) {
  return getRowValue(project, [
    "Regions",
    "Region",
    "Coverage",
    "Areas",
    "Project Regions",
    "Project Coverage",
  ]);
}

function buildDefaultProjectData() {
  const result = {};

  Object.values(PROJECT_COVERAGE_OVERRIDES).forEach((project) => {
    result[project.displayName] = {
      color: project.color,

      description: project.description,

      regions: [...project.regions],
    };
  });

  return result;
}

let projectData = buildDefaultProjectData();

/* ============================================================
   8. PROJECT CARDS
   ============================================================ */

function buildProjectCard(project, index) {
  const projectName = getProjectName(project) || `Project ${index + 1}`;

  const override = getProjectOverride(projectName);

  const color =
    getRowValue(project, ["Color", "Colour"]) ||
    override?.color ||
    DEFAULT_PROJECT_COLORS[index % DEFAULT_PROJECT_COLORS.length];

  const description =
    getRowValue(project, ["Description", "Summary", "Project Description"]) ||
    override?.description ||
    "";

  const status = getRowValue(project, [
    "StatusLabel",
    "Status Label",
    "Status",
  ]);

  const progress = Math.max(
    0,
    Math.min(
      100,
      parseFloat(
        getRowValue(project, [
          "Progress",
          "Percent",
          "% Progress",
          "Progress %",
        ]),
      ) || 0,
    ),
  );

  const investment =
    getRowValue(project, [
      "Investment",
      "Funding",
      "Project Investment",
      "Total Investment",
    ]) || "—";

  const duration =
    getRowValue(project, ["Duration", "Timeline", "Project Duration"]) || "—";

  const beneficiaries =
    getRowValue(project, [
      "Beneficiaries",
      "Beneficiary",
      "Target",
      "Target Beneficiaries",
    ]) || "—";

  const nextStep =
    getRowValue(project, [
      "NextStep",
      "Next Step",
      "NextAction",
      "Next Action",
      "Next Milestone",
    ]) || "—";

  return `

    <div
      class="project-card"
      style="
        border-top-color:
        ${escapeHtml(color)}
      "
    >

      ${
        status
          ? `
            <div
              class="status"
              style="
                background:
                ${escapeHtml(color)}
              "
            >
              ${escapeHtml(status.toUpperCase())}
            </div>
          `
          : ""
      }


      <h3>
        ${escapeHtml(projectName)}
      </h3>


      <p>
        ${escapeHtml(description)}
      </p>


      <div
        class="progress-header"
      >

        <span>
          Progress
        </span>

        <strong>
          ${progress}%
        </strong>

      </div>


      <div class="progress">

        <div
          class="fill"
          style="
            width:
            ${progress}%;

            background:
            ${escapeHtml(color)};
          "
        ></div>

      </div>


      <div
        class="project-details"
      >

        <div>

          <small>
            Investment
          </small>

          <strong>
            ${escapeHtml(investment)}
          </strong>

        </div>


        <div>

          <small>
            Duration
          </small>

          <strong>
            ${escapeHtml(duration)}
          </strong>

        </div>


        <div>

          <small>
            Beneficiaries
          </small>

          <strong>
            ${escapeHtml(beneficiaries)}
          </strong>

        </div>


        <div>

          <small>
            Next Step
          </small>

          <strong>
            ${escapeHtml(nextStep)}
          </strong>

        </div>

      </div>

    </div>

  `;
}

/* ============================================================
   9. PROJECTS — GOOGLE SHEET CONNECTION
   ============================================================ */

async function refreshProjects() {
  try {
    const rows = await getSheetRows(CONFIG.PROJECTS_CSV_URL);

    console.log("📁 PROJECT DATA FROM GOOGLE:", rows);

    console.log("📁 PROJECT HEADERS:", rows.length ? Object.keys(rows[0]) : []);

    if (!rows.length) {
      console.warn("Projects sheet returned no rows. Using fallback coverage.");

      projectData = buildDefaultProjectData();

      renderMapAndLegend();

      return;
    }

    const rowsWithColor = rows.map((project, index) => {
      const projectName = getProjectName(project);

      const override = getProjectOverride(projectName);

      return {
        ...project,

        __dashboardColor:
          getRowValue(project, ["Color", "Colour"]) ||
          override?.color ||
          DEFAULT_PROJECT_COLORS[index % DEFAULT_PROJECT_COLORS.length],
      };
    });

    const portfolioGrid =
      document.getElementById("portfolioGrid") ||
      document.querySelector(".portfolio-grid");

    if (portfolioGrid) {
      portfolioGrid.innerHTML = rowsWithColor
        .map((row, index) => buildProjectCard(row, index))
        .join("");
    }

    /*
       Preserve the built-in map
       coverage unless Google Sheets
       supplies explicit Regions.
    */

    const newProjectData = buildDefaultProjectData();

    rowsWithColor.forEach((project) => {
      const projectName = getProjectName(project);

      if (!projectName) {
        return;
      }

      const override = getProjectOverride(projectName);

      const sheetRegions = getProjectRegions(project)
        .split(/[,;|]/)
        .map((region) => region.trim())
        .filter(Boolean);

      const regions = sheetRegions.length
        ? sheetRegions
        : override?.regions || [];

      const displayName = override?.displayName || projectName;

      newProjectData[displayName] = {
        color: project.__dashboardColor,

        regions,

        description:
          getRowValue(project, [
            "Description",
            "Summary",
            "Project Description",
          ]) ||
          override?.description ||
          "Project coverage",
      };
    });

    projectData = newProjectData;

    renderMapAndLegend();

    const portfolioCount = document.getElementById("portfolio-count");

    if (portfolioCount) {
      portfolioCount.textContent = `${rows.length} Active Projects`;
    }

    markSynced();

    console.log("✅ Projects tab loaded successfully");

    console.log("🗺️ MAP PROJECT DATA:", projectData);
  } catch (error) {
    console.error("❌ PROJECT SHEET ERROR:", error);

    projectData = buildDefaultProjectData();

    renderMapAndLegend();
  }
}

/* ============================================================
   10. TANZANIA MAP
   ============================================================ */

function regionMatchesCoverage(mapRegion, coverageRegion) {
  const mapName = cleanName(mapRegion);

  const coverageName = cleanName(coverageRegion);

  if (mapName === coverageName) {
    return true;
  }

  if (coverageName === "pemba" && mapName.includes("pemba")) {
    return true;
  }

  if (coverageName === "unguja") {
    if (mapName.includes("unguja")) {
      return true;
    }

    if (mapName === "mjini magharibi") {
      return true;
    }
  }

  if (
    coverageName.replace(/\s/g, "") === "daressalaam" &&
    mapName.replace(/\s/g, "") === "daressalaam"
  ) {
    return true;
  }

  return false;
}

function getProjectsForRegion(regionName) {
  const projects = [];

  Object.entries(projectData).forEach(([projectName, project]) => {
    const match = project.regions.some((region) =>
      regionMatchesCoverage(regionName, region),
    );

    if (match) {
      projects.push({
        name: projectName,

        ...project,
      });
    }
  });

  return projects;
}

function getRegionName(feature) {
  const properties = feature?.properties || {};

  return (
    properties.NAME_1 ||
    properties.name ||
    properties.NAME ||
    properties.Region ||
    properties.region ||
    properties.shapeName ||
    properties.ADM1_EN ||
    properties.admin1Name ||
    "Unknown Region"
  );
}

/* ============================================================
   11. MAP COLORS
   ============================================================ */

function hexToRgb(hex) {
  const value = String(hex || "#999999")
    .replace("#", "")
    .trim();

  const full =
    value.length === 3
      ? value
          .split("")
          .map((character) => character + character)
          .join("")
      : value;

  const integer = parseInt(full, 16);

  if (Number.isNaN(integer)) {
    return {
      r: 153,
      g: 153,
      b: 153,
    };
  }

  return {
    r: (integer >> 16) & 255,

    g: (integer >> 8) & 255,

    b: integer & 255,
  };
}

function blendHexColors(colors) {
  if (!colors.length) {
    return "#e5e7eb";
  }

  if (colors.length === 1) {
    return colors[0];
  }

  const rgb = colors.map(hexToRgb);

  const count = rgb.length;

  const r = Math.round(rgb.reduce((sum, color) => sum + color.r, 0) / count);

  const g = Math.round(rgb.reduce((sum, color) => sum + color.g, 0) / count);

  const b = Math.round(rgb.reduce((sum, color) => sum + color.b, 0) / count);

  return `rgb(${r}, ${g}, ${b})`;
}

const MAJOR_REGION_LABELS = new Set([
  "mwanza",
  "arusha",
  "dodoma",
  "dar es salaam",
  "mbeya",
  "kigoma",
  "morogoro",
  "tanga",
  "mtwara",
]);

function shouldLabelRegion(regionName) {
  return MAJOR_REGION_LABELS.has(cleanName(regionName));
}

/* ============================================================
   12. MAP STYLING
   ============================================================ */

function getRegionStyle(feature) {
  const regionName = getRegionName(feature);

  const projects = getProjectsForRegion(regionName);

  if (!projects.length) {
    return {
      fillColor: "#e9ecef",

      color: "#d5dde3",

      weight: 1,

      dashArray: "4 4",

      fillOpacity: 0.35,
    };
  }

  if (projects.length === 1) {
    return {
      fillColor: projects[0].color,

      color: "#ffffff",

      weight: 1.5,

      dashArray: null,

      fillOpacity: 0.85,
    };
  }

  return {
    fillColor: blendHexColors(projects.map((project) => project.color)),

    color: "#ffffff",

    weight: 1.8,

    dashArray: null,

    fillOpacity: 0.92,
  };
}

/* ============================================================
   13. LEAFLET MAP
   ============================================================ */

let map = null;

let geojsonData = null;

let geojsonLayer = null;

function initializeMap() {
  if (typeof L === "undefined") {
    console.error("Leaflet is not loaded.");

    return;
  }

  const mapElement = document.getElementById("tanzaniaMap");

  if (!mapElement) {
    console.warn("Could not find #tanzaniaMap");

    return;
  }

  if (map) {
    return;
  }

  map = L.map("tanzaniaMap", {
    zoomControl: false,

    dragging: false,

    scrollWheelZoom: false,

    doubleClickZoom: false,

    boxZoom: false,

    keyboard: false,

    touchZoom: false,

    tap: false,

    attributionControl: false,
  });
}

async function loadGeoJSON() {
  const mapElement = document.getElementById("tanzaniaMap");

  if (!mapElement || typeof L === "undefined") {
    return;
  }

  try {
    const response = await fetch(`${CONFIG.GEOJSON_URL}?_=${Date.now()}`, {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`GeoJSON HTTP ${response.status}`);
    }

    geojsonData = await response.json();

    console.log(
      "✅ Tanzania GeoJSON loaded:",
      geojsonData.features?.length,
      "regions",
    );

    renderMapAndLegend();
  } catch (error) {
    console.error("❌ TANZANIA GEOJSON ERROR:", error);

    mapElement.innerHTML = `

      <div
        style="
          height:100%;
          display:flex;
          justify-content:center;
          align-items:center;
          text-align:center;
          color:#64748b;
          padding:20px;
        "
      >

        Tanzania map file could not be loaded.

        Check that
        <strong>
          tanzania-regions.geojson.json
        </strong>
        is in the same folder as index.html.

      </div>

    `;
  }
}

function renderMapAndLegend() {
  renderLegend();

  if (!geojsonData) {
    return;
  }

  initializeMap();

  if (!map) {
    return;
  }

  if (geojsonLayer) {
    map.removeLayer(geojsonLayer);
  }

  geojsonLayer = L.geoJSON(geojsonData, {
    style: getRegionStyle,

    onEachFeature(feature, layer) {
      const regionName = getRegionName(feature);

      const projects = getProjectsForRegion(regionName);

      if (shouldLabelRegion(regionName)) {
        const tooltipClass = projects.length
          ? "region-label active-label"
          : "region-label";

        layer.bindTooltip(regionName, {
          permanent: true,

          direction: "center",

          className: tooltipClass,
        });
      }

      const projectNames = projects.length
        ? projects.map((project) => project.name).join(" + ")
        : "No Active Project";

      const descriptions = projects.length
        ? projects.map((project) => project.description).join(" / ")
        : "No active project coverage listed.";

      layer.bindPopup(`

            <div class="map-popup">

              <strong>
                ${escapeHtml(regionName)}
              </strong>

              <p>
                ${escapeHtml(projectNames)}
              </p>

              <small>
                ${escapeHtml(descriptions)}
              </small>

            </div>

          `);

      layer.on({
        mouseover(event) {
          event.target.setStyle({
            weight: 3,

            color: projects.length ? "#0f172a" : "#94a3b8",

            fillOpacity: projects.length ? 1 : 0.55,
          });

          if (event.target.bringToFront) {
            event.target.bringToFront();
          }
        },

        mouseout(event) {
          if (geojsonLayer) {
            geojsonLayer.resetStyle(event.target);
          }
        },

        click() {
          layer.openPopup();
        },
      });
    },
  }).addTo(map);

  const bounds = geojsonLayer.getBounds();

  if (bounds.isValid()) {
    map.fitBounds(bounds, {
      padding: [10, 10],
    });
  }

  setTimeout(() => {
    if (!map) {
      return;
    }

    map.invalidateSize();

    if (geojsonLayer) {
      const refreshedBounds = geojsonLayer.getBounds();

      if (refreshedBounds.isValid()) {
        map.fitBounds(refreshedBounds, {
          padding: [10, 10],
        });
      }
    }
  }, 300);
}

/* ============================================================
   14. MAP LEGEND
   ============================================================ */

function renderLegend() {
  const element = document.getElementById("projectLegend");

  if (!element) {
    return;
  }

  const projects = Object.entries(projectData);

  const projectItems = projects
    .map(([name, project]) => {
      const regionCount = project.regions.length;

      return `

            <div class="legend-item">

              <span
                class="legend-color"
                style="
                  background:
                  ${escapeHtml(project.color)};
                "
              ></span>


              <div class="legend-text">

                <strong>
                  ${escapeHtml(name)}
                </strong>


                <p>
                  ${regionCount}
                  region${regionCount === 1 ? "" : "s"}
                </p>


                ${
                  project.description
                    ? `
                      <small>
                        ${escapeHtml(project.description)}
                      </small>
                    `
                    : ""
                }

              </div>

            </div>

          `;
    })
    .join("");

  element.innerHTML =
    projectItems +
    `

      <div
        class="
          legend-item
          no-project
        "
      >

        <span
          class="legend-color"
          style="
            background:
            #e5e7eb;
          "
        ></span>


        <div class="legend-text">

          <strong>
            Not Covered
          </strong>

          <p>
            Remaining regions
          </p>

        </div>

      </div>

    `;
}

/* ============================================================
   15. PORTFOLIO TIMELINE
   ============================================================ */

async function refreshTimeline() {
  const element = document.getElementById("timeline");

  if (!element) {
    return;
  }

  try {
    const rows = await getSheetRows(CONFIG.TIMELINE_CSV_URL);

    console.log("📅 TIMELINE DATA:", rows);

    console.log(
      "📅 TIMELINE HEADERS:",
      rows.length ? Object.keys(rows[0]) : [],
    );

    if (!rows.length) {
      element.innerHTML = `
        <div class="empty-state">
          No timeline data available.
        </div>
      `;

      return;
    }

    element.innerHTML = rows
      .map((row) => {
        const project =
          getRowValue(row, [
            "Project",
            "Project Name",
            "ProjectName",
            "Programme",
            "Program",
            "Project Short Name",
          ]) || "Portfolio";

        const title =
          getRowValue(row, [
            "Milestone",
            "Milestone Name",
            "Activity",
            "Activity Name",
            "Event",
            "Event Name",
            "Title",
            "Task",
            "Description",
            "Name",
          ]) || "Portfolio activity";

        const date = getRowValue(row, [
          "Date",
          "Milestone Date",
          "Event Date",
          "Start Date",
          "Target Date",
          "Deadline",
          "Due Date",
        ]);

        const status = getRowValue(row, [
          "Status",
          "Status Label",
          "Phase",
          "Progress Status",
        ]);

        const color = getProjectColor(project);

        return `

            <div
              class="timeline-item"
              style="
                --timeline-color:
                ${escapeHtml(color)}
              "
            >

              <span class="timeline-project">
                ${escapeHtml(project)}
              </span>


              <div class="timeline-body">

                <strong>
                  ${escapeHtml(title)}
                </strong>


                <div class="timeline-meta">

                  ${
                    date
                      ? `
                        <span>
                          📅
                          ${escapeHtml(date)}
                        </span>
                      `
                      : ""
                  }


                  ${
                    status
                      ? `
                        <span>
                          ${escapeHtml(status)}
                        </span>
                      `
                      : ""
                  }

                </div>

              </div>

            </div>

          `;
      })
      .join("");

    element.classList.add("populated");

    console.log("✅ Timeline loaded:", rows.length);
  } catch (error) {
    console.error("❌ TIMELINE ERROR:", error);

    element.innerHTML = `

      <div class="empty-state">
        Timeline data could not be loaded.
      </div>

    `;
  }
}

/* ============================================================
   16. UPCOMING MISSIONS
   ============================================================ */

async function refreshMilestones() {
  const element = document.getElementById("milestones");

  if (!element) {
    return;
  }

  try {
    const rows = await getSheetRows(CONFIG.MILESTONES_CSV_URL);

    console.log("✈️ MISSIONS DATA:", rows);

    console.log(
      "✈️ MISSIONS HEADERS:",
      rows.length ? Object.keys(rows[0]) : [],
    );

    if (!rows.length) {
      element.innerHTML = `

        <div class="empty-state">
          No upcoming missions available.
        </div>

      `;

      return;
    }

    element.innerHTML = rows
      .map((row) => {
        const project =
          getRowValue(row, [
            "Project",
            "Project Name",
            "ProjectName",
            "Programme",
            "Program",
            "Project Short Name",
          ]) || "Portfolio";

        const title =
          getRowValue(row, [
            "Mission",
            "Mission Name",
            "Mission Title",
            "Mission Activity",
            "Milestone",
            "Milestone Name",
            "Activity",
            "Activity Name",
            "Event",
            "Event Name",
            "Title",
            "Description",
            "Name",
          ]) || "Upcoming mission";

        const date = getRowValue(row, [
          "Date",
          "Mission Date",
          "Start Date",
          "End Date",
          "Target Date",
          "Deadline",
          "Due Date",
        ]);

        const status =
          getRowValue(row, [
            "Status",
            "Status Label",
            "Phase",
            "Mission Status",
          ]) || "Planned";

        const color = getProjectColor(project);

        const statusClass = toStatusClass(status) || "planned";

        return `

            <div
              class="mission-item"
              style="
                --mission-color:
                ${escapeHtml(color)}
              "
            >

              <div class="mission-top">

                <span class="mission-project">
                  ${escapeHtml(project)}
                </span>


                <span
                  class="
                    mission-status
                    mission-${escapeHtml(statusClass)}
                  "
                >
                  ${escapeHtml(status)}
                </span>

              </div>


              <strong
                class="mission-title"
              >
                ${escapeHtml(title)}
              </strong>


              ${
                date
                  ? `
                    <div class="mission-date">
                      📅
                      ${escapeHtml(date)}
                    </div>
                  `
                  : ""
              }

            </div>

          `;
      })
      .join("");

    element.classList.add("populated");

    console.log("✅ Missions loaded:", rows.length);
  } catch (error) {
    console.error("❌ MISSIONS ERROR:", error);

    element.innerHTML = `

      <div class="empty-state">
        Mission data could not be loaded.
      </div>

    `;
  }
}
/* ============================================================
   17. PROJECT STAKEHOLDERS — ROTATING PROJECT CARDS
   ============================================================ */

let stakeholderRows = [];

let stakeholderRotationTimer = null;

const STAKEHOLDER_ROTATION_MS = 4500;

/* ------------------------------------------------------------
   HELPERS
   ------------------------------------------------------------ */

function stopStakeholderRotation() {
  if (stakeholderRotationTimer) {
    clearInterval(stakeholderRotationTimer);
    stakeholderRotationTimer = null;
  }
}

function getStakeholderProject(row) {
  return (
    getRowValue(row, [
      "Project",
      "Project Name",
      "ProjectName",
      "Programme",
      "Program",
    ]) || "Portfolio"
  );
}

function buildStakeholderSlide(row, index, total) {
  const stakeholder =
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

  const role = getRowValue(row, [
    "Role",
    "Responsibility",
    "Description",
    "Function",
  ]);

  const category =
    getRowValue(row, [
      "Category",
      "Stakeholder Category",
      "Type",
      "Stakeholder Type",
      "Partner Type",
    ]) || "Partner";

  const engagement = getRowValue(row, ["Engagement", "Engagement Level"]);

  const influence = getRowValue(row, ["Influence", "Influence Level"]);

  const status = getRowValue(row, ["Status", "Status Label"]);

  const nextAction = getRowValue(row, [
    "Next Action",
    "NextAction",
    "Next Step",
    "NextStep",
    "Action",
  ]);

  return `
    <div class="stakeholder-slide">

      <div class="stakeholder-slide-top">

        <div class="stakeholder-identity">

          <strong class="stakeholder-name">
            ${escapeHtml(stakeholder)}
          </strong>

          ${
            role
              ? `
                <span class="stakeholder-role-new">
                  ${escapeHtml(role)}
                </span>
              `
              : ""
          }

        </div>


        <span class="stakeholder-counter">
          ${index + 1} / ${total}
        </span>

      </div>


      <div class="stakeholder-chip-row">

        ${
          category
            ? `
              <span class="stakeholder-chip category-chip">
                ${escapeHtml(category)}
              </span>
            `
            : ""
        }


        ${
          engagement
            ? `
              <span class="stakeholder-chip">
                <small>Engagement</small>
                ${escapeHtml(engagement)}
              </span>
            `
            : ""
        }


        ${
          influence
            ? `
              <span class="stakeholder-chip">
                <small>Influence</small>
                ${escapeHtml(influence)}
              </span>
            `
            : ""
        }


        ${
          status
            ? `
              <span
                class="
                  stakeholder-chip
                  stakeholder-status-chip
                  status-${escapeHtml(toStatusClass(status))}
                "
              >
                ${escapeHtml(status)}
              </span>
            `
            : ""
        }

      </div>


      ${
        nextAction
          ? `
            <div class="stakeholder-action">

              <span>
                Next Action
              </span>

              <strong>
                ${escapeHtml(nextAction)}
              </strong>

            </div>
          `
          : ""
      }

    </div>
  `;
}

/* ------------------------------------------------------------
   LOAD GOOGLE SHEET
   ------------------------------------------------------------ */

async function refreshStakeholders() {
  const element = document.getElementById("stakeholders");

  if (!element) {
    return;
  }

  try {
    stakeholderRows = await getSheetRows(CONFIG.STAKEHOLDERS_CSV_URL);

    console.log("🤝 STAKEHOLDER DATA:", stakeholderRows);

    console.log(
      "🤝 STAKEHOLDER HEADERS:",
      stakeholderRows.length ? Object.keys(stakeholderRows[0]) : [],
    );

    if (!stakeholderRows.length) {
      stopStakeholderRotation();

      element.innerHTML = `
        <div class="empty-state">
          No stakeholder data available.
        </div>
      `;

      return;
    }

    const select = document.getElementById("stakeholderProjectSelect");

    const projects = [
      ...new Set(
        stakeholderRows
          .map((row) => getStakeholderProject(row))
          .filter(Boolean),
      ),
    ];

    if (select) {
      select.innerHTML = `
        <option value="ALL">
          All Projects
        </option>
      `;

      projects.forEach((project) => {
        const option = document.createElement("option");

        option.value = project;

        option.textContent = project;

        select.appendChild(option);
      });

      select.onchange = function () {
        renderStakeholders(this.value);
      };
    }

    renderStakeholders("ALL");

    console.log("✅ Stakeholders loaded:", stakeholderRows.length);
  } catch (error) {
    stopStakeholderRotation();

    console.error("❌ STAKEHOLDERS ERROR:", error);

    element.innerHTML = `
      <div class="empty-state">
        Stakeholder data could not be loaded.
      </div>
    `;
  }
}

/* ------------------------------------------------------------
   GROUP + DISPLAY PROJECTS
   ------------------------------------------------------------ */

function renderStakeholders(filter = "ALL") {
  const element = document.getElementById("stakeholders");

  if (!element) {
    return;
  }

  stopStakeholderRotation();

  let rows = stakeholderRows;

  if (filter !== "ALL") {
    rows = rows.filter((row) => {
      const project = getStakeholderProject(row);

      return normalizeProjectKey(project) === normalizeProjectKey(filter);
    });
  }

  if (!rows.length) {
    element.innerHTML = `
      <div class="empty-state">
        No stakeholders found.
      </div>
    `;

    return;
  }

  /* GROUP ROWS BY PROJECT */

  const groupedProjects = new Map();

  rows.forEach((row) => {
    const project = getStakeholderProject(row);

    if (!groupedProjects.has(project)) {
      groupedProjects.set(project, []);
    }

    groupedProjects.get(project).push(row);
  });

  const groups = Array.from(groupedProjects.entries());

  const indexes = groups.map(() => 0);

  /* BUILD PROJECT CARDS */

  element.innerHTML = `
    <div
      class="
        stakeholder-project-grid
        ${groups.length === 1 ? "single-project" : ""}
      "
    >

      ${groups
        .map(([project, projectRows], groupIndex) => {
          const color = getProjectColor(project);

          return `

            <div
              class="stakeholder-project-card"
              style="
                --project-color:
                ${escapeHtml(color)};
              "
            >

              <div class="stakeholder-project-title">

                <div class="stakeholder-project-name">

                  <span
                    class="stakeholder-project-dot"
                  ></span>

                  <h3>
                    ${escapeHtml(project)}
                  </h3>

                </div>


                <span class="stakeholder-count">

                  ${projectRows.length}

                  stakeholder${projectRows.length === 1 ? "" : "s"}

                </span>

              </div>


              <div
                class="stakeholder-rotating-slot"
                data-group-index="${groupIndex}"
              >

                ${buildStakeholderSlide(projectRows[0], 0, projectRows.length)}

              </div>


              ${
                projectRows.length > 1
                  ? `
                    <div
                      class="stakeholder-rotation-track"
                    >
                      <span
                        class="
                          stakeholder-rotation-progress
                          running
                        "
                        data-progress-index="${groupIndex}"
                      ></span>
                    </div>
                  `
                  : ""
              }

            </div>
          `;
        })
        .join("")}

    </div>
  `;

  element.classList.add("populated");

  /* ----------------------------------------------------------
     AUTOMATIC ROTATION
     ---------------------------------------------------------- */

  const hasRotatingProjects = groups.some(
    ([, projectRows]) => projectRows.length > 1,
  );

  if (!hasRotatingProjects) {
    return;
  }

  stakeholderRotationTimer = setInterval(() => {
    /*
     * Pause while user is looking
     * at / hovering over the panel.
     */

    if (element.matches(":hover")) {
      return;
    }

    groups.forEach(([project, projectRows], groupIndex) => {
      if (projectRows.length <= 1) {
        return;
      }

      indexes[groupIndex] = (indexes[groupIndex] + 1) % projectRows.length;

      const slot = element.querySelector(`[data-group-index="${groupIndex}"]`);

      if (!slot) {
        return;
      }

      slot.classList.add("is-changing");

      setTimeout(() => {
        if (!slot.isConnected) {
          return;
        }

        slot.innerHTML = buildStakeholderSlide(
          projectRows[indexes[groupIndex]],
          indexes[groupIndex],
          projectRows.length,
        );

        requestAnimationFrame(() => {
          slot.classList.remove("is-changing");
        });

        /*
         * Restart progress indicator.
         */

        const progress = element.querySelector(
          `[data-progress-index="${groupIndex}"]`,
        );

        if (progress) {
          progress.classList.remove("running");

          void progress.offsetWidth;

          progress.classList.add("running");
        }
      }, 180);
    });
  }, STAKEHOLDER_ROTATION_MS);
}
/* ============================================================
   18. DISBURSEMENTS
   ============================================================ */

let disbursementRows = [];

let disbursementChart = null;

async function refreshDisbursements() {
  try {
    disbursementRows = await getSheetRows(CONFIG.DISBURSEMENTS_CSV_URL);

    console.log("💰 DISBURSEMENT DATA:", disbursementRows);

    console.log(
      "💰 DISBURSEMENT HEADERS:",
      disbursementRows.length ? Object.keys(disbursementRows[0]) : [],
    );

    const select = document.getElementById("disbursementProjectSelect");

    const projects = [
      ...new Set(
        disbursementRows
          .map((row) =>
            getRowValue(row, [
              "Project",
              "Project Name",
              "ProjectName",
              "Programme",
              "Program",
            ]),
          )
          .filter(Boolean),
      ),
    ];

    if (select) {
      select.innerHTML = `

        <option value="PORTFOLIO">
          Portfolio
        </option>

      `;

      projects.forEach((project) => {
        const option = document.createElement("option");

        option.value = project;

        option.textContent = project;

        select.appendChild(option);
      });

      select.onchange = function () {
        renderDisbursement(this.value);
      };
    }

    renderDisbursement("PORTFOLIO");

    console.log("✅ Disbursements loaded:", disbursementRows.length);
  } catch (error) {
    console.error("❌ DISBURSEMENT ERROR:", error);

    setText("disb-current", "—");

    setText("disb-cumulative", "—");

    setText("disb-remaining", "—");

    setText("disb-rate", "—");
  }
}

function formatDashboardMoney(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "—";
  }

  if (Math.abs(number) >= 1000000) {
    return `$${(number / 1000000).toFixed(2)}M`;
  }

  if (Math.abs(number) >= 1000) {
    return `$${(number / 1000).toFixed(1)}K`;
  }

  return `$${number.toLocaleString()}`;
}

function renderDisbursement(projectFilter = "PORTFOLIO") {
  let rows = disbursementRows;

  if (projectFilter !== "PORTFOLIO") {
    rows = rows.filter((row) => {
      const project = getRowValue(row, [
        "Project",
        "Project Name",
        "ProjectName",
        "Programme",
        "Program",
      ]);

      return (
        normalizeProjectKey(project) === normalizeProjectKey(projectFilter)
      );
    });
  }

  if (!rows.length) {
    console.warn("No disbursement rows found.");

    setText("disb-current", "—");

    setText("disb-cumulative", "—");

    setText("disb-remaining", "—");

    setText("disb-rate", "—");

    setText("disb-envelope", "—");

    setText("disb-ytd", "—");

    setText("disb-contracts", "—");

    setText("disb-contract-value", "—");

    setText("disb-planned", "—");

    return;
  }

  let current = 0;

  let cumulative = 0;

  let remaining = 0;

  let yearly = 0;

  let ytd = 0;

  let contracts = 0;

  let contractValue = 0;

  let planned = 0;

  rows.forEach((row) => {
    current += parseNumber(
      getRowValue(row, [
        "Current IFAD Amount",
        "Current IFAD",
        "IFAD Amount",
        "Current Amount",
        "Approved Amount",
        "Financing Amount",
        "Total Financing",
        "IFAD Financing",
      ]),
    );

    cumulative += parseNumber(
      getRowValue(row, [
        "Cumulative Disbursed",
        "Cumulative Disbursement",
        "Cumulative",
        "Disbursed",
        "Disbursed Amount",
        "Total Disbursed",
      ]),
    );

    remaining += parseNumber(
      getRowValue(row, [
        "Remaining Balance",
        "Remaining",
        "Balance",
        "Undisbursed",
        "Undisbursed Balance",
      ]),
    );

    yearly += parseNumber(
      getRowValue(row, [
        "Yearly Envelope",
        "Annual Envelope",
        "Annual Allocation",
        "Yearly Allocation",
        "Yearly",
      ]),
    );

    ytd += parseNumber(
      getRowValue(row, [
        "Disbursed YTD",
        "YTD Disbursed",
        "YTD",
        "Disbursement YTD",
      ]),
    );

    contracts += parseNumber(
      getRowValue(row, [
        "Open Contracts",
        "Contracts",
        "Number of Contracts",
        "Active Contracts",
      ]),
    );

    contractValue += parseNumber(
      getRowValue(row, [
        "Contracts Value",
        "Contract Value",
        "Total Contract Value",
      ]),
    );

    planned += parseNumber(
      getRowValue(row, [
        "Planned Contract Payments",
        "Planned Payments",
        "Planned Payment",
        "Planned",
      ]),
    );
  });

  if (remaining === 0 && current > cumulative) {
    remaining = current - cumulative;
  }

  const rate = current > 0 ? (cumulative / current) * 100 : 0;

  setText("disb-current", current ? formatDashboardMoney(current) : "—");

  setText(
    "disb-cumulative",
    cumulative ? formatDashboardMoney(cumulative) : "—",
  );

  setText("disb-remaining", remaining ? formatDashboardMoney(remaining) : "—");

  setText("disb-rate", current ? `${rate.toFixed(1)}%` : "—");

  setText("disb-envelope", yearly ? formatDashboardMoney(yearly) : "—");

  setText("disb-ytd", ytd ? formatDashboardMoney(ytd) : "—");

  setText("disb-contracts", contracts ? contracts.toLocaleString() : "—");

  setText(
    "disb-contract-value",
    contractValue ? formatDashboardMoney(contractValue) : "—",
  );

  setText("disb-planned", planned ? formatDashboardMoney(planned) : "—");

  /*
     Chart.js
  */

  const canvas = document.getElementById("disbursementChart");

  if (canvas && typeof Chart !== "undefined") {
    const ctx = canvas.getContext("2d");

    if (disbursementChart) {
      disbursementChart.destroy();
    }

    disbursementChart = new Chart(ctx, {
      type: "doughnut",

      data: {
        labels: ["Cumulative Disbursed", "Remaining Balance"],

        datasets: [
          {
            data: [cumulative, Math.max(remaining, 0)],

            backgroundColor: ["#0b6e4f", "#dfe7e3"],

            borderWidth: 0,
          },
        ],
      },

      options: {
        responsive: true,

        maintainAspectRatio: false,

        cutout: "68%",

        plugins: {
          legend: {
            position: "bottom",
          },
        },
      },
    });
  }
}

/* ============================================================
   19. ANNOUNCEMENTS
   ============================================================ */

let announcementTimer = null;

async function refreshAnnouncements() {
  const element = document.getElementById("announcements");

  if (!element) {
    return;
  }

  try {
    const rows = await getSheetRows(CONFIG.ANNOUNCEMENTS_CSV_URL);

    console.log("📢 ANNOUNCEMENT DATA:", rows);

    const messages = rows
      .map((row) =>
        getRowValue(row, [
          "Announcement",
          "Message",
          "Text",
          "Title",
          "Update",
          "Description",
        ]),
      )
      .filter(Boolean);

    if (!messages.length) {
      element.textContent = "No announcements available.";

      return;
    }

    let index = 0;

    function showAnnouncement() {
      element.classList.remove("scrolling");

      element.textContent = messages[index % messages.length];

      index++;

      void element.offsetWidth;

      element.classList.add("scrolling");
    }

    showAnnouncement();

    if (announcementTimer) {
      clearInterval(announcementTimer);
    }

    announcementTimer = setInterval(
      showAnnouncement,
      CONFIG.ANNOUNCEMENT_SECONDS * 1000,
    );

    console.log("✅ Announcements loaded:", messages.length);
  } catch (error) {
    console.error("❌ ANNOUNCEMENTS ERROR:", error);
  }
}

/* ============================================================
   20. AUTO REFRESH
   ============================================================ */

let dashboardRefreshTimer = null;

function startAutoRefresh() {
  if (dashboardRefreshTimer) {
    clearInterval(dashboardRefreshTimer);
  }

  dashboardRefreshTimer = setInterval(
    () => {
      console.log("🔄 Automatic dashboard refresh...");

      refreshDashboardData();
    },
    CONFIG.SYNC_MINUTES * 60 * 1000,
  );
}

async function refreshDashboardData() {
  await Promise.allSettled([
    refreshKPIs(),

    refreshProjects(),

    refreshTimeline(),

    refreshMilestones(),

    refreshStakeholders(),

    refreshDisbursements(),

    refreshAnnouncements(),
  ]);

  markSynced();

  console.log("✅ Dashboard data refreshed.");
}

/* ============================================================
   21. SINGLE DASHBOARD INITIALIZATION
   ============================================================ */

async function initializeDashboard() {
  console.log("🚀 IFAD Portfolio Command Centre starting...");

  /*
     Clock
  */

  updateClock();

  setInterval(updateClock, 1000);

  /*
     Draw fallback legend
     immediately.
  */

  renderLegend();

  /*
     Load map.
     It can run while Sheets
     data loads.
  */

  loadGeoJSON();

  /*
     Load ALL dashboard sections.
     They are now global functions.
  */

  await Promise.allSettled([
    refreshKPIs(),

    refreshProjects(),

    refreshTimeline(),

    refreshMilestones(),

    refreshStakeholders(),

    refreshDisbursements(),

    refreshAnnouncements(),
  ]);

  /*
     Final map redraw after
     Google Sheets project data
     has arrived.
  */

  renderMapAndLegend();

  markSynced();

  startAutoRefresh();

  console.log("✅ Dashboard fully initialized.");
}

/* ============================================================
   22. START AFTER HTML LOAD
   ============================================================ */

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeDashboard);
} else {
  initializeDashboard();
}

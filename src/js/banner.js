/**
 * @file banner.js
 * @description Lógica do editor do Banner de Assinatura (v2).
 *
 * Responsabilidades:
 *  - Sincronizar formulário -> banner (texto, cores, tema, paleta, layout)
 *  - Tema claro/escuro e paletas de acento
 *  - QR Code local com contraste garantido (drawQR)
 *  - Upload de foto (drag & drop)
 *  - Restaurar padrão (resetToDefaults) — restaura TODOS os estados
 *  - Exportação delegada ao módulo BannerExporter (export.js)
 *
 * Ordem de scripts (index.html):
 *  qrcode.lib.js -> config.js -> export.js -> banner.js
 *
 * Tudo roda offline, sem frameworks.
 */

"use strict";

const $ = (id) => document.getElementById(id);

/* ─────────────────────────────────────────
   PALETAS E TEMAS
   ───────────────────────────────────────── */
const PALETTES = {
    crimson: { accent: "#e11d48", signal: "#4f46e5", label: "Crimson" },
    indigo: { accent: "#4f46e5", signal: "#e11d48", label: "Indigo" },
    emerald: { accent: "#059669", signal: "#0ea5e9", label: "Esmeralda" },
    amber: { accent: "#d97706", signal: "#4f46e5", label: "Âmbar" },
    sky: { accent: "#0284c7", signal: "#7c3aed", label: "Azul" },
    violet: { accent: "#7c3aed", signal: "#db2777", label: "Violeta" },
};

const THEMES = {
    light: {
        background: "#ffffff",
        textPrimary: "#0f172a",
        textSecondary: "#475569",
        border: "#e6e8ee",
    },
    dark: {
        background: "#0b1220",
        textPrimary: "#f1f5f9",
        textSecondary: "#94a3b8",
        border: "#22304a",
    },
};

let currentTheme = "light";
let currentPalette = "crimson";

/* ─────────────────────────────────────────
   INICIALIZAÇÃO — popula TODOS os controles a partir de BANNER_CONFIG
   ───────────────────────────────────────── */
function initFromConfig() {
    const d = BANNER_CONFIG.defaults;
    const c = BANNER_CONFIG.colors;
    const ap = BANNER_CONFIG.appearance || {};
    const ex = BANNER_CONFIG.export || {};

    // Conteúdo
    $("f-eyebrow").value = d.eyebrow;
    $("f-name").value = d.name;
    $("f-role").value = d.role;
    if ($("f-empresa")) $("f-empresa").value = d.empresa || "";
    $("f-specs").value = d.specs;
    $("f-tagline").value = d.tagline;
    $("f-email").value = d.email;
    $("f-site").value = d.site;
    $("f-qrurl").value = d.qrUrl;

    // Cores base
    $("f-void").value = c.background;
    $("f-text").value = c.textPrimary;
    $("f-text2").value = c.textSecondary;
    $("f-accent").value = c.accent;
    $("f-border").value = c.border;

    // Tema e paleta
    currentTheme = ap.theme === "dark" ? "dark" : "light";
    currentPalette = PALETTES[ap.accentPalette] ? ap.accentPalette : "crimson";
    if (currentTheme === "dark") applyThemeColors("dark");
    applyPaletteSignal(currentPalette);
    reflectThemeButtons();
    reflectPaletteSwatches();

    // Layout
    if ($("f-show-qr")) $("f-show-qr").checked = true;
    if ($("f-cursor")) $("f-cursor").checked = true;

    // Exportação
    if ($("f-format")) $("f-format").value = ex.format || "png";
    if ($("f-export-size"))
        $("f-export-size").value = ex.defaultSize || "medium";
    const custom = ex.custom || {};
    if ($("f-cw")) $("f-cw").value = custom.width || 2400;
    if ($("f-ch")) $("f-ch").value = custom.height || 640;
    if ($("f-preserve"))
        $("f-preserve").checked = custom.preserveAspect !== false;
    if ($("f-quality"))
        $("f-quality").value = ex.quality != null ? ex.quality : 0.92;
}

/* ─────────────────────────────────────────
   PARSERS
   ───────────────────────────────────────── */
function escapeHTML(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function parseBold(str) {
    return escapeHTML(str).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
}

function renderSpecs(val) {
    const items = val
        .split(";")
        .map((s) => s.trim())
        .filter(Boolean);
    return items
        .map((item, i) => {
            const sep =
                i < items.length - 1 ? '<span class="sep">&#9679;</span>' : "";
            const safe = item.replace(/&/g, "&amp;").replace(/</g, "&lt;");
            return '<span class="role alt">' + safe + "</span>" + sep;
        })
        .join("");
}

/* ─────────────────────────────────────────
   SINCRONIZAÇÃO DE TEXTO
   ───────────────────────────────────────── */
function syncText() {
    $("t-eyebrow").textContent = $("f-eyebrow").value;
    $("t-name").innerHTML = parseBold($("f-name").value);
    $("t-role").textContent = $("f-role").value;

    // Empresa (opcional): só aparece quando preenchida
    const empresa = $("f-empresa") ? $("f-empresa").value.trim() : "";
    if ($("t-company")) {
        $("t-company").textContent = empresa;
        if ($("t-company-sep"))
            $("t-company-sep").textContent = empresa ? " · " : "";
    }

    $("t-specs").innerHTML = renderSpecs($("f-specs").value);

    $("t-tagline").innerHTML = $("f-tagline")
        .value.replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/&lt;br\s*\/?&gt;/gi, "<br>");

    const email = $("f-email").value;
    $("c-email").textContent = email;
    $("c-email").href = "mailto:" + email;

    const site = $("f-site").value;
    $("c-site").textContent = site;
    $("c-site").href = site.startsWith("http") ? site : "https://" + site;

    const words = $("f-name").value.replace(/\*/g, "").trim().split(/\s+/);
    const initials =
        (words[0] && words[0][0] ? words[0][0] : "G") +
        (words[words.length - 1] && words[words.length - 1][0]
            ? words[words.length - 1][0]
            : "C");
    $("monogram").textContent = initials.toUpperCase();
}

/* ─────────────────────────────────────────
   SINCRONIZAÇÃO DE CORES
   ───────────────────────────────────────── */
function syncColors() {
    const root = document.documentElement.style;
    root.setProperty("--void", $("f-void").value);
    root.setProperty("--text", $("f-text").value);
    root.setProperty("--text-2", $("f-text2").value);
    root.setProperty("--accent", $("f-accent").value);
    root.setProperty("--border", $("f-border").value);
    drawQR();
}

/* ─────────────────────────────────────────
   TEMA E PALETA
   ───────────────────────────────────────── */
function applyThemeColors(themeKey) {
    const t = THEMES[themeKey] || THEMES.light;
    $("f-void").value = t.background;
    $("f-text").value = t.textPrimary;
    $("f-text2").value = t.textSecondary;
    $("f-border").value = t.border;
}

function applyPaletteSignal(name) {
    const p = PALETTES[name] || PALETTES.crimson;
    const root = document.documentElement.style;
    root.setProperty("--signal", p.signal);
    root.setProperty("--signal-hover", p.signal);
}

function reflectThemeButtons() {
    const lb = $("theme-light");
    const db = $("theme-dark");
    if (lb) lb.setAttribute("aria-pressed", String(currentTheme === "light"));
    if (db) db.setAttribute("aria-pressed", String(currentTheme === "dark"));
}

function reflectPaletteSwatches() {
    const swatches = document.querySelectorAll(".swatch[data-palette]");
    swatches.forEach((s) => {
        const active = s.getAttribute("data-palette") === currentPalette;
        s.classList.toggle("is-active", active);
        s.setAttribute("aria-pressed", String(active));
    });
}

function setTheme(themeKey) {
    currentTheme = THEMES[themeKey] ? themeKey : "light";
    applyThemeColors(currentTheme);
    reflectThemeButtons();
    syncColors();
}

function setPalette(name) {
    currentPalette = PALETTES[name] ? name : "crimson";
    $("f-accent").value = PALETTES[currentPalette].accent;
    applyPaletteSignal(currentPalette);
    reflectPaletteSwatches();
    syncColors();
}

/* ─────────────────────────────────────────
   QR CODE (preview) — com contraste garantido
   Em tema escuro o texto fica claro; o cartão do QR é branco, então
   forçamos módulos escuros para o código permanecer escaneável.
   ───────────────────────────────────────── */
function relativeLuminance(color) {
    const m = (color || "").match(/[\d.]+/g);
    let r, g, b;
    if (color && color.startsWith("#")) {
        const hex =
            color.length === 4
                ? color
                      .slice(1)
                      .split("")
                      .map((c) => c + c)
                      .join("")
                : color.slice(1);
        r = parseInt(hex.slice(0, 2), 16);
        g = parseInt(hex.slice(2, 4), 16);
        b = parseInt(hex.slice(4, 6), 16);
    } else if (m && m.length >= 3) {
        r = +m[0];
        g = +m[1];
        b = +m[2];
    } else {
        return 0;
    }
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function qrInkColor() {
    const text =
        getComputedStyle(document.documentElement)
            .getPropertyValue("--text")
            .trim() || "#0f172a";
    // Cartão do QR é branco; garante módulos escuros (contraste/escaneável)
    return relativeLuminance(text) > 140 ? "#0f172a" : text;
}

function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

function drawQR() {
    const url = $("f-qrurl").value || "https://example.com";
    const dark = qrInkColor();

    let qr;
    try {
        qr = qrcode(0, "H");
        qr.addData(url);
        qr.make();
    } catch (e) {
        console.warn("[QR] Falha ao gerar QR Code:", e);
        return;
    }

    const count = qr.getModuleCount();
    const canvas = $("qrCanvas");
    const size = canvas.width;
    const ctx = canvas.getContext("2d");
    const cell = size / count;
    const radius = cell * 0.42;

    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = dark;
    for (let row = 0; row < count; row++) {
        for (let col = 0; col < count; col++) {
            if (qr.isDark(row, col)) {
                roundRect(ctx, col * cell, row * cell, cell, cell, radius);
                ctx.fill();
            }
        }
    }
}

/* ─────────────────────────────────────────
   LAYOUT (toggles)
   ───────────────────────────────────────── */
function applyLayoutToggles() {
    const showQR = $("f-show-qr") ? $("f-show-qr").checked : true;
    const qrZone = document.querySelector(".qr-zone");
    if (qrZone) qrZone.style.display = showQR ? "" : "none";

    const cursorOn = $("f-cursor") ? $("f-cursor").checked : true;
    const cursor = document.querySelector(".eyebrow .cursor");
    if (cursor) cursor.style.display = cursorOn ? "" : "none";
}

/* ─────────────────────────────────────────
   UPLOAD DE FOTO
   ───────────────────────────────────────── */
(function initPhotoUploader() {
    const dropZone = $("photo-drop-zone");
    const fileInput = $("f-photo");
    const thumb = $("photo-thumb");
    const nameEl = $("photo-name");
    const removeBtn = $("photo-remove");
    const EMPTY_LABEL = "Clique ou arraste uma imagem";

    function applyPhoto(dataUrl, filename) {
        $("avatarImg").src = dataUrl;
        $("avatar").classList.add("has-photo");
        thumb.src = dataUrl;
        dropZone.classList.add("has-photo");
        nameEl.textContent = filename || "foto-perfil.jpg";
    }

    function clearPhoto() {
        $("avatarImg").src = "";
        $("avatar").classList.remove("has-photo");
        thumb.src = "";
        dropZone.classList.remove("has-photo");
        nameEl.textContent = EMPTY_LABEL;
        fileInput.value = "";
    }

    function loadFile(file) {
        if (!file || !file.type.startsWith("image/")) return;
        const reader = new FileReader();
        reader.onload = (ev) => applyPhoto(ev.target.result, file.name);
        reader.readAsDataURL(file);
    }

    window._clearPhoto = clearPhoto;

    fileInput.addEventListener("change", (e) => loadFile(e.target.files[0]));
    removeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        clearPhoto();
    });
    dropZone.addEventListener("dragover", (e) => {
        e.preventDefault();
        dropZone.classList.add("dragover");
    });
    dropZone.addEventListener("dragleave", (e) => {
        if (!dropZone.contains(e.relatedTarget))
            dropZone.classList.remove("dragover");
    });
    dropZone.addEventListener("drop", (e) => {
        e.preventDefault();
        dropZone.classList.remove("dragover");
        loadFile(e.dataTransfer.files[0]);
    });
})();

/* ─────────────────────────────────────────
   EXPORTAÇÃO
   ───────────────────────────────────────── */
function currentExportOptions() {
    const ex = BANNER_CONFIG.export || {};
    const sizeMode = $("f-export-size") ? $("f-export-size").value : "medium";
    return {
        sizeMode: sizeMode,
        format: $("f-format") ? $("f-format").value : "png",
        width: $("f-cw") ? parseInt($("f-cw").value, 10) : undefined,
        height: $("f-ch") ? parseInt($("f-ch").value, 10) : undefined,
        preserveAspect: $("f-preserve") ? $("f-preserve").checked : true,
        quality: $("f-quality") ? parseFloat($("f-quality").value) : 0.92,
        filename: ex.filename || "banner-assinatura.png",
    };
}

function refreshExportUI() {
    const opts = currentExportOptions();
    const isCustom = opts.sizeMode === "custom";
    const fmtLossy = opts.format === "jpeg" || opts.format === "webp";

    // Mostra/oculta blocos
    const customBlock = $("custom-res");
    if (customBlock) customBlock.hidden = !isCustom;
    const qualityRow = $("quality-row");
    if (qualityRow) qualityRow.hidden = !fmtLossy;

    // Altura desabilitada quando preserva proporção
    if ($("f-ch")) $("f-ch").disabled = isCustom && opts.preserveAspect;

    // Valor da qualidade
    if ($("quality-val") && $("f-quality"))
        $("quality-val").textContent =
            Math.round(parseFloat($("f-quality").value) * 100) + "%";

    if (typeof BannerExporter === "undefined") return;

    const W = BANNER_CONFIG.brand.bannerWidth;
    const H = BANNER_CONFIG.brand.bannerHeight;
    const d = BannerExporter.describeTarget(opts, W, H);

    // Em modo custom com proporção travada, espelha a altura calculada
    if (isCustom && opts.preserveAspect && $("f-ch"))
        $("f-ch").value = d.height;

    const hint = $("export-dim-hint");
    if (hint) {
        const fmtName = (opts.format || "png").toUpperCase();
        hint.textContent =
            "Arquivo: " +
            d.width +
            " × " +
            d.height +
            " px · " +
            fmtName +
            " · " +
            (d.uniform
                ? d.scaleX.toFixed(2) + "×"
                : d.scaleX.toFixed(2) + "× / " + d.scaleY.toFixed(2) + "×");
    }

    const validation = $("export-validation");
    if (validation) {
        validation.textContent = d.message || "";
        validation.classList.toggle("is-error", !d.valid);
        validation.classList.toggle("is-warn", d.valid && !!d.message);
    }

    const btn = $("btn-png");
    if (btn) btn.disabled = !d.valid;
}

async function handleExport() {
    const btn = $("btn-png");
    const original = btn.textContent;
    btn.disabled = true;
    btn.classList.add("is-loading");
    btn.textContent = "Gerando...";
    try {
        await BannerExporter.download(currentExportOptions());
    } catch (err) {
        console.error("[Export]", err);
        const detail = err && err.message ? err.message : String(err);
        alert(
            "Não foi possível exportar a imagem.\n\nDetalhe: " +
                detail +
                "\n\nTente um navegador atualizado (Chrome, Edge, Firefox ou Safari).",
        );
    } finally {
        btn.classList.remove("is-loading");
        btn.textContent = original;
        refreshExportUI(); // reavalia o estado disabled
    }
}

/* ─────────────────────────────────────────
   RESET — restaura integralmente o estado padrão
   ───────────────────────────────────────── */
function resetToDefaults() {
    initFromConfig();
    if (typeof window._clearPhoto === "function") window._clearPhoto();
    syncText();
    syncColors();
    applyLayoutToggles();
    refreshExportUI();
}

/* ─────────────────────────────────────────
   EVENT LISTENERS
   ───────────────────────────────────────── */
const TEXT_FIELDS = [
    "f-eyebrow",
    "f-name",
    "f-role",
    "f-empresa",
    "f-specs",
    "f-tagline",
    "f-email",
    "f-site",
];
const COLOR_FIELDS = ["f-void", "f-text", "f-text2", "f-accent", "f-border"];

TEXT_FIELDS.forEach((id) => {
    const el = $(id);
    if (el) el.addEventListener("input", syncText);
});
COLOR_FIELDS.forEach((id) => {
    const el = $(id);
    if (el) el.addEventListener("input", syncColors);
});
$("f-qrurl").addEventListener("input", drawQR);

// Tema
if ($("theme-light"))
    $("theme-light").addEventListener("click", () => setTheme("light"));
if ($("theme-dark"))
    $("theme-dark").addEventListener("click", () => setTheme("dark"));

// Paletas
document.querySelectorAll(".swatch[data-palette]").forEach((s) => {
    s.addEventListener("click", () =>
        setPalette(s.getAttribute("data-palette")),
    );
});

// Layout toggles
["f-show-qr", "f-cursor"].forEach((id) => {
    const el = $(id);
    if (el) el.addEventListener("change", applyLayoutToggles);
});

// Exportação
[
    "f-format",
    "f-export-size",
    "f-cw",
    "f-ch",
    "f-preserve",
    "f-quality",
].forEach((id) => {
    const el = $(id);
    if (el) {
        el.addEventListener("input", refreshExportUI);
        el.addEventListener("change", refreshExportUI);
    }
});

$("btn-png").addEventListener("click", handleExport);
$("btn-reset").addEventListener("click", resetToDefaults);

/* ─────────────────────────────────────────
   BOOTSTRAP
   ───────────────────────────────────────── */
initFromConfig();
syncText();
syncColors();
applyLayoutToggles();
refreshExportUI();

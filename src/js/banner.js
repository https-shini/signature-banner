/**
 * @file banner.js
 * @description Lógica do editor do Banner de Assinatura (v3).
 *
 * Cores e tema são delegados ao módulo BannerTheme (theme.js), que é a
 * fonte única de verdade. Este arquivo cuida da UI: conteúdo, controles
 * de tema/cores/paleta, layout, exportação e import/export de config.
 *
 * Ordem de scripts (index.html):
 *  qrcode.lib.js -> config.js -> theme.js -> export.js -> banner.js
 */

"use strict";

const $ = (id) => document.getElementById(id);

/* Tokens semânticos editáveis na seção Cores */
const TOKEN_FIELDS = [
    { name: "background", label: "Plano de fundo" },
    { name: "textPrimary", label: "Texto primário" },
    { name: "textSecondary", label: "Texto secundário" },
    { name: "accent", label: "Acento" },
    { name: "border", label: "Bordas" },
];

/* ─────────────────────────────────────────
   INICIALIZAÇÃO (conteúdo, layout, exportação)
   O tema é tratado por BannerTheme + refreshThemeUI().
   ───────────────────────────────────────── */
function initFromConfig() {
    const d = BANNER_CONFIG.defaults;
    const ex = BANNER_CONFIG.export || {};

    $("f-eyebrow").value = d.eyebrow;
    $("f-name").value = d.name;
    $("f-role").value = d.role;
    if ($("f-empresa")) $("f-empresa").value = d.empresa || "";
    $("f-specs").value = d.specs;
    $("f-tagline").value = d.tagline;
    $("f-email").value = d.email;
    $("f-site").value = d.site;
    $("f-qrurl").value = d.qrUrl;

    if ($("f-show-qr")) $("f-show-qr").checked = true;
    if ($("f-cursor")) $("f-cursor").checked = true;

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
   PARSERS / TEXTO
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
                i < items.length - 1
                    ? '<span class="sep">&#9679;</span>'
                    : "";
            const safe = item.replace(/&/g, "&amp;").replace(/</g, "&lt;");
            return '<span class="role alt">' + safe + "</span>" + sep;
        })
        .join("");
}

function syncText() {
    $("t-eyebrow").textContent = $("f-eyebrow").value;
    $("t-name").innerHTML = parseBold($("f-name").value);
    $("t-role").textContent = $("f-role").value;

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
   QR CODE — contraste garantido (cartão branco)
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
        console.warn("[QR] Falha ao gerar:", e);
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
   TEMA / CORES — UI ligada ao BannerTheme
   ───────────────────────────────────────── */
function reflectModeButtons() {
    const mode = BannerTheme.getMode();
    [
        ["mode-light", "light"],
        ["mode-dark", "dark"],
        ["mode-auto", "auto"],
    ].forEach(([id, val]) => {
        if ($(id)) $(id).setAttribute("aria-pressed", String(mode === val));
    });
    const note = $("mode-note");
    if (note) {
        note.textContent =
            mode === "auto"
                ? "Seguindo o sistema: " +
                  (BannerTheme.effectiveMode() === "dark" ? "escuro" : "claro")
                : "";
    }
}

function reflectPaletteSwatches() {
    const pal = BannerTheme.getPalette();
    document.querySelectorAll(".swatch[data-palette]").forEach((s) => {
        const active = s.getAttribute("data-palette") === pal;
        s.classList.toggle("is-active", active);
        s.setAttribute("aria-pressed", String(active));
    });
}

function reflectTokenInputs() {
    TOKEN_FIELDS.forEach(({ name }) => {
        const hex = BannerTheme.getToken(name) || "#000000";
        const norm = BannerTheme.normalizeHex(hex);
        const col = $("f-col-" + name);
        const txt = $("f-hex-" + name);
        const err = $("err-" + name);
        if (col) col.value = norm;
        if (txt) txt.value = norm;
        if (err) err.textContent = "";
        if (txt) txt.classList.remove("is-invalid");
    });
}

function refreshThemeUI() {
    reflectModeButtons();
    reflectPaletteSwatches();
    reflectTokenInputs();
}

function handleTokenColorInput(name) {
    const col = $("f-col-" + name);
    if (!col) return;
    BannerTheme.setToken(name, col.value);
    const txt = $("f-hex-" + name);
    if (txt) {
        txt.value = BannerTheme.normalizeHex(col.value);
        txt.classList.remove("is-invalid");
    }
    const err = $("err-" + name);
    if (err) err.textContent = "";
    if (name === "accent") reflectPaletteSwatches();
}

function handleTokenHexInput(name) {
    const txt = $("f-hex-" + name);
    if (!txt) return;
    const val = txt.value.trim();
    const err = $("err-" + name);
    if (BannerTheme.isValidHex(val)) {
        const norm = BannerTheme.normalizeHex(val);
        BannerTheme.setToken(name, norm);
        const col = $("f-col-" + name);
        if (col) col.value = norm;
        txt.classList.remove("is-invalid");
        if (err) err.textContent = "";
        if (name === "accent") reflectPaletteSwatches();
    } else {
        txt.classList.add("is-invalid");
        if (err) err.textContent = "Use #RGB ou #RRGGBB.";
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
    return {
        sizeMode: $("f-export-size") ? $("f-export-size").value : "medium",
        format: $("f-format") ? $("f-format").value : "png",
        width: $("f-cw") ? parseInt($("f-cw").value, 10) : undefined,
        height: $("f-ch") ? parseInt($("f-ch").value, 10) : undefined,
        preserveAspect: $("f-preserve") ? $("f-preserve").checked : true,
        quality: $("f-quality") ? parseFloat($("f-quality").value) : 0.92,
        filename: ex.filename || "banner-assinatura",
    };
}

function refreshExportUI() {
    const opts = currentExportOptions();
    const isCustom = opts.sizeMode === "custom";
    const fmtLossy = opts.format === "jpeg" || opts.format === "webp";

    if ($("custom-res")) $("custom-res").hidden = !isCustom;
    if ($("quality-row")) $("quality-row").hidden = !fmtLossy;
    if ($("f-ch")) $("f-ch").disabled = isCustom && opts.preserveAspect;
    if ($("quality-val") && $("f-quality"))
        $("quality-val").textContent =
            Math.round(parseFloat($("f-quality").value) * 100) + "%";

    if (typeof BannerExporter === "undefined") return;
    const W = BANNER_CONFIG.brand.bannerWidth;
    const H = BANNER_CONFIG.brand.bannerHeight;
    const d = BannerExporter.describeTarget(opts, W, H);

    if (isCustom && opts.preserveAspect && $("f-ch")) $("f-ch").value = d.height;

    const hint = $("export-dim-hint");
    if (hint) {
        hint.textContent =
            "Arquivo: " +
            d.width +
            " × " +
            d.height +
            " px · " +
            (opts.format || "png").toUpperCase() +
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
    if ($("btn-png")) $("btn-png").disabled = !d.valid;
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
        refreshExportUI();
    }
}

/* ─────────────────────────────────────────
   IMPORTAR / EXPORTAR CONFIGURAÇÃO (JSON)
   ───────────────────────────────────────── */
function gatherConfigSnapshot() {
    return {
        _type: "signature-banner-config",
        version: 3,
        theme: BannerTheme.exportConfig(),
        content: {
            eyebrow: $("f-eyebrow").value,
            name: $("f-name").value,
            role: $("f-role").value,
            empresa: $("f-empresa") ? $("f-empresa").value : "",
            specs: $("f-specs").value,
            tagline: $("f-tagline").value,
            email: $("f-email").value,
            site: $("f-site").value,
            qrUrl: $("f-qrurl").value,
        },
        layout: {
            showQR: $("f-show-qr") ? $("f-show-qr").checked : true,
            cursor: $("f-cursor") ? $("f-cursor").checked : true,
        },
        export: {
            format: $("f-format") ? $("f-format").value : "png",
            size: $("f-export-size") ? $("f-export-size").value : "medium",
            width: $("f-cw") ? parseInt($("f-cw").value, 10) : 2400,
            height: $("f-ch") ? parseInt($("f-ch").value, 10) : 640,
            preserveAspect: $("f-preserve") ? $("f-preserve").checked : true,
            quality: $("f-quality") ? parseFloat($("f-quality").value) : 0.92,
        },
    };
}

function applyConfigSnapshot(s) {
    if (!s || typeof s !== "object") throw new Error("Arquivo inválido.");
    if (s.theme) BannerTheme.importConfig(s.theme);

    const c = s.content || {};
    const setv = (id, v) => {
        if ($(id) && v != null) $(id).value = v;
    };
    setv("f-eyebrow", c.eyebrow);
    setv("f-name", c.name);
    setv("f-role", c.role);
    setv("f-empresa", c.empresa);
    setv("f-specs", c.specs);
    setv("f-tagline", c.tagline);
    setv("f-email", c.email);
    setv("f-site", c.site);
    setv("f-qrurl", c.qrUrl);

    if (s.layout) {
        if ($("f-show-qr")) $("f-show-qr").checked = !!s.layout.showQR;
        if ($("f-cursor")) $("f-cursor").checked = !!s.layout.cursor;
    }
    if (s.export) {
        setv("f-format", s.export.format);
        setv("f-export-size", s.export.size);
        if ($("f-cw") && s.export.width) $("f-cw").value = s.export.width;
        if ($("f-ch") && s.export.height) $("f-ch").value = s.export.height;
        if ($("f-preserve"))
            $("f-preserve").checked = s.export.preserveAspect !== false;
        if ($("f-quality") && s.export.quality != null)
            $("f-quality").value = s.export.quality;
    }

    syncText();
    applyLayoutToggles();
    refreshThemeUI();
    refreshExportUI();
}

function exportConfigFile() {
    const data = JSON.stringify(gatherConfigSnapshot(), null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "banner-config.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function importConfigFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
        try {
            applyConfigSnapshot(JSON.parse(ev.target.result));
        } catch (e) {
            console.error("[Import]", e);
            alert(
                "Não foi possível importar a configuração.\n\nDetalhe: " +
                    (e && e.message ? e.message : e),
            );
        }
    };
    reader.readAsText(file);
}

/* ─────────────────────────────────────────
   RESET — restaura integralmente o padrão
   ───────────────────────────────────────── */
function resetToDefaults() {
    BannerTheme.importConfig(JSON.parse(JSON.stringify(BANNER_CONFIG.theme)));
    initFromConfig();
    if (typeof window._clearPhoto === "function") window._clearPhoto();
    syncText();
    applyLayoutToggles();
    refreshThemeUI();
    refreshExportUI();
}

/* ─────────────────────────────────────────
   LISTENERS
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
TEXT_FIELDS.forEach((id) => {
    const el = $(id);
    if (el) el.addEventListener("input", syncText);
});
$("f-qrurl").addEventListener("input", drawQR);

// Modo de tema
[
    ["mode-light", "light"],
    ["mode-dark", "dark"],
    ["mode-auto", "auto"],
].forEach(([id, val]) => {
    const el = $(id);
    if (el)
        el.addEventListener("click", () => {
            BannerTheme.setMode(val);
            refreshThemeUI();
        });
});

// Paletas
document.querySelectorAll(".swatch[data-palette]").forEach((s) => {
    s.addEventListener("click", () => {
        BannerTheme.setPalette(s.getAttribute("data-palette"));
        refreshThemeUI();
    });
});

// Cores por token (picker + hex)
TOKEN_FIELDS.forEach(({ name }) => {
    const col = $("f-col-" + name);
    const txt = $("f-hex-" + name);
    if (col) col.addEventListener("input", () => handleTokenColorInput(name));
    if (txt) txt.addEventListener("input", () => handleTokenHexInput(name));
});

// Layout
["f-show-qr", "f-cursor"].forEach((id) => {
    const el = $(id);
    if (el) el.addEventListener("change", applyLayoutToggles);
});

// Exportação
["f-format", "f-export-size", "f-cw", "f-ch", "f-preserve", "f-quality"].forEach(
    (id) => {
        const el = $(id);
        if (el) {
            el.addEventListener("input", refreshExportUI);
            el.addEventListener("change", refreshExportUI);
        }
    },
);

$("btn-png").addEventListener("click", handleExport);
$("btn-reset").addEventListener("click", resetToDefaults);

// Import / Export de configuração
if ($("btn-export-cfg"))
    $("btn-export-cfg").addEventListener("click", exportConfigFile);
if ($("btn-import-cfg") && $("f-import-cfg")) {
    $("btn-import-cfg").addEventListener("click", () => $("f-import-cfg").click());
    $("f-import-cfg").addEventListener("change", (e) =>
        importConfigFile(e.target.files[0]),
    );
}

/* ─────────────────────────────────────────
   BOOTSTRAP
   ───────────────────────────────────────── */
initFromConfig();
BannerTheme.onChange(() => drawQR());
BannerTheme.init(BANNER_CONFIG.theme);
refreshThemeUI();
syncText();
applyLayoutToggles();
refreshExportUI();

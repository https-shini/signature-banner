/**
 * @file banner.js
 * @description Lógica principal do Banner de Assinatura.
 *
 * Responsabilidades:
 *  - Sincronizar o formulário de edição com o DOM do banner (syncText, syncColors)
 *  - Gerar o QR Code localmente (drawQR)
 *  - Exportar o banner como PNG de alta resolução (exportPNG)
 *  - Inicializar o estado a partir de BANNER_CONFIG (definido em config.js)
 *
 * Dependências (declaradas no index.html, nesta ordem):
 *  1. src/js/qrcode.lib.js  — gerador QR (Kazuhiko Arase, MIT)
 *  2. src/js/config.js      — objeto BANNER_CONFIG
 *  3. src/js/banner.js      — este arquivo
 *
 * Não há dependências de frameworks externos ou CDNs.
 * Todo o código roda 100% offline no navegador.
 */

"use strict";

/* ─────────────────────────────────────────
   Atalho de seleção por ID
   ───────────────────────────────────────── */
const $ = (id) => document.getElementById(id);

/* ─────────────────────────────────────────
   INICIALIZAÇÃO
   Popula o formulário com os valores de BANNER_CONFIG
   e renderiza o estado inicial do banner.
   ───────────────────────────────────────── */
function initFromConfig() {
    const d = BANNER_CONFIG.defaults;
    const c = BANNER_CONFIG.colors;

    // Campos de texto
    $("f-eyebrow").value = d.eyebrow;
    $("f-name").value = d.name;
    $("f-role").value = d.role;
    $("f-specs").value = d.specs;
    $("f-tagline").value = d.tagline;
    $("f-email").value = d.email;
    $("f-site").value = d.site;
    $("f-qrurl").value = d.qrUrl;

    // Cores
    $("f-void").value = c.background;
    $("f-text").value = c.textPrimary;
    $("f-text2").value = c.textSecondary;
    $("f-accent").value = c.accent;
    $("f-border").value = c.border;

    // Aplica CSS signal (indigo) via variável
    document.documentElement.style.setProperty(
        "--signal",
        BANNER_CONFIG.brand.signal,
    );
    document.documentElement.style.setProperty(
        "--signal-hover",
        BANNER_CONFIG.brand.signal,
    );
}

/* ─────────────────────────────────────────
   PARSERS DE TEXTO
   ───────────────────────────────────────── */

/**
 * Converte **texto** em <b>texto</b> para suporte a negrito inline.
 * Escapa o restante do HTML para segurança.
 * @param {string} str
 * @returns {string} HTML sanitizado com <b> para negritos
 */
function parseBold(str) {
    const esc = (s) =>
        s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return esc(str).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
}

/**
 * Converte uma lista de especializações separadas por ";" em HTML de spans.
 * Ex: "Full Stack; AI" → <span class="role alt">Full Stack</span>•<span...>AI</span>
 * @param {string} val
 * @returns {string} HTML para o container .roles
 */
function renderSpecs(val) {
    const items = val
        .split(";")
        .map((s) => s.trim())
        .filter(Boolean);
    return items
        .map((item, i) => {
            const sep =
                i < items.length - 1 ? '<span class="sep">&#9679;</span>' : "";
            const safeItem = item.replace(/&/g, "&amp;").replace(/</g, "&lt;");
            return `<span class="role alt">${safeItem}</span>${sep}`;
        })
        .join("");
}

/* ─────────────────────────────────────────
   SINCRONIZAÇÃO DE TEXTO (DOM → Banner)
   Chamada a cada keystroke nos inputs.
   ───────────────────────────────────────── */
function syncText() {
    $("t-eyebrow").textContent = $("f-eyebrow").value;
    $("t-name").innerHTML = parseBold($("f-name").value);
    $("t-role").textContent = $("f-role").value;
    $("t-specs").innerHTML = renderSpecs($("f-specs").value);

    // Tagline: escapa HTML mas permite <br> literal
    $("t-tagline").innerHTML = $("f-tagline")
        .value.replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/&lt;br\s*\/?&gt;/gi, "<br>");

    // E-mail
    const email = $("f-email").value;
    $("c-email").textContent = email;
    $("c-email").href = "mailto:" + email;

    // Site
    const site = $("f-site").value;
    $("c-site").textContent = site;
    $("c-site").href = site.startsWith("http") ? site : "https://" + site;

    // Monograma: iniciais da primeira e última palavra do nome
    const words = $("f-name").value.replace(/\*/g, "").trim().split(/\s+/);
    const initials =
        (words[0]?.[0] ?? "G") + (words[words.length - 1]?.[0] ?? "C");
    $("monogram").textContent = initials.toUpperCase();
}

/* ─────────────────────────────────────────
   SINCRONIZAÇÃO DE CORES (CSS vars)
   ───────────────────────────────────────── */
function syncColors() {
    const root = document.documentElement.style;
    root.setProperty("--void", $("f-void").value);
    root.setProperty("--text", $("f-text").value);
    root.setProperty("--text-2", $("f-text2").value);
    root.setProperty("--accent", $("f-accent").value);
    root.setProperty("--border", $("f-border").value);
    drawQR(); // recolore os módulos do QR com a nova cor de texto
}

/* ─────────────────────────────────────────
   QR CODE
   Gerado localmente usando a lib embutida.
   Usa módulos com cantos arredondados.
   ───────────────────────────────────────── */

/**
 * Desenha um retângulo com bordas arredondadas no canvas 2D.
 * Reutilizado pelo QR e pelo exporter.
 */
function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

/**
 * Renderiza o QR Code no elemento <canvas id="qrCanvas">.
 * Lê a URL de #f-qrurl e a cor do texto da CSS var --text.
 */
function drawQR() {
    const url = $("f-qrurl").value || "https://example.com";
    const dark =
        getComputedStyle(document.documentElement)
            .getPropertyValue("--text")
            .trim() || "#0f172a";

    let qr;
    try {
        qr = qrcode(0, "H"); // type 0 = tamanho automático, ECC nível H (30%)
        qr.addData(url);
        qr.make();
    } catch (e) {
        console.warn("[QR] Falha ao gerar QR Code:", e);
        return;
    }

    const count = qr.getModuleCount();
    const canvas = $("qrCanvas");
    const size = canvas.width; // 232px
    const ctx = canvas.getContext("2d");
    const cell = size / count;
    const radius = cell * 0.42; // arredondamento dos módulos

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
   UPLOAD DE FOTO
   Drop zone com preview em miniatura, remoção e drag & drop.
   ───────────────────────────────────────── */
(function initPhotoUploader() {
    const dropZone = document.getElementById("photo-drop-zone");
    const fileInput = document.getElementById("f-photo");
    const thumb = document.getElementById("photo-thumb");
    const nameEl = document.getElementById("photo-name");
    const removeBtn = document.getElementById("photo-remove");

    const EMPTY_LABEL = "Clique ou arraste uma imagem";

    function applyPhoto(dataUrl, filename) {
        // Banner
        $("avatarImg").src = dataUrl;
        $("avatar").classList.add("has-photo");
        // Drop zone
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

    // Expõe clearPhoto para o botão de reset
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
   RESET
   Restaura todos os campos para os valores de BANNER_CONFIG.
   ───────────────────────────────────────── */
$("btn-reset").addEventListener("click", () => {
    initFromConfig();
    if (window._clearPhoto) window._clearPhoto();
    syncText();
    syncColors();
});

/* ─────────────────────────────────────────
   EVENT LISTENERS — atualização em tempo real
   ───────────────────────────────────────── */
const TEXT_FIELDS = [
    "f-eyebrow",
    "f-name",
    "f-role",
    "f-specs",
    "f-tagline",
    "f-email",
    "f-site",
];
const COLOR_FIELDS = ["f-void", "f-text", "f-text2", "f-accent", "f-border"];

TEXT_FIELDS.forEach((id) => $(id).addEventListener("input", syncText));
COLOR_FIELDS.forEach((id) => $(id).addEventListener("input", syncColors));
$("f-qrurl").addEventListener("input", drawQR);

/* ─────────────────────────────────────────
   EXPORTAÇÃO PNG
   Renderiza o banner diretamente em <canvas> 2D,
   reconstruindo todos os elementos visuais via Canvas API.
   Salva como PNG em escala 2× (2400×640px por padrão).
   ───────────────────────────────────────── */

/** Lê uma CSS custom property do :root. */
function cssVar(name) {
    return getComputedStyle(document.documentElement)
        .getPropertyValue(name)
        .trim();
}

/**
 * Converte uma cor hex ou rgb(...) para rgba(..., alpha).
 * @param {string} color — #rrggbb ou rgb(r,g,b)
 * @param {number} a     — alpha 0..1
 * @returns {string}
 */
function hexA(color, a) {
    let r, g, b;
    if (color.startsWith("#")) {
        r = parseInt(color.slice(1, 3), 16);
        g = parseInt(color.slice(3, 5), 16);
        b = parseInt(color.slice(5, 7), 16);
    } else {
        const m = color.match(/\d+/g);
        [r, g, b] = [+m[0], +m[1], +m[2]];
    }
    return `rgba(${r},${g},${b},${a})`;
}

/** Desenha texto com letter-spacing manual (Canvas API não suporta nativo). */
function letterSpacedText(ctx, text, x, y, ls) {
    let cx = x;
    for (const ch of text) {
        ctx.fillText(ch, cx, y);
        cx += ctx.measureText(ch).width + ls;
    }
}

/** Mede a largura de texto com letter-spacing manual. */
function measureSpaced(ctx, text, ls) {
    let w = 0;
    for (const ch of text) w += ctx.measureText(ch).width + ls;
    return w - ls;
}

/**
 * Desenha o nome respeitando negritos parciais (**palavra**).
 * Usa Fraunces weight 400 para texto normal e 500 para <b>.
 */
function drawName(ctx, x, y, color) {
    const html = $("t-name").innerHTML;
    const parts = html.split(/(<b>.*?<\/b>)/g).filter(Boolean);
    ctx.fillStyle = color;
    let cx = x;
    for (const part of parts) {
        const bold = part.startsWith("<b>");
        const txt = part
            .replace(/<\/?b>/g, "")
            .replace(/&amp;/g, "&")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">");
        ctx.font = `${bold ? "500" : "400"} 46px 'Fraunces', Georgia, serif`;
        ctx.fillText(txt, cx, y);
        cx += ctx.measureText(txt).width;
    }
}

/**
 * Desenha as especializações com bullets circulares de acento entre elas.
 */
function drawSpecs(ctx, x, y, color, accentColor) {
    const items = [...$("t-specs").querySelectorAll(".role")].map(
        (e) => e.textContent,
    );
    ctx.font = "400 14.5px 'Inter', sans-serif";
    let cx = x;
    items.forEach((item, i) => {
        ctx.fillStyle = color;
        ctx.fillText(item, cx, y);
        cx += ctx.measureText(item).width + 14;
        if (i < items.length - 1) {
            ctx.fillStyle = accentColor;
            ctx.beginPath();
            ctx.arc(cx, y - 5, 2.5, 0, Math.PI * 2);
            ctx.fill();
            cx += 14;
        }
    });
}

/** Extrai as linhas da tagline separadas por <br>. */
function parseTaglineLines(node) {
    return node.innerHTML
        .split(/<br\s*\/?>/i)
        .map((s) =>
            s
                .replace(/&amp;/g, "&")
                .replace(/&lt;/g, "<")
                .replace(/&gt;/g, ">")
                .trim(),
        );
}

/* ── Helpers de ícones desenhados no Canvas ── */

function roundRectPath(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

function drawArrow(ctx, x, y, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(x - 7, y);
    ctx.lineTo(x + 5, y);
    ctx.moveTo(x + 1, y - 4);
    ctx.lineTo(x + 5, y);
    ctx.lineTo(x + 1, y + 4);
    ctx.stroke();
}

function drawChat(ctx, x, y, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    roundRectPath(ctx, x - 7, y - 6, 14, 10, 2.5);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - 4, y + 4);
    ctx.lineTo(x - 6, y + 8);
    ctx.lineTo(x - 1, y + 4);
    ctx.stroke();
}

function drawEnvelope(ctx, x, y, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.6;
    ctx.lineJoin = "round";
    roundRectPath(ctx, x, y - 5, 16, 12, 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + 1, y - 3);
    ctx.lineTo(x + 8, y + 2);
    ctx.lineTo(x + 15, y - 3);
    ctx.stroke();
}

function drawGlobe(ctx, x, y, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(x + 7, y + 1, 7, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y + 1);
    ctx.lineTo(x + 14, y + 1);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(x + 7, y + 1, 3, 7, 0, 0, Math.PI * 2);
    ctx.stroke();
}

/**
 * Exporta o banner como PNG.
 *
 * @param {number} scale — fator de escala (padrão: BANNER_CONFIG.export.scale)
 *
 * O canvas é criado off-screen com dimensões W*scale × H*scale.
 * Todos os elementos são reconstruídos via Canvas 2D API para fidelidade pixel-perfect.
 * O arquivo é baixado automaticamente via link temporário.
 */
async function exportPNG(scale = BANNER_CONFIG.export.scale) {
    // Garante que as web fonts estejam carregadas antes de pintar texto
    if (document.fonts?.ready) {
        try {
            await document.fonts.load("400 46px 'Fraunces'");
            await document.fonts.load("500 52px 'JetBrains Mono'");
            await document.fonts.load("400 15px 'Inter'");
            await document.fonts.ready;
        } catch (_) {
            /* segue sem garantia de fonte */
        }
    }

    const {
        bannerWidth: W,
        bannerHeight: H,
        borderRadius,
    } = BANNER_CONFIG.brand;
    const canvas = document.createElement("canvas");
    canvas.width = W * scale;
    canvas.height = H * scale;
    const ctx = canvas.getContext("2d");
    ctx.scale(scale, scale);
    ctx.textBaseline = "alphabetic";

    // Resolve cores atuais (respeitando alterações do usuário no painel)
    const cBg = getComputedStyle($("banner")).backgroundColor || "#ffffff";
    const cText = cssVar("--text") || "#0f172a";
    const cText2 = cssVar("--text-2") || "#475569";
    const cText3 = cssVar("--text-3") || "#64748b";
    const cAccent = cssVar("--accent") || "#e11d48";
    const cSignal = cssVar("--signal") || "#4f46e5";
    const cBorder =
        getComputedStyle($("banner")).borderTopColor || "rgba(0,0,0,.09)";

    /* ── Fundo ── */
    roundRectPath(ctx, 0, 0, W, H, borderRadius);
    ctx.fillStyle = "#ffffff";
    ctx.fill();

    // Overlay de gradiente radial (glow crimson + indigo)
    const g1 = ctx.createRadialGradient(
        W * 0.86,
        H * 0.38,
        0,
        W * 0.86,
        H * 0.38,
        420,
    );
    g1.addColorStop(0, hexA(cAccent, 0.07));
    g1.addColorStop(1, hexA(cAccent, 0));
    roundRectPath(ctx, 0, 0, W, H, borderRadius);
    ctx.fillStyle = g1;
    ctx.fill();

    const g2 = ctx.createRadialGradient(
        W * 0.08,
        H * 1.15,
        0,
        W * 0.08,
        H * 1.15,
        380,
    );
    g2.addColorStop(0, hexA(cSignal, 0.05));
    g2.addColorStop(1, hexA(cSignal, 0));
    roundRectPath(ctx, 0, 0, W, H, borderRadius);
    ctx.fillStyle = g2;
    ctx.fill();

    // Borda
    roundRectPath(ctx, 0.5, 0.5, W - 1, H - 1, borderRadius);
    ctx.strokeStyle = cBorder;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Rail esquerda (linha vertical de acento)
    const rg = ctx.createLinearGradient(0, 0, 0, H);
    rg.addColorStop(0, hexA(cAccent, 0));
    rg.addColorStop(0.3, cAccent);
    rg.addColorStop(0.7, cAccent);
    rg.addColorStop(1, hexA(cAccent, 0));
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, 4, H);

    /* ── Avatar ── */
    const ax = 125,
        ay = 160,
        ar = 75;
    const avatarEl = $("avatar");
    const avatarImg = $("avatarImg");
    const hasPhoto = avatarEl.classList.contains("has-photo") && avatarImg?.src;

    if (hasPhoto) {
        try {
            if (avatarImg.decode) await avatarImg.decode();
        } catch (_) {}
        ctx.save();
        ctx.beginPath();
        ctx.arc(ax, ay, ar, 0, Math.PI * 2);
        ctx.clip();
        const iw = avatarImg.naturalWidth || avatarImg.width;
        const ih = avatarImg.naturalHeight || avatarImg.height;
        const side = ar * 2;
        const ratio = Math.max(side / iw, side / ih);
        ctx.drawImage(
            avatarImg,
            ax - (iw * ratio) / 2,
            ay - (ih * ratio) / 2,
            iw * ratio,
            ih * ratio,
        );
        ctx.restore();
        ctx.beginPath();
        ctx.arc(ax, ay, ar, 0, Math.PI * 2);
        ctx.lineWidth = 1;
        ctx.strokeStyle = hexA(cAccent, 0.3);
        ctx.stroke();
    } else {
        ctx.save();
        ctx.beginPath();
        ctx.arc(ax, ay, ar, 0, Math.PI * 2);
        const ag = ctx.createRadialGradient(
            ax - 26,
            ay - 32,
            0,
            ax,
            ay,
            ar * 1.3,
        );
        ag.addColorStop(0, "#ffffff");
        ag.addColorStop(0.78, "#f1f5f9");
        ctx.fillStyle = ag;
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = hexA(cAccent, 0.3);
        ctx.stroke();
        ctx.restore();

        const initials =
            $("monogram")
                .textContent.replace(/[^A-Za-z]/g, "")
                .slice(0, 2)
                .toUpperCase() || "GC";
        ctx.font = "500 52px 'JetBrains Mono', monospace";
        const mW = ctx.measureText(initials).width;
        const mx = ax - mW / 2;
        ctx.fillStyle = cText;
        ctx.fillText(initials, mx, ay + 18);
    }

    /* ── Coluna de conteúdo ── */
    const x = 266;

    // Eyebrow
    let y = 46;
    ctx.font = "500 12px 'JetBrains Mono', monospace";
    ctx.fillStyle = cAccent;
    ctx.fillText("//", x, y);
    const slashW = ctx.measureText("// ").width;
    ctx.fillStyle = cText3;
    const eyebrow = $("t-eyebrow").textContent.toUpperCase();
    ctx.save();
    letterSpacedText(ctx, eyebrow, x + slashW, y, 2.1);
    ctx.restore();
    // Cursor piscando
    const ebW = measureSpaced(ctx, eyebrow, 2.1);
    ctx.fillStyle = cAccent;
    ctx.fillRect(x + slashW + ebW + 8, y - 11, 8, 14);

    // Nome
    y = 100;
    drawName(ctx, x, y, cText);

    // Cargo principal
    y = 135;
    ctx.font = "500 15px 'Inter', sans-serif";
    ctx.fillStyle = cText;
    ctx.fillText($("t-role").textContent, x, y);

    // Especializações
    y = 162;
    drawSpecs(ctx, x, y, cText2, cAccent);

    // Tagline (até 2 linhas)
    y = 195;
    ctx.font = "300 15px 'Inter', sans-serif";
    ctx.fillStyle = cText2;
    parseTaglineLines($("t-tagline")).forEach((ln, i) =>
        ctx.fillText(ln, x, y + i * 22),
    );

    // Linha de contato (sem CTAs — ocupa o espaço vago)
    y = 248;
    ctx.font = "400 13px 'JetBrains Mono', monospace";
    drawEnvelope(ctx, x + 1, y - 5, cAccent);
    ctx.fillStyle = cText2;
    const email = $("c-email").textContent;
    ctx.fillText(email, x + 22, y);
    const emW = ctx.measureText(email).width;
    ctx.fillStyle = cText3;
    ctx.fillText("·", x + 22 + emW + 10, y);
    drawGlobe(ctx, x + 22 + emW + 24, y - 6, cAccent);
    ctx.fillStyle = cText2;
    ctx.fillText($("c-site").textContent, x + 22 + emW + 44, y);

    /* ── Zona do QR ── */
    const qzx = 970;
    ctx.strokeStyle = cBorder;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(qzx, 0);
    ctx.lineTo(qzx, H);
    ctx.stroke();

    // Card branco do QR
    const cardX = qzx + (230 - 140) / 2;
    const cardY = (H - 140) / 2 - 8;
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.12)";
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 8;
    roundRectPath(ctx, cardX, cardY, 140, 140, 14);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.restore();
    roundRectPath(ctx, cardX + 0.5, cardY + 0.5, 139, 139, 14);
    ctx.strokeStyle = cBorder;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Copia o QR canvas gerado localmente
    ctx.drawImage($("qrCanvas"), cardX + 12, cardY + 12, 116, 116);

    // Label do QR
    ctx.font = "500 10.5px 'JetBrains Mono', monospace";
    const lbl = $("t-qrlabel")
        ? $("t-qrlabel").textContent.toUpperCase()
        : "CENTRAL DE CONTATOS";
    const lblW = measureSpaced(ctx, lbl, 1.5);
    const lblX = qzx + (230 - (lblW + 13)) / 2;
    ctx.fillStyle = cAccent;
    ctx.beginPath();
    ctx.arc(lblX + 2.5, cardY + 140 + 22 - 3.5, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = cText3;
    letterSpacedText(ctx, lbl, lblX + 13, cardY + 140 + 22, 1.5);

    /* ── Download ── */
    const link = document.createElement("a");
    link.download = BANNER_CONFIG.export.filename;
    link.href = canvas.toDataURL("image/png");
    link.click();
}

/* Botão de export */
$("btn-png").addEventListener("click", async () => {
    const btn = $("btn-png");
    const old = btn.textContent;
    btn.textContent = "Gerando...";
    try {
        await exportPNG();
    } catch (e) {
        console.error("[Export]", e);
        alert(
            "Não foi possível exportar o PNG. Tente no Chrome ou Edge atualizado.",
        );
    }
    btn.textContent = old;
});

/* ─────────────────────────────────────────
   BOOTSTRAP — inicializa e renderiza
   ───────────────────────────────────────── */
initFromConfig();
syncText();
syncColors();

/**
 * @file export.js
 * @description Módulo dedicado de exportação do Banner de Assinatura (v2).
 *
 * Princípio de fidelidade
 * ------------------------------------------------------------------
 * O exportador NÃO recria um layout próprio. Ele mede o DOM vivo
 * (getBoundingClientRect) e lê os estilos calculados (getComputedStyle)
 * de cada elemento, pintando no canvas exatamente nas mesmas posições,
 * fontes e cores exibidas no editor. O que está na tela é o que sai no
 * arquivo — cores, tema, textos, foto, ícones e dimensões em tempo real.
 * A renderização é off-screen; o editor nunca é alterado.
 *
 * Recursos (v2)
 *  - Resoluções predefinidas: small (1x), medium (2x), large (3x), auto
 *  - Resolução personalizada em pixels (largura/altura)
 *  - Preservar proporção original (escala uniforme, sem distorção)
 *  - Formatos: PNG, JPEG, WebP (com controle de qualidade nos com perda)
 *  - Validação de limites min./max. e guarda de memória (megapixels)
 *  - Descrição do alvo p/ pre-visualizacao sem renderizar
 *
 * API pública (global `BannerExporter`):
 *  - SIZE_PRESETS, LIMITS, FORMATS
 *  - resolveScale(sizeKey)
 *  - dimensionsFor(sizeKey, W, H)        -> presets
 *  - describeTarget(options, W, H)       -> { width, height, scaleX, scaleY, uniform, format, valid, message }
 *  - buildCanvas(options)                -> Promise<HTMLCanvasElement>
 *  - download(options)                   -> Promise<void>
 *
 * options = {
 *   sizeMode: "small"|"medium"|"large"|"auto"|"custom",
 *   width, height,            // px, usados quando sizeMode==="custom"
 *   preserveAspect: boolean,  // padrao true
 *   format: "png"|"jpeg"|"webp",
 *   quality: 0..1,            // formatos com perda
 *   filename: string
 * }
 *
 * Sem dependencias externas.
 */

"use strict";

const BannerExporter = (function () {
    const $ = (id) => document.getElementById(id);

    /* PRESETS / LIMITES */
    const SIZE_PRESETS = {
        small: { label: "Pequeno", scale: 1 },
        medium: { label: "Médio", scale: 2 },
        large: { label: "Grande", scale: 3 },
        auto: { label: "Automático", scale: null },
        custom: { label: "Personalizada", scale: null },
    };

    const LIMITS = {
        minDim: 200,
        maxDim: 8000,
        maxPixels: 40000000, // ~40 MP
        minScale: 1,
        maxScale: 8,
    };

    const FORMATS = {
        png: { mime: "image/png", ext: "png", lossy: false },
        jpeg: { mime: "image/jpeg", ext: "jpg", lossy: true },
        webp: { mime: "image/webp", ext: "webp", lossy: true },
    };

    const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

    function resolveScale(sizeKey) {
        const p = SIZE_PRESETS[sizeKey] || SIZE_PRESETS.medium;
        if (p.scale) return p.scale;
        const dpr = window.devicePixelRatio || 1;
        return Math.min(3, Math.max(1, Math.round(dpr)));
    }

    function dimensionsFor(sizeKey, W, H) {
        const scale = resolveScale(sizeKey);
        return {
            scale,
            width: Math.round(W * scale),
            height: Math.round(H * scale),
        };
    }

    function formatInfo(fmt) {
        return FORMATS[fmt] || FORMATS.png;
    }

    /* CÁLCULO DO ALVO (com validacao e clamp) */
    function computeTarget(options, W0, H0) {
        const opts = options || {};
        const fmt = FORMATS[opts.format] ? opts.format : "png";
        const ratio = H0 / W0;
        let outW, outH, uniform;
        let message = "";

        if (opts.sizeMode === "custom") {
            let w = parseInt(opts.width, 10);
            let h = parseInt(opts.height, 10);
            if (!Number.isFinite(w) || w <= 0) w = Math.round(W0 * 2);

            const cw = clamp(w, LIMITS.minDim, LIMITS.maxDim);
            if (cw !== w)
                message = "Largura ajustada para " + LIMITS.minDim + "-" + LIMITS.maxDim + " px.";
            w = cw;

            const preserve = opts.preserveAspect !== false;
            if (preserve || !Number.isFinite(h) || h <= 0) {
                h = Math.round(w * ratio);
                uniform = true;
            } else {
                const ch = clamp(h, LIMITS.minDim, LIMITS.maxDim);
                if (ch !== h)
                    message =
                        (message ? message + " " : "") +
                        "Altura ajustada para " + LIMITS.minDim + "-" + LIMITS.maxDim + " px.";
                h = ch;
                uniform = Math.abs(w / W0 - h / H0) < 0.001;
                if (!uniform)
                    message =
                        (message ? message + " " : "") +
                        "Proporcao diferente da original pode distorcer o conteudo.";
            }
            outW = w;
            outH = h;
        } else {
            const s = resolveScale(opts.sizeMode);
            outW = Math.round(W0 * s);
            outH = Math.round(H0 * s);
            uniform = true;
        }

        let valid = true;
        if (outW * outH > LIMITS.maxPixels) {
            valid = false;
            message =
                "Resolucao excede o limite de " +
                Math.round(LIMITS.maxPixels / 1000000) +
                " MP. Reduza as dimensoes.";
        }

        return {
            outW: outW,
            outH: outH,
            scaleX: outW / W0,
            scaleY: outH / H0,
            uniform: uniform,
            format: fmt,
            valid: valid,
            message: message,
        };
    }

    function bannerLogicalSize() {
        const banner = $("banner");
        if (!banner) return { W: 1200, H: 320 };
        const r = banner.getBoundingClientRect();
        return {
            W: Math.round(r.width) || 1200,
            H: Math.round(r.height) || 320,
        };
    }

    function describeTarget(options, W, H) {
        if (W == null || H == null) {
            const s = bannerLogicalSize();
            W = s.W;
            H = s.H;
        }
        const t = computeTarget(options, W, H);
        return {
            width: t.outW,
            height: t.outH,
            scaleX: t.scaleX,
            scaleY: t.scaleY,
            uniform: t.uniform,
            format: t.format,
            valid: t.valid,
            message: t.message,
        };
    }

    /* HELPERS */
    const SUPPORTS_LETTER_SPACING = (function () {
        try {
            const c = document.createElement("canvas").getContext("2d");
            return "letterSpacing" in c;
        } catch (_) {
            return false;
        }
    })();

    function cssVar(name, fallback) {
        const v = getComputedStyle(document.documentElement)
            .getPropertyValue(name)
            .trim();
        return v || fallback;
    }

    function parseRGB(color) {
        color = (color || "").trim();
        if (color.startsWith("#")) {
            if (color.length === 4)
                return {
                    r: parseInt(color[1] + color[1], 16),
                    g: parseInt(color[2] + color[2], 16),
                    b: parseInt(color[3] + color[3], 16),
                };
            return {
                r: parseInt(color.slice(1, 3), 16),
                g: parseInt(color.slice(3, 5), 16),
                b: parseInt(color.slice(5, 7), 16),
            };
        }
        const m = color.match(/[\d.]+/g);
        if (!m || m.length < 3) return { r: 0, g: 0, b: 0 };
        return { r: +m[0], g: +m[1], b: +m[2] };
    }

    function withAlpha(color, alpha) {
        const c = parseRGB(color);
        return "rgba(" + c.r + "," + c.g + "," + c.b + "," + alpha + ")";
    }

    function roundRectPath(ctx, x, y, w, h, r) {
        r = Math.min(r, w / 2, h / 2);
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
    }

    function drawLetterSpaced(ctx, text, x, y, ls) {
        let cx = x;
        for (const ch of text) {
            ctx.fillText(ch, cx, y);
            cx += ctx.measureText(ch).width + ls;
        }
    }

    function applyTextTransform(text, transform) {
        if (transform === "uppercase") return text.toUpperCase();
        if (transform === "lowercase") return text.toLowerCase();
        if (transform === "capitalize")
            return text.replace(/\b\w/g, (c) => c.toUpperCase());
        return text;
    }

    function loadImage(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error("Falha ao carregar imagem."));
            img.src = src;
        });
    }

    async function ensureFontsReady() {
        if (!document.fonts) return;
        try {
            await Promise.all([
                document.fonts.load("400 46px 'Fraunces'"),
                document.fonts.load("500 46px 'Fraunces'"),
                document.fonts.load("400 13px 'JetBrains Mono'"),
                document.fonts.load("500 52px 'JetBrains Mono'"),
                document.fonts.load("300 15px 'Inter'"),
                document.fonts.load("400 15px 'Inter'"),
                document.fonts.load("500 15px 'Inter'"),
            ]);
            await document.fonts.ready;
        } catch (_) {}
    }

    /* CAMADAS DE DESENHO */
    function rel(rect, origin) {
        return {
            x: rect.left - origin.left,
            y: rect.top - origin.top,
            w: rect.width,
            h: rect.height,
            cx: rect.left - origin.left + rect.width / 2,
            cy: rect.top - origin.top + rect.height / 2,
        };
    }

    function radialGlow(ctx, cx, cy, radius, color, alpha, W, H) {
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
        g.addColorStop(0, withAlpha(color, alpha));
        g.addColorStop(1, withAlpha(color, 0));
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
    }

    function drawAvatar(ctx, banner, origin, accent, baseBg) {
        const av = $("avatar");
        if (!av) return;
        const r = rel(av.getBoundingClientRect(), origin);
        if (!r.w || !r.h) return;
        const rad = Math.min(r.w, r.h) / 2;
        const cs = getComputedStyle(av);

        // Disco deriva do fundo do banner (mantém contraste do monograma
        // tanto no tema claro quanto no escuro) + leve brilho superior.
        ctx.save();
        ctx.beginPath();
        ctx.arc(r.cx, r.cy, rad, 0, Math.PI * 2);
        ctx.clip();
        ctx.fillStyle = baseBg || "#ffffff";
        ctx.fillRect(r.cx - rad, r.cy - rad, rad * 2, rad * 2);
        const ag = ctx.createRadialGradient(
            r.cx - rad * 0.3,
            r.cy - rad * 0.35,
            0,
            r.cx,
            r.cy,
            rad * 1.25,
        );
        ag.addColorStop(0, withAlpha("#ffffff", 0.08));
        ag.addColorStop(1, withAlpha("#ffffff", 0));
        ctx.fillStyle = ag;
        ctx.fillRect(r.cx - rad, r.cy - rad, rad * 2, rad * 2);
        ctx.restore();

        const img = $("avatarImg");
        const hasPhoto = av.classList.contains("has-photo") && img && img.src;
        if (hasPhoto) {
            const iw = img.naturalWidth || img.width;
            const ih = img.naturalHeight || img.height;
            if (iw && ih) {
                ctx.save();
                ctx.beginPath();
                ctx.arc(r.cx, r.cy, rad, 0, Math.PI * 2);
                ctx.clip();
                const side = rad * 2;
                const k = Math.max(side / iw, side / ih);
                ctx.drawImage(
                    img,
                    r.cx - (iw * k) / 2,
                    r.cy - (ih * k) / 2,
                    iw * k,
                    ih * k,
                );
                ctx.restore();
            }
        }

        ctx.beginPath();
        ctx.arc(r.cx, r.cy, rad, 0, Math.PI * 2);
        ctx.lineWidth = parseFloat(cs.borderTopWidth) || 4;
        ctx.strokeStyle = withAlpha(accent, 0.35);
        ctx.stroke();
    }

    function drawQRZone(ctx, banner, origin, borderColor, H) {
        const zone = banner.querySelector(".qr-zone");
        const card = banner.querySelector(".qr-card");
        const qrCanvas = $("qrCanvas");

        if (zone) {
            const zr = rel(zone.getBoundingClientRect(), origin);
            if (zr.w && zr.h) {
                ctx.beginPath();
                ctx.moveTo(zr.x + 0.5, 0);
                ctx.lineTo(zr.x + 0.5, H);
                ctx.lineWidth = 1;
                ctx.strokeStyle = borderColor;
                ctx.stroke();
            }
        }

        if (card) {
            const cr = rel(card.getBoundingClientRect(), origin);
            if (!cr.w || !cr.h) return;
            const cs = getComputedStyle(card);
            const rad = parseFloat(cs.borderTopLeftRadius) || 14;

            ctx.save();
            ctx.shadowColor = "rgba(0,0,0,0.16)";
            ctx.shadowBlur = 22;
            ctx.shadowOffsetY = 8;
            roundRectPath(ctx, cr.x, cr.y, cr.w, cr.h, rad);
            ctx.fillStyle = cs.backgroundColor || "#ffffff";
            ctx.fill();
            ctx.restore();

            roundRectPath(ctx, cr.x + 0.5, cr.y + 0.5, cr.w - 1, cr.h - 1, rad);
            ctx.lineWidth = 1;
            ctx.strokeStyle = borderColor;
            ctx.stroke();

            if (qrCanvas) {
                const qr = rel(qrCanvas.getBoundingClientRect(), origin);
                if (qr.w && qr.h)
                    ctx.drawImage(qrCanvas, qr.x, qr.y, qr.w, qr.h);
            }
        }
    }

    function paintText(ctx, root, origin) {
        walk(root);

        function walk(node) {
            const children = node.childNodes;
            for (let i = 0; i < children.length; i++) {
                const child = children[i];
                if (child.nodeType === Node.TEXT_NODE) {
                    drawTextNode(child);
                } else if (child.nodeType === Node.ELEMENT_NODE) {
                    const tag = child.tagName.toLowerCase();
                    if (tag === "svg" || tag === "canvas" || tag === "img")
                        continue;
                    const cs = getComputedStyle(child);
                    if (cs.display === "none" || cs.visibility === "hidden")
                        continue;
                    walk(child);
                }
            }
        }

        function drawTextNode(textNode) {
            const raw = textNode.nodeValue;
            if (!raw || !raw.replace(/\s/g, "").length) return;
            const parent = textNode.parentElement;
            if (!parent) return;
            const cs = getComputedStyle(parent);
            if (
                cs.display === "none" ||
                cs.visibility === "hidden" ||
                parseFloat(cs.opacity) === 0
            )
                return;

            const range = document.createRange();
            range.selectNodeContents(textNode);
            const r = range.getBoundingClientRect();
            if (!r.width || !r.height) return;

            const text = applyTextTransform(
                raw.replace(/\s+/g, " ").trim(),
                cs.textTransform,
            );
            if (!text) return;

            const x = r.left - origin.left;
            const cy = r.top - origin.top + r.height / 2;
            ctx.font =
                cs.fontStyle +
                " " +
                cs.fontWeight +
                " " +
                cs.fontSize +
                " " +
                cs.fontFamily;
            ctx.fillStyle = cs.color;
            ctx.textBaseline = "middle";

            const ls = parseFloat(cs.letterSpacing);
            if (!isNaN(ls) && ls !== 0) {
                if (SUPPORTS_LETTER_SPACING) {
                    ctx.letterSpacing = cs.letterSpacing;
                    ctx.fillText(text, x, cy);
                    ctx.letterSpacing = "0px";
                } else {
                    drawLetterSpaced(ctx, text, x, cy, ls);
                }
            } else {
                ctx.fillText(text, x, cy);
            }
        }
    }

    async function paintIcons(ctx, root, origin) {
        const svgs = root.querySelectorAll("svg");
        for (const svg of svgs) {
            const cs = getComputedStyle(svg);
            if (cs.display === "none" || cs.visibility === "hidden") continue;
            const r = svg.getBoundingClientRect();
            if (!r.width || !r.height) continue;

            const clone = svg.cloneNode(true);
            clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
            clone.setAttribute("width", r.width);
            clone.setAttribute("height", r.height);
            const stroke =
                cs.stroke && cs.stroke !== "none" ? cs.stroke : cs.color;
            clone.style.color = cs.color;
            if (stroke && stroke !== "none")
                clone.setAttribute("stroke", stroke);

            const xml = new XMLSerializer().serializeToString(clone);
            const url =
                "data:image/svg+xml;charset=utf-8," + encodeURIComponent(xml);
            try {
                const img = await loadImage(url);
                ctx.drawImage(
                    img,
                    r.left - origin.left,
                    r.top - origin.top,
                    r.width,
                    r.height,
                );
            } catch (_) {}
        }
    }

    /* MONTAGEM DO CANVAS */
    async function buildCanvas(options) {
        const opts = options || {};
        const banner = $("banner");
        if (!banner) throw new Error("Elemento #banner nao encontrado.");

        await ensureFontsReady();

        const avatarImg = $("avatarImg");
        if (
            avatarImg &&
            avatarImg.src &&
            $("avatar") &&
            $("avatar").classList.contains("has-photo") &&
            avatarImg.decode
        ) {
            try {
                await avatarImg.decode();
            } catch (_) {}
        }

        const bRect = banner.getBoundingClientRect();
        const origin = { left: bRect.left, top: bRect.top };
        const W = Math.round(bRect.width);
        const H = Math.round(bRect.height);
        if (!W || !H) throw new Error("Banner sem dimensoes visiveis.");

        const target = computeTarget(opts, W, H);
        if (!target.valid)
            throw new Error(target.message || "Resolucao invalida.");

        const canvas = document.createElement("canvas");
        canvas.width = target.outW;
        canvas.height = target.outH;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Contexto 2D indisponivel.");
        ctx.setTransform(target.scaleX, 0, 0, target.scaleY, 0, 0);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";

        const bs = getComputedStyle(banner);
        const radius = parseFloat(bs.borderTopLeftRadius) || 16;
        const baseBg = bs.backgroundColor || "#ffffff";
        const borderColor = bs.borderTopColor || "rgba(0,0,0,0.09)";
        const accent = cssVar("--accent", "#e11d48");
        const signal = cssVar("--signal", "#4f46e5");

        // JPEG nao tem alfa: pinta o fundo antes para evitar quinas pretas.
        if (target.format === "jpeg") {
            ctx.fillStyle = baseBg;
            ctx.fillRect(0, 0, W, H);
        }

        ctx.save();
        roundRectPath(ctx, 0, 0, W, H, radius);
        ctx.clip();

        ctx.fillStyle = baseBg;
        ctx.fillRect(0, 0, W, H);
        radialGlow(ctx, W * 0.86, H * 0.38, 460, accent, 0.08, W, H);
        radialGlow(ctx, W * 0.08, H * 1.12, 420, signal, 0.06, W, H);

        const railEl = banner.querySelector(".rail");
        const railW = railEl
            ? railEl.getBoundingClientRect().width || 4
            : 4;
        const rg = ctx.createLinearGradient(0, 0, 0, H);
        rg.addColorStop(0, withAlpha(accent, 0));
        rg.addColorStop(0.3, accent);
        rg.addColorStop(0.7, accent);
        rg.addColorStop(1, withAlpha(accent, 0));
        ctx.fillStyle = rg;
        ctx.fillRect(0, 0, railW, H);

        drawAvatar(ctx, banner, origin, accent, baseBg);
        drawQRZone(ctx, banner, origin, borderColor, H);
        paintText(ctx, banner, origin);
        await paintIcons(ctx, banner, origin);

        ctx.restore();

        roundRectPath(ctx, 0.5, 0.5, W - 1, H - 1, radius);
        ctx.lineWidth = 1;
        ctx.strokeStyle = borderColor;
        ctx.stroke();

        canvas._exportFormat = target.format;
        return canvas;
    }

    /* CONVERSAO E DOWNLOAD */
    function canvasToBlob(canvas, mime, quality) {
        return new Promise((resolve) => {
            if (canvas.toBlob) {
                canvas.toBlob((b) => resolve(b), mime, quality);
            } else {
                try {
                    resolve(dataURLToBlob(canvas.toDataURL(mime, quality)));
                } catch (_) {
                    resolve(null);
                }
            }
        });
    }

    function dataURLToBlob(dataURL) {
        const parts = dataURL.split(",");
        const head = parts[0];
        const body = parts[1];
        const mime = (head.match(/:(.*?);/) || [])[1] || "image/png";
        const bin = atob(body);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        return new Blob([bytes], { type: mime });
    }

    function ensureExtension(filename, ext) {
        const base = (filename || "banner-assinatura").replace(
            /\.(png|jpe?g|webp)$/i,
            "",
        );
        return base + "." + ext;
    }

    async function download(options) {
        const opts = options || {};
        const canvas = await buildCanvas(opts);
        const fmt = formatInfo(canvas._exportFormat || opts.format || "png");
        const quality = fmt.lossy
            ? clamp(
                  typeof opts.quality === "number" ? opts.quality : 0.92,
                  0.3,
                  1,
              )
            : undefined;

        const blob = await canvasToBlob(canvas, fmt.mime, quality);
        if (!blob) throw new Error("Nao foi possivel gerar a imagem.");

        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = ensureExtension(opts.filename, fmt.ext);
        a.rel = "noopener";
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1500);
    }

    return {
        SIZE_PRESETS: SIZE_PRESETS,
        LIMITS: LIMITS,
        FORMATS: FORMATS,
        resolveScale: resolveScale,
        dimensionsFor: dimensionsFor,
        describeTarget: describeTarget,
        buildCanvas: buildCanvas,
        download: download,
    };
})();

if (typeof module === "object" && module.exports) {
    module.exports = BannerExporter;
}

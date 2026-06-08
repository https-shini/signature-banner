/**
 * @file theme.js  v3.0
 * @description Engine de temas do Banner de Assinatura.
 *
 * Responsabilidades:
 *  — Gerenciar a configuração centralizada de temas (ThemeConfig)
 *  — Mapear cores semânticas → CSS vars do banner E da interface
 *  — Aplicar presets pré-definidos (light/dark)
 *  — Detectar preferência do sistema (prefers-color-scheme)
 *  — Validar hex e calcular contraste WCAG 2.1 (AA / AAA)
 *  — Exportar e importar temas em JSON
 *  — Derivar tokens adicionais (hover, subtle, glow, border-brand) automaticamente
 *
 * ─── Arquitetura de tokens ────────────────────────────────────────────────────
 *
 *  ThemeConfig (objeto JS)
 *       │
 *       ▼
 *  BannerTheme.apply(config)
 *       │
 *       ├── aplica CSS vars do BANNER  (--void, --text, --accent, ...)
 *       │   no :root do document
 *       │
 *       └── aplica CSS vars da INTERFACE  (--page-bg, --base, --panel-border, ...)
 *           e adiciona/remove body.dark-mode para o painel de edição
 *
 * ─── Estrutura do ThemeConfig ─────────────────────────────────────────────────
 *
 *  {
 *    id:     string,       // identificador único (ex: "light-default")
 *    name:   string,       // label exibido na UI
 *    mode:   "light"|"dark",
 *    colors: {
 *      // Valores aceitos: "#RRGGBB" ou variável semântica como "var(--_crimson-600)"
 *      background:    string,  // superfície principal do banner
 *      textPrimary:   string,  // nome, cargo, CTA texto
 *      textSecondary: string,  // tagline, roles, contato
 *      accent:        string,  // brand primária: rail, QR, bullets, CTA1
 *      border:        string,  // bordas e divisores
 *      signal:        string,  // brand secundária: CTA2, borda indigo
 *    }
 *  }
 *
 * Expõe o namespace global `BannerTheme`.
 */

"use strict";

/* ─────────────────────────────────────────────────────────────────────────────
   PRIMITIVOS  (espelho dos primitivos do tokens.css)
   Nunca referenciados diretamente pelos presets — servem como fonte de verdade
   para computar valores derivados no CSS var() fallback.
───────────────────────────────────────────────────────────────────────────── */
const _P = {
    /* Crimson */
    crimson50: "#fff1f2",
    crimson100: "#ffe4e6",
    crimson200: "#fecdd3",
    crimson400: "#fb7185",
    crimson500: "#f43f5e",
    crimson600: "#e11d48",
    crimson700: "#be123c",
    crimson800: "#9f1239",
    crimson900: "#881337",
    crimson950: "#4c0519",

    /* Indigo */
    indigo100: "#e0e7ff",
    indigo300: "#a5b4fc",
    indigo400: "#818cf8",
    indigo500: "#6366f1",
    indigo600: "#4f46e5",
    indigo700: "#4338ca",
    indigo800: "#3730a3",

    /* Slate */
    slate0: "#ffffff",
    slate50: "#f8fafc",
    slate100: "#f1f5f9",
    slate150: "#eaeff5",
    slate200: "#e2e8f0",
    slate300: "#cbd5e1",
    slate400: "#94a3b8",
    slate500: "#64748b",
    slate600: "#475569",
    slate700: "#334155",
    slate800: "#1e293b",
    slate850: "#151f2e",
    slate900: "#0f172a",
    slate920: "#0b1120",
    slate950: "#070d19",

    /* Status */
    green700: "#15803d",
    green500: "#22c55e",
    red600: "#dc2626",
};

/* ─────────────────────────────────────────────────────────────────────────────
   UTILITÁRIOS DE COR
───────────────────────────────────────────────────────────────────────────── */

/**
 * Verifica se uma string é um hex válido (#RGB ou #RRGGBB).
 */
function isValidHex(hex) {
    if (typeof hex !== "string") return false;
    return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(hex.trim());
}

/**
 * Normaliza hex 3 dígitos → 6 dígitos, sempre com #.
 */
function normalizeHex(hex) {
    const h = hex.trim();
    if (!h.startsWith("#")) return "#" + h;
    if (h.length === 4) {
        return "#" + h[1] + h[1] + h[2] + h[2] + h[3] + h[3];
    }
    return h.toLowerCase();
}

/**
 * Converte hex → { r, g, b } (0-255).
 */
function hexToRGB(hex) {
    const h = normalizeHex(hex);
    return {
        r: parseInt(h.slice(1, 3), 16),
        g: parseInt(h.slice(3, 5), 16),
        b: parseInt(h.slice(5, 7), 16),
    };
}

/**
 * Luminância relativa (WCAG 2.1).
 */
function relativeLuminance({ r, g, b }) {
    const ch = (c) => {
        const s = c / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
}

/**
 * Razão de contraste entre dois hex.
 * Retorna { ratio, level: "AAA"|"AA"|"FAIL", ok: boolean }
 */
function wcagLevel(fgHex, bgHex) {
    try {
        const L1 = relativeLuminance(hexToRGB(fgHex));
        const L2 = relativeLuminance(hexToRGB(bgHex));
        const lighter = Math.max(L1, L2);
        const darker = Math.min(L1, L2);
        const ratio = (lighter + 0.05) / (darker + 0.05);
        const level = ratio >= 7 ? "AAA" : ratio >= 4.5 ? "AA" : "FAIL";
        return { ratio, level, ok: ratio >= 4.5 };
    } catch {
        return { ratio: 0, level: "FAIL", ok: false };
    }
}

/**
 * Determina mode ("light"|"dark") pela luminância do fundo.
 */
function detectMode(bgHex) {
    try {
        const { r, g, b } = hexToRGB(bgHex);
        const brightness = (r * 299 + g * 587 + b * 114) / 1000;
        return brightness < 128 ? "dark" : "light";
    } catch {
        return "light";
    }
}

/**
 * Mistura duas cores hex com um alpha (0-1) — simula color-mix para tokens derivados.
 * Retorna hex.
 */
function mixHex(hex, alpha, overBg = "#ffffff") {
    try {
        const fg = hexToRGB(hex);
        const bg = hexToRGB(overBg);
        const r = Math.round(fg.r * alpha + bg.r * (1 - alpha));
        const g = Math.round(fg.g * alpha + bg.g * (1 - alpha));
        const b = Math.round(fg.b * alpha + bg.b * (1 - alpha));
        return (
            "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")
        );
    } catch {
        return hex;
    }
}

/**
 * Escurece um hex (factor 0-1, onde 1 = preto).
 */
function darkenHex(hex, factor = 0.12) {
    try {
        const { r, g, b } = hexToRGB(hex);
        return (
            "#" +
            [r, g, b]
                .map((v) =>
                    Math.round(v * (1 - factor))
                        .toString(16)
                        .padStart(2, "0"),
                )
                .join("")
        );
    } catch {
        return hex;
    }
}

/**
 * Clareia um hex (factor 0-1, onde 1 = branco).
 */
function lightenHex(hex, factor = 0.12) {
    try {
        const { r, g, b } = hexToRGB(hex);
        return (
            "#" +
            [r, g, b]
                .map((v) =>
                    Math.round(v + (255 - v) * factor)
                        .toString(16)
                        .padStart(2, "0"),
                )
                .join("")
        );
    } catch {
        return hex;
    }
}

/* ─────────────────────────────────────────────────────────────────────────────
   DERIVAÇÃO DE TOKENS
   A partir de um ThemeConfig.colors, gera todos os tokens secundários
   automaticamente — sem precisar que o usuário os defina.
───────────────────────────────────────────────────────────────────────────── */

/**
 * Dado um conjunto de cores-base e o mode, retorna o mapa completo de CSS vars.
 *
 * @param {object} colors   - { background, textPrimary, textSecondary, accent, border, signal }
 * @param {"light"|"dark"} mode
 * @returns {object}  { "--void": "#...", "--text": "#...", ... }
 */
function deriveTokens(colors, mode) {
    const isDark = mode === "dark";
    const bg = colors.background || (isDark ? _P.slate950 : _P.slate0);
    const text1 = colors.textPrimary || (isDark ? _P.slate50 : _P.slate900);
    const text2 = colors.textSecondary || (isDark ? _P.slate400 : _P.slate600);
    const accent = colors.accent || _P.crimson600;
    const border =
        colors.border ||
        (isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.09)");
    const signal = colors.signal || _P.indigo600;

    /* ── Tokens derivados ─────────────────────────────────────────── */

    // text-3: mais apagado que text-2
    const text3 = isDark ? mixHex(text2, 0.65, bg) : lightenHex(text2, 0.18);

    // hover do acento: escurece 12%
    const accentHover = darkenHex(accent, 0.12);
    const signalHover = darkenHex(signal, 0.12);

    // subtle: acento com baixo alpha sobre o fundo
    const accentSoft = mixHex(
        accent,
        isDark ? 0.14 : 0.09,
        isDark ? _P.slate900 : _P.slate0,
    );
    const signalSoft = mixHex(
        signal,
        isDark ? 0.14 : 0.09,
        isDark ? _P.slate900 : _P.slate0,
    );

    // border-brand: acento com 40% de opacidade
    const borderBrand = mixHex(accent, 0.4, isDark ? "#0f172a" : "#ffffff");
    const borderStrong = isDark ? "rgba(255,255,255,0.16)" : "rgba(0,0,0,0.16)";

    /* ── Superfícies da interface de preview (painel) ─────────────── */
    // As superfícies do PAINEL são independentes do banner e seguem o mode
    const pageBg = isDark ? _P.slate950 : "#f2f4f8";
    const panelBg = isDark ? _P.slate920 : _P.slate50;
    const inputBg = isDark ? _P.slate900 : _P.slate0;
    const raisedBg = isDark ? _P.slate850 : _P.slate100;

    const panelText1 = isDark ? _P.slate50 : _P.slate900;
    const panelText2 = isDark ? _P.slate300 : _P.slate700;
    const panelText3 = isDark ? _P.slate500 : _P.slate500;

    const panelBorder = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.09)";
    const panelBorderS = isDark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.16)";

    return {
        /* ── Banner: tokens de conteúdo ─────────────────────────────── */
        "--void": bg,
        "--text": text1,
        "--text-2": text2,
        "--text-3": text3,
        "--accent": accent,
        "--accent-hover": accentHover,
        "--accent-soft": accentSoft,
        "--signal": signal,
        "--signal-hover": signalHover,
        "--border": border,
        "--border-strong": borderStrong,
        "--border-brand": borderBrand,

        /* ── Interface: tokens do painel/preview ─────────────────────── */
        "--page-bg": pageBg,
        "--base": panelBg,
        "--raised": raisedBg,
        "--panel-input": inputBg,
        "--panel-text-1": panelText1,
        "--panel-text-2": panelText2,
        "--panel-text-3": panelText3,
        "--panel-border": panelBorder,
        "--panel-border-s": panelBorderS,
        "--panel-accent": accent,

        /* ── Primitivos expostos (para referência em banner.css gradients) */
        "--_crimson-600": _P.crimson600,
        "--_crimson-700": _P.crimson700,
        "--_indigo-600": _P.indigo600,
        "--_indigo-700": _P.indigo700,
        "--_slate-0": _P.slate0,
        "--_slate-50": _P.slate50,
        "--_slate-100": _P.slate100,
        "--_slate-150": _P.slate150,
        "--_slate-500": _P.slate500,
        "--_slate-600": _P.slate600,
        "--_slate-800": _P.slate800,
        "--_slate-900": _P.slate900,
        "--_green-700": _P.green700,
    };
}

/* ─────────────────────────────────────────────────────────────────────────────
   PRESETS PREDEFINIDOS
   Cada preset define o mínimo necessário — todos os tokens derivados são
   computados automaticamente por deriveTokens().
───────────────────────────────────────────────────────────────────────────── */
const PRESETS = [
    /* ── Claro ──────────────────────────────────────────────────────── */
    {
        id: "light-default",
        name: "Claro · Padrão",
        mode: "light",
        colors: {
            background: _P.slate0,
            textPrimary: _P.slate900,
            textSecondary: _P.slate600,
            accent: _P.crimson600,
            border: "rgba(0,0,0,0.09)",
            signal: _P.indigo600,
        },
    },
    {
        id: "light-slate",
        name: "Claro · Slate",
        mode: "light",
        colors: {
            background: _P.slate50,
            textPrimary: _P.slate900,
            textSecondary: _P.slate600,
            accent: _P.crimson600,
            border: "rgba(0,0,0,0.09)",
            signal: _P.indigo600,
        },
    },
    {
        id: "light-warm",
        name: "Claro · Warm",
        mode: "light",
        colors: {
            background: "#fffbf5",
            textPrimary: _P.slate900,
            textSecondary: _P.slate600,
            accent: _P.crimson600,
            border: "rgba(0,0,0,0.09)",
            signal: "#7c3aed",
        },
    },
    {
        id: "light-violet",
        name: "Claro · Violet",
        mode: "light",
        colors: {
            background: "#faf5ff",
            textPrimary: _P.slate900,
            textSecondary: _P.slate600,
            accent: "#7c3aed",
            border: "rgba(0,0,0,0.09)",
            signal: _P.crimson600,
        },
    },

    /* ── Escuro ──────────────────────────────────────────────────────── */
    {
        id: "dark-midnight",
        name: "Escuro · Midnight",
        mode: "dark",
        colors: {
            background: _P.slate950,
            textPrimary: _P.slate50,
            textSecondary: _P.slate400,
            accent: _P.crimson600,
            border: "rgba(255,255,255,0.08)",
            signal: _P.indigo500,
        },
    },
    {
        id: "dark-noir",
        name: "Escuro · Noir",
        mode: "dark",
        colors: {
            background: _P.slate900,
            textPrimary: _P.slate50,
            textSecondary: _P.slate400,
            accent: "#f43f5e",
            border: "rgba(255,255,255,0.08)",
            signal: _P.indigo400,
        },
    },
    {
        id: "dark-indigo",
        name: "Escuro · Indigo",
        mode: "dark",
        colors: {
            background: "#0e0e1f",
            textPrimary: _P.slate50,
            textSecondary: _P.slate400,
            accent: _P.indigo500,
            border: "rgba(255,255,255,0.08)",
            signal: _P.crimson600,
        },
    },
    {
        id: "dark-emerald",
        name: "Escuro · Emerald",
        mode: "dark",
        colors: {
            background: "#071a12",
            textPrimary: _P.slate50,
            textSecondary: _P.slate400,
            accent: "#10b981",
            border: "rgba(255,255,255,0.08)",
            signal: "#3b82f6",
        },
    },
];

/* ─────────────────────────────────────────────────────────────────────────────
   APLICAÇÃO AO DOM
───────────────────────────────────────────────────────────────────────────── */

/**
 * Aplica um ThemeConfig ao DOM:
 *  1. Escreve todos os tokens derivados como CSS vars no :root
 *  2. Adiciona/remove body.dark-mode para estilizar a interface do painel
 *
 * @param {object} config  - ThemeConfig válido
 */
function applyTheme(config) {
    const tokens = deriveTokens(config.colors || {}, config.mode || "light");
    const root = document.documentElement;

    for (const [prop, value] of Object.entries(tokens)) {
        root.style.setProperty(prop, value);
    }

    // Sincroniza modo da interface (body + html color-scheme)
    const isDark = config.mode === "dark";
    document.body.classList.toggle("dark-mode", isDark);
    document.body.classList.toggle("light-mode", !isDark);
    document.documentElement.style.colorScheme = isDark ? "dark" : "light";
}

/* ─────────────────────────────────────────────────────────────────────────────
   DETECÇÃO DO SISTEMA
───────────────────────────────────────────────────────────────────────────── */

/**
 * Retorna o preset mais adequado para a preferência do sistema.
 */
function getSystemPreset() {
    const prefersDark = window.matchMedia?.(
        "(prefers-color-scheme: dark)",
    ).matches;
    const id = prefersDark ? "dark-midnight" : "light-default";
    return PRESETS.find((p) => p.id === id) || PRESETS[0];
}

/**
 * Registra um listener que atualiza o tema quando a preferência muda.
 * Retorna a função de cleanup.
 *
 * @param {function} callback - (preset: ThemeConfig) => void
 */
function watchSystemPreference(callback) {
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!mq) return () => {};

    const handler = (e) => {
        const id = e.matches ? "dark-midnight" : "light-default";
        const preset = PRESETS.find((p) => p.id === id) || PRESETS[0];
        callback(preset);
    };

    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
}

/* ─────────────────────────────────────────────────────────────────────────────
   SERIALIZAÇÃO (EXPORT / IMPORT)
───────────────────────────────────────────────────────────────────────────── */

/**
 * Serializa um ThemeConfig para JSON formatado.
 * O JSON inclui metadados de versão para compatibilidade futura.
 */
function exportJSON(config) {
    const payload = {
        _version: "3.0",
        id: config.id || "custom-export",
        name: config.name || "Tema Personalizado",
        mode: config.mode || "light",
        colors: { ...(config.colors || {}) },
    };
    return JSON.stringify(payload, null, 2);
}

/**
 * Desserializa um JSON e retorna um ThemeConfig validado.
 * Lança erro descritivo em caso de JSON inválido ou campos ausentes.
 */
function importJSON(json) {
    let parsed;
    try {
        parsed = JSON.parse(json.trim());
    } catch (e) {
        throw new Error("JSON inválido: " + e.message);
    }

    // Suporte a formato legado (v1/v2 sem _version)
    const colors = parsed.colors || {};

    // Validação mínima: pelo menos uma cor precisa ser definida
    const hasColors = Object.keys(colors).length > 0;
    if (!hasColors) {
        throw new Error(
            "O JSON não contém cores válidas. Inclua ao menos { colors: { background, accent } }.",
        );
    }

    // Valida valores hex onde aplicável
    for (const [key, value] of Object.entries(colors)) {
        if (
            typeof value === "string" &&
            value.startsWith("#") &&
            !isValidHex(value)
        ) {
            throw new Error(`Cor inválida em "${key}": ${value}`);
        }
    }

    const mode = parsed.mode === "dark" ? "dark" : "light";

    return {
        id: parsed.id || "imported",
        name: parsed.name || "Tema Importado",
        mode,
        colors: {
            background: colors.background || "",
            textPrimary: colors.textPrimary || colors.text_primary || "",
            textSecondary: colors.textSecondary || colors.text_secondary || "",
            accent: colors.accent || "",
            border: colors.border || "",
            signal: colors.signal || "",
        },
    };
}

/* ─────────────────────────────────────────────────────────────────────────────
   NAMESPACE PÚBLICO
───────────────────────────────────────────────────────────────────────────── */

/**
 * @namespace BannerTheme
 * Interface pública consumida por banner.js.
 */
const BannerTheme = Object.freeze({
    /** Lista de presets disponíveis. */
    presets: PRESETS,

    /**
     * Aplica um ThemeConfig completo ao DOM.
     * Aceita qualquer objeto com { mode, colors }.
     * @param {object} config
     */
    apply: applyTheme,

    /**
     * Deriva todos os tokens CSS a partir de um ThemeConfig.
     * Útil para inspecionar os valores sem aplicar ao DOM.
     * @param {object} colors
     * @param {"light"|"dark"} mode
     * @returns {object}
     */
    deriveTokens,

    /**
     * Retorna o preset recomendado para a preferência do sistema.
     * @returns {object} ThemeConfig
     */
    getSystemPreset,

    /**
     * Registra listener de mudança de preferência do sistema.
     * @param {function} callback - (preset) => void
     * @returns {function} cleanup
     */
    watchSystemPreference,

    /**
     * Serializa ThemeConfig → JSON string.
     * @param {object} config
     * @returns {string}
     */
    exportJSON,

    /**
     * Desserializa JSON string → ThemeConfig validado.
     * Lança Error se inválido.
     * @param {string} json
     * @returns {object}
     */
    importJSON,

    /* ── Utilitários de cor (usados em banner.js) ── */

    /** Verifica se uma string é hex válido. */
    isValidHex,

    /** Normaliza hex 3→6 dígitos. */
    normalizeHex,

    /** Razão de contraste e nível WCAG entre dois hex. */
    wcagLevel,

    /** Detecta "light"|"dark" pelo brilho do fundo. */
    detectMode,

    /**
     * Mistura uma cor com um fundo em uma opacidade (0-1).
     * Útil para preview ao vivo de cores derivadas.
     */
    mixHex,

    /** Escurece um hex pelo fator dado (0-1). */
    darkenHex,

    /** Clareia um hex pelo fator dado (0-1). */
    lightenHex,
});

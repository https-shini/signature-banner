/**
 * @file theme.js
 * @description Gerenciador central de temas do Banner de Assinatura.
 *
 * Fonte única de verdade para cores. Lê a configuração semântica de
 * BANNER_CONFIG.theme e aplica:
 *   - As CSS vars locais do banner (--void, --text, --text-2, --accent,
 *     --border, --signal) na variante do modo efetivo.
 *   - O tema da interface (página) via classe `body.light-mode`, mantendo
 *     o ambiente de pré-visualização consistente com o banner.
 *
 * Cada cor é semântica (background, textPrimary, textSecondary, accent,
 * border) e tem variante { light, dark }. Modos: "light" | "dark" | "auto"
 * (auto segue prefers-color-scheme). Suporta paletas pré-definidas, edição
 * por hex validado e import/export da configuração.
 *
 * API (global `BannerTheme`):
 *   init(themeConfig)            -> inicializa a partir de BANNER_CONFIG.theme
 *   apply()                      -> reaplica o estado atual
 *   setMode(mode)                -> "light" | "dark" | "auto"
 *   setPalette(name)             -> aplica paleta de acento
 *   setToken(name, hex[, mode])  -> define cor (valida hex); retorna bool
 *   getToken(name[, mode])       -> hex efetivo
 *   getMode() / getPalette() / effectiveMode()
 *   isValidHex(v) / normalizeHex(v)
 *   exportConfig() / importConfig(obj)
 *   onChange(fn)                 -> callback(effectiveMode) a cada aplicação
 */

"use strict";

const BannerTheme = (function () {
    const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

    // Token semântico -> CSS var local do banner
    const BANNER_VAR_MAP = {
        background: "--void",
        textPrimary: "--text",
        textSecondary: "--text-2",
        accent: "--accent",
        border: "--border",
    };

    let cfg = null;
    let mql = null;
    const listeners = [];

    const clone = (o) => JSON.parse(JSON.stringify(o));

    function isValidHex(v) {
        return HEX_RE.test((v || "").trim());
    }

    function normalizeHex(v) {
        v = (v || "").trim();
        if (/^#([0-9a-fA-F]{3})$/.test(v)) {
            const h = v.slice(1);
            v =
                "#" +
                h
                    .split("")
                    .map((c) => c + c)
                    .join("");
        }
        return v.toLowerCase();
    }

    function ensureShape() {
        if (!cfg) cfg = {};
        if (!cfg.mode) cfg.mode = "dark";
        if (!cfg.tokens) cfg.tokens = {};
        if (!cfg.palettes) cfg.palettes = {};
    }

    function setupAutoListener() {
        if (!window.matchMedia) return;
        if (mql) {
            if (mql.removeEventListener)
                mql.removeEventListener("change", onSystemChange);
            else if (mql.removeListener) mql.removeListener(onSystemChange);
        }
        mql = window.matchMedia("(prefers-color-scheme: dark)");
        if (mql.addEventListener) mql.addEventListener("change", onSystemChange);
        else if (mql.addListener) mql.addListener(onSystemChange);
    }

    function onSystemChange() {
        if (cfg.mode === "auto") apply();
    }

    function effectiveMode() {
        if (cfg.mode === "auto") return mql && mql.matches ? "dark" : "light";
        return cfg.mode === "light" ? "light" : "dark";
    }

    function tokenValue(name, mode) {
        const t = cfg.tokens[name];
        if (!t) return null;
        return t[mode] || t.dark || t.light || null;
    }

    function apply() {
        ensureShape();
        const mode = effectiveMode();
        const rootStyle = document.documentElement.style;

        Object.keys(BANNER_VAR_MAP).forEach((name) => {
            const v = tokenValue(name, mode);
            if (v) rootStyle.setProperty(BANNER_VAR_MAP[name], v);
        });

        const pal = cfg.palettes[cfg.palette];
        if (pal && pal.signal) {
            rootStyle.setProperty("--signal", pal.signal);
            rootStyle.setProperty("--signal-hover", pal.signal);
        }

        if (document.body)
            document.body.classList.toggle("light-mode", mode === "light");
        document.documentElement.setAttribute("data-banner-mode", mode);

        notify(mode);
    }

    function setMode(m) {
        cfg.mode = ["light", "dark", "auto"].indexOf(m) >= 0 ? m : "dark";
        apply();
    }

    function setPalette(name) {
        if (!cfg.palettes[name]) return;
        cfg.palette = name;
        const p = cfg.palettes[name];
        cfg.tokens.accent = cfg.tokens.accent || {};
        cfg.tokens.accent.light = p.accent;
        cfg.tokens.accent.dark = p.accent;
        apply();
    }

    function setToken(name, hex, mode) {
        if (!isValidHex(hex)) return false;
        mode = mode || effectiveMode();
        cfg.tokens[name] = cfg.tokens[name] || {};
        cfg.tokens[name][mode] = normalizeHex(hex);
        // Edição manual de acento desvincula a paleta selecionada
        if (name === "accent") cfg.palette = null;
        apply();
        return true;
    }

    function getToken(name, mode) {
        return tokenValue(name, mode || effectiveMode());
    }

    function init(themeConfig) {
        cfg = clone(themeConfig || {});
        ensureShape();
        setupAutoListener();
        apply();
    }

    function exportConfig() {
        return clone(cfg);
    }

    function importConfig(obj) {
        if (!obj || typeof obj !== "object")
            throw new Error("Configuração de tema inválida.");
        cfg = clone(obj);
        ensureShape();
        setupAutoListener();
        apply();
    }

    function onChange(fn) {
        if (typeof fn === "function") listeners.push(fn);
    }
    function notify(mode) {
        listeners.forEach((fn) => {
            try {
                fn(mode);
            } catch (_) {}
        });
    }

    return {
        init: init,
        apply: apply,
        setMode: setMode,
        setPalette: setPalette,
        setToken: setToken,
        getToken: getToken,
        getMode: () => (cfg ? cfg.mode : "dark"),
        getPalette: () => (cfg ? cfg.palette : null),
        effectiveMode: effectiveMode,
        isValidHex: isValidHex,
        normalizeHex: normalizeHex,
        exportConfig: exportConfig,
        importConfig: importConfig,
        onChange: onChange,
    };
})();

if (typeof module === "object" && module.exports) {
    module.exports = BannerTheme;
}

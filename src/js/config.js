/**
 * @file config.js
 * @description Configuração central do Banner de Assinatura.
 *
 * Único arquivo a editar para personalizar tudo — conteúdo, tema, cores
 * e exportação — sem tocar no código principal.
 *
 * Seções:
 *  - defaults  -> conteúdo inicial
 *  - theme     -> GESTÃO CENTRAL DE TEMAS (fonte única de cores)
 *  - export    -> formato, resolução, qualidade, arquivo
 *  - brand     -> tokens de identidade (fontes, dimensões, raio)
 */

const BANNER_CONFIG = {
    defaults: {
        eyebrow: "Software Developer",
        name: "**Guilherme de Souza Cruz**",
        role: "Desenvolvedor de Software",
        empresa: "",
        specs: "Full Stack Developer; AI & Automation; Freelancer",
        tagline:
            "Desenvolvendo soluções digitais que transformam desafios em oportunidades.",
        email: "contato.guilhermescruz@gmail.com",
        site: "bl4ck404.dev.br",
        qrUrl: "https://devlinks-rocketseat-five.vercel.app",
    },

    /**
     * THEME — gestão central de temas.
     *
     *  mode:    "light" | "dark" | "auto" (auto segue prefers-color-scheme)
     *  palette: chave de `palettes` aplicada ao acento
     *  palettes: paletas pré-definidas (acento + acento secundário "signal")
     *  tokens:  cada cor é semântica e tem variante { light, dark } em hex.
     *           Todas as cores do banner derivam daqui. Para criar um tema
     *           personalizado, basta editar/adicionar valores abaixo.
     *
     * Tokens semânticos:
     *  background    -> fundo do banner
     *  textPrimary   -> nome, cargo (alta hierarquia)
     *  textSecondary -> tagline, specs, contato
     *  accent        -> rail, ícones, bullets, QR (cor de marca)
     *  border        -> bordas e divisores
     */
    theme: {
        mode: "dark",
        palette: "crimson",

        palettes: {
            crimson: { accent: "#e11d48", signal: "#4f46e5", label: "Crimson" },
            indigo: { accent: "#4f46e5", signal: "#e11d48", label: "Indigo" },
            emerald: { accent: "#059669", signal: "#0ea5e9", label: "Esmeralda" },
            amber: { accent: "#d97706", signal: "#4f46e5", label: "Âmbar" },
            sky: { accent: "#0284c7", signal: "#7c3aed", label: "Azul" },
            violet: { accent: "#7c3aed", signal: "#db2777", label: "Violeta" },
        },

        tokens: {
            background: { light: "#ffffff", dark: "#0b1220" },
            textPrimary: { light: "#0f172a", dark: "#f1f5f9" },
            textSecondary: { light: "#475569", dark: "#94a3b8" },
            accent: { light: "#e11d48", dark: "#e11d48" },
            border: { light: "#e6e8ee", dark: "#22304a" },
        },
    },

    /**
     * EXPORTAÇÃO — afeta apenas o arquivo, nunca o editor.
     *  format:      "png" | "jpeg" | "webp"
     *  quality:     0..1 (JPEG/WebP)
     *  defaultSize: "small"(1x) | "medium"(2x) | "large"(3x) | "auto" | "custom"
     *  custom:      dimensões px do modo "Personalizada"
     */
    export: {
        format: "png",
        quality: 0.92,
        defaultSize: "medium",
        custom: { width: 2400, height: 640, preserveAspect: true },
        filename: "banner-assinatura-guilherme-cruz",
    },

    brand: {
        fontSans: "'Inter', -apple-system, 'Segoe UI', sans-serif",
        fontSerif: "'Fraunces', 'Tiempos Headline', Georgia, serif",
        fontMono: "'JetBrains Mono', 'SFMono-Regular', Consolas, monospace",
        bannerWidth: 1200,
        bannerHeight: 320,
        borderRadius: 16,
    },
};

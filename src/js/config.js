/**
 * @file config.js
 * @description Configuração do Banner de Assinatura.
 *
 * Único arquivo que você precisa editar para personalizar o banner.
 *
 * Seções:
 *  - defaults    -> conteúdo inicial dos campos
 *  - colors      -> paleta base (tema claro)
 *  - appearance  -> tema e paleta de acento iniciais
 *  - export      -> formato, resolução, qualidade e padrão de arquivo
 *  - brand       -> tokens visuais (fontes, dimensões, raio)
 *
 * Sintaxe nos textos:
 *  - **palavra**   no "name"     -> negrito
 *  - <br>          no "tagline"  -> quebra de linha
 *  - ";"           no "specs"    -> separa especializações
 */

const BANNER_CONFIG = {
    defaults: {
        eyebrow: "Software Developer",
        name: "**Guilherme de Souza Cruz**",
        role: "Desenvolvedor de Software",
        empresa: "", // opcional: aparece ao lado do cargo quando preenchido
        specs: "Full Stack Developer; AI & Automation; Freelancer",
        tagline:
            "Desenvolvendo soluções digitais que transformam desafios em oportunidades.",
        email: "contato.guilhermescruz@gmail.com",
        site: "bl4ck404.dev.br",
        qrUrl: "https://devlinks-rocketseat-five.vercel.app",
    },

    colors: {
        background: "#ffffff",
        textPrimary: "#0f172a",
        textSecondary: "#475569",
        accent: "#e11d48",
        border: "#e6e8ee",
    },

    /**
     * APARÊNCIA
     *  theme:         "light" | "dark"
     *  accentPalette: "crimson" | "indigo" | "emerald" | "amber" | "sky" | "violet"
     */
    appearance: {
        theme: "light",
        accentPalette: "crimson",
    },

    /**
     * EXPORTAÇÃO — afeta apenas o arquivo, nunca o editor.
     *  format:      "png" | "jpeg" | "webp"
     *  quality:     0..1 (apenas JPEG/WebP)
     *  defaultSize: "small"(1x) | "medium"(2x) | "large"(3x) | "auto" | "custom"
     *  custom:      dimensões em px do modo "Personalizada"
     */
    export: {
        format: "png",
        quality: 0.92,
        defaultSize: "medium",
        custom: {
            width: 2400,
            height: 640,
            preserveAspect: true,
        },
        filename: "banner-assinatura-guilherme-cruz",
    },

    brand: {
        signal: "#4f46e5",
        fontSans: "'Inter', -apple-system, 'Segoe UI', sans-serif",
        fontSerif: "'Fraunces', 'Tiempos Headline', Georgia, serif",
        fontMono: "'JetBrains Mono', 'SFMono-Regular', Consolas, monospace",
        bannerWidth: 1200,
        bannerHeight: 320,
        borderRadius: 16,
    },
};

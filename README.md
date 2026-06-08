# Signature Banner

Banner de assinatura profissional em HTML/CSS/JS puro — editável em tempo
real, com tema claro/escuro, exportação em PNG/JPEG/WebP de alta resolução,
100% offline e sem dependências externas (nem build, nem CDN).

---

## Funcionalidades

- **Preview ao vivo** — qualquer alteração reflete instantaneamente no banner.
- **Tema claro/escuro/auto** — o tema do banner e da interface mudam juntos;
  `auto` segue `prefers-color-scheme`.
- **Cores semânticas** — `background`, `textPrimary`, `textSecondary`,
  `accent`, `border`, cada uma com variante clara e escura, editáveis por
  seletor de cor ou hex validado.
- **Paletas de acento** — Crimson, Indigo, Esmeralda, Âmbar, Azul, Violeta.
- **QR Code dinâmico** — gerado localmente (sem CDN), com contraste garantido
  em qualquer tema.
- **Foto de perfil** — substitui o monograma (drag & drop).
- **Exportação avançada** — formatos PNG/JPEG/WebP, resoluções predefinidas
  (1×/2×/3×/auto) e **resolução personalizada** em pixels, com preservação de
  proporção, qualidade e validação de limites.
- **Importar/Exportar configuração** — salva e restaura todo o estado em JSON.
- **Zero dependências** — sem framework, sem bundler, sem servidor.

---

## Início rápido

```bash
git clone https://github.com/seu-usuario/signature-banner.git
cd signature-banner
open index.html        # ou: python3 -m http.server  →  http://localhost:8000
```

Não é necessário instalar nada.

---

## Personalização

### Método 1 — Painel visual

Abra `index.html`, edite as seções (Aparência, Conteúdo, Mídia, Layout,
Exportação), escolha formato/resolução e clique em **Exportar imagem**. Use
**Exportar/Importar configuração** para versionar o estado em JSON.

### Método 2 — `src/js/config.js`

`config.js` é o único arquivo que você precisa editar. Estrutura resumida:

```js
const BANNER_CONFIG = {
  defaults: {
    eyebrow: "Software Developer",
    name:    "**Guilherme de Souza Cruz**", // **negrito** parcial
    role:    "Desenvolvedor de Software",
    empresa: "",                              // opcional (ao lado do cargo)
    specs:   "Full Stack; AI & Automation",   // separados por ;
    tagline: "Linha 1<br>Linha 2",            // <br> quebra linha
    email:   "voce@email.com",
    site:    "seusite.com.br",
    qrUrl:   "https://links.seusite.com.br",
  },

  theme: {
    mode: "dark",          // "light" | "dark" | "auto"
    palette: "crimson",    // chave de palettes
    palettes: { crimson: { accent: "#e11d48", signal: "#4f46e5" }, /* ... */ },
    tokens: {              // cada cor: variante light + dark
      background:    { light: "#ffffff", dark: "#0b1220" },
      textPrimary:   { light: "#0f172a", dark: "#f1f5f9" },
      textSecondary: { light: "#475569", dark: "#94a3b8" },
      accent:        { light: "#e11d48", dark: "#e11d48" },
      border:        { light: "#e6e8ee", dark: "#22304a" },
    },
  },

  export: {
    format: "png",         // "png" | "jpeg" | "webp"
    quality: 0.92,         // 0..1 (JPEG/WebP)
    defaultSize: "medium", // small | medium | large | auto | custom
    custom: { width: 2400, height: 640, preserveAspect: true },
    filename: "banner-assinatura",
  },

  brand: { /* fontes e dimensões lógicas do banner */ },
};
```

### Sintaxe especial

| Campo | Sintaxe | Resultado |
|-------|---------|-----------|
| `name` | `Primeiro **Último**` | "Último" em negrito |
| `tagline` | `Linha 1<br>Linha 2` | Quebra de linha |
| `specs` | `React; Node; SQL` | Itens com bullets |

---

## Estrutura do projeto

```
signature-banner/
├── index.html              ← ponto de entrada (não editar)
├── src/
│   ├── css/banner.css       ← tokens de tema (UI) + banner + painel
│   └── js/
│       ├── config.js        ← ★ EDITE AQUI — conteúdo, tema, exportação
│       ├── qrcode.lib.js    ← QR Code (Kazuhiko Arase, MIT) — não editar
│       ├── theme.js         ← BannerTheme: gestão central de temas
│       ├── export.js        ← BannerExporter: exportação fiel ao DOM
│       └── banner.js        ← editor (UI, sync, listeners, bootstrap)
└── docs/
    ├── CUSTOMIZATION.md
    └── DEVELOPMENT.md
```

### Ordem de carregamento dos scripts

```
qrcode.lib.js → config.js → theme.js → export.js → banner.js
```

`theme.js`, `export.js` e `banner.js` consomem os globais `qrcode` e
`BANNER_CONFIG`. A ordem no `index.html` garante isso sem bundler.

---

## Exportação — como funciona

`export.js` **não recria o layout**: ele mede o DOM vivo
(`getBoundingClientRect`) e lê os estilos calculados (`getComputedStyle`) de
cada elemento, pintando num `<canvas>` off-screen nas mesmas posições, fontes
e cores exibidas. O que está na tela é o que sai no arquivo.

- **Resoluções**: `small` 1× (1200×320), `medium` 2× (2400×640), `large` 3×
  (3600×960), `auto` (densidade da tela) e `custom` (px arbitrários).
- **Proporção**: com "preservar proporção" a escala é uniforme (sem distorção).
- **Formatos**: PNG (alfa), JPEG (fundo opaco), WebP. Qualidade aplica-se aos
  formatos com perda.
- **Limites**: 200–8000 px por lado e guarda de ~40 MP, com validação.

> **E-mail**: links dentro de imagens não são clicáveis na maioria dos
> clientes. Cole o banner com uma linha de texto real contendo seus links.

---

## Compatibilidade

| Navegador | Suporte |
|-----------|---------|
| Chrome / Edge 90+ | ✅ |
| Firefox 90+ | ✅ |
| Safari 15+ | ✅ |

Requer: `Canvas 2D API`, `CSS custom properties`, `color-mix()`,
`FileReader`, `prefers-color-scheme`. O `letter-spacing` no canvas tem
fallback manual para navegadores que não o suportam.

---

## Licença

Código sob [MIT](LICENSE). O QR Code embutido (`src/js/qrcode.lib.js`) é de
**Kazuhiko Arase**, também MIT.

# Guia de Desenvolvimento

Arquitetura interna do **Signature Banner** para quem for estender o projeto.

---

## Visão geral

SPA vanilla — sem framework, sem bundler, sem transpilador. Cinco scripts
globais carregados em ordem:

```
index.html
   │  (carrega em ordem)
   ▼
qrcode.lib.js   → expõe qrcode()            (Kazuhiko Arase, MIT)
config.js       → expõe BANNER_CONFIG        (editável pelo usuário)
theme.js        → expõe BannerTheme          (gestão central de temas)
export.js       → expõe BannerExporter       (exportação fiel ao DOM)
banner.js       → editor: UI, sync, listeners, bootstrap
```

`config.js`, `theme.js` e `export.js` são declarações `const` de topo
(lexical globals), visíveis aos scripts seguintes sem `window.` — mesmo
modelo do navegador.

---

## Responsabilidades por módulo

### theme.js — `BannerTheme`
Fonte única de cores. Lê `BANNER_CONFIG.theme` (clonado) e:

- resolve o modo efetivo (`light`/`dark`/`auto`+`prefers-color-scheme`);
- aplica as variantes de cor nas CSS vars locais do banner;
- alterna `body.light-mode` para a interface acompanhar;
- valida/normaliza hex, troca paleta, e faz import/export do estado.

| Método | Descrição |
|--------|-----------|
| `init(themeConfig)` | inicializa e aplica |
| `setMode(m)` / `setPalette(n)` / `setToken(name,hex[,mode])` | mutadores |
| `getToken(name[,mode])` / `getMode()` / `getPalette()` / `effectiveMode()` | leitura |
| `isValidHex(v)` / `normalizeHex(v)` | hex |
| `exportConfig()` / `importConfig(obj)` | estado |
| `onChange(fn)` | callback a cada `apply()` (usado para redesenhar o QR) |

### export.js — `BannerExporter`
Renderiza o banner medindo o DOM real (não recria layout). Mede posições com
`getBoundingClientRect` e lê estilos com `getComputedStyle`, pintando num
canvas off-screen.

| Função | Descrição |
|--------|-----------|
| `describeTarget(opts,W,H)` | calcula dimensões/escala/validade sem renderizar (preview) |
| `dimensionsFor(sizeKey,W,H)` / `resolveScale(sizeKey)` | presets |
| `buildCanvas(opts)` | monta o canvas (fundo, rail, avatar, texto, ícones, QR) |
| `download(opts)` | gera o blob e dispara o download |

Internos: `computeTarget` (clamp + validação + proporção), `paintText`
(percorre nós de texto, herda fonte/cor/transform/letter-spacing de cada
elemento — negrito parcial, bullets e quebras saem automáticos), `paintIcons`
(serializa cada `<svg>` resolvendo `currentColor`), `drawAvatar`, `drawQRZone`,
`canvasToBlob` (com fallback `toDataURL`).

### banner.js — editor
UI e cola entre módulos.

| Grupo | Funções |
|-------|---------|
| Init | `initFromConfig()` (conteúdo, layout, export) |
| Texto | `parseBold`, `renderSpecs`, `syncText` |
| QR | `drawQR` (+ `qrInkColor`/`relativeLuminance` p/ contraste), `roundRect` |
| Tema/cores | `refreshThemeUI`, `reflect*`, `handleTokenColorInput/HexInput` |
| Layout | `applyLayoutToggles` |
| Export | `currentExportOptions`, `refreshExportUI`, `handleExport` |
| Config IO | `gatherConfigSnapshot`, `applyConfigSnapshot`, `exportConfigFile`, `importConfigFile` |
| Reset | `resetToDefaults` |

---

## Fluxo de dados

```
BANNER_CONFIG ──init──▶ BannerTheme.cfg (clone)
        │                      │ apply()
        ▼                      ▼
   inputs do painel     CSS vars do banner + body.light-mode
        │ (eventos)            │ onChange → drawQR()
        ▼                      ▼
   syncText / handleToken*   QR recolorido
        │
        ▼
   DOM do banner  ──(medido em tempo de export)──▶  BannerExporter.buildCanvas()
```

O export sempre lê o estado atual do DOM, então reflete tema, cores, textos,
foto e ícones exatamente como exibidos.

---

## Convenções de cor

- **Interface** (página/painel): tokens `--color-*` no `:root` (dark) e
  `body.light-mode` (light). Não editáveis pelo usuário.
- **Banner**: tokens locais `--void/--text/--text-2/--accent/--border/--signal`,
  definidos em runtime pelo `BannerTheme`. Derivados (`--text-3`,
  `--accent-soft`, `--border-brand`) via `color-mix()`.

O modo (claro/escuro) controla os dois conjuntos ao mesmo tempo.

---

## Adicionando um novo campo de conteúdo

1. `index.html` — `<div class="field">` + `<input id="f-...">` na seção Conteúdo
   e o elemento alvo (`<span id="t-...">`) no banner.
2. `config.js` — chave em `defaults`.
3. `banner.js` — em `initFromConfig` (popular), `syncText` (sincronizar),
   `TEXT_FIELDS` (listener) e, se relevante, em `gather/applyConfigSnapshot`.
4. O export captura automaticamente (é dirigido pelo DOM) — nada a fazer lá.
5. `docs/CUSTOMIZATION.md` — documentar.

---

## Deploy (GitHub Pages / estático)

Sem build: faça push e aponte o Pages para a branch/raiz. Funciona em qualquer
host estático (Pages, Netlify, Vercel, S3).

---

## Notas técnicas

- **Sem util compartilhado**: pequenas funções de cor (`parseRGB`,
  `relativeLuminance`, `roundRect`) aparecem isoladas por módulo, de propósito —
  cada script é independente e não há bundler. É um trade-off conhecido.
- **`[hidden]`**: o CSS força `[hidden]{display:none!important}` para que o
  atributo vença regras de classe (ex.: `.grid{display:grid}` em
  `#custom-res`/`#quality-row`).
- **FOUC**: com `mode: "light"` há um possível flash escuro de 1 frame antes do
  JS aplicar `body.light-mode` (os scripts ficam no fim do `<body>`). Com o
  padrão `dark` não ocorre. Para eliminar no light, inline um script mínimo no
  `<head>` que adicione a classe antes da pintura.

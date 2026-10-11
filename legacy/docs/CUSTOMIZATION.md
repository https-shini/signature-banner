# Guia de Personalização

Todas as opções de customização do **Signature Banner**.

---

## 1. Painel visual

Abra `index.html`. O painel é dividido em seções recolhíveis:

- **Aparência** — tema (Claro/Escuro/Auto), paleta de acento e cores por token.
- **Conteúdo** — nome, cargo, empresa, eyebrow, specs, tagline, e-mail, site, QR.
- **Mídia** — foto de perfil (substitui o monograma).
- **Layout** — mostrar/ocultar QR; animação do cursor (apenas no editor).
- **Exportação** — formato, resolução, qualidade.

Tudo reflete em tempo real. **Exportar/Importar configuração** (em Aparência)
salva e restaura o estado completo em JSON.

---

## 2. `src/js/config.js`

Único arquivo a editar para persistir personalizações.

### `defaults` — conteúdo

| Chave | Descrição | Sintaxe |
|-------|-----------|---------|
| `eyebrow` | Rótulo mono acima do nome | UPPERCASE recomendado |
| `name` | Nome completo | `**Texto**` para negrito |
| `role` | Cargo principal | — |
| `empresa` | Empresa (opcional) | aparece ao lado do cargo quando preenchida |
| `specs` | Especializações | separe com `;` |
| `tagline` | Frase de posicionamento | `<br>` quebra linha |
| `email` | E-mail | vira `mailto:` |
| `site` | Site exibido | `https://` adicionado se ausente |
| `qrUrl` | URL do QR | URL completa |

### `theme` — gestão central de temas (fonte única de cores)

| Chave | Descrição |
|-------|-----------|
| `mode` | `"light"`, `"dark"` ou `"auto"` (segue `prefers-color-scheme`) |
| `palette` | chave de `palettes` aplicada ao acento |
| `palettes` | mapa `nome → { accent, signal }` (acento + acento secundário) |
| `tokens` | mapa `tokenSemântico → { light, dark }` em hex |

Tokens semânticos e seu papel no banner:

| Token | Papel |
|-------|-------|
| `background` | fundo do banner |
| `textPrimary` | nome, cargo |
| `textSecondary` | tagline, specs, contato |
| `accent` | rail, ícones, bullets, QR |
| `border` | bordas e divisores |

Todas as cores do banner derivam de `theme.tokens`. O `BannerTheme` (theme.js)
aplica a variante do modo efetivo nas CSS vars locais do banner
(`--void`, `--text`, `--text-2`, `--accent`, `--border`) e alterna
`body.light-mode` para a interface acompanhar.

> Os tokens derivados `--text-3` (eyebrow/labels), `--accent-soft` e
> `--border-brand` são calculados via `color-mix()` no CSS a partir de
> `--text-2`/`--accent`, então acompanham as cores automaticamente.

### `export` — exportação

| Chave | Descrição | Padrão |
|-------|-----------|--------|
| `format` | `"png"` / `"jpeg"` / `"webp"` | `"png"` |
| `quality` | 0..1 (JPEG/WebP) | `0.92` |
| `defaultSize` | `small`/`medium`/`large`/`auto`/`custom` | `"medium"` |
| `custom` | `{ width, height, preserveAspect }` em px | 2400×640 |
| `filename` | nome do arquivo (extensão automática) | — |

### `brand` — identidade

| Chave | Descrição | Padrão |
|-------|-----------|--------|
| `fontSans` / `fontSerif` / `fontMono` | font stacks | Inter / Fraunces / JetBrains Mono |
| `bannerWidth` / `bannerHeight` | dimensões lógicas | 1200 / 320 |
| `borderRadius` | arredondamento | 16 |

---

## 3. Criar um tema personalizado

Edite as variantes em `theme.tokens` e/ou adicione uma paleta:

```js
theme: {
  mode: "dark",
  palette: "oceano",
  palettes: {
    // ...existentes
    oceano: { accent: "#0ea5e9", signal: "#22d3ee" },
  },
  tokens: {
    background:    { light: "#f7fbff", dark: "#04121f" },
    textPrimary:   { light: "#0b2233", dark: "#e6f6ff" },
    textSecondary: { light: "#3b5566", dark: "#8fb6c9" },
    accent:        { light: "#0ea5e9", dark: "#0ea5e9" },
    border:        { light: "#dcebf5", dark: "#123243" },
  },
},
```

Ou, sem editar código, faça a personalização no painel e use
**Exportar configuração** para gerar um `banner-config.json` versionável.

---

## 4. Tipografia

As fontes são importadas do Google Fonts no topo de `src/css/banner.css`.
Para trocar: ajuste o `@import` e os tokens `--font-sans/--font-serif/--font-mono`
(banner) e `--font-body/--font-mono` (interface). A exportação lê as fontes
computadas do DOM — não há nomes de fonte fixos no código de export.

---

## 5. Uso 100% offline

O projeto roda offline, exceto pelo download das fontes do Google. Para
offline total: baixe as fontes em WOFF2, coloque em `src/fonts/` e troque o
`@import` por `@font-face` local em `banner.css`.

---

## 6. Exemplo de configuração

```js
defaults: {
  eyebrow: "FRONTEND ENGINEER",
  name:    "Ana **Oliveira**",
  role:    "Frontend Developer",
  empresa: "Acme",
  specs:   "React; TypeScript; Design Systems",
  tagline: "Interfaces que encantam<br>e sistemas que escalam.",
  email:   "ana@email.com",
  site:    "anaoliveira.dev",
  qrUrl:   "https://anaoliveira.dev",
},
theme: { mode: "light", palette: "indigo" },
```

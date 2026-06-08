# Guia de Desenvolvimento

Este documento descreve a arquitetura interna do **Signature Banner** para quem quiser contribuir, estender ou adaptar o projeto.

---

## Arquitetura

O projeto é uma SPA (Single Page Application) vanilla — sem framework, sem bundler, sem transpilador.

```
┌─────────────────────────────────────────┐
│              index.html                 │
│   (estrutura HTML + carrega scripts)    │
└───────────┬─────────────────────────────┘
            │ carrega em ordem
            ▼
┌───────────────────┐
│  qrcode.lib.js    │  → expõe `qrcode()` global (Kazuhiko Arase, MIT)
└───────────────────┘
            │
            ▼
┌───────────────────┐
│    config.js      │  → expõe `BANNER_CONFIG` global (editável pelo usuário)
└───────────────────┘
            │
            ▼
┌───────────────────┐
│    banner.js      │  → consome qrcode() e BANNER_CONFIG, inicializa tudo
└───────────────────┘
            │
            ├── initFromConfig()  → popula formulário com config
            ├── syncText()        → DOM do banner ← inputs de texto
            ├── syncColors()      → CSS vars ← color pickers
            ├── drawQR()          → canvas#qrCanvas ← URL + cor
            └── exportPNG()       → off-screen canvas → download .png
```

---

## Fluxo de dados

```
BANNER_CONFIG (config.js)
         │
         ▼
  initFromConfig()   ←── carrega uma vez no bootstrap
         │
         ▼
  campos do painel (#f-*)
         │
    input event
         │
    ┌────┴──────┐
    ▼           ▼
syncText()   syncColors()
    │               │
    ▼               ▼
  DOM do         CSS vars
  banner         (--void,
 (#t-*, ctas,    --text,
  monogram)      --accent, ...)
                    │
                    ▼
                 drawQR()
                 (recolore
                  módulos)
```

---

## Módulos de `banner.js`

### Inicialização

| Função | Responsabilidade |
|--------|-----------------|
| `initFromConfig()` | Lê `BANNER_CONFIG` e popula todos os `<input>` com os valores padrão |

### Parsers de texto

| Função | Input | Output |
|--------|-------|--------|
| `parseBold(str)` | `"Nome **Cruz**"` | `"Nome <b>Cruz</b>"` (HTML escapado) |
| `renderSpecs(val)` | `"React; Node; SQL"` | HTML com `<span class="role alt">` e `<span class="sep">` |

### Sincronização DOM

| Função | Trigger | Efeito |
|--------|---------|--------|
| `syncText()` | `input` nos text fields | Atualiza todos os elementos de texto do banner |
| `syncColors()` | `input` nos color pickers | Seta CSS vars no `:root` e chama `drawQR()` |

### QR Code

| Função | Descrição |
|--------|-----------|
| `drawQR()` | Gera QR via lib, renderiza no canvas com módulos arredondados |
| `roundRect(ctx, x, y, w, h, r)` | Helper: retângulo com bordas arredondadas no canvas 2D |

### Export PNG

| Função | Descrição |
|--------|-----------|
| `exportPNG(scale?)` | async: aguarda fonts, cria canvas off-screen, renderiza tudo, dispara download |
| `hexA(color, a)` | Converte `#rrggbb` ou `rgb(...)` para `rgba(..., a)` |
| `letterSpacedText(ctx, text, x, y, ls)` | Texto com letter-spacing manual (workaround Canvas API) |
| `measureSpaced(ctx, text, ls)` | Mede largura de texto com letter-spacing manual |
| `drawName(ctx, x, y, color)` | Renderiza nome com bold parcial via parsing do innerHTML |
| `drawSpecs(ctx, x, y, color, accentColor)` | Renderiza especializações com bullets circulares |
| `parseTaglineLines(node)` | Extrai linhas da tagline separadas por `<br>` |
| `drawArrow / drawChat / drawEnvelope / drawGlobe` | Ícones desenhados com Canvas 2D primitives |
| `roundRectPath(ctx, x, y, w, h, r)` | Path de retângulo arredondado (sem fill/stroke) |

---

## Layout do canvas de export

O canvas tem `1200×320` px em coordenadas lógicas (escala aplicada depois):

```
  0                 250     266                970     1200
  ┌──┬──────────────────────────────────────────────────────┐
  │  │ avatar-zone   │  content                  │ qr-zone  │
  │  │               │                           │          │
  │ ←4px rail        │                           │ ←230px→  │
  └──┴──────────────────────────────────────────────────────┘
```

Coordenadas Y dos elementos (dentro do content):
- `y=46`  → eyebrow
- `y=100` → nome (baseline do texto serif 46px)
- `y=135` → cargo principal
- `y=162` → especializações
- `y=195` → tagline (+ `22px` por linha adicional)
- `y=262` → CTAs (centro dos botões)
- `y=300` → linha de contato

---

## Adicionando um novo campo ao painel

1. **`index.html`** — adicione o par `<div class="field">` + `<input>` com um ID no painel
2. **`config.js`** — adicione a chave correspondente em `defaults`
3. **`banner.js`**:
   - `initFromConfig()`: adicione `$('seu-input').value = d.suaChave`
   - `syncText()`: adicione a lógica de sincronização com o elemento do banner
   - `TEXT_FIELDS`: adicione o ID do input no array de listeners
4. **`exportPNG()`**: se o campo impactar o PNG, adicione a renderização correspondente
5. **`docs/CUSTOMIZATION.md`**: documente a nova chave

---

## Deploy no GitHub Pages

1. Faça fork ou push do repositório
2. Vá em **Settings → Pages**
3. Selecione a branch `main` e a raiz `/`
4. O banner estará acessível em `https://seu-usuario.github.io/signature-banner/`

> Como o projeto não tem build step, o deploy é imediato.

---

## Sem bundler — por quê?

O projeto prioriza **zero fricção** para contribuidores e usuários:

- Abrir → editar → usar. Sem `npm install`, sem `npm run dev`
- Compatível com qualquer hospedagem estática (GitHub Pages, Netlify, Vercel, S3)
- `qrcode.lib.js` é embutido intencionalmente para funcionamento offline
- Os três scripts são pequenos o suficiente para não justificar bundling

Se você quiser adicionar um bundler (Vite, esbuild), a estrutura modular atual facilita a migração — basta converter os globals (`qrcode`, `BANNER_CONFIG`) para ESM exports.

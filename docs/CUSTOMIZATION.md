# Guia de Personalização

Este documento explica em detalhes todas as opções de customização do **Signature Banner**.

---

## 1. Edição via painel visual

Abra `index.html` no navegador. O painel abaixo do banner permite editar:

- **Conteúdo**: eyebrow, nome, cargo, especializações, tagline, e-mail, site, CTAs, QR
- **Cores**: fundo, texto primário, texto secundário, acento, bordas
- **Foto**: upload de imagem local (substitui o monograma)

Toda alteração reflete em tempo real no preview.

---

## 2. Edição via `src/js/config.js`

Para que suas personalizações persistam ao recarregar a página — especialmente útil para versionar no repositório — edite o arquivo `src/js/config.js`.

### `defaults` — conteúdo do banner

| Chave | Descrição | Sintaxe especial |
|-------|-----------|-----------------|
| `eyebrow` | Rótulo monospace acima do nome | UPPERCASE recomendado |
| `name` | Nome completo | Use `**Texto**` para negrito (Fraunces 500) |
| `role` | Cargo principal em destaque | — |
| `specs` | Especializações em linha | Separe com `;` (ponto-e-vírgula) |
| `tagline` | Frase curta de posicionamento | Use `<br>` para quebrar a linha |
| `email` | Endereço de e-mail | Vira `mailto:` automaticamente |
| `site` | Domínio ou URL do site | `https://` adicionado se ausente |
| `cta1Text` | Texto do botão primário (crimson) | — |
| `cta1Link` | Link do botão primário | URL completa |
| `cta2Text` | Texto do botão secundário (indigo) | — |
| `cta2Link` | Link do botão secundário | URL completa |
| `qrLabel` | Rótulo mono abaixo do QR | UPPERCASE recomendado |
| `qrUrl` | URL codificada no QR Code | URL completa |

### `colors` — paleta de cores

| Chave | Papel no banner | Padrão |
|-------|----------------|--------|
| `background` | Superfície do banner | `#ffffff` |
| `textPrimary` | Nome, cargo, botão primário (texto) | `#0f172a` |
| `textSecondary` | Tagline, especializações, contato | `#475569` |
| `accent` | Rail, botão primário, anel do avatar, QR, bullets | `#e11d48` |
| `border` | Borda do banner, divisor do QR | `#e6e8ee` |

> A cor `textTertiary` (`--text-3`, usado em labels mono e eyebrow) é derivada de `textSecondary` via CSS e não é exposta no config. Para alterá-la, edite `--text-3` em `src/css/banner.css`.

### `export` — configurações do PNG

| Chave | Descrição | Padrão |
|-------|-----------|--------|
| `scale` | Fator de escala (1 = 1200×320, 2 = 2400×640, 3 = 3600×960) | `2` |
| `filename` | Nome do arquivo baixado | `'banner-assinatura.png'` |

### `brand` — tokens de identidade visual

| Chave | Descrição | Padrão |
|-------|-----------|--------|
| `signal` | Cor do botão secundário e borda indigo | `'#4f46e5'` |
| `fontSans` | Font stack sans-serif | `'Inter', ...` |
| `fontSerif` | Font stack serif display | `'Fraunces', ...` |
| `fontMono` | Font stack monospace | `'JetBrains Mono', ...` |
| `bannerWidth` | Largura lógica do banner em px | `1200` |
| `bannerHeight` | Altura lógica do banner em px | `320` |
| `borderRadius` | Arredondamento do card do banner | `16` |

---

## 3. Troca de paleta de cores completa

Para uma identidade diferente (ex: azul marinho + dourado), altere em `config.js`:

```js
colors: {
  background:    '#0a0f1e',   // fundo escuro
  textPrimary:   '#f0f4ff',
  textSecondary: '#94a3b8',
  accent:        '#f5c542',   // dourado
  border:        '#1e2a3a',
},
brand: {
  signal: '#60a5fa',          // azul
  // ...
},
```

E ajuste os primitivos de cor no `:root` de `src/css/banner.css` se quiser que os gradientes de glow também mudem.

---

## 4. Troca de tipografia

As fontes são importadas do Google Fonts no topo de `src/css/banner.css`. Para substituí-las:

1. Altere o `@import url(...)` em `banner.css` pela nova fonte
2. Atualize os campos `fontSans`, `fontSerif` ou `fontMono` em `config.js`
3. Atualize as referências de fonte hardcoded no `exportPNG()` em `banner.js` (procure por `ctx.font = ...`)

---

## 5. Uso offline completo

O projeto já funciona offline exceto pelo carregamento das fontes Google (Inter, JetBrains Mono, Fraunces). Para uso completamente offline:

1. Baixe as fontes em formato WOFF2 (ex: via [google-webfonts-helper](https://gwfh.mranftl.com/))
2. Coloque em `src/fonts/`
3. Substitua o `@import` por `@font-face` local em `banner.css`

---

## 6. Exemplos de configuração

### Desenvolvedor frontend

```js
defaults: {
  eyebrow:  'FRONTEND ENGINEER',
  name:     'Ana **Oliveira**',
  role:     'Frontend Developer',
  specs:    'React; TypeScript; Design Systems',
  tagline:  'Criando interfaces que encantam<br>e sistemas que escalam.',
  email:    'ana@email.com',
  site:     'anaoliveira.dev',
  cta1Text: 'Ver Projetos',
  cta1Link: 'https://anaoliveira.dev',
  cta2Text: 'LinkedIn',
  cta2Link: 'https://linkedin.com/in/anaoliveira',
  qrLabel:  'PORTFÓLIO',
  qrUrl:    'https://anaoliveira.dev',
},
colors: {
  accent: '#6366f1', // violeta
},
```

### Designer UX/UI

```js
defaults: {
  eyebrow:  'UX / UI DESIGNER',
  name:     'Lucas **Ferreira**',
  role:     'Product Designer',
  specs:    'Figma; Pesquisa; Prototipação',
  tagline:  'Design centrado em pessoas,<br>produtos que fazem sentido.',
  // ...
},
colors: {
  accent: '#f97316', // laranja
},
brand: {
  signal: '#ec4899', // rosa
},
```

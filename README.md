# Signature Banner

Banner de assinatura profissional em HTML puro — editável em tempo real, exportável como PNG de alta resolução, totalmente offline e sem dependências externas.

![Banner Preview](docs/preview.png)

---

## Funcionalidades

- **Preview ao vivo** — qualquer alteração no painel reflete instantaneamente no banner
- **QR Code dinâmico** — gerado localmente via lib embutida (sem CDN, funciona offline)
- **Upload de foto** — substitui o monograma por foto profissional
- **Export PNG 2×** — gera imagem em 2400×640 px pronta para assinatura de e-mail
- **Painel de cores** — personalização de paleta em tempo real via color pickers
- **Zero dependências** — sem frameworks, sem build step, sem servidor

---

## Início rápido

```bash
# Clone o repositório
git clone https://github.com/seu-usuario/signature-banner.git
cd signature-banner

# Abra no navegador (qualquer método funciona)
open index.html
# ou: python3 -m http.server e acesse http://localhost:8000
```

Não é necessário instalar nada.

---

## Personalização

### Método 1 — Painel visual (recomendado para uso pontual)

Abra `index.html` no navegador, edite os campos do painel e clique em **Exportar PNG (2×)**.

### Método 2 — Arquivo de configuração (recomendado para manter no repositório)

Edite **`src/js/config.js`** para definir seus valores padrão. Este é o único arquivo que você precisa alterar:

```js
const BANNER_CONFIG = {
  defaults: {
    eyebrow:  'SOFTWARE ENGINEER',
    name:     'Seu Nome **Sobrenome**',  // **negrito** no sobrenome
    role:     'Desenvolvedor de Software',
    specs:    'Frontend; React; TypeScript', // separados por ;
    tagline:  'Sua tagline aqui<br>segunda linha opcional.',
    email:    'seu@email.com',
    site:     'seusite.com.br',
    cta1Text: 'Ver Portfólio',
    cta1Link: 'https://seusite.com.br',
    cta2Text: 'Entrar em Contato',
    cta2Link: 'https://linkedin.com/in/voce',
    qrLabel:  'MEUS LINKS',
    qrUrl:    'https://linktr.ee/voce',
  },

  colors: {
    background:     '#ffffff',
    textPrimary:    '#0f172a',
    textSecondary:  '#475569',
    accent:         '#e11d48',   // cor principal de marca
    border:         '#e6e8ee',
  },

  export: {
    scale:    2,
    filename: 'banner-assinatura.png',
  },

  brand: {
    signal: '#4f46e5',  // cor do botão secundário (CTA 2)
    // ...demais tokens
  },
};
```

### Sintaxe especial nos campos de texto

| Campo | Sintaxe | Resultado |
|-------|---------|-----------|
| `name` | `Primeiro **Último**` | "Último" em negrito (Fraunces 500) |
| `tagline` | `Linha 1<br>Linha 2` | Quebra de linha no banner |
| `specs` | `React; Node.js; SQL` | Itens separados por bullets |

---

## Estrutura do projeto

```
signature-banner/
├── index.html              ← Ponto de entrada (não editar)
├── src/
│   ├── css/
│   │   └── banner.css      ← Estilos (design tokens + layout + painel)
│   └── js/
│       ├── config.js       ← ★ EDITE AQUI — textos, cores, links, export
│       ├── qrcode.lib.js   ← QR Code Generator (Kazuhiko Arase, MIT)
│       └── banner.js       ← Lógica principal (sync, QR, export PNG)
└── docs/
    ├── CUSTOMIZATION.md    ← Guia detalhado de personalização
    └── DEVELOPMENT.md      ← Guia de contribuição e desenvolvimento
```

### Ordem de carregamento dos scripts

```
qrcode.lib.js  →  config.js  →  banner.js
     ↓                ↓              ↓
define qrcode()  define BANNER_CONFIG  bootstrap
```

`banner.js` depende de `qrcode` e `BANNER_CONFIG` estarem no escopo global. A ordem declarada no `index.html` garante isso sem bundler.

---

## Personalização avançada de cores

Além do painel, os tokens de cor completos ficam no bloco `:root` de `src/css/banner.css`. A cor de acento secundário (`--signal`, usada no CTA 2) não está exposta no painel mas pode ser alterada em `config.js`:

```js
brand: {
  signal: '#059669',  // troca indigo por esmeralda
}
```

---

## Export PNG — detalhes técnicos

O botão **Exportar PNG (2×)** renderiza o banner num `<canvas>` off-screen de 2400×640 px, reconstruindo todos os elementos via Canvas 2D API:

- Gradientes de fundo e glow de marca
- Avatar circular com clip ou monograma com ponto de acento
- Nome com bold parcial (Fraunces 400/500)
- Especializações com bullets
- Tagline com quebra de linha
- Botões primário e secundário desenhados com `roundRect`
- Ícones (seta, balão, envelope, globo) desenhados via primitives
- QR Code copiado do `<canvas>` DOM

A escala padrão é `2` (configurável em `config.export.scale`). Escala `3` gera 3600×960 px.

> **Limitação de e-mail**: links dentro de imagens não são clicáveis na maioria dos clientes. Adicione os links como texto real abaixo da imagem na assinatura.

---

## Compatibilidade

| Navegador | Suporte |
|-----------|---------|
| Chrome 90+ | ✅ Completo |
| Edge 90+   | ✅ Completo |
| Firefox 90+ | ✅ Completo |
| Safari 15+ | ✅ Completo |

Requer suporte a: `Canvas 2D API`, `CSS custom properties`, `color-mix()`, `FileReader API`.

---

## Licença

O código do projeto está sob licença [MIT](LICENSE).

A biblioteca de QR Code embutida (`src/js/qrcode.lib.js`) é de autoria de **Kazuhiko Arase** e está também sob licença MIT.

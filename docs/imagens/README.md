# Imagens do site

Onde as imagens moram, como nomear, em que tamanho exportar e como colocar no ar.
Os **prompts de geração** estão em [`PROMPTS.md`](./PROMPTS.md).

## Onde guardar

```
public/img/site/
├── home/        → landing page (/)
├── gestantes/   → /gestantes
├── medicos/     → /medicos
├── seguranca/   → /seguranca
├── og/          → previews de compartilhamento (WhatsApp, Instagram, LinkedIn)
└── texturas/    → grão, mesh gradients, fundos reutilizáveis
```

Tudo em `public/` é servido como está, sem passar pelo bundler. Uma imagem em
`public/img/site/home/hero-trilha.webp` fica acessível em
`/img/site/home/hero-trilha.webp` — é assim que se referencia no JSX:

```tsx
<img
  src="/img/site/home/hero-trilha.webp"
  alt="Mãe olhando a trilha do bebê no celular"
  width={1800}
  height={1200}
  loading="lazy"
  decoding="async"
  className="rounded-2xl shadow-lift"
/>
```

> Os logos que já existem ficam em `public/img/` (raiz) e continuam onde estão —
> `public/img/site/` é só para o material novo de marketing.

> **Este `docs/` não é servido ao navegador.** É de propósito: guia e prompts são
> material interno, não precisam ir junto no build.

## Como nomear

`assunto-contexto.webp`, tudo minúsculo, sem acento, separado por hífen.
`hero-trilha.webp`, `mae-bebe-acolhimento.webp`, `painel-contexto.webp`.
Nada de `IMG_4432.png`, `foto final FINAL v2.jpg`.

Se precisar de variação por tema, sufixe `-dark` (mesmo padrão dos logos:
`logo_sem_fundo_so_com_nome_dark.svg`).

## Formatos e tamanhos

| Uso | Proporção | Exportar em | Formato |
|---|---|---|---|
| Hero (imagem grande) | 3:2 | 1800 × 1200 | `.webp` |
| Faixa larga / fundo de seção | 16:9 | 1920 × 1080 | `.webp` |
| Card / retrato de seção | 4:3 | 1200 × 900 | `.webp` |
| Ícone ilustrado / passo | 1:1 | 800 × 800 | `.webp` |
| Open Graph (link preview) | 1.91:1 | 1200 × 630 | `.png` ou `.jpg` |
| Textura tileável | 1:1 | 512 × 512 | `.png` (com alpha) |

- **WebP com qualidade 82** é o ponto certo para foto: peso de JPEG, nitidez de PNG.
- **Nenhuma imagem acima de 300 KB.** Hero pode chegar a 400 KB, e só.
- Gere sempre no **maior tamanho possível** no gerador e reduza depois — dá pra
  encolher uma imagem boa, não dá pra inventar pixel que não existe.

Para converter e comprimir:

```bash
# uma imagem
npx @squoosh/cli --webp '{"quality":82}' -d public/img/site/home entrada.png

# ou, com sharp já instalado no projeto
npx sharp -i entrada.png -o saida.webp --width 1800 -f webp -q 82
```

## Acessibilidade — obrigatório

Toda `<img>` precisa de `alt`:

- **Imagem que informa** → descreva o que ela mostra, em português, sem começar com
  "imagem de": `alt="Mãe acompanhando a trilha do bebê pelo celular"`.
- **Imagem puramente decorativa** (textura, blob, fundo) → `alt=""` **e**
  `aria-hidden`, para o leitor de tela pular.

Sempre passe `width` e `height` (ou `aspect-ratio` no CSS) — sem isso o layout
pula quando a imagem carrega, e isso conta contra o CLS no Core Web Vitals.

`loading="lazy"` em tudo, **menos** na imagem do hero: essa é a maior imagem do
primeiro paint e deve carregar com `loading="eager"` e `fetchpriority="high"`.

## Regras de conteúdo — leia antes de gerar

Prumo é um produto de saúde. Isso restringe o que a imagem pode dizer:

1. **Pessoa gerada por IA nunca é apresentada como pessoa real.** Nada de retrato
   com nome embaixo como se fosse depoimento de paciente ou de médico. Se for
   ilustrar um depoimento de verdade, use foto da pessoa de verdade, com autorização.
2. **Nada de tela clínica legível com dado inventado.** Se aparecer interface na
   imagem, ela fica desfocada, cortada ou abstrata — número de exame falso e legível
   vira desinformação médica.
3. **Nada de procedimento clínico específico** (agulha entrando na pele, exame
   invasivo, parto). O tom é acolhimento e organização, não procedimento.
4. **Diversidade real.** Tons de pele, idades, tipos de corpo e composições
   familiares variados ao longo do conjunto — não só uma família branca de revista.
   O Brasil é o público.
5. **Sem marca de terceiro**: nada de logo de hospital, plano de saúde ou celular
   identificável.

## Fluxo até o site

1. Gerar com o prompt de [`PROMPTS.md`](./PROMPTS.md) (2–4 variações por slot).
2. Escolher, recortar na proporção da tabela acima.
3. Converter para WebP e conferir o peso.
4. Salvar na pasta certa, com o nome certo.
5. Colocar no JSX com `alt`, `width`, `height`.
6. Rodar `npm run build` e olhar a página em claro **e** escuro — a maioria dos
   problemas aparece só no modo escuro.

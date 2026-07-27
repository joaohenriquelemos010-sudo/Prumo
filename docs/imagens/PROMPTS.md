# Prompts de geração de imagem — Prumo

Prompts prontos para Midjourney, Higgsfield, Nano Banana, Flux, Ideogram, Firefly ou
DALL·E. Onde salvar e como exportar: [`README.md`](./README.md).

**Escreva o prompt em inglês.** Todo gerador foi treinado majoritariamente em inglês
e responde melhor nele — os prompts abaixo já vêm assim, com a intenção explicada em
português logo acima. Os hexadecimais estão nos prompts porque nenhum modelo entende
OKLCH (que é o que o `tokens.css` usa).

---

## 1. A decisão que vem antes dos prompts

Duas trilhas visuais possíveis. **A consistência importa mais que qualquer imagem
isolada** — cinco fotos medianas com a mesma luz batem uma obra-prima solta no meio
de um site que não combina com ela.

| | Trilha A — Fotografia | Trilha B — Ilustração 3D suave |
|---|---|---|
| **Cara** | Luz de janela, tons dessaturados, grão fino | Formas arredondadas, gradiente da marca, sem contorno |
| **Ponto forte** | Emoção, confiança, "gente de verdade" | Controle total da cor, escala infinita, zero risco de mão com seis dedos |
| **Risco** | Cair no estoque genérico; mão/rosto deformado | Ficar infantil e perder o peso clínico |

**A recomendação:** trilha mista, com uma regra clara.

- **Gente → fotografia.** Mãe, bebê, médico. É onde a foto ganha da ilustração.
- **Conceito → abstrato com gradiente.** Trilha, continuidade, segurança, dados.
  Nada de figura humana ilustrada aqui — só forma, luz e o gradiente da marca.

As duas conversam porque compartilham a mesma paleta e a mesma luz difusa. É o que
o `tokens.css` já diz: *"acolhimento materno fluindo para segurança clínica"*.

---

## 2. Bloco de estilo (cole em TODO prompt)

### `[ESTILO-FOTO]`

```
Soft editorial photography, natural diffused daylight from a large window,
calm and airy atmosphere. Desaturated palette anchored on soft lilac #B58BFD
and periwinkle blue #5B81FB over near-white #FEFCFF surfaces. Subtle warm
skin tones. Fine natural film grain, shallow depth of field, 50mm lens at
f/2.0. Generous negative space. No harsh shadows, no clutter, no saturated
accent colors. Premium modern healthcare brand, quiet and human.
```

### `[ESTILO-ABSTRATO]`

```
Minimal abstract 3D render, soft matte surfaces, rounded organic forms,
smooth gradient from lilac #B58BFD to periwinkle blue #5B81FB over an almost
white #FEFCFF background. Gentle volumetric light, very soft diffuse shadows,
subtle grain. Elegant, weightless, clean. No text, no icons, no hard edges,
no metallic or glossy reflections.
```

### `[NEGATIVO]` (campo de negative prompt, ou `--no` no Midjourney)

```
text, letters, words, watermark, logo, signature, UI screenshot, legible
medical data, charts with numbers, needles, syringes, blood, hospital
equipment, surgical scene, stock-photo forced smile, oversaturated colors,
HDR, heavy vignette, cluttered background, plastic skin, waxy retouching,
deformed hands, extra fingers, distorted anatomy, low resolution, cartoon
outline, clipart
```

### Parâmetros por ferramenta

| Ferramenta | O que acrescentar no fim |
|---|---|
| Midjourney v7 | `--ar 3:2 --style raw --stylize 150 --no <NEGATIVO>` |
| Flux / Higgsfield | negative prompt em campo próprio; `guidance 3.5`, resolução máxima |
| Ideogram | modo *Realistic*, *Magic Prompt: off* (senão ele reescreve e some com a paleta) |
| DALL·E / Firefly | sem campo negativo — vire a negação em afirmação: em vez de "no clutter", escreva "an empty, uncluttered surface" |

`--style raw` no Midjourney é o que impede a "beleza automática" de comer a paleta
suave. Sem ele a imagem volta saturada e genérica.

---

## 3. Landing page (`/`) → `public/img/site/home/`

### 3.1 `hero-trilha.webp` — a imagem principal do site

**Onde:** hero da home, ao lado de *"Tudo sobre você e seu bebê, num lugar só"*.
**Proporção:** 3:2 (1800 × 1200). Espaço vazio à **esquerda** para o texto respirar.

```
[ESTILO-FOTO]

A pregnant woman in her early thirties, seated by a large bright window in a
calm modern living room, looking down at her phone with a soft, relieved
half-smile. Warm brown skin, natural curly hair, simple oatmeal-colored
knit sweater. Her free hand rests on her belly. The phone screen is out of
focus and unreadable, glowing faint lilac. Soft plants and a linen curtain
blurred in the background. She occupies the right third of the frame; the
left two thirds are soft empty light. Candid, unposed, documentary feel.
```

**Variações a testar** — gere as três e escolha:
1. Trocar por uma **mãe com bebê de colo** (pós-parto), mesma luz — testa o outro
   lado da promessa: a trilha continua depois do nascimento.
2. **Mão e celular apenas**, sem rosto — mais neutro, envelhece melhor, some com o
   risco de rosto sintético.
3. **Casal**, um apoiando o outro — reforça "você não está sozinha".

### 3.2 `mae-bebe-acolhimento.webp` — card "Sou gestante ou mãe"

**Onde:** seção *"Por onde você entra?"*. **Proporção:** 4:3 (1200 × 900).

```
[ESTILO-FOTO]

A young mother holding her newborn baby against her chest in soft morning
light, both calm, eyes closed, cheek resting on the baby's head. Light brown
skin, no makeup, simple white cotton shirt. Extremely soft focus background
in pale lilac tones. Intimate, quiet, protective. Framed from the chest up,
centered composition.
```

### 3.3 `medico-panorama.webp` — card "Sou médico"

**Onde:** mesma seção, card ao lado. **Proporção:** 4:3 (1200 × 900).
Precisa parecer competente sem parecer frio: mesma luz do card ao lado.

```
[ESTILO-FOTO]

A pediatrician in her forties in a bright, uncluttered consultation room,
standing and studying a tablet with focused, unhurried attention. Dark skin,
short natural hair, plain white coat over a periwinkle blue shirt. The tablet
screen is blurred and unreadable. Behind her, a clean wall and a window with
diffused daylight. Calm, competent, human — not corporate. Framed from the
waist up, she sits on the left third of the frame.
```

> Nunca legende essa imagem com um nome e um CRM. É pessoa gerada — vira depoimento
> falso na hora. Ver *Regras de conteúdo* no `README.md`.

### 3.4 `continuidade-abstrata.webp` — a metáfora da trilha

**Onde:** seção *"Hoje, o cuidado se parte em dois"*, entre os cards Antes / Com a Prumo.
**Proporção:** 16:9 (1920 × 1080). É a imagem que explica o produto sem uma palavra.

```
[ESTILO-ABSTRATO]

Two separate soft ribbons of light — one lilac #B58BFD, one periwinkle blue
#5B81FB — flowing in from the left, drifting apart and frayed. Toward the
center they converge and merge into a single continuous smooth ribbon that
flows confidently to the right edge of the frame. The merged ribbon is denser
and brighter than the two that formed it. Floating in soft empty white space,
gentle depth of field, delicate glow at the junction point. Serene, elegant,
inevitable.
```

**Variação:** em vez de fitas, **duas trilhas de pequenas esferas** que se
encontram e viram um caminho único de esferas maiores — lê mais como "linha do
tempo" e menos como fumaça.

### 3.5 `cta-fundo.webp` — fundo da chamada final

**Onde:** por baixo do bloco *"O caminho do seu bebê começa agora"*, que já tem o
gradiente da marca. Serve de textura sob o gradiente — precisa ser **discreto**.
**Proporção:** 21:9 (2400 × 1030). Aplicar com `opacity-20` ou `mix-blend-soft-light`.

```
[ESTILO-ABSTRATO]

Very subtle abstract background texture: slow flowing waves of light in
lilac and periwinkle blue, extremely low contrast, almost monochrome, like
silk moving underwater. Nearly featureless, no focal point, no bright
highlights. Designed to sit behind text without competing with it.
```

Teste o texto branco em cima antes de aprovar. Se a imagem puxar o olho, ela está
forte demais — baixe a opacidade ou gere de novo com "even lower contrast".

---

## 4. Página Gestantes (`/gestantes`) → `public/img/site/gestantes/`

### 4.1 `hero.webp`

**Onde:** *"Você não está sozinha nesse caminho"*. **Proporção:** 3:2 (1800 × 1200),
espaço vazio à direita (o texto desta página é alinhado à esquerda).

```
[ESTILO-FOTO]

A pregnant woman walking slowly along a quiet tree-lined path in soft late
afternoon light, seen from behind and slightly to the side, one hand resting
on her belly. Loose light dress in off-white. The path ahead is clear, open
and gently lit, disappearing into soft bokeh. Warm but desaturated tones with
lilac shadows. Sense of forward movement and calm. She sits on the left third
of the frame; open path fills the right.
```

O caminho aberto à frente é o ponto — é literalmente a trilha. Não corte.

### 4.2 Trio dos três passos — 1:1 (800 × 800) cada

Os três precisam parecer **irmãos**: mesmo enquadramento, mesma luz, mesma distância.
Se possível, gere numa sessão só, mudando apenas a frase do meio.

**`passo-onde-estou.webp`** — *"Você sempre sabe onde está"*

```
[ESTILO-ABSTRATO]

A single softly glowing marker resting on a gentle curved path of light that
recedes into soft white space. The path behind the marker is dim; the path
ahead is lit. Lilac to periwinkle gradient. Centered, minimal, floating.
```

**`passo-lembretes.webp`** — *"Lembretes na hora certa"*

```
[ESTILO-ABSTRATO]

Three soft rounded shapes spaced evenly along a gentle curve of light, the
middle one glowing brighter than the others as if it were the current moment.
Lilac to periwinkle gradient over soft white space. Centered, minimal,
floating.
```

**`passo-linguagem.webp`** — *"Explicado como gente fala"*

```
[ESTILO-ABSTRATO]

Two soft rounded speech-bubble forms gently overlapping, made of smooth
matte gradient material, lilac merging into periwinkle blue. No text inside,
no tails, no icons. Warm, open, conversational. Centered, minimal, floating
in soft white space.
```

### 4.3 `tranquilidade.webp` — seção "Menos ansiedade, mais clareza"

**Proporção:** 4:3 (1200 × 900).

```
[ESTILO-FOTO]

Close-up of a pregnant woman's hands resting relaxed and open on her lap,
soft daylight, a phone face-down beside them on a pale linen surface. Shallow
depth of field, the face out of frame. Quiet, unhurried, a moment of not
worrying. Muted lilac and warm neutral tones.
```

Celular **virado para baixo** é o argumento inteiro da seção: o app resolveu, ela
pode largar o telefone.

---

## 5. Página Médicos (`/medicos`) → `public/img/site/medicos/`

Outro registro: mesma paleta e mesma luz, porém **mais estruturado, menos macio**.
Enquadramento mais reto, contraste um pouco mais alto, nada de bokeh romântico.

### 5.1 `hero.webp` — 3:2 (1800 × 1200)

**Onde:** *"A trilha completa, do útero ao consultório"*.

```
[ESTILO-FOTO]

An obstetrician and a pediatrician standing side by side in a bright modern
clinic corridor, mid-conversation, one gesturing toward a tablet the other is
holding. Both in white coats, different ages and skin tones. The screen is
angled away and unreadable. Clean architectural background, large windows,
pale surfaces. Slightly more contrast and structure than a lifestyle photo,
still warm. Professional collaboration between two specialties, not a posed
corporate portrait.
```

A imagem tem que dizer *handoff entre especialidades* — é a tese da página.

### 5.2 `painel-contexto.webp` — 16:9 (1920 × 1080)

**Onde:** perto de *"O panorama clínico, num relance"*. Cuidado: o painel real já é
renderizado ali pelo `PainelClinicoDemo` — esta imagem **não pode competir** nem
fingir ser interface. É abstrata, ponto.

```
[ESTILO-ABSTRATO]

An abstract data landscape: a horizontal timeline of soft glowing nodes of
varying size connected by a single continuous thread of light, receding
gently into depth. Two of the nodes glow warmer, as if flagged for attention.
Lilac to periwinkle gradient over near-white. Rigorous, calm, orderly — the
feeling of a complete picture at a glance. No numbers, no charts, no letters,
no interface elements.
```

---

## 6. Página Segurança (`/seguranca`) → `public/img/site/seguranca/`

### 6.1 `dados-protegidos.webp` — 3:2 (1800 × 1200)

**Onde:** hero de *"Os dados são seus. Ponto."*
O clichê a evitar: cadeado azul, escudo, código binário verde, encapuzado. Segurança
aqui é **cuidado**, não paranoia.

```
[ESTILO-ABSTRATO]

A soft translucent dome of light gently enclosing a small cluster of warm
glowing spheres, protecting without confining. The dome is barely there —
made of light, not glass or metal. Lilac and periwinkle gradient over soft
white. Calm, spacious, reassuring. No padlock, no shield, no keyhole, no
circuitry, no binary code, no dark background.
```

---

## 7. Previews de compartilhamento → `public/img/site/og/`

Aparecem no WhatsApp, Instagram e LinkedIn quando alguém manda o link. **1200 × 630**,
`.png`. Regra crítica: **o texto é montado por cima no editor, não gerado.** Todo
modelo de imagem erra letra em português, e a que ele acerta sai com fonte errada —
a marca usa Outfit (display) e Nunito (corpo).

Gere só o fundo:

**`og-fundo.png`** — base das três variações

```
[ESTILO-ABSTRATO]

Elegant abstract background: a soft ribbon of lilac-to-periwinkle gradient
light flowing diagonally across the lower right portion of the frame, over a
clean near-white #FEFCFF field. The entire upper left half is empty, calm and
uncluttered. Subtle grain, very soft glow, no focal detail. Designed as a
backdrop for typography.
```

Depois, no Figma / Canva, compor em cima:

| Arquivo | Texto | Logo |
|---|---|---|
| `og-default.png` | "Tudo sobre você e seu bebê, num lugar só" | `logo_sem_fundo_com_nome_e_desenho.svg` |
| `og-gestantes.png` | "Você não está sozinha nesse caminho" | idem |
| `og-medicos.png` | "A trilha completa, do útero ao consultório" | idem |

Texto em **Outfit SemiBold**, cor `#36408C` (índigo da marca), no canto superior
esquerdo, com margem generosa. Corpo em Nunito se precisar de segunda linha.

---

## 8. Texturas → `public/img/site/texturas/`

### 8.1 `grao-suave.png` — 512 × 512, tileável, com alpha

Uma camada de grão por cima dos gradientes tira o aspecto de "degradê de CSS" e
dá acabamento impresso. Aplicar com `opacity-[0.04]` e `mix-blend-overlay`.

```
Seamless tileable fine film grain texture, monochrome, very subtle, evenly
distributed, transparent background, no pattern, no repetition artifacts, no
color. Photographic 400 ISO grain structure.
```

Muitos geradores não fazem alpha nem tile de verdade. Alternativas melhores:
gerar grão por SVG `feTurbulence` direto no CSS, ou baixar de uma fonte com licença
livre. **Não passe de 5% de opacidade** — acima disso vira ruído de TV.

### 8.2 `malha-gradiente.webp` — 1:1 (1400 × 1400)

Uma mesh gradient de apoio para fundos de seção. O componente `Blob.tsx` já resolve
isso em CSS — gere esta só se quiser algo mais orgânico que o blob atual.

```
[ESTILO-ABSTRATO]

Smooth organic mesh gradient blob, lilac #B58BFD blending into periwinkle
#5B81FB and pale lavender #E4D6FB, soft irregular edges dissolving into pure
white. Blurred, weightless, no visible structure or banding. Like ink
diffusing in water, photographed from above.
```

---

## 9. Paleta de referência (hex ↔ token)

Os prompts pedem hex porque nenhum gerador entende OKLCH. Estes são os
equivalentes aproximados do que está em `tokens.css`:

| Token | Hex aprox. | Papel |
|---|---|---|
| `--color-lilas` | `#B58BFD` | acolhimento materno |
| `--color-lilas-soft` | `#E4D6FB` | |
| `--color-azul` | `#5B81FB` | confiança clínica |
| `--color-azul-soft` | `#C9D6FF` | |
| `--color-indigo` | `#36408C` | âncora, tipografia |
| `--color-paper` | `#FEFCFF` | fundo claro |
| `--color-paper-2` | `#F7F3FC` | fundo alternado |
| `--color-paper` (dark) | `#292642` | fundo escuro |

**Modo escuro:** a maioria destas imagens é clara e vai "estourar" no tema escuro.
Duas saídas, e a primeira é quase sempre a certa:

1. **Deixar clara e dar moldura** — `rounded-2xl` mais `border border-line`. Uma
   imagem clara emoldurada num fundo escuro lê como cartão, não como erro.
2. **Gerar variante `-dark`** com o fundo trocado por `#292642` no prompt. Dobra o
   trabalho — reserve para o hero e para as OG.

---

## 10. Checklist antes de subir

- [ ] Proporção e tamanho batem com a tabela do `README.md`
- [ ] Convertida para WebP, abaixo de 300 KB (hero: 400 KB)
- [ ] Nome em minúsculo, sem acento, com hífen
- [ ] Na pasta da página certa
- [ ] Mãos e rostos conferidos de perto (é onde o gerador falha)
- [ ] Nenhum texto, número ou logo legível na imagem
- [ ] Nenhuma pessoa gerada apresentada como pessoa real
- [ ] `alt` escrito, `width` e `height` no JSX
- [ ] Vista em claro **e** em escuro
- [ ] O conjunto parece uma família só — não cinco sites diferentes

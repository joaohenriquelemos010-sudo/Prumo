# Prumo

**Tudo sobre você e seu bebê, num lugar só.**

A Prumo é um hub de saúde que costura a **obstetrícia** e a **pediatria** numa
trilha clínica contínua — que começa na vida intrauterina e segue com a criança.
Para a família, um caminho claro e previsível. Para o médico, o panorama completo
para decidir rápido e com segurança.

O nome vem de *estar no prumo*: equilíbrio, estabilidade, direção certa.

Este repositório é o **site institucional + protótipo funcional**.

## Stack

- **Vite + React 18 + TypeScript** (strict)
- **Tailwind CSS** com tokens de marca em CSS variables (OKLCH)
- **Framer Motion** para animações e transições
- **React Router** com lazy loading por rota
- **Zustand** para estado global
- **React Hook Form + Zod** para formulários e validação
- **Lucide React** para ícones
- **DOMPurify** para sanitização

## Como rodar

```bash
npm install
npm run dev        # frontend + API na MESMA porta (5173)
npm run build      # build de produção (typecheck + bundle)
npm run preview    # serve o build de produção
npm run typecheck  # checagem de tipos (frontend + backend)
npm run lint       # eslint
npm test           # testes unitários (vitest)
npm run smoke      # E2E num navegador real — precisa do dev rodando
```

O smoke (`scripts/smoke.mjs`) percorre as jornadas que atravessam frontend, API e banco:
paridade da navegação no celular, tema claro/escuro, marcar → confirmar → ver uma consulta,
a separação do que a família lê, e a passagem do pré-natal para a pediatria. Use
`SHOTS=1` para gravar as telas em `.smoke/`, e `CHROME_PATH=…` para apontar um Chromium
que a máquina já tenha.

Os testes unitários (`npm test`) cobrem os módulos puros — as curvas clínicas
(Hadlock e OMS), a física de movimento e o registro de programas. As curvas são
os números em que os alertas disparam, então estão fixados à mão contra a tabela
de referência, e não derivados da própria implementação.

### Migrações

Mongoose schemas são o schema — não há DDL. Mas mover documentos existentes passa
por um runner (`server/services/migracoes/`), executado uma vez na conexão e
antes de qualquer requisição. Cada migração é um arquivo numerado com um `up()`
idempotente; o registro de quais já rodaram fica na coleção `migracoes`, e o
`_id` ser o nome da migração é o que torna o claim atômico entre dois cold starts
serverless simultâneos.

Para adicionar uma: crie `NNN-descricao.ts` com um `up()` idempotente e registre-o
no array de `migracoes/index.ts`. Nunca reordene nem renomeie uma entrada já
publicada.

Em desenvolvimento, a API Express roda **dentro do servidor do Vite** (um plugin
monta o app Express como middleware em `/api`) — um processo só, sem porta extra.
Em produção (Vercel), as mesmas rotas são servidas pela função serverless
`api/index.ts`.

### Variáveis de ambiente

Copie `.env.example` para `.env`. As duas do backend:

- **`MONGODB_URI`** — connection string do MongoDB Atlas. **Se deixar em branco em
  desenvolvimento, o servidor sobe um MongoDB em memória automaticamente** — dá pra
  rodar tudo sem configurar nada. Em produção é obrigatória.
- **`JWT_SECRET`** — segredo para assinar a sessão. Gere um valor longo e aleatório.

Lembre: só variáveis `VITE_*` chegam ao cliente e **elas são públicas**. Segredos
(`MONGODB_URI`, `JWT_SECRET`) ficam só no servidor / painel da Vercel.

## Backend e deploy (Vercel)

- **Backend**: Express + Mongoose (`server/`), empacotado como uma função
  serverless em `api/index.ts`. A conexão do Mongoose é cacheada entre invocações.
- **Auth**: e-mail/senha (bcrypt) com sessão em **cookie httpOnly** (JWT),
  papéis gestante/mãe vs médico.
- **Deploy**: `vercel.json` já configura o rewrite de `/api/*` para a função e o
  fallback SPA. Configure `MONGODB_URI` e `JWT_SECRET` no painel da Vercel.

## Estrutura

```
src/
  app/        rotas, layout, providers, header, footer, error boundary
  features/   domínios: trilha (a estrela), painel clínico
  components/ UI reutilizável (Button, Logo, Section, Blob, Skeleton…)
  lib/        api, hooks, stores (zustand), schemas, audit, sanitize, rate-limit
  pages/      Home, Trilha, Gestantes, Medicos, Seguranca, Onboarding, Dashboard, 404
  styles/     tokens.css (design system) + index.css
public/img/   logos SVG
tokens.css    export portátil do design system (raiz)
```

## Páginas públicas

| Rota            | O que é |
|-----------------|---------|
| `/`             | Landing: o problema (cuidado partido) → solução (trilha), públicos, CTA |
| `/trilha`       | **A Trilha** (demo) — experiência estilo Duolingo, do pré-natal ao 1º ano |
| `/gestantes` · `/medicos` | Conteúdo para cada público |
| `/seguranca`    | Segurança e privacidade, LGPD, controle dos dados |
| `/onboarding`   | Criar conta em 3 passos, com bifurcação mãe/gestante · médico (CPF) |
| `/entrar` · `/esqueci-senha` | Login e recuperação de senha |
| `/vincular/:token` | Confirmar conexão médico↔paciente (link/QR) |

## Área interna (`/app`) — autenticada, por papel

**Paciente (gestante/mãe/pai):** Início (home guiada com "próximo passo") · Trilha real ·
**Bebê** (crescimento semana a semana) · **Agenda** (consultas com dia e hora, lista ou mês,
remarcar, cancelar, exportar `.ics`) · **Agendar** (escolhe profissional, dia e horário) ·
**Exames** (upload/guarda no GridFS) · **Caderninho de dúvidas** (PDF) · **Vacinas**
(calendário SUS/PNI) · **Comunidade** (feed estilo FLO + quizzes mito×verdade) ·
**Conectar** (link + QR para o médico) · Perfil (plano de saúde; exportar/excluir dados — LGPD).

**Médico:** Painel clínico · **Agenda** (próximos, fila de pedidos para confirmar/recusar,
e o editor de disponibilidade) · **Prontuário** contínuo, incluindo o resumo de nascimento
que passa o caso para a pediatria · **Bebê** (registro de biometria fetal) · **Consultas**
(roteiro da diretriz + SOAP) · **Exames** · **Dúvidas** · **Pacientes**. O acesso do médico
aos dados de um paciente é **escopado por vínculo consentido e revogável**.

### Agendamento

Modelo híbrido. Médicos com conta publicam **disponibilidade** (faixas semanais, bloqueios,
duração, antecedência) e a família marca um **horário real**, que o profissional confirma ou
recusa. Clínicas do catálogo, que não têm conta, recebem uma **proposta de horário** que o
admin responde por elas. O servidor recalcula a disponibilidade a cada marcação em vez de
confiar no slot que o cliente devolveu — dois pedidos para o mesmo horário dão 409.

### O que a família lê

O prontuário não mostra tudo. `notasPrivadas` fica só com a equipe, e a médica decide se a
impressão diagnóstica é compartilhada. O corte é feito **no servidor**, a partir da sessão.
A família vê que existe uma avaliação, sem ler o conteúdo — nunca um espaço em branco sem
explicação.

### Verificação de padrões

Toda medida gravada é comparada com a faixa esperada para a idade — biometria fetal pelas
curvas de Hadlock, antropometria infantil por escore-z da OMS. O que sai da faixa vira um
alerta para a médica na hora, com o limiar que disparou e a fonte. Alertas são clínicos por
padrão; os poucos marcados para a família chegam como convite para conversar na consulta.

Backend em `server/` (Express + Mongoose) com models para User, Criança, Prontuário,
Consulta, Exame (GridFS), Dúvida, Vínculo/Convite, Prestador, Agendamento, Disponibilidade,
MedidaFetal, Alerta e Post; rotas sob `/api/*`; validação Zod e sanitização em toda entrada.

## A Trilha

O coração do produto. Um caminho vertical serpenteante com nós (etapas):

- **Concluído / atual (pulsando) / bloqueado** — legível sem ler.
- O caminho se preenche com o gradiente lilás → azul conforme o progresso.
- Tocar num nó **expande a etapa in-place** (sem navegar), mostrando o que é, o
  que fazer e o que esperar.
- Marcos importantes (1º ultrassom, nascimento, 1ª vacina…) ganham destaque e uma
  micro-celebração discreta ao concluir.

Os dados são mockados, mas clinicamente plausíveis, cobrindo
gestação → parto → puerpério → primeiro ano.

## Identidade

O gradiente é elemento narrativo, não decoração: começa no **lilás** (acolhimento
materno) e flui para o **azul sereno** (confiança clínica), ancorado no **índigo
profundo** da tipografia. Os hex foram extraídos dos SVGs em `public/img`.

- Lilás `#b58bfd` · Azul `#5b81fb` · Índigo `#36408c`
- Tipografia: **Outfit** (display) + **Nunito** (corpo)

## Segurança

Este produto lida com dados de saúde. Veja [`SECURITY.md`](./SECURITY.md) para o
que está implementado no cliente e o que precisa vir do backend.

## Acessibilidade e performance

- Contraste AA, navegação por teclado, ARIA correto.
- Todas as animações respeitam `prefers-reduced-motion`.
- Code splitting por rota, fontes com `font-display: swap`, imagens SVG.

---

Protótipo. Não substitui a orientação de um profissional de saúde.

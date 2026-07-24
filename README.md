# Prumo

**Tudo sobre você e seu bebê, num lugar só.**

A Prumo é um hub de saúde que costura a **obstetrícia** e a **pediatria** numa
trilha clínica contínua — que começa na vida intrauterina e segue com a criança.
Para a família, um caminho claro e previsível. Para o médico, o panorama completo
para decidir rápido e com segurança.

O nome vem de *estar no prumo*: equilíbrio, estabilidade, direção certa.

<!-- Linha de teste: exemplo didático de commit/push -->


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
```

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
**Exames** (upload/guarda no GridFS) · **Caderninho de dúvidas** (PDF) · **Agenda** e
**Vacinas** (calendário SUS/PNI) · **Agendar** (marketplace com Google Maps/Waze e
proximidade) · **Comunidade** (feed estilo FLO + quizzes mito×verdade + amamentação) ·
**Conectar** (link + QR para o médico) · Perfil (exportar/excluir dados — LGPD).

**Médico:** Painel clínico · **Prontuário** contínuo (editável) · **Consultas** (jornada
SOAP passo a passo) · **Exames** do paciente · **Dúvidas** (responde o caderninho) ·
**Pacientes** (conecta-se por link/QR e alterna entre eles). O acesso do médico aos dados
de um paciente é **escopado por vínculo consentido e revogável**.

Backend em `server/` (Express + Mongoose) com models para User, Criança, Prontuário,
Consulta, Exame (GridFS), Dúvida, Vínculo/Convite, Prestador, Solicitação e Post; rotas
sob `/api/*`; validação Zod e sanitização em toda entrada.

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

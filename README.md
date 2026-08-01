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

### App da paciente (PWA) — instalável, push encostado

O Prumo é instalável: `public/manifest.webmanifest` + um service worker escrito
à mão em `public/sw.js`. Escrito à mão de propósito — o service worker é o único
código do produto que **sobrevive ao deploy**, e um bug de cache aqui serve a
versão velha do app para quem já instalou, indefinidamente. Numa plataforma de
saúde isso quer dizer uma gestante lendo a orientação de duas versões atrás.

Três regras, e elas cabem na cabeça:

1. **Nada de dado de saúde em cache.** Requisição para `/api/` nunca passa pelo
   worker. O cache do navegador é disco não cifrado.
2. **HTML sempre da rede primeiro** — é o que garante que um deploy chegue. O
   cache do HTML só serve como resposta de offline.
3. **Assets com hash no nome são imutáveis** — esses sim, cache primeiro.

Os ícones são gerados a partir do SVG da marca por `node scripts/gerar-icones.mjs`,
que rasteriza com o Chromium do Playwright. Reproduzível: qualquer pessoa roda e
obtém o mesmo arquivo. Um PNG exportado à mão de um editor não tem essa
propriedade, e é assim que o ícone do app fica desatualizado sem ninguém
perceber.

**Web Push está encostado como o SMTP.** Sem `VAPID_PUBLIC_KEY` /
`VAPID_PRIVATE_KEY` o canal `push` roda em `noop` e `GET /api/push/chave`
responde `ativo: false` — o cliente esconde o botão em vez de pedir uma
permissão que não leva a nada, e uma permissão negada por engano é quase
irreversível (o navegador passa a bloquear o pedido em silêncio).

Para ligar: `npx web-push generate-vapid-keys` e as duas variáveis no ambiente.
⚠️ Trocar a chave **pública** depois invalida todas as inscrições existentes.

O corpo da notificação **nunca traz conteúdo clínico** — nem nome de exame, nem
medida, nem diagnóstico. Uma notificação aparece na tela bloqueada, à vista de
quem estiver por perto. Ela diz que há algo para ver e leva até lá; o conteúdo
fica atrás do login.

### Financeiro — quanto entrou, e nada além

Recebimentos por atendimento, particular vs. convênio, resumo mensal.
**Não é TISS**, e isso é decisão: TISS 4.x é meses de trabalho com
particularidades por operadora e só paga para quem fatura convênio direto.

Duas regras sustentam o módulo:

**O dado é do médico, não da jornada.** Todo o resto do Prumo é escopado por
`Crianca` — a família é dona, o médico alcança por vínculo. Aqui é o contrário, e
a consequência é dura: um recebimento **nunca** entra na exportação LGPD da
paciente nem no pacote de transferência. Se entrar, é vazamento — na direção
contrária da usual, mas vazamento. O smoke verifica isso explicitamente.

**Dinheiro é inteiro.** `valorCentavos`, sempre. Ponto flutuante para dinheiro é
o defeito que aparece depois de mil linhas somadas e some quando se procura, e um
relatório que fecha com dois centavos de diferença destrói a confiança no sistema
inteiro. A conversão de texto para centavos é feita em string — `Number('1234.56')
* 100` dá `123455.99999999999`.

A ambiguidade que mais custa caro está resolvida e testada: `1.500` são mil e
quinhentos reais, não um e cinquenta. A regra é *um separador seguido de
exatamente três dígitos é milhar*, porque moeda brasileira não tem três casas
decimais. Errar isso cobraria mil vezes menos sem dar erro nenhum — por isso o
formulário ecoa o valor entendido embaixo do campo.

`GET /api/financeiro/pendentes` lista atendimentos realizados que ninguém lançou:
a agenda já sabe quem foi atendido, e sem isso a médica transcreveria a própria
agenda à mão. Um índice único em `agendamento` impede que clicar duas vezes dobre
o faturamento do mês.

### Receituário — sem contrato, sem custo

Prescrição é o maior lock-in "não consigo sair do concorrente". A integração com
a Memed resolveria, mas exige **parceria comercial**. Sem ela, o Prumo emite a
receita em PDF pronta para imprimir e assinar — e isso cobre o caso real, que é
como a maioria dos consultórios já trabalha.

**A decisão de projeto inverteu em relação ao plano.** Com a Memed, guardaríamos
apenas a referência: o conteúdo é dela, que é a custodiante legal. Sem a Memed, o
custodiante somos nós — então o conteúdo **precisa** ficar aqui, entrar na cadeia
encadeada de `Evolucao` e viajar no pacote de transferência. Uma receita que a
médica emitiu e o Prumo não guarda é um buraco no prontuário. O campo `memedId`
já existe para o dia em que a parceria acontecer.

O tipo decide a consequência, e ela aparece ao lado da escolha:

| Tipo | Vias | Validade | Base |
|---|---|---|---|
| Simples | 1 | 30 dias | prática corrente |
| Antimicrobiano | 2 | 10 dias | RDC ANVISA 20/2011 |
| Controle especial | 2 | 30 dias | Portaria SVS/MS 344/1998 |

Emitir uma via só faz a farmácia recusar — e quem descobre isso é a paciente, no
balcão.

**Sobre validade jurídica, sem rodeios.** O Prumo gera a receita; ele não a
assina. A Lei 14.063/2020 e a Res. CFM 2.299/2021 exigem assinatura digital
qualificada (ICP-Brasil) para dispensação sem presença física. O PDF traz o bloco
de assinatura em **cada via** e declara, em letra visível, que a via vale depois
de assinada — no papel, ou com o certificado da médica por fora. O assinador do
gov.br é gratuito. É melhor a paciente descobrir isso aqui do que na farmácia.

### Teleconsulta — ponto a ponto, custo zero

`Agendamento.modalidade` já tinha `teleconsulta` e isso **não significava nada** —
era uma lacuna visível para quem usa. O que faltava não era um provedor de vídeo,
era a costura.

O vídeo vai direto de um navegador ao outro. O servidor só entrega as mensagens
que os dois trocam para se encontrar (`server/routes/teleconsulta.ts`) e sai de
cena. Daily.co e 100ms cobram por minuto porque **retransmitem mídia**; aqui não
há mídia para retransmitir, então o custo é o de uma coleção com TTL.

A sinalização é por poll curto, e não WebSocket, porque o backend roda como
função serverless — onde não existe conexão de longa duração. A alternativa seria
um serviço de realtime pago para trocar seis mensagens. O custo do poll aparece
só na latência de **estabelecer** a chamada, não na conversa.

| Peça | Custo | Estado |
|---|---|---|
| Mídia (áudio/vídeo) | **R$ 0** — nunca toca o servidor | pronto |
| STUN | **R$ 0** — o público do Google, que só responde "qual é o seu IP" | pronto |
| Sinalização | **R$ 0** — MongoDB com TTL de 5 min | pronto |
| TURN (relay) | pago, **opcional** | desligado |

**O que TURN resolve, e por que fica desligado.** Numa parcela das redes (NAT
simétrico, algumas corporativas e móveis) o ponto a ponto não fecha. Sem TURN,
essas chamadas falham — e a tela **diz isso** e sugere trocar de rede ou combinar
por telefone, em vez de girar um spinner e fazer a pessoa achar que a internet
dela é o problema. Quando valer a pena: `coturn` num VPS pequeno (grátis fora o
servidor) ou um provedor de TURN cobrado por GB, que é ordens de grandeza mais
barato que vídeo por minuto.

**Sem gravação**, e isso é decisão de produto, não limitação: gravar dispara
deveres pesados de retenção do CFM e obrigações de dado sensível da LGPD por
valor marginal. O que fica registrado é o atendimento, no prontuário, como em
qualquer consulta presencial.

### Lembretes — hoje encostados

A fila de lembretes está construída e rodando; **o envio de e-mail está
desligado**. Enquanto `SMTP_HOST` estiver vazio, o transporte é `noop`: o
lembrete é marcado como enviado, nada sai, e os limites de frequência e a
deduplicação se exercitam de verdade. É a escolha deliberada — quando o SMTP for
ligado, o comportamento já é o que a gente observou, e não uma estreia em cima da
caixa de entrada das pacientes. A tela `/app/lembretes` diz isso à paciente em
vez de deixá-la esperando um e-mail que ninguém mandou.

**O agendador é externo — [cron-job.org](https://cron-job.org), não Vercel Cron.**
A consequência prática: o gatilho é uma requisição HTTP vinda da internet aberta,
então a autenticação é nossa responsabilidade.

Para configurar, quando for a hora:

| Campo | Valor |
|---|---|
| URL | `https://<seu-domínio>/api/cron/lembretes` |
| Método | `POST` (o `GET` também funciona, para agendadores que só sabem GET) |
| Agendamento | `*/15 * * * *` |
| Cabeçalho | `Authorization: Bearer <CRON_SECRET>` |

Use o **cabeçalho**, não `?token=`. A query string funciona e está documentada,
mas vaza em log de servidor, em histórico de proxy e no `Referer`.

Sem `CRON_SECRET` configurado o endpoint responde **503** — fechado, e não
aberto. `GET /api/cron/saude` responde 200 com o mesmo segredo e sem efeito
colateral, para o agendador ter um alvo antes de a fila existir.

## Backend e deploy (Vercel)

- **Backend**: Express + Mongoose (`server/`), empacotado como uma função
  serverless em `api/index.ts`. A conexão do Mongoose é cacheada entre invocações.
- **Auth**: e-mail/senha (bcrypt) com sessão em **cookie httpOnly** (JWT),
  papéis gestante/mãe vs médico.
- **Deploy**: `vercel.json` já configura o rewrite de `/api/*` para a função e o
  fallback SPA. Configure `MONGODB_URI` e `JWT_SECRET` no painel da Vercel.

### O que está no `vercel.json`, e por quê

JSON não tem comentário, e a Vercel **valida o arquivo contra um schema fechado**:
uma chave a mais — inclusive uma chave `"//"` usada como comentário — reprova o
deploy antes de qualquer build. Por isso o raciocínio mora aqui.

- **`installCommand: MONGOMS_DISABLE_POSTINSTALL=1 npm ci`** — o
  `mongodb-memory-server` é dependência de desenvolvimento, mas tem script de
  pós-instalação que **baixa o binário do mongod** (~100 MB) de um domínio da
  MongoDB. Na Vercel isso é download inútil no melhor caso e build reprovado no
  pior, porque produção nunca sobe banco em memória (veja o `isProd` em
  `server/db.ts`). A variável desliga só o download; o pacote continua instalado
  e o `npm ci` local de quem desenvolve não muda.
- **`/sw.js` sem cache** — o service worker é o único código que **sobrevive ao
  deploy**. Um worker velho em cache serve o app velho para quem já instalou,
  indefinidamente, e não há como corrigir do servidor.
- **`/manifest.webmanifest` por 1 hora** — muda junto com a marca, e raramente.
  Curto o bastante para uma correção chegar, longo o bastante para não custar.
- **`/icones/*` por 1 dia** — nome estável, então cache longo depende de trocar o
  nome ao trocar a arte. Um dia é o meio-termo honesto.

Os headers de segurança (CSP, `X-Frame-Options`, HSTS) **ainda não** saem daqui —
hoje são o `<meta>` de `index.html` mais o dev server. Servi-los como header HTTP
de verdade continua na lista de `SECURITY.md`.

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

**Médico — quatro destinos, e nenhum deles é uma tela clínica:** **Meu dia** (a fila de
hoje, cada horário com *Iniciar atendimento*) · **Agenda** (próximos, fila de pedidos para
confirmar/recusar, e o editor de disponibilidade) · **Pacientes** (ordenados por urgência:
próximo horário, alertas abertos, dúvidas sem resposta) · **Financeiro**.

Prontuário, consultas, exames, bebê, vacinas e dúvidas **não estão no menu**. Não sumiram:
nunca foram lugares. Eram seis destinos globais agindo sobre uma "paciente ativa" invisível,
escolhida em outra tela e guardada em memória — dava para trocar de aba sem saber de quem era
o prontuário aberto. Tudo o que é *de alguém* mora dentro da paciente, em `/app/pacientes/:id`.

O acesso do médico aos dados de um paciente é **escopado por vínculo consentido e revogável**.

### O hub da paciente

`/app/pacientes/:jornadaId` é uma tela por pessoa, com abas internas — Resumo · Prontuário ·
Consultas · Exames · Bebê · Vacinas · Dúvidas — e o nome dela no título.

A diferença que importa não é visual: **a paciente está na URL**. Recarregar a página, abrir
em outra aba, voltar pelo histórico do navegador ou mandar o endereço para um colega passaram
a funcionar — nenhuma dessas coisas um estado em memória jamais deu. As abas são as páginas
que já existiam, renderizadas com `embutido` (que esconde o cabeçalho e o seletor de
paciente): o hub mudou a navegação, não o conteúdo, e por isso não há duas versões do
prontuário para manter em dia.

### Paciente sem conta — atender antes do cadastro

O médico cadastra quem ele atende **sem que essa pessoa exista na plataforma**. Só o nome é
obrigatório. É a regra do consultório, não a exceção: chega alguém, é atendido, e o registro
tem que existir na hora. Exigir que a pessoa instale um app e crie uma conta para poder ser
atendida inverte quem trabalha para quem — e o que acontece de verdade é que o médico anota
no papel e nunca mais volta.

A decisão que sustenta isso é uma linha de schema: **`Crianca.responsavel` deixou de ser
obrigatório.** Nulo significa "jornada de arquivo", tutelada pelo médico que a criou. O
`Vinculo` nasce junto, então a paciente já aparece em *Pacientes* e o acesso já é o mesmo de
sempre — nenhuma dessas duas coisas tinha motivo para esperar por um cadastro que talvez
nunca venha.

*Iniciar atendimento* funciona sem agendamento prévio. Por dentro, o atendimento de balcão
**cria** o agendamento correspondente e segue pelo trilho normal: agenda, financeiro,
receituário e teleconsulta continuam lendo uma coisa só, e nenhum deles precisa saber que
esta paciente entrou sem marcar.

**A vinculação é uma adoção, não uma cópia.** Quando a paciente quiser acompanhar pelo
celular, o médico gera um código de 8 caracteres; ela cria a conta, digita o código em
*Conectar*, e a **mesma** jornada passa a ser dela — com o histórico inteiro no lugar, sem
migração e sem ninguém redigitar nada. A jornada vazia que o cadastro dela criou é
descartada, e só depois de verificar coleção por coleção que não há nada dentro.

Duas escolhas aqui não são de estilo:

- **Quem digita o código é a paciente.** O caminho óbvio seria o médico apontar a jornada
  para um e-mail — e um erro de digitação entregaria um prontuário inteiro para outra pessoa,
  sem que ninguém notasse. Com o código em mãos, o registro só encontra dono quando alguém
  que esteve na consulta age.
- **O alfabeto do código não tem `O/0`, `I/1/L` nem `S/5`.** Ele é ditado em voz alta no
  balcão e digitado por outra pessoa depois; cada par ambíguo custaria uma ligação.

A reivindicação é uma escrita condicional única (`findOneAndUpdate` filtrando pelo código e
por `responsavel: null`), então dois usos simultâneos do mesmo código terminam com um dono só
— e não com o segundo apagando o primeiro em silêncio.

### O cockpit de atendimento

`/app/atendimento/:id` é a tela onde a consulta acontece — e é a única fora do shell da
plataforma: ocupa a viewport inteira e não oferece navegação para fora no meio de um
atendimento.

Uma requisição (`POST /api/atendimento/iniciar`) devolve tudo de uma vez: a consulta, o
resumo do prontuário, as últimas medidas, os alertas abertos e as dúvidas sem resposta.
É um round trip porque a médica está com a paciente na frente.

Três colunas em telas grandes — contexto da paciente · S-O-A-P · roteiro da diretriz e
medidas — cada uma com seu próprio contexto de rolagem dentro de um `h-dvh overflow-hidden`.
**A página não rola.** No celular os três painéis viram um seletor.

O que se digita é salvo sozinho (`PATCH`, debounce de 1,5s); o único feedback é "salvo há
Xs". Enquanto a consulta é `rascunho`, ela existe **só para quem a está escrevendo** — nem a
família nem outro médico vinculado a enxergam. O registro clínico entra na história quando o
autor diz que entrou, em *Finalizar atendimento*, que também fecha o agendamento como
realizado e roda a verificação de padrões.

### Agendamento

Modelo híbrido. Médicos com conta publicam **disponibilidade** (faixas semanais, bloqueios,
duração, antecedência) e a família marca um **horário real**, que o profissional confirma ou
recusa. Clínicas do catálogo, que não têm conta, recebem uma **proposta de horário** que o
admin responde por elas. O servidor recalcula a disponibilidade a cada marcação em vez de
confiar no slot que o cliente devolveu — dois pedidos para o mesmo horário dão 409.

### Checklist

Conteúdo e estado vivem separados: `ChecklistTemplate` guarda os textos,
`Checklist` guarda só o que a paciente marcou. É essa separação que permite
corrigir uma explicação mal escrita sem tocar no progresso de ninguém —
`templateVersao` registra qual redação ela tinha na frente quando marcou.

**Exatamente dois níveis**: grupos (o que fazer) → passos (como fazer). Passos
não têm filhos, e há teste garantindo. Um terceiro nível viraria uma árvore que
ninguém navega no celular com uma mão.

O conteúdo (`server/conteudo/checklists/`) deriva das mesmas fontes do roteiro
clínico — Caderneta da Gestante, PNI, FEBRASGO — mas é **reescrito**, não
traduzido. A régua: uma mulher sem formação em saúde, lendo no celular às onze
da noite, precisa entender o que fazer, por que importa, e sair menos ansiosa do
que entrou. Testes guardam isso: todo grupo precisa de explicação leiga com mais
de 80 caracteres, fonte citada, e ao menos um passo obrigatório.

A trilha (`/app/trilha`) passou a ser uma **projeção** do checklist. Antes eram
duas metáforas paralelas para a mesma jornada — uma com nós mockados e outra com
o conteúdo de verdade, que não dava para tocar.

### PDFs

Os documentos vivem em `src/features/pdf/`: `sistema/` (fontes, paleta, capa,
cabeçalho, rodapé, primitivas) e `documentos/` (um arquivo por documento).
`documents.tsx` continua sendo o ponto de entrada — é o que mantém **um** chunk
`@react-pdf` compartilhado por todas as páginas.

As fontes da marca (Outfit + Nunito) são **embutidas**, nunca buscadas em CDN: o
`Font.register` do react-pdf baixa a URL em tempo de render, e um soluço de rede
produziria um documento quebrado na frente da paciente. A logo é transcrita para
as primitivas `Svg`/`Path` do react-pdf, gerada a partir dos SVGs de
`public/img/` — nada de PNG rasterizado, que borraria em impressão.

Todo documento tem capa opcional, cabeçalho que se repete, rodapé com
identificação e `pág. N de M`, e bloco de assinatura.

> ⚠️ **Nunca declare `lineHeight` dentro de um elemento `fixed`** (nem na `Page`,
> de onde ele é herdado). No react-pdf isso faz o elemento **não ser desenhado**
> — sem erro, sem aviso. Foi o que deixou a primeira versão sair sem paginação
> nenhuma. O leading do corpo mora em `s.corpo`, que não é fixo, e há teste
> guardando isso.

Cada documento é renderizado de verdade para um buffer em
`documentos/documentos.test.tsx`, com dados e vazio — é o único jeito de pegar
erro de layout do react-pdf, que só falha em runtime.

### O prontuário não se edita

A história clínica vive na coleção `Evolucao`, **append-only**. Não existe rota de
update nem de delete: corrigir é **retificar**, o que escreve uma entrada nova
apontando para a anterior — e as duas ficam. É como um prontuário funciona no papel
há um século, e é o que a Res. CFM 1.821/2007 e o nível NGS2 da certificação
SBIS/CFM cobram de quem quer ser 100% digital.

Cada entrada carrega o hash da anterior. Adulterar uma evolução direto no banco
quebra a cadeia dali em diante, e `GET /api/prontuario/integridade` aponta o elo
exato. Não impede a escrita — torna a adulteração **detectável**, que é o que dá
para prometer de verdade sem um serviço externo de selagem.

### Transferência para o próximo médico

Três atos, nessa ordem: o médico **pede**, a responsável **autoriza**, o colega
**baixa**. O token só nasce no consentimento — antes disso não existe link, então
não há como vazar o que ainda não foi permitido. Expira em 7 dias por TTL, e
revogar mata o acesso na hora.

O pacote é nomeado como **recursos FHIR** (`paciente` → Patient, `encontros` →
Encounter, `observacoes` → Observation, `imunizacoes` → Immunization, `documentos`
→ DocumentReference, `condicoes` → Condition, `narrativa` → Composition). A RNDS
exige HL7 FHIR; nomear certo agora é a diferença entre escrever um mapeamento
depois e reescrever o exportador inteiro.

Notas privadas e avaliações marcadas como "só para mim" **não vão** no pacote:
são o raciocínio em aberto de um profissional específico, não o registro do caso.

### FHIR R4

`GET /api/transferencias/:token/fhir` entrega o mesmo caso como **Bundle FHIR R4
do tipo `document`** — mesmo token, mesma checagem de consentimento, mesma linha
de auditoria da rota `/pacote`. Muda só o formato: `/pacote` é para gente ler,
`/fhir` é para outro prontuário importar sem ninguém redigitar nada.

O mapeamento vive em `server/services/fhir/`, é **puro** (pacote entra, Bundle
sai — sem banco, sem relógio) e é testado campo a campo. Num formato de
interoperabilidade, um campo errado não estoura aqui: ele aparece do outro lado,
semanas depois, como dado errado no prontuário de outra pessoa.

O que sai codificado de verdade:

| Medida | Código |
|---|---|
| Peso, altura, comprimento, perímetro cefálico, PA sistólica/diastólica, altura uterina | **LOINC** + unidade **UCUM** |
| BCF (batimentos cardíacos fetais) | LOINC `55283-6` |
| Idade gestacional | LOINC `11884-4`, unidade `wk` |
| PFE, DBP, CC, CA, CF, ILA (biometria fetal) | código **local** (`SISTEMA_PRUMO`) |

Os seis últimos ficam em código local de propósito: inventar um LOINC aproximado
seria pior que não ter nenhum — o receptor confiaria no código errado.

**Isto é R4 base, não perfil da RNDS.** Falta, e está documentado no cabeçalho do
mapeador: os `meta.profile` da RNDS, o CNS como `identifier` do Patient (o Prumo
não coleta CNS hoje), as vacinas em BRVacina (hoje saem com o id local do PNI),
o certificado ICP-Brasil e o credenciamento no DATASUS. Emitir um Bundle
carimbado com `meta.profile` da RNDS sem cumprir o perfil seria duplamente ruim:
o barramento rejeitaria, e quem lesse o código acharia que está pronto.

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

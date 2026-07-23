# Segurança — Prumo

A Prumo lida com dados de saúde de gestantes e crianças. Aqui tratamos segurança
como requisito de produto. Este documento explica, em linguagem simples, o que já
está implementado no cliente e o que precisa vir do backend.

## O que já está implementado (cliente)

### Headers e Content Security Policy
- **CSP restritiva** aplicada de duas formas: um `<meta http-equiv>` em `index.html`
  (defesa em profundidade) e headers no dev server (`vite.config.ts`).
- Headers presentes: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`
  (câmera, microfone e geolocalização bloqueados) e `Strict-Transport-Security`.
- A CSP bloqueia `object-src`, restringe `script-src` a `'self'`, e limita
  `img/font/style/connect` às origens estritamente necessárias.

### Nenhum segredo no cliente
- Só variáveis com prefixo `VITE_` chegam ao bundle, e elas são **públicas por
  definição**. Veja `.env.example` — só há a URL base da API.
- Segredos reais (chaves privadas, credenciais) vivem apenas no backend.

### Nenhum dado de saúde em `localStorage`
- O progresso da trilha e as respostas do onboarding ficam **apenas em memória**
  (stores Zustand). Recarregar a página descarta tudo — que é o esperado num
  protótipo.
- O único dado persistido é a **decisão de consentimento LGPD** (flags booleanas),
  que não é dado de saúde. Ver `src/lib/stores/consent.ts`.

### Validação e sanitização de toda entrada
- **Zod** valida cada formulário antes de qualquer envio (`src/lib/schemas.ts`).
- **DOMPurify** sanitiza qualquer texto que venha do usuário
  (`src/lib/sanitize.ts`), incluindo normalização e limite de tamanho.

### Camada de API isolada
- Todo acesso à rede passa por `src/lib/api/client.ts`, com:
  - **timeout** por requisição (sem spinner infinito),
  - **retry com backoff exponencial** para leituras idempotentes,
  - **erros que nunca vazam detalhe técnico** — o usuário vê sempre uma mensagem
    acolhedora; a causa crua fica só para log.

### Rate limiting e anti-duplo-submit
- `src/lib/rate-limit.ts` limita tentativas por ação (ex.: envio do onboarding) e
  o botão entra em estado `loading` para evitar submissão dupla.

### Audit trail conceitual
- Toda ação sensível emite um evento tipado (`src/lib/audit.ts`). Hoje só loga no
  console em desenvolvimento; a arquitetura já nasce pronta para um log de
  auditoria imutável no backend — basta trocar o *sink*.

### Acessibilidade e resiliência
- **Error boundaries por rota** com fallback acolhedor (nunca tela branca ou stack
  trace) — `src/app/ErrorBoundary.tsx`.
- Navegação completa por teclado, `:focus-visible` visível, ARIA em switches,
  progressos e diálogos.
- Todas as animações respeitam `prefers-reduced-motion`.

## Backend (já implementado nesta fase)

O backend Express + MongoDB (Atlas) já entrega parte do que antes era "a fazer":

- **Sessão em cookie httpOnly + SameSite=Strict + Secure** (em produção), assinada
  com JWT. O token nunca é lido por JavaScript no cliente.
- **Senhas com bcrypt** (fator 12). Nunca guardamos senha em texto puro.
- **Validação Zod no servidor** em toda rota — o servidor não confia no cliente.
- **Papéis** (gestante/mãe vs médico) com middleware `requireRole`.
- **Rate limiting** por IP nas rotas de autenticação.
- **Mensagens que não vazam detalhe**: login errado não revela se o e-mail existe;
  erros internos nunca mostram stack trace.
- **Segredos só no ambiente**: `MONGODB_URI` e `JWT_SECRET` vivem em `.env` / painel
  da Vercel, nunca no repositório.

## O que ainda precisa evoluir no backend

Estes itens **não** podem ser garantidos só no cliente — são responsabilidade do
servidor / infraestrutura:

- **CSP e headers de segurança como headers HTTP reais** servidos pelo CDN /
  proxy reverso. O `<meta>` é fallback: não cobre `frame-ancestors` nem
  `report-uri`. Um exemplo de configuração (Nginx) deve espelhar os headers de
  `vite.config.ts`.
- **Sessão em cookie `httpOnly` + `SameSite=Strict` + `Secure`**, emitido pelo
  backend. O cliente só usa `credentials: 'include'` — nunca manipula o token.
- **Autenticação e autorização** de verdade: quem vê a trilha de quem.
- **Rate limiting no servidor** (o do cliente é só anti-spam, não é barreira).
- **Criptografia em repouso** dos dados de saúde e **log de auditoria imutável**.
- **Fluxos LGPD reais** por trás dos botões de exportar / excluir: verificação de
  identidade, prazo legal, confirmação e efetivação.
- **Rotação de segredos** e gestão de chaves fora do repositório.

## Documentos do médico (CPF e CRM)

No cadastro do médico coletamos **CPF** e **CRM**:

- **CPF** é validado pelo algoritmo real de dígitos verificadores. É dado sensível:
  fica com `select: false` no banco (não vem em consultas por padrão), **nunca é
  retornado ao cliente** (nem no `/me`), e em produção deve ser **cifrado em
  repouso**. Só é armazenado para o papel médico.
- **CRM** é validado por formato (número + UF válida). **Não existe API oficial
  gratuita de verificação de CRM** (o CFM não expõe isso), então a conta entra como
  `verificacaoStatus: 'pendente'` e a arquitetura já deixa o gancho para uma checagem
  oficial (CFM) ou serviço pago no futuro.

## Content Security Policy e PDFs

A geração de PDF (`@react-pdf/renderer`) usa **WebAssembly**. Por isso a CSP inclui
`'wasm-unsafe-eval'` no `script-src` — é a diretiva estreita que libera **só** WASM,
sem permitir `eval()` de JavaScript (bem mais seguro que `'unsafe-eval'`). Os PDFs
são gerados no cliente via `blob:` (por isso `img-src` inclui `blob:`).

## Autorização e escopo por usuário

Toda rota sensível exige sessão (`requireAuth`) e opera **apenas sobre os dados do
próprio usuário** — cada consulta é escopada por `responsavel`/`crianca` do usuário
logado (`getOrCreateCrianca(req.user.id)`), então um usuário nunca acessa a jornada
de outro (sem IDOR):

- Anotações do prontuário e dúvidas do caderninho só podem ser **editadas/removidas
  pelo autor** (checagem de `autorId`).
- A resposta do médico no caderninho é restrita ao papel médico **e** à sua própria
  paciente (escopo por `crianca`) — um médico não responde dúvida de paciente alheio.
- IDs malformados retornam 404 limpo (sem 500 nem vazamento).

**Tradeoffs conhecidos (aceitáveis para protótipo, a endurecer em produção):**
- O cadastro responde 409 quando o e-mail já existe (pequena enumeração de e-mail);
  mitigado por rate limit. O login não enumera.
- Rate limiting é in-memory por instância (serverless) e cobre as rotas de auth;
  em produção, use um limitador compartilhado (Redis/Upstash) e estenda às escritas.
- `verificacaoStatus` do médico é informativo (modo demonstração); não bloqueia
  recursos ainda.

## Vínculo médico↔paciente (compartilhamento por link/QR)

O acesso do médico aos dados de um paciente exige um **vínculo consentido**, criado
quando um lado aceita o link/QR do outro (**ambos podem iniciar**):

- O convite é um **token aleatório** (32 hex) com **validade de 7 dias** e uso único;
  quem criou não pode aceitar o próprio convite.
- Só um **médico** aceita convite de paciente e só um **paciente** aceita convite de
  médico (papéis validados).
- Com o vínculo, o médico acessa exames/prontuário/consultas/vacinas **apenas** daquele
  paciente, via `server/services/acesso.ts` (`resolveCrianca` — própria criança OU
  médico com vínculo **ativo**). Verificado: médico sem vínculo → **403**; ao **revogar**
  (o paciente sempre pode), o acesso cai para **403** na hora.
- Médico e paciente **compartilham o registro do bebê**: exames anexados pelo médico
  aparecem para o paciente e vice-versa.

**CRM**: agora é **opcional e não validado** no cadastro (o **CPF é validado** por
dígitos + nome obrigatório). A verificação oficial de CRM (CFM) fica para depois.

## Exames e consultas (dados de saúde)

- **Arquivos de exame** ficam no **GridFS** do próprio MongoDB/Atlas (sem serviço
  externo). O download é **autenticado e escopado por paciente**: só quem é dono da
  jornada acessa o arquivo (testado — outro médico recebe 404). Limite de 5 MB e
  apenas PDF/JPG/PNG/WEBP (`fileFilter` + `MulterError` → 413).
- **Consultas** (formato SOAP) só são criadas por médico (`requireRole`), removíveis
  só pelo autor; leitura escopada ao paciente. IDs malformados → 404.
- Em produção, os binários no GridFS devem ser **cifrados em repouso**. O acesso
  cross-conta (médico que atende a mãe vê os exames dela) será concedido via a
  **conexão** paciente↔profissional da Fase 7.

## Recuperação de senha e marketplace

- **Esqueci minha senha** (`POST /api/auth/esqueci-senha`): responde sempre igual,
  exista ou não a conta (**sem enumeração de e-mail**), com rate limit. O envio real
  do e-mail de redefinição depende de um **provedor de e-mail** (a integrar) — hoje o
  pedido é aceito e registrado, sem enviar.
- **Marketplace**: listagens de profissionais/clínicas são públicas ao usuário logado
  (`requireAuth`); as solicitações de agendamento ficam escopadas ao usuário. Rotas de
  direção usam **deep links** (Google Maps / Waze) — sem chave e sem rastrear o usuário;
  a geolocalização é opcional (permissão do navegador) e só serve para ordenar por
  distância, com fallback quando negada.

## Compatibilidade mobile (Capacitor)

O código foi mantido web e preparado para virar app com Capacitor sem reescrever:
todo acesso de rede passa pelo client `api` (base configurável por
`VITE_API_BASE_URL` — URL absoluta no app), uploads via `FormData`/`fetch` (funciona
em WebView), e `window`/`localStorage` sempre sob guarda. **Ressalva**: a sessão em
cookie httpOnly `SameSite=Strict` não é enviada de uma origem Capacitor para uma API
cross-origin; a migração mobile trocará para `SameSite=None; Secure` ou sessão por
token em armazenamento seguro — a camada de auth já isola essa troca.

## Acessibilidade e movimento

Todas as animações respeitam `prefers-reduced-motion`: as de CSS via media query, e
as de **framer-motion** via `<MotionConfig reducedMotion="user">` (movimento por JS
que a media query não alcança). Foco sempre visível (`:focus-visible` com contorno
sólido ≥3:1).

## Conteúdo clínico (SUS)

O calendário vacinal, os exames de pré-natal e os marcos de desenvolvimento são
baseados em fontes públicas do **Ministério da Saúde** (Programa Nacional de
Imunizações e Cadernetas da Gestante e da Criança), com a referência indicada em
cada tela. É conteúdo **informativo** — não substitui a orientação da equipe de
saúde, e a Prumo não inventa condutas, doses ou diagnósticos. Vacinas de campanha
(Influenza, COVID-19) variam por período e seguem o Ministério da Saúde.

## Reportar uma vulnerabilidade

Enquanto não há canal oficial, trate qualquer achado como confidencial e
comunique diretamente à equipe responsável antes de qualquer divulgação.

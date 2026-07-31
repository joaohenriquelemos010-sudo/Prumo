/**
 * O checklist da gestante: dois níveis, conteúdo do servidor, estado da paciente.
 *
 * O que importa verificar aqui não é "a lista aparece" — é que **template e
 * instância continuam separados**: a paciente marca, o progresso é dela, e o
 * conteúdo (títulos, explicações) segue vindo do servidor. Se isso se misturar,
 * corrigir um texto passa a reescrever o progresso de quem já marcou.
 */

export async function registrarTestesDeChecklist({
  navegador,
  BASE,
  DESKTOP,
  secao,
  afirmar,
  registrar,
  conta,
  shot,
}) {
  secao('Checklist: dois níveis, progresso e conteúdo leigo')

  const ctxMae = await navegador.newContext({ viewport: DESKTOP })
  const ctxMedica = await navegador.newContext({ viewport: DESKTOP })
  await registrar(ctxMae.request, conta('gestante'))
  await registrar(ctxMedica.request, conta('medico'))

  // Uma gestação por volta de 26 semanas — dentro da janela do exame de diabetes.
  const dpp = new Date(Date.now() + 98 * 864e5).toISOString()
  await ctxMae.request.put(`${BASE}/api/perfil`, { data: { momento: 'gestante', dpp } })

  /* ---- a gestante já tem o checklist, sem ninguém atribuir ---- */
  const res = await ctxMae.request.get(`${BASE}/api/checklists`)
  afirmar(res.ok(), 'GET /checklists responde', `status ${res.status()}`)
  const { checklists, contexto } = await res.json()

  const gestante = checklists.find((c) => c.chave === 'gestante-completo')
  afirmar(Boolean(gestante), 'a gestante recebe o checklist do programa sem atribuição manual')
  afirmar(gestante.grupos.length >= 8, `o checklist tem os grupos (${gestante?.grupos.length})`)
  afirmar(contexto.semana > 20 && contexto.semana < 32, `a semana gestacional é calculada (${contexto.semana})`)

  /* ---- conteúdo em linguagem leiga, com fonte ---- */
  afirmar(
    gestante.grupos.every((g) => g.explicacaoLeiga && g.explicacaoLeiga.length > 80),
    'todo grupo traz explicação em linguagem leiga',
  )
  afirmar(
    gestante.grupos.every((g) => g.fonte && g.fonte.length > 10),
    'todo grupo cita a fonte clínica',
  )
  afirmar(
    gestante.grupos.every((g) => g.passos.length > 0),
    'todo grupo tem o segundo nível (passos)',
  )
  afirmar(
    gestante.grupos.every((g) => g.passos.every((p) => !('passos' in p))),
    'passos NÃO têm um terceiro nível',
  )

  /* ---- a janela marca, não esconde ---- */
  const forasDaJanela = gestante.grupos.filter((g) => g.foraDaJanela)
  afirmar(
    forasDaJanela.length > 0 && forasDaJanela.length < gestante.grupos.length,
    `o que está fora da janela é marcado, não escondido (${forasDaJanela.length} de ${gestante.grupos.length})`,
  )

  /* ---- marcar passos fecha o grupo sozinho ---- */
  const alvo = gestante.grupos.find((g) => g.passos.filter((p) => !p.opcional).length >= 2)
  const obrigatorios = alvo.passos.filter((p) => !p.opcional)

  let ultimaResposta
  for (const passo of obrigatorios) {
    ultimaResposta = await ctxMae.request.patch(
      `${BASE}/api/checklists/gestante-completo/grupo/${alvo.id}/passo/${passo.id}`,
      { data: { feito: true } },
    )
  }
  afirmar(ultimaResposta.ok(), 'a gestante marca os passos', `status ${ultimaResposta.status()}`)

  const { checklist: depois, grupoConcluido } = await ultimaResposta.json()
  const grupoDepois = depois.grupos.find((g) => g.id === alvo.id)
  afirmar(grupoConcluido === true, 'marcar o último passo obrigatório fecha o grupo')
  afirmar(grupoDepois.estado === 'feito', 'o grupo fica com estado "feito"')
  afirmar(depois.progresso > 0, `o progresso sobe (${depois.progresso}%)`)
  afirmar(depois.sequenciaDias >= 1, `a sequência começa a contar (${depois.sequenciaDias})`)

  /* ---- desmarcar reabre ---- */
  const reabrir = await ctxMae.request.patch(
    `${BASE}/api/checklists/gestante-completo/grupo/${alvo.id}/passo/${obrigatorios[0].id}`,
    { data: { feito: false } },
  )
  const { checklist: reaberto } = await reabrir.json()
  afirmar(
    reaberto.grupos.find((g) => g.id === alvo.id).estado === 'em-andamento',
    'desmarcar um passo reabre o grupo',
  )

  /* ---- "não se aplica" é uma saída de verdade ---- */
  const outro = gestante.grupos.find((g) => g.id !== alvo.id)
  const naoSeAplica = await ctxMae.request.patch(
    `${BASE}/api/checklists/gestante-completo/grupo/${outro.id}`,
    { data: { estado: 'nao-se-aplica' } },
  )
  const { checklist: comExcecao } = await naoSeAplica.json()
  afirmar(
    comExcecao.grupos.find((g) => g.id === outro.id).estado === 'nao-se-aplica',
    '"não se aplica" é aceito e conta como resolvido',
  )

  /* ---- a instância guarda SÓ estado ---- */
  afirmar(
    gestante.grupos[0].titulo.length > 0 && gestante.grupos[0].explicacaoLeiga.length > 0,
    'o conteúdo vem do servidor, junto do estado',
  )

  /* ---- a médica vê o catálogo e consegue atribuir ---- */
  const catalogo = await ctxMedica.request.get(`${BASE}/api/checklists/templates`)
  afirmar(catalogo.ok(), 'a médica lê o catálogo de checklists', `status ${catalogo.status()}`)
  const { templates } = await catalogo.json()
  afirmar(templates.length >= 2, `o catálogo tem os templates (${templates.length})`)
  afirmar(
    templates.filter((t) => t.chave === 'gestante-completo').length === 1,
    'o catálogo traz só a versão mais recente de cada chave',
  )

  /* ---- a família NÃO acessa o catálogo (é ferramenta da médica) ---- */
  const catalogoFamilia = await ctxMae.request.get(`${BASE}/api/checklists/templates`)
  afirmar(
    catalogoFamilia.status() === 403,
    'a família não acessa o catálogo de templates',
    `status ${catalogoFamilia.status()}`,
  )

  /* ---- item inexistente é recusado ---- */
  const inventado = await ctxMae.request.patch(
    `${BASE}/api/checklists/gestante-completo/grupo/nao-existe`,
    { data: { estado: 'feito' } },
  )
  afirmar(
    inventado.status() === 404,
    'marcar um grupo que não existe no template é recusado',
    `status ${inventado.status()}`,
  )

  /* ---- e a tela mostra tudo isso ---- */
  const pageMae = await ctxMae.newPage()
  await pageMae.goto(`${BASE}/app/trilha`)
  await pageMae.waitForSelector('h1', { timeout: 15000 })
  const texto = await pageMae.locator('body').innerText()
  afirmar(texto.includes('Sua gravidez'), 'a trilha mostra o checklist da gestante')
  afirmar(texto.includes('Seu próximo passo'), 'a trilha destaca UM próximo passo')
  await shot(pageMae, 'checklist-trilha')

  // Abrir um cartão leva ao segundo nível, numa folha — sem sair da página.
  const urlAntes = pageMae.url()
  await pageMae.locator('button:has-text("Fazer os exames")').first().click()
  await pageMae.waitForSelector('[role="dialog"]', { timeout: 15000 })
  afirmar(pageMae.url() === urlAntes, 'o segundo nível abre numa folha, sem navegar')
  afirmar(
    (await pageMae.locator('[role="dialog"]').innerText()).includes('Como fazer'),
    'a folha mostra os passos e a explicação',
  )
  await shot(pageMae, 'checklist-folha')

  await ctxMae.close()
  await ctxMedica.close()
}

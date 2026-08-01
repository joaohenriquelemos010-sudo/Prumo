/**
 * O fluxo do consultório: catálogo de tipos → agenda → 1ª consulta → retorno.
 *
 * O que este arquivo protege é uma regra só, e ela é a mais fácil de quebrar sem
 * ninguém notar: **na segunda consulta o formulário muda e traz o que já foi
 * respondido**. Se ela regredir, nada estoura — o médico só volta a redigitar a
 * anamnese toda vez, e para de preencher.
 */
export async function registrarTestesDoFluxoMedico({
  navegador,
  BASE,
  DESKTOP,
  secao,
  afirmar,
  registrar,
  conta,
}) {
  secao('Fluxo do consultório: tipos de consulta e prontuário por tipo')

  const ctx = await navegador.newContext({ viewport: DESKTOP })
  await registrar(ctx.request, conta('medico'))

  /* ---- o catálogo nasce semeado pela especialidade ---- */
  const cat = await ctx.request.get(`${BASE}/api/tipos-atendimento`)
  afirmar(cat.ok(), 'o catálogo de tipos carrega', `status ${cat.status()}`)
  const { tipos, templates } = await cat.json()
  afirmar(tipos.length > 0, `o catálogo já vem semeado (${tipos.length} tipos)`)
  afirmar(
    tipos.some((t) => t.templateNatureza === 'primeira') &&
      tipos.some((t) => t.templateNatureza === 'retorno'),
    'vem com primeira consulta E retorno — o par é o que faz a regra funcionar',
  )
  afirmar(templates.length >= 6, `os formulários estão disponíveis (${templates.length})`)

  // Durações diferentes por tipo é o ponto do catálogo.
  const duracoes = new Set(tipos.map((t) => t.duracaoMin))
  afirmar(duracoes.size > 1, 'tipos diferentes têm durações diferentes')

  /* ---- criar um tipo próprio ---- */
  const criar = await ctx.request.post(`${BASE}/api/tipos-atendimento`, {
    data: { nome: 'Retorno rápido', duracaoMin: 15, cor: 'azul', template: 'pre-natal-retorno' },
  })
  afirmar(criar.ok(), 'o médico cria um tipo próprio', `status ${criar.status()}`)

  const duplicado = await ctx.request.post(`${BASE}/api/tipos-atendimento`, {
    data: { nome: 'Retorno rápido', duracaoMin: 20, cor: 'azul', template: 'soap-generico' },
  })
  afirmar(
    duplicado.status() === 409,
    'dois tipos com o mesmo nome são recusados — seriam indistinguíveis na agenda',
    `status ${duplicado.status()}`,
  )

  /* ---- uma paciente de balcão ---- */
  const paciente = (
    await (
      await ctx.request.post(`${BASE}/api/pacientes`, {
        data: { nome: 'Marina Primeira', momento: 'gestante' },
      })
    ).json()
  ).paciente

  /* ---- PRIMEIRA consulta: anamnese completa ---- */
  const um = await (
    await ctx.request.post(`${BASE}/api/atendimento/iniciar`, { data: { jornadaId: paciente.id } })
  ).json()

  afirmar(Boolean(um.formulario), 'o atendimento vem com um formulário resolvido')
  afirmar(
    um.formulario.natureza === 'primeira' && um.formulario.primeiraVez === true,
    `a primeira consulta abre a anamnese completa (veio ${um.formulario.natureza})`,
  )
  afirmar(um.formulario.secoes.length >= 3, `a anamnese tem seções de verdade (${um.formulario.secoes.length})`)
  afirmar(um.formulario.herdado.length === 0, 'não há o que herdar na primeira consulta')

  // Responde dois campos permanentes e finaliza.
  await ctx.request.patch(`${BASE}/api/atendimento/${um.consulta.id}`, {
    data: { estruturado: { tipoSanguineo: 'O+', gesta: 2 } },
  })
  // Um segundo PATCH com OUTRO campo: o servidor tem que mesclar, não substituir.
  await ctx.request.patch(`${BASE}/api/atendimento/${um.consulta.id}`, {
    data: { estruturado: { alergias: 'dipirona' } },
  })
  const salvo = await (
    await ctx.request.patch(`${BASE}/api/atendimento/${um.consulta.id}`, {
      data: { subjetivo: 'Primeira consulta de pré-natal.' },
    })
  ).json()
  afirmar(
    salvo.consulta.estruturado?.tipoSanguineo === 'O+' &&
      salvo.consulta.estruturado?.alergias === 'dipirona',
    'PATCHes sucessivos MESCLAM as respostas em vez de trocar o objeto',
  )

  const fim = await ctx.request.post(`${BASE}/api/atendimento/${um.consulta.id}/finalizar`, {
    data: {},
  })
  afirmar(fim.ok(), 'a primeira consulta fecha', `status ${fim.status()}`)

  /* ---- SEGUNDA consulta: retorno, herdando ---- *
   * É a asserção que dá nome ao arquivo. */
  const dois = await (
    await ctx.request.post(`${BASE}/api/atendimento/iniciar`, { data: { jornadaId: paciente.id } })
  ).json()

  afirmar(
    dois.formulario.natureza === 'retorno',
    `a segunda consulta abre o acompanhamento (veio ${dois.formulario.natureza})`,
  )
  afirmar(
    dois.formulario.primeiraVez === false,
    'e ela sabe que não é a primeira vez',
  )

  const herdados = Object.fromEntries(dois.formulario.herdado.map((h) => [h.campoId, h.valor]))
  afirmar(
    herdados.tipoSanguineo === 'O+',
    'o tipo sanguíneo da anamnese aparece SEM ser perguntado de novo',
    JSON.stringify(herdados),
  )
  afirmar(herdados.gesta === '2', 'as gestações também vêm herdadas')
  afirmar(
    dois.formulario.secoes.every((s) => s.campos.every((c) => c.id !== 'tipoSanguineo')),
    'e o formulário do retorno NÃO pede o tipo sanguíneo de novo',
  )

  /* ---- lista de espera ---- */
  const espera = await ctx.request.post(`${BASE}/api/lista-espera`, {
    data: { nome: 'Quem espera', telefone: '11999990000', prioridade: 1 },
  })
  afirmar(espera.ok(), 'alguém entra na lista de espera', `status ${espera.status()}`)
  const fila = await (await ctx.request.get(`${BASE}/api/lista-espera`)).json()
  afirmar(fila.fila.length === 1 && fila.fila[0].prioridade === 1, 'a fila devolve quem está esperando')

  /* ---- insights ---- */
  const ins = await (await ctx.request.get(`${BASE}/api/vinculos/insights`)).json()
  afirmar(ins.insights.total >= 1, 'os insights contam as pacientes')
  afirmar(ins.insights.semConta >= 1, 'e sabem quantas ainda não têm conta')

  /* ---- busca ---- */
  const achou = await (
    await ctx.request.get(`${BASE}/api/vinculos/pacientes?q=marina`)
  ).json()
  afirmar(achou.pacientes.length === 1, 'a busca acha pelo nome, em minúsculas')
  const naoAchou = await (
    await ctx.request.get(`${BASE}/api/vinculos/pacientes?q=zzzznaoexiste`)
  ).json()
  afirmar(naoAchou.pacientes.length === 0, 'e não acha o que não existe')

  /* ---- a tela ---- */
  const page = await ctx.newPage()
  await page.goto(`${BASE}/app/agenda`)
  await page.waitForSelector('[role="tablist"]')
  afirmar(
    await page.locator('button:has-text("Espera")').isVisible(),
    'a agenda ganhou a aba de lista de espera',
  )
  await page.click('button:has-text("Configurar")')
  await page.waitForSelector('text=Tipos de consulta')
  afirmar(
    await page.locator('text=Tipos de consulta').isVisible(),
    'o catálogo de tipos vive junto da disponibilidade',
  )
  afirmar(
    await page.locator('text=Almoço').first().isVisible(),
    'e o intervalo de almoço tem campo próprio',
  )

  await ctx.close()
}

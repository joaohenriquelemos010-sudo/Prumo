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
  // Sem configurar de propósito: é o portão que este arquivo testa primeiro.
  await registrar(ctx.request, conta('medico'), { configurar: false })

  /* ---- o portão: quem acabou de criar conta vai configurar a agenda ---- *
   * É o passo que o fluxo do consultório coloca entre criar a conta e usar o
   * produto. Sem ele, o médico caía num app que parecia quebrado — calendário
   * vazio, nenhum horário para oferecer, e nenhuma pista do que faltava. */
  {
    const page = await ctx.newPage()
    await page.goto(`${BASE}/app`)
    await page.waitForURL('**/app/configurar-agenda', { timeout: 8000 }).catch(() => {})
    afirmar(
      page.url().includes('/app/configurar-agenda'),
      'médico sem agenda configurada é levado para a configuração',
      `caiu em ${page.url()}`,
    )
    afirmar(
      await page.locator('text=Em que dias você atende?').isVisible(),
      'e a primeira pergunta é em que dias ele atende',
    )

    // O calendário interativo: cada dia é um botão que liga e desliga.
    await page.click('button[aria-pressed="false"]:has-text("SEG")')
    await page.click('button[aria-pressed="false"]:has-text("QUA")')
    await page.waitForTimeout(200)
    afirmar(
      (await page.locator('text=Segunda').count()) === 1,
      'ligar um dia abre a linha de horários dele',
    )

    await page.click('button:has-text("Continuar")')
    await page.waitForSelector('text=Tipos de consulta', { timeout: 8000 })
    afirmar(true, 'salvar a semana leva ao passo dos tipos de consulta')

    await page.click('button:has-text("Está bom assim")')
    await page.waitForSelector('text=Sua agenda está no ar', { timeout: 8000 })
    afirmar(true, 'e o fluxo termina dizendo que a agenda está no ar')

    // Agora o portão tem que deixar passar.
    await page.goto(`${BASE}/app/pacientes`)
    await page.waitForTimeout(600)
    afirmar(
      !page.url().includes('configurar-agenda'),
      'depois de configurar, o médico circula livre pelo app',
      `caiu em ${page.url()}`,
    )
    await page.close()
  }

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

  /* ---- o calendário ---- *
   * A agenda deixou de ser lista e virou grade. As asserções aqui são de
   * estrutura, não de pixel: que a semana tenha sete colunas, que um horário
   * marcado apareça como bloco, e que trocar de período de fato mude o que se vê. */
  const marcar = await ctx.request.post(`${BASE}/api/agenda/marcar`, {
    data: {
      jornadaId: paciente.id,
      inicio: (() => {
        // Amanhã às 10h no relógio do servidor de teste.
        const d = new Date()
        d.setDate(d.getDate() + 1)
        d.setHours(10, 0, 0, 0)
        return d.toISOString()
      })(),
      tipoAtendimentoId: tipos[0].id,
    },
  })
  afirmar(marcar.ok(), 'o médico marca um horário direto', `status ${marcar.status()}`)

  // O mesmo horário de novo tem que bater no conflito, e não criar dois.
  const dobrado = await ctx.request.post(`${BASE}/api/agenda/marcar`, {
    data: {
      jornadaId: paciente.id,
      inicio: (() => {
        const d = new Date()
        d.setDate(d.getDate() + 1)
        d.setHours(10, 15, 0, 0)
        return d.toISOString()
      })(),
      tipoAtendimentoId: tipos[0].id,
    },
  })
  afirmar(
    dobrado.status() === 409,
    'marcar por cima de outro atendimento é recusado por padrão',
    `status ${dobrado.status()}`,
  )

  const semana = await (
    await ctx.request.get(
      `${BASE}/api/agenda?de=${new Date(Date.now() - 86400000).toISOString()}&ate=${new Date(Date.now() + 7 * 86400000).toISOString()}`,
    )
  ).json()
  afirmar(semana.agendamentos.length >= 1, 'a agenda devolve os horários da janela')
  afirmar(Boolean(semana.expediente), 'e o fundo da grade — expediente, almoço, bloqueios')
  afirmar(
    semana.agendamentos.every((a) => typeof a.cor === 'string'),
    'cada horário traz a cor do tipo, para a legenda funcionar',
  )

  const janelaEnorme = await ctx.request.get(
    `${BASE}/api/agenda?de=2000-01-01T00:00:00Z&ate=2030-01-01T00:00:00Z`,
  )
  afirmar(
    janelaEnorme.status() === 400,
    'uma janela absurda é recusada em vez de varrer a coleção',
    `status ${janelaEnorme.status()}`,
  )

  /* ---- a tela ---- */
  const page = await ctx.newPage()
  await page.goto(`${BASE}/app/agenda`)
  await page.waitForSelector('[role="tablist"]')
  afirmar(
    await page.locator('button:has-text("Espera")').isVisible(),
    'a agenda ganhou a aba de lista de espera',
  )
  // A grade da semana: sete colunas de dia mais a régua de horas.
  await page.waitForSelector('[role="tablist"] button:has-text("Semana")')
  const colunas = await page.$$eval('[title*="–"]', (bs) => bs.length)
  afirmar(colunas >= 1, `os horários aparecem como blocos na grade (${colunas})`)

  // A regressão que apareceu na tela: um atendimento fora do expediente fazia a
  // grade inteira desabar para uma faixa de uma hora.
  const horas = await page.$$eval('.tabular-nums', (ns) => ns.map((n) => n.textContent))
  afirmar(
    horas.length >= 8,
    `a grade mostra o dia de trabalho inteiro (${horas.length} horas na régua)`,
    horas.join(' '),
  )
  afirmar(
    await page.locator('button:has-text("Novo agendamento")').isVisible(),
    'a barra tem o botão de marcar',
  )

  const antes = await page.textContent('[role="tablist"] ~ * , body')
  await page.click('button[aria-label="Próximo período"]')
  await page.waitForTimeout(500)
  afirmar(
    (await page.textContent('body')) !== antes,
    'avançar o período muda o que a grade mostra',
  )

  await page.click('button:has-text("Dia")')
  await page.waitForTimeout(400)
  afirmar(
    await page.locator('button[aria-selected="true"]:has-text("Dia")').isVisible(),
    'a visão de dia existe e é selecionável',
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

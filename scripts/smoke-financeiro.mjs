/**
 * Financeiro — o dado que é do médico, e não da paciente.
 *
 * Todo o resto do Prumo é escopado por jornada: a família é dona, o médico
 * alcança por vínculo. Aqui é o contrário, e a asserção mais importante deste
 * arquivo é a que confirma isso: **um recebimento nunca aparece na exportação
 * LGPD da paciente**. Se aparecer, é vazamento — na direção contrária da usual,
 * mas vazamento.
 */

async function publicarAgenda(request, BASE) {
  const res = await request.put(`${BASE}/api/disponibilidade/me`, {
    data: {
      ativo: true,
      duracaoPadraoMin: 30,
      antecedenciaMinHoras: 0,
      janelaMaxDias: 60,
      regras: [0, 1, 2, 3, 4, 5, 6].map((diaSemana) => ({
        diaSemana,
        inicio: '00:00',
        fim: '23:59',
        modalidades: ['presencial'],
        local: 'Consultório',
      })),
      atendeParticular: true,
    },
  })
  if (!res.ok()) throw new Error(`publicar agenda falhou: ${await res.text()}`)
}

export async function registrarTestesDeFinanceiro({
  navegador,
  BASE,
  DESKTOP,
  secao,
  afirmar,
  registrar,
  conta,
}) {
  secao('Financeiro: o mês da médica, e o que a paciente não vê')

  const ctxMedica = await navegador.newContext({ viewport: DESKTOP })
  const ctxOutra = await navegador.newContext({ viewport: DESKTOP })
  const ctxMae = await navegador.newContext({ viewport: DESKTOP })

  await registrar(ctxMedica.request, conta('medico'))
  await registrar(ctxOutra.request, conta('medico'))
  await registrar(ctxMae.request, conta('gestante'))
  await publicarAgenda(ctxMedica.request, BASE)

  /* ---- a família não tem financeiro ---- */
  const familia = await ctxMae.request.get(`${BASE}/api/financeiro`)
  afirmar(
    familia.status() === 403,
    'a família NÃO acessa o financeiro — o dado é do médico',
    `status ${familia.status()}`,
  )

  /* ---- lançamento avulso ---- */
  const criado = await ctxMedica.request.post(`${BASE}/api/financeiro`, {
    data: {
      pacienteNome: 'Marina',
      valorCentavos: 35000,
      forma: 'pix',
      estado: 'recebido',
    },
  })
  afirmar(criado.status() === 201, 'a médica lança um recebimento', `status ${criado.status()}`)

  await ctxMedica.request.post(`${BASE}/api/financeiro`, {
    data: { pacienteNome: 'Joana', valorCentavos: 18000, forma: 'convenio', convenio: 'Unimed', estado: 'recebido' },
  })
  await ctxMedica.request.post(`${BASE}/api/financeiro`, {
    data: { pacienteNome: 'Carla', valorCentavos: 40000, forma: 'pix', estado: 'previsto' },
  })

  /* ---- o resumo vem do servidor, e fecha ---- */
  const mes = await (await ctxMedica.request.get(`${BASE}/api/financeiro`)).json()
  const r = mes.resumo
  afirmar(r.recebidoCentavos === 53000, `recebido soma certo (${r.recebidoCentavos})`)
  afirmar(r.previstoCentavos === 40000, `previsto soma certo (${r.previstoCentavos})`)
  afirmar(r.totalCentavos === 93000, 'total é recebido + previsto')
  afirmar(r.convenioCentavos === 18000, 'convênio é separado do particular')
  afirmar(r.particularCentavos === 35000, 'particular é o resto do recebido')
  afirmar(
    r.particularCentavos + r.convenioCentavos === r.recebidoCentavos,
    'particular + convênio fecha no recebido',
  )

  /* ---- valores absurdos são recusados ---- */
  const absurdo = await ctxMedica.request.post(`${BASE}/api/financeiro`, {
    data: { valorCentavos: 999999999999, forma: 'pix' },
  })
  afirmar(absurdo.status() === 400, 'valor absurdo é recusado — provavelmente sobrou um zero')

  const fracionado = await ctxMedica.request.post(`${BASE}/api/financeiro`, {
    data: { valorCentavos: 350.5, forma: 'pix' },
  })
  afirmar(
    fracionado.status() === 400,
    'centavo fracionado é recusado: dinheiro é inteiro, sempre',
  )

  /* ---- ⚠️ o financeiro de um médico não é o de outro ---- */
  const daOutra = await (await ctxOutra.request.get(`${BASE}/api/financeiro`)).json()
  afirmar(
    daOutra.recebimentos.length === 0,
    'outro médico NÃO vê os lançamentos deste — escopo é por médico',
  )
  afirmar(daOutra.resumo.recebidoCentavos === 0, 'e o resumo dele é o dele')

  /* ---- ⚠️ e a paciente não vê nada disso na exportação LGPD ---- */
  const exportacao = await ctxMae.request.get(`${BASE}/api/auth/exportar`)
  if (exportacao.ok()) {
    const texto = await exportacao.text()
    afirmar(
      !texto.includes('valorCentavos') && !texto.includes('recebimento'),
      'a exportação LGPD da paciente NÃO contém dado financeiro do médico',
    )
  }

  /* ---- lançar a partir da agenda: sem digitação dupla, e sem duplicar ---- */
  const medica = await (await ctxMedica.request.get(`${BASE}/api/auth/me`)).json()
  const inicio = new Date(Date.now() + 10 * 60 * 1000)
  inicio.setSeconds(0, 0)

  const marcado = await ctxMae.request.post(`${BASE}/api/agendamentos`, {
    data: {
      medicoId: medica.user.id,
      objetivo: 'consulta-gestante',
      modalidade: 'presencial',
      inicio: inicio.toISOString(),
    },
  })
  const { agendamento } = await marcado.json()
  await ctxMedica.request.patch(`${BASE}/api/agendamentos/${agendamento.id}`, {
    data: { status: 'confirmado' },
  })
  await ctxMedica.request.patch(`${BASE}/api/agendamentos/${agendamento.id}`, {
    data: { status: 'realizado' },
  })

  const pendentes = await (await ctxMedica.request.get(`${BASE}/api/financeiro/pendentes`)).json()
  afirmar(
    pendentes.pendentes.some((p) => p.id === agendamento.id),
    'um atendimento realizado sem lançamento aparece como pendente',
  )

  const lancado = await ctxMedica.request.post(`${BASE}/api/financeiro`, {
    data: { agendamentoId: agendamento.id, valorCentavos: 30000, forma: 'pix', estado: 'recebido' },
  })
  afirmar(lancado.status() === 201, 'lançar a partir do agendamento funciona')

  /**
   * O índice único que impede o faturamento de dobrar. Clicar duas vezes em
   * "lançar" é comum, e ninguém confere um relatório financeiro contra a agenda
   * item a item — o erro passaria despercebido até o contador reclamar.
   */
  const denovo = await ctxMedica.request.post(`${BASE}/api/financeiro`, {
    data: { agendamentoId: agendamento.id, valorCentavos: 30000, forma: 'pix', estado: 'recebido' },
  })
  afirmar(
    denovo.status() === 200,
    'lançar o mesmo agendamento duas vezes NÃO dobra o faturamento',
    `status ${denovo.status()}`,
  )
  afirmar((await denovo.json()).jaExistia === true, 'e a resposta diz que já existia')

  const semPendente = await (
    await ctxMedica.request.get(`${BASE}/api/financeiro/pendentes`)
  ).json()
  afirmar(
    !semPendente.pendentes.some((p) => p.id === agendamento.id),
    'depois de lançado, o atendimento sai da lista de pendentes',
  )

  /* ---- um médico não mexe no lançamento de outro ---- */
  const { recebimentos } = await (await ctxMedica.request.get(`${BASE}/api/financeiro`)).json()
  const alvo = recebimentos[0]
  const intrusa = await ctxOutra.request.patch(`${BASE}/api/financeiro/${alvo.id}`, {
    data: { valorCentavos: 1 },
  })
  afirmar(
    intrusa.status() === 404,
    'outro médico não edita o lançamento deste',
    `status ${intrusa.status()}`,
  )

  /* ---- e a tela existe ---- */
  const page = await ctxMedica.newPage()
  await page.goto(`${BASE}/app/financeiro`)
  await page.waitForSelector('h1', { timeout: 15000 })
  const texto = await page.locator('body').innerText()
  afirmar(texto.includes('Quanto entrou'), 'a tela do financeiro abre')
  afirmar(texto.includes('Ticket médio'), 'e mostra o resumo do mês')

  await ctxMedica.close()
  await ctxOutra.close()
  await ctxMae.close()
}

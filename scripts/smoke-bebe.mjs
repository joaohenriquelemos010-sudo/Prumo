/**
 * A evolução do bebê: granularidade, batimentos e anexos.
 *
 * O que importa verificar aqui não é "a tela abre" — é que a **escolha de quem
 * cuida sobrevive**. Trocar semana → trimestre e voltar depois de um reload
 * para "semana" desfaz a decisão da pessoa e faz o produto parecer que não
 * escuta. Como a preferência mora no `localStorage` (é interface, não dado de
 * saúde), só um teste de navegador de verdade prova que ela persiste.
 *
 * E o oposto também é verificado: a preferência é de interface, então **nenhuma
 * medida** pode ter ido junto para o disco do navegador.
 */

/** Publica uma agenda que cobre o dia inteiro, para o teste não depender da hora. */
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
        local: 'Consultório central',
      })),
      atendeParticular: true,
    },
  })
  if (!res.ok()) throw new Error(`publicar agenda falhou: ${await res.text()}`)
}

export async function registrarTestesDeBebe({
  navegador,
  BASE,
  DESKTOP,
  secao,
  afirmar,
  registrar,
  conta,
  shot,
}) {
  secao('Bebê: granularidade, batimentos e a história em períodos')

  const ctxMae = await navegador.newContext({ viewport: DESKTOP })
  const ctxMedica = await navegador.newContext({ viewport: DESKTOP })
  await registrar(ctxMae.request, conta('gestante'))
  await registrar(ctxMedica.request, conta('medico'))
  await publicarAgenda(ctxMedica.request, BASE)

  // Gestação por volta de 32 semanas: dá para haver medidas em dois trimestres,
  // que é o caso em que agrupar significa alguma coisa.
  const dpp = new Date(Date.now() + 56 * 864e5).toISOString()
  await ctxMae.request.put(`${BASE}/api/perfil`, { data: { momento: 'gestante', dpp } })

  // Vincula as duas — sem isso a médica não alcança a jornada.
  const convite = await (await ctxMae.request.post(`${BASE}/api/vinculos/convite`, { data: {} })).json()
  await ctxMedica.request.post(`${BASE}/api/vinculos/aceitar/${convite.token}`, { data: {} })
  const { vinculos } = await (await ctxMedica.request.get(`${BASE}/api/vinculos`)).json()
  const criancaId = vinculos[0]?.crianca
  afirmar(Boolean(criancaId), 'médica vinculada à jornada da paciente')

  /* ---- biometria em três trimestres ---- */
  const semanas = [
    { semana: 12, pfeG: 60 },
    { semana: 20, pfeG: 330 },
    { semana: 24, pfeG: 680 },
    { semana: 28, pfeG: 1200 },
    { semana: 32, pfeG: 1900 },
  ]
  for (const m of semanas) {
    const res = await ctxMedica.request.put(`${BASE}/api/bebe/medidas?crianca=${criancaId}`, {
      data: { semana: m.semana, pfeG: m.pfeG, apresentacao: 'cefalica' },
    })
    afirmar(res.ok(), `médica registra a semana ${m.semana}`, `status ${res.status()}`)
  }

  /* ---- os batimentos vêm de uma consulta, e não de um campo novo ---- */
  const agora = new Date(Date.now() + 20 * 60 * 1000)
  agora.setSeconds(0, 0)
  const medicaMe = await (await ctxMedica.request.get(`${BASE}/api/auth/me`)).json()
  const marcado = await ctxMae.request.post(`${BASE}/api/agendamentos`, {
    data: {
      medicoId: medicaMe.user.id,
      objetivo: 'consulta-gestante',
      modalidade: 'presencial',
      inicio: agora.toISOString(),
    },
  })
  const { agendamento } = await marcado.json()
  await ctxMedica.request.patch(`${BASE}/api/agendamentos/${agendamento.id}`, {
    data: { status: 'confirmado' },
  })

  const iniciado = await ctxMedica.request.post(`${BASE}/api/atendimento/iniciar`, {
    data: { agendamentoId: agendamento.id },
  })
  afirmar(iniciado.ok(), 'a médica inicia o atendimento', `status ${iniciado.status()}`)
  const { consulta } = await iniciado.json()

  await ctxMedica.request.patch(`${BASE}/api/atendimento/${consulta.id}`, {
    data: { medidas: { bcfBpm: 142 } },
  })
  await ctxMedica.request.post(`${BASE}/api/atendimento/${consulta.id}/finalizar`, { data: {} })

  const bebe = await (await ctxMae.request.get(`${BASE}/api/bebe`)).json()
  afirmar(
    Array.isArray(bebe.batimentos) && bebe.batimentos.length > 0,
    `os batimentos saem do atendimento e chegam na tela do bebê (${bebe.batimentos?.length ?? 0})`,
  )
  afirmar(bebe.batimentos?.[0]?.bpm === 142, 'o valor é o que a médica digitou')
  afirmar(
    typeof bebe.batimentos?.[0]?.semana === 'number',
    'o batimento vem com a semana gestacional, e não só com a data',
  )

  /* ---- a família não recebe percentil; a médica recebe ---- */
  afirmar(
    (bebe.medidas ?? []).every((m) => !('percentis' in m)),
    'a família NÃO recebe percentil — "P1" é o número que assusta',
  )
  const bebeMedica = await (await ctxMedica.request.get(`${BASE}/api/bebe?crianca=${criancaId}`)).json()
  afirmar(
    (bebeMedica.medidas ?? []).some((m) => 'percentis' in m),
    'a médica recebe o percentil, que é a leitura clínica',
  )

  /* ---- o filtro de janela nos exames ---- */
  const semFiltro = await (await ctxMae.request.get(`${BASE}/api/exames`)).json()
  const forcadoVazio = await (
    await ctxMae.request.get(`${BASE}/api/exames?de=1990-01-01&ate=1990-12-31`)
  ).json()
  afirmar(
    Array.isArray(forcadoVazio.exames) && forcadoVazio.exames.length === 0,
    'GET /exames?de=&ate= recorta por data',
  )
  const dataInvalida = await ctxMae.request.get(`${BASE}/api/exames?de=nao-e-data`)
  afirmar(
    dataInvalida.ok() && (await dataInvalida.json()).exames.length === semFiltro.exames.length,
    'uma data inválida é ignorada em vez de virar erro',
  )

  /* ---- e a tela: períodos, seletor e persistência ---- */
  const pageMae = await ctxMae.newPage()
  await pageMae.goto(`${BASE}/app/bebe`)
  await pageMae.waitForSelector('h1', { timeout: 15000 })

  const texto = await pageMae.locator('body').innerText()
  afirmar(texto.includes('O coração do bebê'), 'o BPM ganha cartão próprio, e não uma célula de tabela')
  afirmar(texto.includes('142'), 'o número aparece na tela')
  afirmar(
    texto.includes('110') && texto.includes('160'),
    'a faixa de normalidade viaja junto com o número',
  )
  afirmar(texto.includes('Como o bebê vem crescendo'), 'a evolução em períodos existe')
  await shot(pageMae, 'bebe-gestacao')

  // O delta é a carga emocional: sem ele, é só uma lista de números.
  afirmar(/desde a semana \d+/.test(texto), 'o cartão mostra a variação desde a primeira medida')

  /* ---- trocar a granularidade muda o agrupamento ---- */
  const cartoes = () => pageMae.locator('[data-periodo]').count()
  const antes = await cartoes()

  await pageMae.locator('button[role="radio"]:has-text("Trimestre")').click()
  await pageMae.waitForTimeout(400)
  const depois = await cartoes()
  afirmar(
    depois < antes && depois > 0,
    `trimestre agrupa o que semana separava (${antes} → ${depois})`,
  )
  await shot(pageMae, 'bebe-trimestre')

  /* ---- e a escolha sobrevive ao reload ---- */
  await pageMae.reload()
  await pageMae.waitForSelector('button[role="radio"]', { timeout: 15000 })
  const selecionado = await pageMae
    .locator('button[role="radio"][aria-checked="true"]')
    .first()
    .innerText()
  afirmar(
    selecionado.trim() === 'Trimestre',
    'a granularidade escolhida sobrevive ao reload',
    `veio "${selecionado.trim()}"`,
  )

  /**
   * O outro lado da mesma regra: a preferência pode ir para o disco justamente
   * por não ser dado de saúde. Se uma medida vazasse junto, a permissão viraria
   * um furo.
   */
  const guardado = await pageMae.evaluate(() =>
    Object.fromEntries(
      Object.keys(localStorage).map((k) => [k, String(localStorage.getItem(k)).slice(0, 400)]),
    ),
  )
  const despejo = JSON.stringify(guardado)
  afirmar(
    !/\b1900\b|\bpfeG\b|\bbcfBpm\b|\b142\b/.test(despejo),
    'nenhuma medida foi parar no localStorage — só a preferência de interface',
    despejo.slice(0, 200),
  )

  /* ---- movimento reduzido continua utilizável ---- */
  await pageMae.emulateMedia({ reducedMotion: 'reduce' })
  await pageMae.reload()
  await pageMae.waitForSelector('button[role="radio"]', { timeout: 15000 })
  await pageMae.locator('button[role="radio"]:has-text("Mês")').click()
  await pageMae.waitForTimeout(200)
  afirmar(
    (await cartoes()) > 0,
    'com prefers-reduced-motion o seletor continua funcionando',
  )
  await pageMae.emulateMedia({ reducedMotion: null })

  /* ---- "ver todos os números" abre numa folha, sem navegar ---- */
  const urlAntes = pageMae.url()
  await pageMae.locator('button:has-text("Ver todos os números")').first().click()
  await pageMae.waitForSelector('[role="dialog"]', { timeout: 15000 })
  afirmar(pageMae.url() === urlAntes, 'a tabela completa abre numa folha, sem sair da página')
  afirmar(
    (await pageMae.locator('[role="dialog"]').innerText()).includes('Semana'),
    'a folha traz a tabela de medidas',
  )
  await shot(pageMae, 'bebe-todos-os-numeros')

  await ctxMae.close()
  await ctxMedica.close()
}

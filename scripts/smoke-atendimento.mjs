/**
 * Cockpit de atendimento: da agenda ao prontuário, num fluxo só.
 *
 * É o caminho que vende o produto — a obstetra clica *Iniciar atendimento*,
 * escreve, finaliza, e a consulta aparece para a família. Se este arquivo passa,
 * o fluxo contínuo existe; se falha, o resto da fase não importa.
 *
 * Verifica também as duas coisas que precisam ser verdade e são invisíveis: que
 * o rascunho NÃO vaza para a família enquanto está sendo escrito, e que o
 * cockpit cabe na tela sem rolagem de página.
 */

/** Publica uma agenda semanal para a médica cujos cookies `request` carrega. */
async function publicarAgenda(request, BASE) {
  const regras = [0, 1, 2, 3, 4, 5, 6].map((diaSemana) => ({
    diaSemana,
    inicio: '00:00',
    fim: '23:59',
    modalidades: ['presencial', 'teleconsulta'],
    local: 'Consultório central',
  }))
  const res = await request.put(`${BASE}/api/disponibilidade/me`, {
    data: {
      ativo: true,
      duracaoPadraoMin: 30,
      antecedenciaMinHoras: 0,
      janelaMaxDias: 60,
      regras,
      atendeParticular: true,
    },
  })
  if (!res.ok()) throw new Error(`publicar agenda falhou: ${await res.text()}`)
}

export async function registrarTestesDeAtendimento({
  navegador,
  BASE,
  DESKTOP,
  secao,
  afirmar,
  registrar,
  conta,
  shot,
}) {
  secao('Atendimento: iniciar, escrever, finalizar')

  const dadosMedica = conta('medico')
  const ctxMedica = await navegador.newContext({ viewport: DESKTOP })
  const ctxMae = await navegador.newContext({ viewport: DESKTOP })
  await registrar(ctxMedica.request, dadosMedica)
  await registrar(ctxMae.request, conta('gestante'))
  await publicarAgenda(ctxMedica.request, BASE)

  // Uma gestação por volta de 30 semanas.
  const dpp = new Date(Date.now() + 70 * 864e5).toISOString()
  await ctxMae.request.put(`${BASE}/api/perfil`, { data: { momento: 'gestante', dpp } })

  // Vincula as duas — sem isso a médica não alcança a jornada.
  const convite = await (await ctxMae.request.post(`${BASE}/api/vinculos/convite`, { data: {} })).json()
  await ctxMedica.request.post(`${BASE}/api/vinculos/aceitar/${convite.token}`, { data: {} })
  const { vinculos } = await (await ctxMedica.request.get(`${BASE}/api/vinculos`)).json()
  const criancaId = vinculos[0]?.crianca
  afirmar(Boolean(criancaId), 'médica vinculada à jornada da paciente')

  /* ---- a lista de pacientes traz o que faz decidir por onde começar ---- */
  const listaRes = await ctxMedica.request.get(`${BASE}/api/vinculos/pacientes`)
  const { pacientes } = await listaRes.json()
  afirmar(listaRes.ok() && pacientes.length > 0, 'GET /vinculos/pacientes lista a paciente')
  afirmar(
    'alertas' in pacientes[0] && 'duvidas' in pacientes[0] && 'proximo' in pacientes[0],
    'a lista traz próximo horário, alertas e dúvidas',
  )

  /* ---- a família marca, a médica confirma ---- */
  const daqui = new Date(Date.now() + 30 * 60 * 1000)
  daqui.setSeconds(0, 0)
  const marcar = await ctxMae.request.post(`${BASE}/api/agendamentos`, {
    data: {
      medicoId: (await (await ctxMedica.request.get(`${BASE}/api/auth/me`)).json()).user.id,
      objetivo: 'consulta-gestante',
      modalidade: 'presencial',
      inicio: daqui.toISOString(),
    },
  })
  afirmar(marcar.ok(), 'família marca um horário real', `status ${marcar.status()}`)
  const { agendamento } = await marcar.json()

  const confirmar = await ctxMedica.request.patch(`${BASE}/api/agendamentos/${agendamento.id}`, {
    data: { status: 'confirmado' },
  })
  afirmar(confirmar.ok(), 'médica confirma o agendamento', `status ${confirmar.status()}`)

  /* ---- "Meu dia" oferece o CTA ---- */
  const pageMedica = await ctxMedica.newPage()
  await pageMedica.goto(`${BASE}/app`)
  await pageMedica.waitForSelector('h1')
  const cta = pageMedica.locator('a:has-text("Iniciar atendimento")').first()
  await cta.waitFor({ state: 'visible', timeout: 15000 })
  afirmar(true, 'Meu dia mostra "Iniciar atendimento" para o horário de hoje')
  await shot(pageMedica, 'meu-dia')

  /* ---- o cockpit abre e é UMA tela ---- */
  await cta.click()
  await pageMedica.waitForURL(/\/app\/atendimento\//, { timeout: 15000 })
  await pageMedica.waitForSelector('textarea', { timeout: 15000 })

  afirmar(
    (await pageMedica.locator('body').innerText()).includes('Atendendo'),
    'o cockpit identifica quem está sendo atendida',
  )

  const semRolagem = await pageMedica.evaluate(
    () => document.documentElement.scrollHeight <= window.innerHeight + 2,
  )
  afirmar(semRolagem, 'o cockpit cabe na tela sem rolagem de página (1280×900)')
  await shot(pageMedica, 'cockpit')

  /* ---- escrever dispara autosave ---- */
  const areas = pageMedica.locator('textarea')
  await areas.nth(0).fill('Refere boa movimentação fetal, sem queixas.')
  await areas.nth(2).fill('Gestação evoluindo bem para a idade gestacional.')
  await pageMedica.waitForSelector('text=/Salvo/', { timeout: 15000 })
  afirmar(true, 'o que foi digitado é salvo sozinho, sem botão')

  /* ---- e o rascunho NÃO vaza para a família ---- */
  const antes = await (await ctxMae.request.get(`${BASE}/api/consultas`)).json()
  afirmar(
    !antes.consultas.some((c) => c.subjetivo?.includes('movimentação fetal')),
    'família NÃO vê o rascunho enquanto a médica escreve',
  )

  /* ---- finalizar fecha o ciclo ---- */
  await pageMedica.locator('button:has-text("Finalizar atendimento")').click()
  await pageMedica.waitForURL((u) => !u.pathname.includes('/atendimento/'), { timeout: 20000 })

  const depois = await (await ctxMae.request.get(`${BASE}/api/consultas`)).json()
  const publicada = depois.consultas.find((c) => c.subjetivo?.includes('movimentação fetal'))
  afirmar(Boolean(publicada), 'depois de finalizada, a família vê a consulta')
  afirmar(publicada?.status === 'finalizada', 'a consulta fica marcada como finalizada')
  afirmar(!('notasPrivadas' in (publicada ?? {})), 'família continua sem receber notas privadas')

  const agenda = await (
    await ctxMedica.request.get(`${BASE}/api/agendamentos?crianca=${criancaId}`)
  ).json()
  const fechado = agenda.agendamentos.find((a) => a.id === agendamento.id)
  afirmar(fechado?.status === 'realizado', 'o agendamento vira "realizado" ao finalizar')

  await ctxMedica.close()
  await ctxMae.close()
}

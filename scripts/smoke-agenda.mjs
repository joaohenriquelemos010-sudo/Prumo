/**
 * Agenda half of the smoke suite: the booking journey end to end, through the
 * real UI. Loaded by scripts/smoke.mjs — see there for how to run it.
 */

/** Publishes a weekly agenda for the doctor whose cookies `ctx` holds. */
async function publicarAgenda(request, BASE) {
  const regras = [0, 1, 2, 3, 4, 5, 6].map((diaSemana) => ({
    diaSemana,
    inicio: '09:00',
    fim: '12:00',
    modalidades: ['presencial', 'teleconsulta'],
    local: 'Consultório central',
  }))
  const res = await request.put(`${BASE}/api/disponibilidade/me`, {
    data: {
      ativo: true,
      duracaoPadraoMin: 30,
      // Every day, starting an hour from now, so the suite always has a slot to
      // click regardless of which day it runs on.
      antecedenciaMinHoras: 1,
      janelaMaxDias: 60,
      regras,
      conveniosAtendidos: ['Unimed'],
      atendeParticular: true,
    },
  })
  if (!res.ok()) throw new Error(`publicar agenda falhou: ${await res.text()}`)
}

export async function registrarTestesDeAgenda({
  navegador,
  BASE,
  MOBILE,
  DESKTOP,
  secao,
  afirmar,
  registrar,
  conta,
  shot,
}) {
  secao('Agendamento: marcar, confirmar, remarcar')

  // --- the doctor opens an agenda -----------------------------------------
  const dadosMedica = conta('medico')
  const ctxMedica = await navegador.newContext({ viewport: DESKTOP })
  const pageMedica = await ctxMedica.newPage()
  await registrar(ctxMedica.request, dadosMedica)
  await publicarAgenda(ctxMedica.request, BASE)
  await pageMedica.goto(`${BASE}/app/agenda`)
  await pageMedica.waitForSelector('h1')
  afirmar(
    (await pageMedica.locator('h1').innerText()).toLowerCase().includes('agenda'),
    'médica vê a própria agenda em /app/agenda',
  )

  // --- the family books a real slot ---------------------------------------
  const ctxMae = await navegador.newContext({ viewport: MOBILE })
  const pageMae = await ctxMae.newPage()
  await registrar(ctxMae.request, conta('gestante'))

  await pageMae.goto(`${BASE}/app/profissionais?objetivo=consulta-gestante`)
  // Target OUR doctor by name — the database keeps earlier runs, so "the first
  // result" would be somebody else's.
  const cartao = pageMae.locator('li').filter({ hasText: dadosMedica.nome })
  await cartao.first().waitFor({ state: 'visible', timeout: 20000 })
  afirmar(
    await cartao.first().locator('text=Agenda online').isVisible(),
    'médica com agenda aparece na busca com selo "Agenda online"',
  )

  await cartao.first().locator('button:has-text("Escolher horário")').click()
  await pageMae.waitForSelector('[role="grid"]', { timeout: 15000 })

  // Pick the first free time the calendar offers.
  const chip = pageMae.locator('[role="radio"]').first()
  await chip.waitFor({ state: 'visible', timeout: 15000 })
  const horaEscolhida = (await chip.innerText()).trim()
  await chip.click()
  await shot(pageMae, 'agendar-quando')

  await pageMae.locator('button:has-text("Escolher como")').click()
  await pageMae.waitForSelector('#convenio')
  await pageMae.locator('button:has-text("Revisar")').click()
  await pageMae.waitForSelector('text=Confere se está tudo certo')
  await shot(pageMae, 'agendar-confirmar')

  await pageMae.locator('button:has-text("Marcar consulta")').click()
  await pageMae.waitForURL(/\/app\/agenda/, { timeout: 15000 })
  await pageMae.waitForSelector('text=Aguardando confirmação', { timeout: 15000 })
  afirmar(true, `família marcou ${horaEscolhida} e caiu na Agenda com status pendente`)
  await shot(pageMae, 'agenda-paciente')

  // --- the doctor confirms -------------------------------------------------
  await pageMedica.goto(`${BASE}/app/agenda`)
  await pageMedica.locator('button:has-text("Pedidos")').click()
  await pageMedica.waitForSelector('button:has-text("Confirmar")', { timeout: 20000 })
  await shot(pageMedica, 'agenda-medica-pedidos')
  await pageMedica.locator('button:has-text("Confirmar")').first().click()

  // Confirming empties the queue — the appointment now belongs to "Próximos".
  await pageMedica
    .locator('text=Nenhum pedido esperando')
    .waitFor({ state: 'visible', timeout: 15000 })
  afirmar(true, 'confirmar tira o pedido da fila da médica')

  await pageMedica.locator('button:has-text("Próximos")').click()
  await pageMedica.waitForSelector('text=Confirmado', { timeout: 15000 })
  afirmar(true, 'a consulta confirmada aparece nos próximos da médica')
  await shot(pageMedica, 'agenda-medica-proximos')

  // --- and the family sees it ---------------------------------------------
  await pageMae.reload()
  await pageMae.waitForSelector('text=Confirmado', { timeout: 15000 })
  afirmar(true, 'família vê a confirmação e o botão de calendário')
  afirmar(
    await pageMae.locator('button:has-text("Adicionar ao calendário")').isVisible(),
    'agendamento confirmado oferece exportar .ics',
  )

  // --- the patient may not confirm on the doctor's behalf ------------------
  const lista = await ctxMae.request.get(`${BASE}/api/agendamentos`)
  const { agendamentos } = await lista.json()
  const alvo = agendamentos[0]
  const tentativa = await ctxMae.request.patch(`${BASE}/api/agendamentos/${alvo.id}`, {
    data: { status: 'realizado' },
  })
  afirmar(tentativa.status() === 403, 'paciente não fecha a consulta por conta própria', `status ${tentativa.status()}`)

  // --- double booking is refused ------------------------------------------
  const duplicado = await ctxMae.request.post(`${BASE}/api/agendamentos`, {
    data: {
      medicoId: alvo.medicoId,
      objetivo: 'consulta-gestante',
      modalidade: 'presencial',
      inicio: alvo.inicio,
    },
  })
  afirmar(duplicado.status() === 409, 'horário já tomado responde 409', `status ${duplicado.status()}`)

  await ctxMae.close()
  await ctxMedica.close()
}

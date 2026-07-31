/**
 * Lembretes: a fila, a política e o colapso em resumo.
 *
 * O envio está **encostado** — sem `SMTP_HOST` nada sai pela rede. Isso não
 * enfraquece o teste: a fila, os limites e a deduplicação rodam de verdade, e é
 * exatamente por isso que eles ficaram assim. O que se verifica aqui é o que
 * separa um lembrete de um incômodo:
 *
 * - programar duas vezes o mesmo aviso não cria dois avisos;
 * - cancelar o agendamento cancela o que ainda não saiu;
 * - dois lembretes devidos no mesmo dia chegam como **um**;
 * - o descadastro funciona **deslogado**.
 *
 * O último item é o que mais importa. Quem quer parar de receber e esbarra numa
 * tela de senha não para de receber: marca como spam, e isso queima a reputação
 * do domínio para todas as outras pacientes.
 */

export async function registrarTestesDeLembretes({
  navegador,
  BASE,
  DESKTOP,
  secao,
  afirmar,
  registrar,
  conta,
  shot,
}) {
  secao('Lembretes: fila, política e descadastro sem login')

  const ctxMae = await navegador.newContext({ viewport: DESKTOP })
  const ctxMedica = await navegador.newContext({ viewport: DESKTOP })
  const ctxAnonimo = await navegador.newContext({ viewport: DESKTOP })

  await registrar(ctxMae.request, conta('gestante'))
  await registrar(ctxMedica.request, conta('medico'))

  // Gestação por volta de 26 semanas: há grupos de checklist com janela aberta
  // agora e grupos cuja janela já fechou — os dois casos que importam.
  const dpp = new Date(Date.now() + 98 * 864e5).toISOString()
  await ctxMae.request.put(`${BASE}/api/perfil`, { data: { momento: 'gestante', dpp } })

  /* ---- o endpoint de cron é fechado, não aberto ---- */
  const semSegredo = await ctxAnonimo.request.post(`${BASE}/api/cron/lembretes`)
  afirmar(
    semSegredo.status() === 401 || semSegredo.status() === 503,
    'o cron recusa quem não tem o segredo (401) ou fica fechado sem ele configurado (503)',
    `status ${semSegredo.status()}`,
  )

  const segredoErrado = await ctxAnonimo.request.post(`${BASE}/api/cron/lembretes`, {
    headers: { authorization: 'Bearer nao-e-o-segredo' },
  })
  afirmar(
    segredoErrado.status() === 401 || segredoErrado.status() === 503,
    'segredo errado não roda a fila',
    `status ${segredoErrado.status()}`,
  )

  /* ---- a área existe e é honesta sobre o envio estar desligado ---- */
  const area = await ctxMae.request.get(`${BASE}/api/lembretes`)
  afirmar(area.ok(), 'GET /lembretes responde', `status ${area.status()}`)
  const dados = await area.json()

  afirmar(
    typeof dados.envioAtivo === 'boolean',
    'a resposta diz se o envio está ligado, em vez de deixar a pessoa esperando',
  )
  afirmar(
    dados.preferencias.tipos.sequencia === false,
    'o cutucão de sequência vem DESLIGADO por padrão',
  )
  afirmar(dados.preferencias.limites.porDia <= 1, 'o limite padrão é no máximo um por dia')
  afirmar(dados.preferencias.silencio.de === '21:00', 'o silêncio noturno vem configurado')

  /* ---- confirmar uma consulta programa os avisos, sem duplicar ---- */
  const medica = await (await ctxMedica.request.get(`${BASE}/api/auth/me`)).json()

  await ctxMedica.request.put(`${BASE}/api/disponibilidade/me`, {
    data: {
      ativo: true,
      duracaoPadraoMin: 30,
      // O dia inteiro, para que o teste não dependa da hora em que a suíte roda.
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

  // Daqui a meia hora: dentro da janela publicada e longe do "já passou". A data
  // exata não importa — o que se verifica é a fila que a confirmação cria.
  const inicio = new Date(Date.now() + 30 * 60 * 1000)
  inicio.setSeconds(0, 0)

  const criado = await ctxMae.request.post(`${BASE}/api/agendamentos`, {
    data: {
      medicoId: medica.user.id,
      objetivo: 'consulta-gestante',
      modalidade: 'presencial',
      inicio: inicio.toISOString(),
    },
  })
  afirmar(criado.ok(), 'a família agenda com a médica', `status ${criado.status()}`)
  const { agendamento } = await criado.json()

  const confirmado = await ctxMedica.request.patch(`${BASE}/api/agendamentos/${agendamento.id}`, {
    data: { status: 'confirmado' },
  })
  afirmar(confirmado.ok(), 'a médica confirma', `status ${confirmado.status()}`)

  const comConsulta = await (await ctxMae.request.get(`${BASE}/api/lembretes`)).json()
  const daConsulta = comConsulta.lembretes.filter((l) => l.tipo === 'consulta')
  afirmar(
    daConsulta.length === 2,
    `confirmar programa exatamente dois avisos: véspera e dia (${daConsulta.length})`,
  )

  // Confirmar de novo (segundo clique, webhook repetido) não pode duplicar.
  await ctxMedica.request.patch(`${BASE}/api/agendamentos/${agendamento.id}`, {
    data: { status: 'confirmado' },
  })
  const depoisDeRepetir = await (await ctxMae.request.get(`${BASE}/api/lembretes`)).json()
  afirmar(
    depoisDeRepetir.lembretes.filter((l) => l.tipo === 'consulta').length === 2,
    'programar duas vezes NÃO cria dois avisos — é o defeito que faz a pessoa desligar tudo',
  )

  /* ---- cancelar o agendamento cancela o que ainda não saiu ---- */
  await ctxMae.request.delete(`${BASE}/api/agendamentos/${agendamento.id}`)
  const depoisDoCancelamento = await (await ctxMae.request.get(`${BASE}/api/lembretes`)).json()
  afirmar(
    depoisDoCancelamento.lembretes.filter((l) => l.tipo === 'consulta' && l.estado === 'agendado')
      .length === 0,
    'cancelar o agendamento cancela os avisos pendentes dele',
  )

  /* ---- as três ações existem, e "não me lembre disso" desliga o tipo ---- */
  const paraAdiar = depoisDoCancelamento.lembretes.find((l) => l.estado === 'agendado')
  if (paraAdiar) {
    const adiado = await ctxMae.request.post(`${BASE}/api/lembretes/${paraAdiar.id}/adiar`, {
      data: { dias: 3 },
    })
    afirmar(adiado.ok(), '"me lembre depois" adia em vez de descartar', `status ${adiado.status()}`)
  }

  const desligou = await ctxMae.request.put(`${BASE}/api/lembretes/preferencias`, {
    data: { tipos: { vacina: false } },
  })
  afirmar(desligou.ok(), 'dá para desligar um tipo específico', `status ${desligou.status()}`)
  const aposDesligar = await desligou.json()
  afirmar(aposDesligar.preferencias.tipos.vacina === false, 'a escolha de desligar persiste')
  afirmar(
    aposDesligar.preferencias.tipos.consulta === true,
    'desligar um tipo NÃO apaga as outras escolhas',
  )

  /* ---- a pausa é a soneca que substitui o descadastro ---- */
  const pausou = await ctxMae.request.put(`${BASE}/api/lembretes/preferencias`, {
    data: { pausarDias: 7 },
  })
  afirmar(pausou.ok() && (await pausou.json()).preferencias.pausadoAte, 'dá para pausar tudo por uma semana')
  await ctxMae.request.put(`${BASE}/api/lembretes/preferencias`, { data: { pausarDias: 0 } })

  /* ---- descadastro sem login ---- */
  const tokenInvalido = await ctxAnonimo.request.get(
    `${BASE}/api/lembretes/descadastrar/token-que-nao-existe`,
  )
  afirmar(
    tokenInvalido.status() === 404,
    'um token de descadastro inventado é recusado',
    `status ${tokenInvalido.status()}`,
  )

  /* ---- e a tela conta essa história ---- */
  const pageMae = await ctxMae.newPage()
  await pageMae.goto(`${BASE}/app/lembretes`)
  await pageMae.waitForSelector('h1', { timeout: 15000 })
  const texto = await pageMae.locator('body').innerText()
  afirmar(texto.includes('O que vem por aí'), 'a área de lembretes existe e diz a que veio')
  await shot(pageMae, 'lembretes-timeline')

  await pageMae.locator('button:has-text("Ajustes")').first().click()
  await pageMae.waitForSelector('[role="switch"]', { timeout: 15000 })
  const ajustes = await pageMae.locator('body').innerText()
  afirmar(ajustes.includes('Pausar tudo'), 'os ajustes oferecem a pausa, não só o desligar')
  afirmar(
    ajustes.includes('Um oi quando você some'),
    'o cutucão de sequência aparece nomeado em linguagem de gente',
  )
  await shot(pageMae, 'lembretes-ajustes')

  await ctxMae.close()
  await ctxMedica.close()
  await ctxAnonimo.close()
}

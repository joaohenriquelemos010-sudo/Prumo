/**
 * Teleconsulta — a sala, e quem pode entrar nela.
 *
 * O que **não** dá para verificar aqui é a mídia: o vídeo é ponto a ponto entre
 * dois navegadores, e um teste headless não estabelece uma conexão WebRTC real
 * de forma confiável. Isso é checagem manual, em dois aparelhos.
 *
 * O que dá — e é o que mais importa — é o **controle de acesso**. A sala é
 * identificada pelo id do agendamento, que não é segredo: sem a checagem de
 * participante, conhecer o id seria suficiente para entrar na consulta de outra
 * pessoa. É o pior defeito possível num produto de saúde, e é exatamente o tipo
 * que passa despercebido porque a tela funciona.
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
        modalidades: ['presencial', 'teleconsulta'],
        local: 'Consultório central',
      })),
      atendeParticular: true,
    },
  })
  if (!res.ok()) throw new Error(`publicar agenda falhou: ${await res.text()}`)
}

export async function registrarTestesDeTeleconsulta({
  navegador,
  BASE,
  DESKTOP,
  secao,
  afirmar,
  registrar,
  conta,
}) {
  secao('Teleconsulta: a sala, e quem entra nela')

  const ctxMae = await navegador.newContext({ viewport: DESKTOP })
  const ctxMedica = await navegador.newContext({ viewport: DESKTOP })
  const ctxIntrusa = await navegador.newContext({ viewport: DESKTOP })

  await registrar(ctxMae.request, conta('gestante'))
  await registrar(ctxMedica.request, conta('medico'))
  await registrar(ctxIntrusa.request, conta('gestante'))
  await publicarAgenda(ctxMedica.request, BASE)

  const medica = await (await ctxMedica.request.get(`${BASE}/api/auth/me`)).json()

  /* ---- uma teleconsulta daqui a pouco ---- */
  const inicio = new Date(Date.now() + 5 * 60 * 1000)
  inicio.setSeconds(0, 0)

  const criado = await ctxMae.request.post(`${BASE}/api/agendamentos`, {
    data: {
      medicoId: medica.user.id,
      objetivo: 'consulta-gestante',
      modalidade: 'teleconsulta',
      inicio: inicio.toISOString(),
    },
  })
  afirmar(criado.ok(), 'a família marca uma teleconsulta', `status ${criado.status()}`)
  const { agendamento } = await criado.json()

  /* ---- sem confirmar, a sala não abre ---- */
  const semConfirmar = await ctxMae.request.post(
    `${BASE}/api/teleconsulta/${agendamento.id}/entrar`,
  )
  afirmar(
    semConfirmar.status() === 409,
    'a sala não abre antes de a consulta ser confirmada',
    `status ${semConfirmar.status()}`,
  )

  await ctxMedica.request.patch(`${BASE}/api/agendamentos/${agendamento.id}`, {
    data: { status: 'confirmado' },
  })

  /* ---- os dois participantes entram ---- */
  const entradaMae = await ctxMae.request.post(`${BASE}/api/teleconsulta/${agendamento.id}/entrar`)
  afirmar(entradaMae.ok(), 'a paciente entra na sala', `status ${entradaMae.status()}`)
  const salaMae = await entradaMae.json()

  const entradaMedica = await ctxMedica.request.post(
    `${BASE}/api/teleconsulta/${agendamento.id}/entrar`,
  )
  afirmar(entradaMedica.ok(), 'a médica entra na sala', `status ${entradaMedica.status()}`)
  const salaMedica = await entradaMedica.json()

  /**
   * A regra que evita o *glare*: os dois lados ofertando ao mesmo tempo faz as
   * ofertas colidirem e a negociação reiniciar em loop.
   */
  afirmar(
    salaMedica.iniciador === true && salaMae.iniciador === false,
    'exatamente um lado é o iniciador, e é sempre a médica',
  )
  afirmar(salaMae.outro === medica.user.id, 'cada lado sabe com quem vai falar')

  /* ---- a configuração de ICE não vaza credencial para o bundle ---- */
  afirmar(
    Array.isArray(salaMae.iceServers) && salaMae.iceServers.length > 0,
    'a sala devolve servidores ICE',
  )
  afirmar(
    JSON.stringify(salaMae.iceServers).includes('stun:'),
    'STUN público por padrão — o caminho gratuito',
  )

  /* ---- ⚠️ a checagem que importa: um estranho NÃO entra ---- */
  const intrusa = await ctxIntrusa.request.post(
    `${BASE}/api/teleconsulta/${agendamento.id}/entrar`,
  )
  afirmar(
    intrusa.status() === 403,
    'quem não é participante NÃO entra, mesmo sabendo o id da consulta',
    `status ${intrusa.status()}`,
  )

  const intrusaEspiando = await ctxIntrusa.request.get(
    `${BASE}/api/teleconsulta/${agendamento.id}/sinais`,
  )
  afirmar(
    intrusaEspiando.status() === 403,
    'quem não é participante também não lê os sinais da sala',
    `status ${intrusaEspiando.status()}`,
  )

  /* ---- a sinalização entrega para o outro, e só uma vez ---- */
  const mandou = await ctxMedica.request.post(`${BASE}/api/teleconsulta/${agendamento.id}/sinal`, {
    data: { tipo: 'oferta', carga: { type: 'offer', sdp: 'v=0\r\no=- 0 0 IN IP4 127.0.0.1\r\n' } },
  })
  afirmar(mandou.status() === 201, 'a médica deixa a oferta', `status ${mandou.status()}`)

  const recebeu = await (
    await ctxMae.request.get(`${BASE}/api/teleconsulta/${agendamento.id}/sinais`)
  ).json()
  afirmar(recebeu.sinais.length === 1, 'a paciente recebe a oferta')
  afirmar(recebeu.sinais[0].tipo === 'oferta', 'e recebe o tipo certo')

  /**
   * Consumir apaga. Um candidato ICE entregue duas vezes faz a negociação
   * reiniciar, e um `tchau` reentregue derruba a chamada seguinte.
   */
  const denovo = await (
    await ctxMae.request.get(`${BASE}/api/teleconsulta/${agendamento.id}/sinais`)
  ).json()
  afirmar(denovo.sinais.length === 0, 'o sinal não é entregue duas vezes')

  /* ---- quem mandou não recebe o próprio sinal ---- */
  await ctxMae.request.post(`${BASE}/api/teleconsulta/${agendamento.id}/sinal`, {
    data: { tipo: 'candidato', carga: { candidate: 'candidate:1 1 udp 1 10.0.0.1 1 typ host' } },
  })
  const eco = await (
    await ctxMae.request.get(`${BASE}/api/teleconsulta/${agendamento.id}/sinais`)
  ).json()
  afirmar(eco.sinais.length === 0, 'quem manda não recebe o próprio sinal de volta')

  /* ---- um sinal gigante é recusado ---- */
  const gigante = await ctxMedica.request.post(
    `${BASE}/api/teleconsulta/${agendamento.id}/sinal`,
    { data: { tipo: 'candidato', carga: { lixo: 'x'.repeat(20000) } } },
  )
  afirmar(
    gigante.status() === 400,
    'um sinal grande demais é recusado — sem teto, é um jeito barato de encher o banco',
    `status ${gigante.status()}`,
  )

  /* ---- sair avisa o outro lado ---- */
  await ctxMedica.request.post(`${BASE}/api/teleconsulta/${agendamento.id}/sair`)
  const tchau = await (
    await ctxMae.request.get(`${BASE}/api/teleconsulta/${agendamento.id}/sinais`)
  ).json()
  afirmar(
    tchau.sinais.some((s) => s.tipo === 'tchau'),
    'sair avisa o outro lado — sem isso ele fica olhando uma tela congelada',
  )

  /* ---- consulta presencial não tem sala ---- */
  const presencialInicio = new Date(Date.now() + 40 * 60 * 1000)
  presencialInicio.setSeconds(0, 0)
  const presencial = await ctxMae.request.post(`${BASE}/api/agendamentos`, {
    data: {
      medicoId: medica.user.id,
      objetivo: 'consulta-gestante',
      modalidade: 'presencial',
      inicio: presencialInicio.toISOString(),
    },
  })
  const { agendamento: pres } = await presencial.json()
  const semSala = await ctxMae.request.post(`${BASE}/api/teleconsulta/${pres.id}/entrar`)
  afirmar(
    semSala.status() === 409,
    'uma consulta presencial não tem sala de vídeo',
    `status ${semSala.status()}`,
  )

  /* ---- e a tela existe ---- */
  const page = await ctxMae.newPage()
  await page.goto(`${BASE}/app/teleconsulta/${agendamento.id}`)
  await page.waitForSelector('button, a', { timeout: 15000 })
  const texto = await page.locator('body').innerText()
  afirmar(
    texto.includes('não é gravada') || texto.includes('direto de um aparelho'),
    'a tela diz que a conversa não passa pelos servidores do Prumo',
  )

  await ctxMae.close()
  await ctxMedica.close()
  await ctxIntrusa.close()
}

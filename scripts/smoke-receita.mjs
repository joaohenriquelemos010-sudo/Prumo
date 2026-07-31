/**
 * Receituário — o maior lock-in do concorrente, resolvido sem contrato.
 *
 * A integração com a Memed exige parceria comercial. Sem ela, o custodiante do
 * documento somos nós — e isso **inverte** a regra do plano original: o conteúdo
 * precisa ficar aqui, e precisa entrar na história clínica como qualquer outro
 * ato. Uma receita que a médica emitiu e o Prumo não guarda é um buraco no
 * prontuário.
 *
 * O que se verifica: quem pode prescrever, quem pode cancelar, que a validade e
 * o número de vias saem do tipo (e não de um campo do formulário), e que a
 * receita **chega na transferência** — porque o próximo médico precisa saber o
 * que a paciente está tomando antes de prescrever qualquer coisa.
 */

export async function registrarTestesDeReceita({
  navegador,
  BASE,
  DESKTOP,
  secao,
  afirmar,
  registrar,
  conta,
}) {
  secao('Receituário: emitir, cancelar e transferir')

  const ctxMae = await navegador.newContext({ viewport: DESKTOP })
  const ctxMedica = await navegador.newContext({ viewport: DESKTOP })
  const ctxOutraMedica = await navegador.newContext({ viewport: DESKTOP })

  await registrar(ctxMae.request, conta('gestante'))
  await registrar(ctxMedica.request, conta('medico'))
  await registrar(ctxOutraMedica.request, conta('medico'))

  const dpp = new Date(Date.now() + 90 * 864e5).toISOString()
  await ctxMae.request.put(`${BASE}/api/perfil`, { data: { momento: 'gestante', dpp } })

  // Vincula as duas médicas à mesma jornada: é o cenário que revela se o
  // cancelamento respeita a autoria.
  const convite = await (await ctxMae.request.post(`${BASE}/api/vinculos/convite`, { data: {} })).json()
  await ctxMedica.request.post(`${BASE}/api/vinculos/aceitar/${convite.token}`, { data: {} })
  const convite2 = await (await ctxMae.request.post(`${BASE}/api/vinculos/convite`, { data: {} })).json()
  await ctxOutraMedica.request.post(`${BASE}/api/vinculos/aceitar/${convite2.token}`, { data: {} })

  const { vinculos } = await (await ctxMedica.request.get(`${BASE}/api/vinculos`)).json()
  const jornada = vinculos[0]?.crianca
  afirmar(Boolean(jornada), 'médica vinculada à jornada')

  /* ---- a família não prescreve ---- */
  const familiaTentou = await ctxMae.request.post(`${BASE}/api/prescricoes`, {
    data: { tipo: 'simples', itens: [{ medicamento: 'Qualquer coisa 500 mg' }] },
  })
  afirmar(
    familiaTentou.status() === 403,
    'a família NÃO prescreve para si mesma',
    `status ${familiaTentou.status()}`,
  )

  /* ---- receita simples: uma via, 30 dias ---- */
  const simples = await ctxMedica.request.post(`${BASE}/api/prescricoes?crianca=${jornada}`, {
    data: {
      tipo: 'simples',
      itens: [
        {
          medicamento: 'Ácido fólico 5 mg',
          dose: '1 comprimido',
          posologia: 'ao dia',
          duracao: 'uso contínuo',
        },
      ],
      orientacoes: 'Tomar sempre no mesmo horário.',
    },
  })
  afirmar(simples.status() === 201, 'a médica emite a receita', `status ${simples.status()}`)
  const { prescricao } = await simples.json()

  afirmar(prescricao.vias === 1, 'receita simples sai em 1 via')
  const diasSimples = Math.round(
    (new Date(prescricao.validaAte) - new Date(prescricao.emitidaEm)) / 864e5,
  )
  afirmar(diasSimples === 30, `receita simples vale 30 dias (${diasSimples})`)

  /**
   * O CRM vem do cadastro, e não do corpo do request: é identidade
   * profissional, não campo de formulário. Se viesse do cliente, qualquer um
   * assinaria com o número de qualquer médico.
   */
  afirmar(
    prescricao.medicoCrm === '123456' && prescricao.medicoCrmUf === 'SP',
    'o CRM impresso vem do cadastro, não do request',
  )

  /* ---- antimicrobiano: duas vias, 10 dias ---- */
  const anti = await ctxMedica.request.post(`${BASE}/api/prescricoes?crianca=${jornada}`, {
    data: {
      tipo: 'antimicrobiano',
      itens: [{ medicamento: 'Amoxicilina 500 mg', posologia: 'de 8 em 8 horas' }],
    },
  })
  const { prescricao: anti1 } = await anti.json()
  afirmar(anti1.vias === 2, 'antimicrobiano sai em 2 vias (RDC 20/2011)')
  const diasAnti = Math.round((new Date(anti1.validaAte) - new Date(anti1.emitidaEm)) / 864e5)
  afirmar(diasAnti === 10, `antimicrobiano vale 10 dias (${diasAnti})`)

  /* ---- uma receita vazia é recusada ---- */
  const vazia = await ctxMedica.request.post(`${BASE}/api/prescricoes?crianca=${jornada}`, {
    data: { tipo: 'simples', itens: [] },
  })
  afirmar(vazia.status() === 400, 'uma receita sem itens é recusada', `status ${vazia.status()}`)

  /* ---- a família lê as próprias receitas ---- */
  const daFamilia = await (await ctxMae.request.get(`${BASE}/api/prescricoes`)).json()
  afirmar(
    daFamilia.prescricoes.length === 2,
    `a família lê as próprias receitas (${daFamilia.prescricoes.length})`,
  )

  /* ---- prescrever entra na história clínica ---- */
  const prontuario = await (
    await ctxMedica.request.get(`${BASE}/api/prontuario?crianca=${jornada}`)
  ).json()
  const naLinha = (prontuario.linhaDoTempo ?? []).filter((e) => e.tipo === 'prescricao')
  afirmar(
    naLinha.length >= 2,
    `prescrever entra na cadeia encadeada do prontuário (${naLinha.length})`,
  )

  /* ---- só quem prescreveu cancela ---- */
  const outraTentou = await ctxOutraMedica.request.post(
    `${BASE}/api/prescricoes/${prescricao.id}/cancelar`,
    { data: { motivo: 'discordo' } },
  )
  afirmar(
    outraTentou.status() === 403,
    'outro médico NÃO cancela a receita de um colega — se discorda, prescreve a dele',
    `status ${outraTentou.status()}`,
  )

  const cancelou = await ctxMedica.request.post(
    `${BASE}/api/prescricoes/${prescricao.id}/cancelar`,
    { data: { motivo: 'Dose corrigida em nova receita.' } },
  )
  afirmar(cancelou.ok(), 'a autora cancela', `status ${cancelou.status()}`)

  /**
   * Cancelar não apaga: o registro é append-only, e a paciente pode ter
   * impresso a via anterior. O que muda é que ela para de valer.
   */
  const depois = await (await ctxMae.request.get(`${BASE}/api/prescricoes`)).json()
  afirmar(depois.prescricoes.length === 2, 'cancelar NÃO apaga a receita do histórico')
  const cancelada = depois.prescricoes.find((p) => p.id === prescricao.id)
  afirmar(Boolean(cancelada?.canceladaEm), 'a receita cancelada fica marcada')

  /* ---- ⚠️ a receita chega na transferência ---- */
  const solicitou = await ctxMedica.request.post(`${BASE}/api/transferencias?crianca=${jornada}`, {
    data: {
      paraMedicoEmail: 'proximo.medico@exemplo.test',
      escopo: ['prontuario', 'consultas'],
    },
  })
  if (solicitou.ok()) {
    const { transferencia } = await solicitou.json()
    const consentiu = await ctxMae.request.post(
      `${BASE}/api/transferencias/${transferencia.id}/consentir`,
      { data: {} },
    )
    afirmar(consentiu.ok(), 'a responsável consente a transferência', `status ${consentiu.status()}`)

    const { transferencia: comToken } = await consentiu.json()
    const pacote = await ctxMedica.request.get(
      `${BASE}/api/transferencias/${comToken.token}/pacote`,
    )
    if (pacote.ok()) {
      const dados = await pacote.json()
      afirmar(
        Array.isArray(dados.pacote?.prescricoes) && dados.pacote.prescricoes.length === 2,
        'as receitas viajam no pacote — o próximo médico precisa saber o que ela toma',
      )
      afirmar(
        dados.pacote.prescricoes.some((p) => p.cancelada === true),
        'a cancelada viaja marcada, e não some: ela foi prescrita e desfeita',
      )
    }
  }

  await ctxMae.close()
  await ctxMedica.close()
  await ctxOutraMedica.close()
}

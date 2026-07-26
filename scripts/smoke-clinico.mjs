/**
 * Clinical half of the smoke suite: the visibility split and the pattern check.
 *
 * These two are the ones worth a test in a health product — a leak here means a
 * mother reads a finding written for a colleague, and a missed alert means a
 * drifting growth curve goes unnoticed.
 */

export async function registrarTestesClinicos({ navegador, BASE, DESKTOP, secao, afirmar, registrar, conta }) {
  secao('Clínico: verificação de padrões e o que a família vê')

  const ctxMedica = await navegador.newContext({ viewport: DESKTOP })
  const ctxMae = await navegador.newContext({ viewport: DESKTOP })
  await registrar(ctxMedica.request, conta('medico'))
  await registrar(ctxMae.request, conta('gestante'))

  // A pregnancy around 30 weeks.
  const dpp = new Date(Date.now() + 70 * 864e5).toISOString()
  await ctxMae.request.put(`${BASE}/api/perfil`, { data: { momento: 'gestante', dpp } })

  // Link them, so the doctor can reach the journey at all.
  const convite = await (await ctxMae.request.post(`${BASE}/api/vinculos/convite`, { data: {} })).json()
  await ctxMedica.request.post(`${BASE}/api/vinculos/aceitar/${convite.token}`, { data: {} })
  const { vinculos } = await (await ctxMedica.request.get(`${BASE}/api/vinculos`)).json()
  const criancaId = vinculos[0]?.crianca
  afirmar(Boolean(criancaId), 'médica vinculada à jornada da paciente')

  /* ---- a measurement well below the band must raise an alert ---- */
  const resposta = await ctxMedica.request.put(`${BASE}/api/bebe/medidas?crianca=${criancaId}`, {
    data: {
      semana: 30,
      pfeG: 1100, // P50 at 30 weeks is ~1559 g — this sits under P3
      ccMm: 270,
      caMm: 240,
      cfMm: 55,
      ilaCm: 10,
      observacao: 'Bebê ativo, líquido normal.',
      notasPrivadas: 'Investigar RCIU — repetir Doppler em 1 semana.',
    },
  })
  afirmar(resposta.ok(), 'obstetra registra a biometria da semana', `status ${resposta.status()}`)

  const visaoMedica = await (await ctxMedica.request.get(`${BASE}/api/bebe?crianca=${criancaId}`)).json()
  afirmar(
    visaoMedica.alertas.length > 0,
    `medida abaixo da faixa gera alerta (${visaoMedica.alertas.length})`,
  )
  afirmar(
    visaoMedica.alertas.some((a) => a.condutaSugerida && a.fonte),
    'alerta traz conduta sugerida e fonte',
  )
  afirmar(
    visaoMedica.medidas[0]?.notasPrivadas?.includes('RCIU'),
    'equipe lê as notas privadas',
  )
  afirmar(
    visaoMedica.medidas[0]?.percentis?.pfeG != null,
    'equipe lê os percentis calculados',
  )

  /* ---- and the family must NOT see any of the frightening parts ---- */
  const visaoFamilia = await (await ctxMae.request.get(`${BASE}/api/bebe`)).json()
  const medidaFamilia = visaoFamilia.medidas[0] ?? {}

  afirmar(!('notasPrivadas' in medidaFamilia), 'família NÃO recebe as notas privadas')
  afirmar(!('percentis' in medidaFamilia), 'família NÃO recebe os percentis brutos')
  afirmar(
    medidaFamilia.pfeG === 1100,
    'família recebe o peso estimado — o dado é dela',
  )
  afirmar(
    visaoFamilia.alertas.every((a) => !a.condutaSugerida),
    'família não recebe conduta clínica nos alertas',
  )

  /* ---- the consultation split, same rule ---- */
  const consulta = await ctxMedica.request.post(`${BASE}/api/consultas?crianca=${criancaId}`, {
    data: {
      tipo: 'pre-natal',
      subjetivo: 'Refere boa movimentação fetal.',
      objetivo: 'PA 120x80, AU 28 cm, BCF 142.',
      avaliacao: 'Suspeita de restrição de crescimento a esclarecer.',
      avaliacaoPrivada: true,
      plano: 'Retorno em 7 dias com Doppler.',
      notasPrivadas: 'Se confirmar, discutir antecipação do parto.',
      igSemanas: 30,
      igDias: 2,
      medidas: { pesoKg: 68.4, paSistolica: 120, paDiastolica: 80, alturaUterinaCm: 28, bcfBpm: 142 },
      checklist: [{ id: 'bcf', feito: true }],
    },
  })
  afirmar(consulta.ok(), 'médica registra consulta de pré-natal', `status ${consulta.status()}`)

  const consultasFamilia = await (await ctxMae.request.get(`${BASE}/api/consultas`)).json()
  const c = consultasFamilia.consultas[0] ?? {}
  afirmar(c.avaliacao === '', 'avaliação marcada como privada não chega à família')
  afirmar(c.avaliacaoOculta === true, 'a família sabe QUE existe uma avaliação, sem ler o conteúdo')
  afirmar(!('notasPrivadas' in c), 'notas da equipe não chegam à família')
  afirmar(
    c.plano?.includes('Doppler'),
    'o plano — o que ela precisa fazer — chega normalmente',
  )

  const consultasMedica = await (
    await ctxMedica.request.get(`${BASE}/api/consultas?crianca=${criancaId}`)
  ).json()
  const cm = consultasMedica.consultas[0] ?? {}
  afirmar(cm.avaliacao?.includes('restrição'), 'a equipe lê a avaliação completa')
  afirmar(cm.notasPrivadas?.includes('antecipação'), 'a equipe lê suas próprias notas')

  /* ---- the handoff: obstetrics → paediatrics ---- */
  const nascimento = await ctxMedica.request.put(`${BASE}/api/prontuario/nascimento?crianca=${criancaId}`, {
    data: {
      dataNascimento: new Date().toISOString(),
      igAoNascerSemanas: 39,
      igAoNascerDias: 2,
      tipoParto: 'vaginal',
      apgar1: 9,
      apgar5: 10,
      pesoNascimentoG: 3240,
      comprimentoNascimentoCm: 49,
      pcNascimentoCm: 34,
      sorologiasMaternas: 'HIV, sífilis e hepatite B não reagentes.',
      gbs: 'negativo',
      aleitamento: 'Exclusivo',
      triagens: [
        { id: 'pezinho', feito: true },
        { id: 'orelhinha', feito: true },
        { id: 'coracaozinho', feito: true },
      ],
    },
  })
  afirmar(nascimento.ok(), 'obstetra registra o nascimento', `status ${nascimento.status()}`)

  const { prontuario } = await nascimento.json()
  afirmar(prontuario.resumoNascimento?.pesoNascimentoG === 3240, 'resumo de nascimento fica gravado')
  afirmar(
    prontuario.eventos.some((e) => e.texto.includes('Nascimento registrado')),
    'a virada aparece na linha do tempo do prontuário',
  )

  // Flipping the journey is what starts the vaccine calendar and puericultura.
  const { perfil } = await (await ctxMae.request.get(`${BASE}/api/perfil`)).json()
  afirmar(perfil.momento === 'ja-nasceu', 'a jornada vira para "já nasceu"')
  afirmar(Boolean(perfil.dataNascimento), 'a data de nascimento passa a alimentar o calendário')

  // And the family reads the summary too — this one is theirs.
  const proFamilia = await (await ctxMae.request.get(`${BASE}/api/prontuario`)).json()
  afirmar(
    proFamilia.prontuario.resumoNascimento?.pesoNascimentoG === 3240,
    'a família também lê o resumo do nascimento',
  )

  await ctxMae.close()
  await ctxMedica.close()
}

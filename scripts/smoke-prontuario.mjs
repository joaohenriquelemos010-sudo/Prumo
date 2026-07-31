/**
 * Prontuário profundo: história append-only e transferência consentida.
 *
 * Duas promessas são verificadas aqui, e as duas são invisíveis na tela:
 *
 * 1. O prontuário **não se edita e não se apaga**. As rotas antigas de PUT e
 *    DELETE em `/evento/:id` deixaram de existir; corrigir é retificar, e a
 *    entrada original continua na história.
 * 2. O prontuário é **da paciente**. Um médico pede para passá-lo adiante, mas
 *    quem autoriza é a responsável — e sem esse consentimento não existe token,
 *    logo não existe nada para baixar.
 */

export async function registrarTestesDeProntuario({
  navegador,
  BASE,
  DESKTOP,
  secao,
  afirmar,
  registrar,
  conta,
}) {
  secao('Prontuário: história append-only e transferência')

  const ctxMedica = await navegador.newContext({ viewport: DESKTOP })
  const ctxMae = await navegador.newContext({ viewport: DESKTOP })
  const ctxColega = await navegador.newContext({ viewport: DESKTOP })
  await registrar(ctxMedica.request, conta('medico'))
  await registrar(ctxMae.request, conta('gestante'))
  const dadosColega = conta('medico')
  await registrar(ctxColega.request, dadosColega)

  const convite = await (await ctxMae.request.post(`${BASE}/api/vinculos/convite`, { data: {} })).json()
  await ctxMedica.request.post(`${BASE}/api/vinculos/aceitar/${convite.token}`, { data: {} })
  const { vinculos } = await (await ctxMedica.request.get(`${BASE}/api/vinculos`)).json()
  const criancaId = vinculos[0]?.crianca
  afirmar(Boolean(criancaId), 'médica vinculada à jornada')

  const q = `?crianca=${criancaId}`

  /* ---- anotar entra na cadeia ---- */
  const a1 = await ctxMedica.request.post(`${BASE}/api/prontuario/evento${q}`, {
    data: { texto: 'Primeira consulta do pré-natal. Sem intercorrências.' },
  })
  afirmar(a1.ok(), 'médica registra uma anotação', `status ${a1.status()}`)

  await ctxMedica.request.post(`${BASE}/api/prontuario/evento${q}`, {
    data: { texto: 'Solicitados exames do primeiro trimestre.' },
  })

  const lido = await (await ctxMedica.request.get(`${BASE}/api/prontuario${q}`)).json()
  afirmar(lido.evolucoes?.length >= 2, `a história tem as entradas (${lido.evolucoes?.length})`)
  afirmar(
    lido.evolucoes.every((e) => e.hash),
    'toda entrada carrega o elo da cadeia',
  )

  /* ---- a cadeia fecha ---- */
  const integridade = await (
    await ctxMedica.request.get(`${BASE}/api/prontuario/integridade${q}`)
  ).json()
  afirmar(integridade.integra === true, 'a cadeia de integridade fecha')
  afirmar(integridade.total >= 2, `a verificação conta as entradas (${integridade.total})`)

  /* ---- editar e apagar NÃO existem mais ---- */
  const alvo = lido.evolucoes.find((e) => e.texto.includes('Primeira consulta'))
  const tentaEditar = await ctxMedica.request.put(
    `${BASE}/api/prontuario/evento/${alvo.id}${q}`,
    { data: { texto: 'reescrito' } },
  )
  afirmar(tentaEditar.status() === 404, 'PUT em anotação não existe mais', `status ${tentaEditar.status()}`)

  const tentaApagar = await ctxMedica.request.delete(`${BASE}/api/prontuario/evento/${alvo.id}${q}`)
  afirmar(tentaApagar.status() === 404, 'DELETE em anotação não existe mais', `status ${tentaApagar.status()}`)

  /* ---- retificar preserva a original ---- */
  const ret = await ctxMedica.request.post(
    `${BASE}/api/prontuario/evolucao/${alvo.id}/retificacao${q}`,
    { data: { texto: 'Primeira consulta do pré-natal. Refere náusea leve.' } },
  )
  afirmar(ret.ok(), 'médica retifica a própria anotação', `status ${ret.status()}`)

  const depois = await (await ctxMedica.request.get(`${BASE}/api/prontuario${q}`)).json()
  const original = depois.evolucoes.find((e) => e.id === alvo.id)
  const correcao = depois.evolucoes.find((e) => e.retificacaoDe === alvo.id)
  afirmar(Boolean(original), 'a entrada original CONTINUA na história')
  afirmar(original?.texto.includes('Sem intercorrências'), 'o texto original não foi alterado')
  afirmar(Boolean(correcao), 'a correção existe como entrada nova')
  afirmar(original?.retificadaPor === correcao?.id, 'a original aponta para a correção')

  const integridade2 = await (
    await ctxMedica.request.get(`${BASE}/api/prontuario/integridade${q}`)
  ).json()
  afirmar(integridade2.integra === true, 'a cadeia continua íntegra depois da retificação')

  /* ---- retificar duas vezes não é permitido ---- */
  const ret2 = await ctxMedica.request.post(
    `${BASE}/api/prontuario/evolucao/${alvo.id}/retificacao${q}`,
    { data: { texto: 'de novo' } },
  )
  afirmar(ret2.status() === 409, 'a mesma entrada não é retificada duas vezes', `status ${ret2.status()}`)

  /* ---- transferência: pedir NÃO dá acesso ---- */
  const pedido = await ctxMedica.request.post(`${BASE}/api/transferencias${q}`, {
    data: {
      paraMedicoEmail: dadosColega.email,
      paraMedicoNome: dadosColega.nome,
      motivo: 'Acompanhamento passa para a pediatria.',
      escopo: ['prontuario', 'consultas'],
    },
  })
  afirmar(pedido.ok(), 'médica pede a transferência', `status ${pedido.status()}`)
  const { transferencia } = await pedido.json()
  afirmar(transferencia.estado === 'pendente', 'o pedido nasce pendente')

  /* ---- o solicitante NÃO pode aprovar o próprio pedido ---- */
  const autoAprovar = await ctxMedica.request.post(
    `${BASE}/api/transferencias/${transferencia.id}/consentir`,
    { data: { aprovar: true } },
  )
  afirmar(
    autoAprovar.status() === 403,
    'o médico NÃO aprova a própria transferência',
    `status ${autoAprovar.status()}`,
  )

  /* ---- a responsável autoriza, e só aí nasce o link ---- */
  const consentir = await ctxMae.request.post(
    `${BASE}/api/transferencias/${transferencia.id}/consentir`,
    { data: { aprovar: true } },
  )
  afirmar(consentir.ok(), 'a responsável autoriza', `status ${consentir.status()}`)
  const { path } = await consentir.json()
  afirmar(Boolean(path), 'o link só é gerado depois do consentimento')

  /* ---- o colega baixa o pacote ---- */
  const baixar = await ctxColega.request.get(`${BASE}${path}`)
  afirmar(baixar.ok(), 'o colega baixa o pacote', `status ${baixar.status()}`)
  const { pacote } = await baixar.json()

  afirmar(pacote.meta?.integridade?.integra === true, 'o pacote carrega o estado da cadeia')
  afirmar(Array.isArray(pacote.narrativa) && pacote.narrativa.length >= 2, 'o pacote traz a narrativa')
  afirmar(
    ['paciente', 'encontros', 'observacoes', 'imunizacoes', 'documentos', 'condicoes', 'narrativa'].every(
      (k) => k in pacote,
    ),
    'o pacote usa os nomes dos recursos FHIR',
  )
  afirmar(
    JSON.stringify(pacote).includes('notasPrivadas') === false,
    'o pacote NÃO leva notas privadas',
  )

  /* ---- o mesmo conteúdo em FHIR R4 ---- */
  const fhir = await ctxColega.request.get(`${BASE}${path.replace(/\/pacote$/, '/fhir')}`)
  afirmar(fhir.ok(), 'o colega baixa o mesmo caso como Bundle FHIR', `status ${fhir.status()}`)
  afirmar(
    (fhir.headers()['content-type'] ?? '').includes('application/fhir+json'),
    'o Bundle sai com o content-type do FHIR',
    fhir.headers()['content-type'],
  )
  const bundle = await fhir.json()
  afirmar(bundle.resourceType === 'Bundle' && bundle.type === 'document', 'é um Bundle document')
  afirmar(
    bundle.entry?.[0]?.resource?.resourceType === 'Composition',
    'a Composition vem primeiro — a regra do tipo `document`',
  )
  // Referência quebrada num Bundle é o defeito que só aparece do outro lado.
  const urls = new Set(bundle.entry.map((e) => e.fullUrl))
  const refs = JSON.stringify(bundle).match(/"reference":"([^"]+)"/g) ?? []
  const orfas = refs
    .map((r) => r.slice('"reference":"'.length, -1))
    .filter((r) => !urls.has(`urn:uuid:${r}`) && !urls.has(r))
  afirmar(orfas.length === 0, 'nenhuma referência aponta para fora do Bundle', orfas.join(', '))

  /* ---- a família não puxa FHIR: é rota de profissional ---- */
  const maeTentaFhir = await ctxMae.request.get(`${BASE}${path.replace(/\/pacote$/, '/fhir')}`)
  afirmar(
    maeTentaFhir.status() === 403,
    'a rota FHIR exige sessão de médico',
    `status ${maeTentaFhir.status()}`,
  )

  /* ---- revogar mata o link na hora ---- */
  await ctxMae.request.post(`${BASE}/api/transferencias/${transferencia.id}/revogar`, { data: {} })
  const depoisRevogar = await ctxColega.request.get(`${BASE}${path}`)
  afirmar(
    depoisRevogar.status() === 404,
    'revogar invalida o link imediatamente',
    `status ${depoisRevogar.status()}`,
  )

  await ctxMedica.close()
  await ctxMae.close()
  await ctxColega.close()
}

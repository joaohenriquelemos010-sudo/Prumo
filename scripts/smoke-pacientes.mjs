/**
 * Paciente sem conta: cadastro de balcão, atendimento e vinculação depois.
 *
 * É o fluxo que atravessa mais costuras do produto — jornada sem responsável,
 * vínculo sem paciente, agendamento criado pelo próprio atendimento, e no fim a
 * adoção do registro por uma conta que nem existia quando a consulta aconteceu.
 * Nenhuma dessas peças é testável em unidade sem mentir sobre o banco.
 */
export async function registrarTestesDePacientes({
  navegador,
  BASE,
  DESKTOP,
  secao,
  afirmar,
  registrar,
  conta,
}) {
  secao('Paciente sem conta: atender antes do cadastro')

  const ctxMedica = await navegador.newContext({ viewport: DESKTOP })
  await registrar(ctxMedica.request, conta('medico'))

  /* ---- cadastro de balcão ---- */
  const criar = await ctxMedica.request.post(`${BASE}/api/pacientes`, {
    data: {
      nome: 'Joana Sem Conta',
      momento: 'gestante',
      telefone: '11999990000',
      observacoes: 'Chegou pela UBS.',
    },
  })
  afirmar(criar.ok(), 'médico cadastra paciente que não está na plataforma', `status ${criar.status()}`)
  const { paciente } = await criar.json()
  afirmar(paciente?.temConta === false, 'a paciente nasce sem conta')
  afirmar(paciente?.nome === 'Joana Sem Conta', 'o nome digitado é o nome da paciente')
  afirmar(paciente?.vinculacao?.codigo === '', 'não há código antes de alguém pedir um')

  /* ---- ela já aparece na lista, sem convite nenhum ---- */
  const lista = await ctxMedica.request.get(`${BASE}/api/vinculos/pacientes`)
  const { pacientes } = await lista.json()
  const naLista = pacientes.find((p) => p.crianca === paciente.id)
  afirmar(Boolean(naLista), 'aparece em Meus pacientes sem precisar de convite')
  afirmar(naLista?.temConta === false, 'a lista marca que ainda não tem conta')

  /* ---- atender sem agendamento prévio ---- */
  const iniciar = await ctxMedica.request.post(`${BASE}/api/atendimento/iniciar`, {
    data: { jornadaId: paciente.id },
  })
  afirmar(iniciar.ok(), 'atendimento de balcão abre sem agendamento prévio', `status ${iniciar.status()}`)
  const atendimento = await iniciar.json()
  afirmar(
    Boolean(atendimento.agendamento?.id),
    'o atendimento sem hora marcada cria o agendamento correspondente',
  )

  // Chamar de novo não pode abrir uma segunda consulta: o médico apertou duas vezes.
  const denovo = await ctxMedica.request.post(`${BASE}/api/atendimento/iniciar`, {
    data: { jornadaId: paciente.id },
  })
  const atendimento2 = await denovo.json()
  afirmar(
    atendimento2.consulta?.id === atendimento.consulta?.id,
    'iniciar duas vezes devolve o mesmo rascunho',
  )

  await ctxMedica.request.patch(`${BASE}/api/atendimento/${atendimento.consulta.id}`, {
    data: { subjetivo: 'Primeira consulta de pré-natal.' },
  })
  const finalizar = await ctxMedica.request.post(
    `${BASE}/api/atendimento/${atendimento.consulta.id}/finalizar`,
    { data: {} },
  )
  afirmar(finalizar.ok(), 'o atendimento fecha normalmente', `status ${finalizar.status()}`)

  /* ---- o código ---- */
  const gerar = await ctxMedica.request.post(`${BASE}/api/pacientes/${paciente.id}/codigo`, {
    data: {},
  })
  afirmar(gerar.ok(), 'médico gera o código de vinculação', `status ${gerar.status()}`)
  const codigo = (await gerar.json()).paciente.vinculacao.codigo
  afirmar(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(codigo), `o código vem legível (${codigo})`)

  /* ---- a paciente cria a conta e reivindica ---- */
  const ctxPaciente = await navegador.newContext({ viewport: DESKTOP })
  const dadosPaciente = conta('gestante')
  await registrar(ctxPaciente.request, dadosPaciente)

  const errado = await ctxPaciente.request.post(`${BASE}/api/pacientes/vincular`, {
    data: { codigo: 'ZZZZ-9999' },
  })
  afirmar(errado.status() === 404, 'código inexistente não vincula nada', `status ${errado.status()}`)

  // Com hífen e em minúsculas — é assim que a pessoa digita.
  const vincular = await ctxPaciente.request.post(`${BASE}/api/pacientes/vincular`, {
    data: { codigo: codigo.toLowerCase() },
  })
  afirmar(vincular.ok(), 'a paciente vincula a própria conta', `status ${vincular.status()}`)

  /* ---- o histórico é o mesmo, não uma cópia ---- */
  const consultas = await ctxPaciente.request.get(`${BASE}/api/consultas`)
  const { consultas: dela } = await consultas.json()
  afirmar(
    dela.some((c) => c.id === atendimento.consulta.id),
    'a consulta feita ANTES da conta aparece para ela',
  )

  const agenda = await ctxPaciente.request.get(`${BASE}/api/agendamentos`)
  const { agendamentos } = await agenda.json()
  afirmar(
    agendamentos.some((a) => a.id === atendimento.agendamento.id),
    'o atendimento anterior aparece na agenda dela',
  )

  /* ---- e do lado do médico o estado mudou ---- */
  const listaDepois = await ctxMedica.request.get(`${BASE}/api/vinculos/pacientes`)
  const depois = (await listaDepois.json()).pacientes.find((p) => p.crianca === paciente.id)
  afirmar(depois?.temConta === true, 'o médico passa a ver a paciente como vinculada')

  /* ---- o código não serve duas vezes ---- */
  const ctxOutra = await navegador.newContext({ viewport: DESKTOP })
  await registrar(ctxOutra.request, conta('gestante'))
  const reuso = await ctxOutra.request.post(`${BASE}/api/pacientes/vincular`, {
    data: { codigo },
  })
  afirmar(
    reuso.status() === 404,
    'código usado não vincula uma segunda pessoa',
    `status ${reuso.status()}`,
  )

  /* ---- e o médico não reivindica jornada para si ---- */
  const ctxOutroMedico = await navegador.newContext({ viewport: DESKTOP })
  await registrar(ctxOutroMedico.request, conta('medico'))
  const medicoTenta = await ctxOutroMedico.request.post(`${BASE}/api/pacientes/vincular`, {
    data: { codigo: 'ABCD-2468' },
  })
  afirmar(
    medicoTenta.status() === 403,
    'médico não usa código de vinculação',
    `status ${medicoTenta.status()}`,
  )

  /* ---- o hub abre pelo endereço, e é isso que substitui as sete abas ---- */
  const page = await ctxMedica.newPage()
  await page.goto(`${BASE}/app/pacientes/${paciente.id}`)
  await page.waitForSelector('h1')
  afirmar(
    (await page.textContent('h1'))?.includes('Joana'),
    'o hub abre direto pela URL, com o nome no título',
  )
  const abas = await page.$$eval('[role="tab"]', (bs) => bs.map((b) => b.textContent?.trim()))
  afirmar(abas.length >= 6, `o hub reúne as áreas clínicas em abas (${abas.length})`)

  await page.click('[role="tab"]:has-text("Consultas")')
  await page.waitForTimeout(300)
  afirmar(
    page.url().includes('aba=consultas'),
    'trocar de aba muda a URL — dá para voltar e compartilhar',
  )

  // O menu do médico não pode ter voltado a listar tela clínica.
  const noRail = await page.$$eval('aside nav a', (as) => as.map((a) => a.getAttribute('href')))
  const clinicas = ['/app/prontuario', '/app/exames', '/app/bebe', '/app/vacinas', '/app/caderninho']
  afirmar(
    noRail.every((h) => !clinicas.includes(h)),
    'o menu do médico não lista telas de paciente',
    `menu: ${noRail.join(', ')}`,
  )

  await ctxMedica.close()
  await ctxPaciente.close()
  await ctxOutra.close()
  await ctxOutroMedico.close()
}

import { Router } from 'express'
import { requireAuth, requireRole } from '../auth.js'
import { resolveJornadaOr403, programaDe } from '../services/jornada.js'
import { Checklist } from '../models/Checklist.js'
import { ChecklistTemplate } from '../models/ChecklistTemplate.js'
import {
  montarChecklist,
  garantirInstancia,
  templateAtual,
  proximaSequencia,
  chavesDoPrograma,
} from '../services/checklist.js'
import type { ContextoTemporal } from '../services/checklist.js'
import { aoAtribuirChecklist } from '../services/lembretes/programar.js'
import { quandoLembrar } from '../services/lembretes/quando.js'
import { checklistAtribuirSchema, checklistGrupoSchema, checklistPassoSchema } from '../validation.js'
import { normalizeField } from '../sanitize.js'
import type { JornadaDoc } from '../models/Jornada.js'

export const checklistsRouter = Router()

/** Semana gestacional e meses de vida, a partir da jornada. */
function contextoTemporal(jornada: JornadaDoc): ContextoTemporal {
  let semana: number | null = null
  let mes: number | null = null

  if (jornada.dpp) {
    // 40 semanas menos o que falta para a DPP.
    const faltamDias = Math.ceil((new Date(jornada.dpp).getTime() - Date.now()) / 86_400_000)
    semana = Math.max(0, Math.min(42, 40 - Math.floor(faltamDias / 7)))
  }
  if (jornada.dataNascimento) {
    const n = new Date(jornada.dataNascimento)
    const hoje = new Date()
    mes = Math.max(0, (hoje.getFullYear() - n.getFullYear()) * 12 + (hoje.getMonth() - n.getMonth()))
  }

  return { semana, mes }
}

/**
 * GET /api/checklists — os checklists desta jornada, conteúdo e estado juntos.
 *
 * Os do programa vêm sempre, mesmo sem instância criada: uma gestante que acabou
 * de entrar deve ver o caminho inteiro, não uma tela vazia esperando alguém
 * "atribuir" alguma coisa.
 */
checklistsRouter.get('/', requireAuth, async (req, res) => {
  const jornada = await resolveJornadaOr403(req, res)
  if (!jornada) return

  const programa = programaDe(jornada)
  const contexto = contextoTemporal(jornada)

  // O que o programa entrega, mais o que um médico atribuiu por fora.
  const atribuidos = await Checklist.find({ jornada: jornada._id }).select('templateChave')
  const chaves = [
    ...new Set([...chavesDoPrograma(programa.id), ...atribuidos.map((c) => c.templateChave)]),
  ]

  const checklists = (
    await Promise.all(chaves.map((chave) => montarChecklist(jornada._id, chave, contexto)))
  ).filter(Boolean)

  res.json({ checklists, contexto })
})

/** GET /api/checklists/templates — o catálogo, para o médico escolher. */
checklistsRouter.get('/templates', requireAuth, requireRole('medico'), async (req, res) => {
  const filtro: Record<string, unknown> = {}
  if (typeof req.query.programa === 'string') filtro.programa = req.query.programa
  if (typeof req.query.publico === 'string') filtro.publico = req.query.publico

  const todos = await ChecklistTemplate.find(filtro).sort({ chave: 1, versao: -1 })

  // Só a versão mais recente de cada chave — versões antigas existem para as
  // instâncias que as referenciam, não para serem atribuídas de novo.
  const vistas = new Set<string>()
  const templates = todos
    .filter((t) => !vistas.has(t.chave) && vistas.add(t.chave))
    .map((t) => ({
      chave: t.chave,
      versao: t.versao,
      titulo: t.titulo,
      descricao: t.descricao,
      publico: t.publico,
      fase: t.fase,
      grupos: t.grupos.length,
    }))

  res.json({ templates })
})

/** POST /api/checklists/atribuir — o médico entrega um checklist à paciente. */
checklistsRouter.post('/atribuir', requireAuth, requireRole('medico'), async (req, res) => {
  const parsed = checklistAtribuirSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Confere os dados.' })
    return
  }
  const jornada = await resolveJornadaOr403(req, res)
  if (!jornada) return

  const template = await templateAtual(parsed.data.chave)
  if (!template) {
    res.status(404).json({ error: 'Esse checklist não existe.' })
    return
  }

  await garantirInstancia(jornada._id, parsed.data.chave, req.user!.id, req.user!.nome)

  /**
   * Um lembrete por grupo, na abertura da janela dele.
   *
   * `quandoLembrar` devolve `null` para janela já fechada, e é o que evita o
   * defeito óbvio: atribuir na semana 30 e disparar de uma vez o lembrete de
   * cada grupo das semanas 1 a 29. O que sobrar devido no mesmo dia vira um
   * resumo só, no despacho.
   */
  await aoAtribuirChecklist({
    jornada: jornada._id,
    destinatarioId: String(jornada.responsavel),
    chave: template.chave,
    grupos: template.grupos.map((g) => ({
      id: g.id,
      titulo: g.titulo,
      porqueImporta: g.porqueImporta,
      canal: g.lembrete?.canal ?? 'inapp',
      quando: quandoLembrar(g.janela, g.lembrete?.antecedenciaDias ?? 0, {
        dpp: jornada.dpp ? new Date(jornada.dpp) : null,
        nascimento: jornada.dataNascimento ? new Date(jornada.dataNascimento) : null,
      }),
    })),
  }).catch(() => {
    /* atribuir o checklist é o ato; a fila de lembrete não pode custá-lo */
  })

  const checklist = await montarChecklist(
    jornada._id,
    parsed.data.chave,
    contextoTemporal(jornada),
  )
  res.status(201).json({ checklist })
})

/**
 * PATCH /api/checklists/:chave/grupo/:grupoId — marca o grupo.
 *
 * A família marca o próprio checklist, e o médico também pode — os dois estão
 * cuidando da mesma coisa. Quem marcou fica registrado em `feitoPor`.
 */
checklistsRouter.patch('/:chave/grupo/:grupoId', requireAuth, async (req, res) => {
  const parsed = checklistGrupoSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Confere os dados.' })
    return
  }
  const jornada = await resolveJornadaOr403(req, res)
  if (!jornada) return

  const template = await templateAtual(req.params.chave)
  if (!template || !template.grupos.some((g) => g.id === req.params.grupoId)) {
    res.status(404).json({ error: 'Esse item não existe neste checklist.' })
    return
  }

  const instancia = await garantirInstancia(jornada._id, req.params.chave)
  if (!instancia) {
    res.status(404).json({ error: 'Checklist não encontrado.' })
    return
  }

  const agora = new Date()
  const grupo = instancia.grupos.find((g) => g.id === req.params.grupoId)
  const feito = parsed.data.estado === 'feito'

  if (grupo) {
    if (parsed.data.estado !== undefined) grupo.estado = parsed.data.estado
    if (parsed.data.nota !== undefined) grupo.nota = normalizeField(parsed.data.nota, 500)
    grupo.feitoEm = feito ? agora : null
    grupo.feitoPor = feito ? req.user!.id : ''
  } else {
    instancia.grupos.push({
      id: req.params.grupoId,
      estado: parsed.data.estado ?? 'pendente',
      nota: normalizeField(parsed.data.nota ?? '', 500),
      feitoEm: feito ? agora : null,
      feitoPor: feito ? req.user!.id : '',
      passos: [],
    })
  }

  instancia.sequenciaDias = proximaSequencia(instancia.sequenciaDias, instancia.ultimoToqueEm, agora)
  instancia.ultimoToqueEm = agora
  await instancia.save()

  res.json({
    checklist: await montarChecklist(jornada._id, req.params.chave, contextoTemporal(jornada)),
  })
})

/**
 * PATCH /api/checklists/:chave/grupo/:grupoId/passo/:passoId — marca um passo.
 *
 * Marcar o último passo obrigatório fecha o grupo sozinho. É o comportamento que
 * a pessoa espera: ela terminou tudo que havia para fazer, não faria sentido
 * pedir uma confirmação extra.
 */
checklistsRouter.patch('/:chave/grupo/:grupoId/passo/:passoId', requireAuth, async (req, res) => {
  const parsed = checklistPassoSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Confere os dados.' })
    return
  }
  const jornada = await resolveJornadaOr403(req, res)
  if (!jornada) return

  const template = await templateAtual(req.params.chave)
  const grupoTemplate = template?.grupos.find((g) => g.id === req.params.grupoId)
  if (!grupoTemplate || !grupoTemplate.passos.some((p) => p.id === req.params.passoId)) {
    res.status(404).json({ error: 'Esse passo não existe neste checklist.' })
    return
  }

  const instancia = await garantirInstancia(jornada._id, req.params.chave)
  if (!instancia) {
    res.status(404).json({ error: 'Checklist não encontrado.' })
    return
  }

  const agora = new Date()
  let grupo = instancia.grupos.find((g) => g.id === req.params.grupoId)
  if (!grupo) {
    instancia.grupos.push({
      id: req.params.grupoId,
      estado: 'em-andamento',
      nota: '',
      feitoEm: null,
      feitoPor: '',
      passos: [],
    })
    grupo = instancia.grupos[instancia.grupos.length - 1]!
  }

  const passo = grupo.passos.find((p) => p.id === req.params.passoId)
  if (passo) {
    passo.feito = parsed.data.feito
    passo.feitoEm = parsed.data.feito ? agora : null
  } else {
    grupo.passos.push({
      id: req.params.passoId,
      feito: parsed.data.feito,
      feitoEm: parsed.data.feito ? agora : null,
    })
  }

  // Fecha (ou reabre) o grupo conforme os passos obrigatórios.
  const obrigatorios = grupoTemplate.passos.filter((p) => !p.opcional).map((p) => p.id)
  const feitos = new Set(grupo.passos.filter((p) => p.feito).map((p) => p.id))
  const todosFeitos = obrigatorios.length > 0 && obrigatorios.every((id) => feitos.has(id))

  if (grupo.estado !== 'nao-se-aplica') {
    if (todosFeitos) {
      grupo.estado = 'feito'
      grupo.feitoEm = agora
      grupo.feitoPor = req.user!.id
    } else {
      grupo.estado = feitos.size > 0 ? 'em-andamento' : 'pendente'
      grupo.feitoEm = null
    }
  }

  instancia.sequenciaDias = proximaSequencia(instancia.sequenciaDias, instancia.ultimoToqueEm, agora)
  instancia.ultimoToqueEm = agora
  await instancia.save()

  res.json({
    checklist: await montarChecklist(jornada._id, req.params.chave, contextoTemporal(jornada)),
    /** Para a tela saber que é hora de comemorar. */
    grupoConcluido: todosFeitos,
  })
})

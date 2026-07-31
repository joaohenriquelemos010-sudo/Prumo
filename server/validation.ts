import { z } from 'zod'
import { PAPEIS } from './models/User.js'
import { CATEGORIAS_EXAME } from './models/Exame.js'
import { CATEGORIAS_POST } from './models/Post.js'
import { OBJETIVOS_AGENDAMENTO } from './models/Agendamento.js'
import { TIPOS_CONSULTA } from './models/Consulta.js'
import { ESCOPOS_TRANSFERENCIA } from './models/Transferencia.js'
import { ESTADOS_GRUPO } from './models/Checklist.js'
import { validarCPF, somenteDigitos, UFS } from './br-docs.js'

/**
 * Server-side validation. The client validates too, but the server never trusts
 * the client — every request body is parsed here before it touches the database.
 */

export const registerSchema = z
  .object({
    nome: z
      .string()
      .trim()
      .min(2, 'Conta pra gente como podemos te chamar.')
      .max(80, 'Esse nome ficou longo demais.')
      .regex(/^[\p{L}\s'.-]+$/u, 'Use só letras, por favor.'),
    email: z.string().trim().toLowerCase().email('Esse e-mail parece incompleto.'),
    senha: z
      .string()
      .min(8, 'Sua senha precisa de pelo menos 8 caracteres.')
      .max(100, 'Senha longa demais.'),
    papel: z.enum(PAPEIS),
    // Doctor-only fields (validated conditionally below).
    cpf: z.string().trim().optional(),
    crm: z.string().trim().optional(),
    crmUf: z.string().trim().toUpperCase().optional(),
    especialidade: z.string().trim().max(60).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.papel !== 'medico') return
    // CPF is validated (real check digits) + name required; CRM is optional and
    // stored as-is for now (no official verification yet).
    if (!data.cpf || !validarCPF(data.cpf)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['cpf'], message: 'CPF inválido. Confere os números?' })
    }
    // Specialty is required for doctors (used in doctor-to-doctor sharing).
    if (!data.especialidade || data.especialidade.length < 2) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['especialidade'], message: 'Informe sua especialidade.' })
    }
  })
  .transform((data) => ({
    ...data,
    cpf: data.cpf ? somenteDigitos(data.cpf) : undefined,
    crm: data.crm ? somenteDigitos(data.crm) : undefined,
    crmUf: data.crmUf && (UFS as readonly string[]).includes(data.crmUf) ? data.crmUf : undefined,
  }))

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Confere o e-mail pra mim?'),
  senha: z.string().min(1, 'Digite sua senha.'),
})

export const trilhaProgressSchema = z.object({
  etapaId: z.string().trim().min(1).max(60),
  concluida: z.boolean(),
})

// Accepts an ISO datetime, a plain YYYY-MM-DD date, or null.
const dataOpcional = z
  .string()
  .refine((v) => !Number.isNaN(Date.parse(v)), 'Data inválida.')
  .nullable()
  .optional()

export const perfilCriancaSchema = z.object({
  nome: z.string().trim().max(80).optional(),
  momento: z.enum(['planejando', 'gestante', 'ja-nasceu']).optional(),
  dpp: dataOpcional,
  dataNascimento: dataOpcional,
  convenio: z
    .object({
      tipo: z.enum(['convenio', 'particular', 'sus']),
      operadora: z.string().trim().max(80).optional(),
      plano: z.string().trim().max(80).optional(),
      numeroCarteirinha: z.string().trim().max(40).optional(),
      validade: dataOpcional,
    })
    .superRefine((c, ctx) => {
      if (c.tipo === 'convenio' && !c.operadora) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['operadora'],
          message: 'Informe a operadora do seu plano.',
        })
      }
    })
    .optional(),
})

export const vacinaToggleSchema = z.object({
  vacinaId: z.string().trim().min(1).max(60),
  aplicada: z.boolean(),
})

export const prontuarioUpdateSchema = z.object({
  tipoSanguineo: z.string().trim().max(8).optional(),
  alergias: z.string().trim().max(500).optional(),
  resumoGestacional: z.string().trim().max(2000).optional(),
  condicoes: z.array(z.string().trim().max(120)).max(30).optional(),
})

export const resumoNascimentoSchema = z.object({
  igAoNascerSemanas: z.number().int().min(20).max(45).nullable().optional(),
  igAoNascerDias: z.number().int().min(0).max(6).nullable().optional(),
  tipoParto: z.enum(['vaginal', 'cesarea', 'forceps', '']).optional(),
  apgar1: z.number().int().min(0).max(10).nullable().optional(),
  apgar5: z.number().int().min(0).max(10).nullable().optional(),
  pesoNascimentoG: z.number().min(200).max(7000).nullable().optional(),
  comprimentoNascimentoCm: z.number().min(20).max(70).nullable().optional(),
  pcNascimentoCm: z.number().min(15).max(50).nullable().optional(),
  intercorrencias: z.string().trim().max(1000).optional(),
  sorologiasMaternas: z.string().trim().max(500).optional(),
  gbs: z.enum(['positivo', 'negativo', 'nao-realizado', '']).optional(),
  aleitamento: z.string().trim().max(200).optional(),
  triagens: z
    .array(
      z.object({
        id: z.string().trim().min(1).max(40),
        feito: z.boolean(),
        resultado: z.string().trim().max(200).optional(),
      }),
    )
    .max(20)
    .optional(),
  /** Vira o momento da jornada para 'ja-nasceu' e grava a data de nascimento. */
  dataNascimento: dataOpcional,
})

export const prontuarioEventoSchema = z.object({
  texto: z.string().trim().min(2, 'Escreva a anotação.').max(2000),
})

export const duvidaCreateSchema = z.object({
  texto: z.string().trim().min(2, 'Escreva sua dúvida.').max(1000, 'Dúvida longa demais.'),
  compartilhada: z.boolean().optional(),
})

export const duvidaUpdateSchema = z.object({
  texto: z.string().trim().min(2, 'Escreva sua dúvida.').max(1000).optional(),
  compartilhada: z.boolean().optional(),
})

export const respostaSchema = z.object({
  texto: z.string().trim().min(2, 'Escreva a resposta.').max(1000),
})

/* ------------------------------ Agendamento ------------------------------ */

const horaHHMM = z
  .string()
  .trim()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use o formato HH:MM.')

const dataISO = z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'Data inválida.')

export const agendamentoCreateSchema = z
  .object({
    /** One of the two — a registered doctor, or a marketplace listing. */
    medicoId: z.string().trim().optional(),
    prestadorId: z.string().trim().optional(),
    objetivo: z.enum(OBJETIVOS_AGENDAMENTO),
    modalidade: z.enum(['teleconsulta', 'presencial', 'domiciliar']).default('presencial'),
    inicio: dataISO,
    mensagem: z.string().trim().max(500).optional(),
    convenio: z.string().trim().max(80).optional(),
  })
  .superRefine((d, ctx) => {
    if (!d.medicoId && !d.prestadorId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['medicoId'],
        message: 'Escolha com quem você quer marcar.',
      })
    }
    if (d.medicoId && d.prestadorId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['medicoId'],
        message: 'Escolha só um profissional por agendamento.',
      })
    }
  })

/** Reschedule and status changes share one endpoint; each field is optional. */
export const agendamentoUpdateSchema = z
  .object({
    status: z.enum(['confirmado', 'recusado', 'cancelado', 'realizado', 'faltou']).optional(),
    inicio: dataISO.optional(),
    modalidade: z.enum(['teleconsulta', 'presencial', 'domiciliar']).optional(),
    motivo: z.string().trim().max(200).optional(),
  })
  .refine((d) => d.status || d.inicio || d.modalidade, {
    message: 'Nada para atualizar.',
  })

export const disponibilidadeUpdateSchema = z.object({
  ativo: z.boolean().optional(),
  duracaoPadraoMin: z.number().int().min(10).max(240).optional(),
  antecedenciaMinHoras: z.number().int().min(0).max(720).optional(),
  janelaMaxDias: z.number().int().min(1).max(365).optional(),
  regras: z
    .array(
      z
        .object({
          diaSemana: z.number().int().min(0).max(6),
          inicio: horaHHMM,
          fim: horaHHMM,
          modalidades: z.array(z.enum(['teleconsulta', 'presencial', 'domiciliar'])).min(1).max(3),
          local: z.string().trim().max(160).optional(),
        })
        .refine((r) => r.fim > r.inicio, { message: 'O fim precisa vir depois do início.' }),
    )
    .max(40)
    .optional(),
  bloqueios: z
    .array(
      z
        .object({
          de: dataISO,
          ate: dataISO,
          motivo: z.string().trim().max(160).optional(),
        })
        .refine((b) => Date.parse(b.ate) > Date.parse(b.de), {
          message: 'O fim do bloqueio precisa vir depois do início.',
        }),
    )
    .max(60)
    .optional(),
  conveniosAtendidos: z.array(z.string().trim().max(80)).max(40).optional(),
  atendeParticular: z.boolean().optional(),
  atendeSus: z.boolean().optional(),
})

export const esqueciSenhaSchema = z.object({
  email: z.string().trim().toLowerCase().email('Digite um e-mail válido.'),
})

export const compartilhamentoCreateSchema = z.object({
  criancaId: z.string().trim().min(1, 'Escolha o paciente.'),
  email: z.string().trim().toLowerCase().email('Informe o e-mail do outro médico.'),
})

const campoLongo = z.string().trim().max(3000).optional()

/** Optional positive number, tolerating the empty string an input sends. */
const medida = (max: number) =>
  z
    .union([z.number(), z.string()])
    .transform((v) => (v === '' || v === null ? null : Number(v)))
    .refine((v) => v === null || (Number.isFinite(v) && v >= 0 && v <= max), 'Valor fora da faixa.')
    .nullable()
    .optional()

export const medidasSchema = z.object({
  pesoKg: medida(300),
  alturaCm: medida(250),
  imc: medida(100),
  paSistolica: medida(300),
  paDiastolica: medida(200),
  alturaUterinaCm: medida(60),
  bcfBpm: medida(250),
  pesoG: medida(40_000),
  comprimentoCm: medida(150),
  perimetroCefalicoCm: medida(80),
})

export const consultaCreateSchema = z.object({
  tipo: z.enum(TIPOS_CONSULTA).default('pediatrica'),
  agendamentoId: z.string().trim().optional(),
  /** Quando a consulta aconteceu. Sem isto, registrar uma visita passada era
   *  impossível: tudo era carimbado no instante da digitação, e a curva de
   *  crescimento empilhava as medidas todas no mesmo mês. */
  data: dataISO.optional(),
  subjetivo: campoLongo,
  objetivo: campoLongo,
  avaliacao: campoLongo,
  plano: campoLongo,
  notasPrivadas: campoLongo,
  avaliacaoPrivada: z.boolean().optional(),
  igSemanas: z.number().int().min(0).max(45).nullable().optional(),
  igDias: z.number().int().min(0).max(6).nullable().optional(),
  medidas: medidasSchema.optional(),
  checklist: z
    .array(
      z.object({
        id: z.string().trim().min(1).max(60),
        feito: z.boolean(),
        observacao: z.string().trim().max(300).optional(),
      }),
    )
    .max(60)
    .optional(),
  peso: z.string().trim().max(20).optional(),
  altura: z.string().trim().max(20).optional(),
  pressao: z.string().trim().max(20).optional(),
})

/** POST /api/consultas/iniciar — abre (ou reabre) o rascunho de um agendamento. */
export const consultaIniciarSchema = z.object({
  agendamentoId: z.string().trim().min(1, 'Sem agendamento não há atendimento para iniciar.'),
})

/**
 * PATCH /api/consultas/:id — autosave do cockpit.
 *
 * Todo campo é opcional porque o cliente manda só o que mudou; um autosave que
 * exigisse o documento inteiro sobrescreveria o que outra aba acabou de gravar.
 */
export const consultaPatchSchema = z.object({
  subjetivo: campoLongo,
  objetivo: campoLongo,
  avaliacao: campoLongo,
  plano: campoLongo,
  notasPrivadas: campoLongo,
  resumoParaFamilia: z.string().trim().max(2000).optional(),
  avaliacaoPrivada: z.boolean().optional(),
  igSemanas: z.number().int().min(0).max(45).nullable().optional(),
  igDias: z.number().int().min(0).max(6).nullable().optional(),
  medidas: medidasSchema.optional(),
  checklist: z
    .array(
      z.object({
        id: z.string().trim().min(1).max(60),
        feito: z.boolean(),
        observacao: z.string().trim().max(300).optional(),
      }),
    )
    .max(60)
    .optional(),
})

/** POST /api/consultas/:id/finalizar — fecha o atendimento. */
export const consultaFinalizarSchema = z.object({
  /** Manda o resumo junto no mesmo gesto — é o fluxo normal. */
  enviarResumo: z.boolean().optional(),
})

/** POST /api/transferencias — pedido de passagem do caso. */
export const transferenciaCreateSchema = z.object({
  paraMedicoEmail: z.string().trim().toLowerCase().email('Confere o e-mail do colega.'),
  paraMedicoNome: z.string().trim().max(80).optional(),
  escopo: z.array(z.enum(ESCOPOS_TRANSFERENCIA)).min(1).optional(),
  motivo: z.string().trim().max(300).optional(),
})

/* ------------------------------- Checklist ------------------------------- */

export const checklistAtribuirSchema = z.object({
  chave: z.string().trim().min(1).max(60),
})

export const checklistGrupoSchema = z.object({
  estado: z.enum(ESTADOS_GRUPO).optional(),
  nota: z.string().trim().max(500).optional(),
})

export const checklistPassoSchema = z.object({
  feito: z.boolean(),
})

/* ------------------------------- Lembretes ------------------------------- */

const horaSilencio = z
  .string()
  .trim()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use o formato HH:MM.')

export const preferenciasUpdateSchema = z.object({
  canais: z
    .object({
      email: z.boolean().optional(),
      inapp: z.boolean().optional(),
      push: z.boolean().optional(),
    })
    .optional(),
  tipos: z
    .object({
      consulta: z.boolean().optional(),
      checklist: z.boolean().optional(),
      exame: z.boolean().optional(),
      vacina: z.boolean().optional(),
      resumo: z.boolean().optional(),
      sequencia: z.boolean().optional(),
    })
    .optional(),
  silencio: z
    .object({
      de: horaSilencio.optional(),
      ate: horaSilencio.optional(),
      fuso: z.string().trim().max(60).optional(),
    })
    .optional(),
  limites: z
    .object({
      porDia: z.number().int().min(0).max(10).optional(),
      porSemana: z.number().int().min(0).max(50).optional(),
    })
    .optional(),
  /** 0 tira a pausa. */
  pausarDias: z.number().int().min(0).max(90).optional(),
})

export const medidaFetalSchema = z.object({
  semana: z.number().int().min(10).max(42),
  data: dataISO.optional(),
  dbpMm: medida(150),
  ccMm: medida(500),
  caMm: medida(500),
  cfMm: medida(120),
  pfeG: medida(7000),
  ilaCm: medida(50),
  apresentacao: z.enum(['cefalica', 'pelvica', 'cormica', 'indefinida']).optional(),
  placenta: z.string().trim().max(120).optional(),
  observacao: z.string().trim().max(500).optional(),
  notasPrivadas: z.string().trim().max(1000).optional(),
})

export const checkinSchema = z.object({
  /** Semana gestacional antes do parto; mês de vida depois. */
  periodo: z.number().int().min(0).max(42),
  fase: z.enum(['gestacao', 'pos-natal']).default('gestacao'),
  notaFamilia: z.string().trim().max(500).optional(),
})

export const exameCreateSchema = z.object({
  nome: z.string().trim().min(2, 'Dê um nome ao exame.').max(120),
  categoria: z.enum(CATEGORIAS_EXAME).default('outro'),
  dataExame: z
    .string()
    .refine((v) => !Number.isNaN(Date.parse(v)), 'Data inválida.')
    .optional(),
  observacoes: z.string().trim().max(1000).optional(),
})

export const postCreateSchema = z.object({
  texto: z.string().trim().min(2, 'Escreva algo para compartilhar.').max(1000, 'Ficou longo — resuma um pouco?'),
  categoria: z.enum(CATEGORIAS_POST).default('maternidade'),
  anonimo: z.boolean().optional(),
})

export const comentarioCreateSchema = z.object({
  texto: z.string().trim().min(1, 'Escreva um comentário.').max(500),
})

export type RegisterInput = z.infer<typeof registerSchema>
export type LoginInput = z.infer<typeof loginSchema>

/**
 * POST /api/auth/trocar-senha.
 *
 * Exige a senha atual mesmo com a sessão válida: um cookie roubado não pode
 * virar troca de senha, que é a forma de o invasor trancar a dona da conta do
 * lado de fora. É a mesma regra das mesmas regras de tamanho do cadastro.
 */
export const trocarSenhaSchema = z
  .object({
    senhaAtual: z.string().min(1, 'Digite sua senha atual.'),
    novaSenha: z
      .string()
      .min(8, 'Sua senha precisa de pelo menos 8 caracteres.')
      .max(100, 'Senha longa demais.'),
  })
  .refine((d) => d.senhaAtual !== d.novaSenha, {
    path: ['novaSenha'],
    message: 'A nova senha precisa ser diferente da atual.',
  })

/**
 * POST /api/push/assinar.
 *
 * A forma vem do `PushSubscription.toJSON()` do navegador — validada aqui
 * porque é entrada de rede como qualquer outra, e um `endpoint` de 40 KB numa
 * coleção sem limite é um jeito barato de encher o banco.
 */
export const assinaturaPushSchema = z.object({
  endpoint: z.string().trim().url('Endpoint inválido.').max(1000),
  keys: z.object({
    p256dh: z.string().trim().min(1).max(300),
    auth: z.string().trim().min(1).max(300),
  }),
})

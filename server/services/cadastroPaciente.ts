import type { HydratedDocument } from 'mongoose'
import type { JornadaDoc } from '../models/Jornada.js'
import { normalizeField } from '../sanitize.js'
import type { pacienteCreateSchema } from '../validation.js'
import type { z } from 'zod'

/**
 * A ficha da paciente — a tradução entre o formulário e o documento.
 *
 * Três rotas gravam exatamente o mesmo cadastro: o `POST` do consultório, o
 * `PATCH` da correção e o envio público do pré-cadastro. Antes de existir este
 * arquivo eram três cópias do mesmo `normalizeField` campo a campo, e a terceira
 * cópia sempre esquecia um campo novo. Aqui a lista de campos existe **uma vez**,
 * e quem grava só escolhe se está criando ou corrigindo.
 *
 * O par `aplicar`/`serializar` é deliberadamente simétrico: se um campo entra
 * aqui e não sai lá, a paciente digita um dado que some ao recarregar a tela — o
 * tipo de bug que nenhum teste de rota pega e toda recepcionista percebe.
 */

export type CadastroPaciente = z.infer<typeof pacienteCreateSchema>

/** Data só quando é data. Campo bagunçado vira `null`, nunca `Invalid Date`. */
export function data(valor: unknown): Date | null {
  if (typeof valor !== 'string' || valor.trim() === '') return null
  const d = new Date(valor)
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * `MM/AAAA` → o **último instante do mês**.
 *
 * O cartão diz "válido até 07/2027", e isso significa o mês inteiro. Guardar
 * `2027-07-01` faria a carteirinha vencer trinta dias antes na conta de quem
 * comparar com `hoje` — um erro silencioso que aparece só na recusa da guia.
 */
export function validadeParaData(valor: unknown): Date | null {
  if (typeof valor !== 'string') return null
  const m = /^(\d{2})\/(\d{4})$/.exec(valor.trim())
  if (!m) return null
  const mes = Number(m[1])
  const ano = Number(m[2])
  if (mes < 1 || mes > 12 || ano < 2000 || ano > 2100) return null
  return new Date(Date.UTC(ano, mes, 0, 23, 59, 59))
}

/** `2027-07-31T…` → `07/2027`, como está impresso no cartão. */
export function dataParaValidade(valor: Date | null | undefined): string {
  if (!valor) return ''
  const d = new Date(valor)
  if (Number.isNaN(d.getTime())) return ''
  return `${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`
}

const DIAS = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom']
const PERIODOS = ['manha', 'tarde', 'noite']

/** Só dígitos — telefone e CPF entram limpos, venham como vierem. */
function digitos(valor: string | undefined, max: number): string {
  return (valor ?? '').replace(/\D/g, '').slice(0, max)
}

/**
 * Grava o cadastro no documento, campo a campo.
 *
 * Usa `set(caminho, valor)` em vez de trocar o objeto `titular` inteiro, e essa
 * é a diferença entre corrigir um telefone e apagar um CPF: `titular.cpf` é
 * `select: false`, então ele **não vem** na leitura — atribuir um `titular` novo
 * montado a partir do que veio deixaria o campo de fora e o `save()` o zeraria
 * sem que ninguém pedisse.
 *
 * Com `criando: false` (o PATCH), só o que veio no corpo é tocado: o cliente
 * manda o que mudou, e um campo ausente significa "não mexi nisso", nunca
 * "apague".
 */
export function aplicarCadastro(
  jornada: HydratedDocument<JornadaDoc>,
  d: Partial<CadastroPaciente>,
  { criando = false }: { criando?: boolean } = {},
): void {
  const definido = (valor: unknown) => criando || valor !== undefined

  // ---- A jornada em si ----
  if (d.momento !== undefined) jornada.momento = d.momento
  if (definido(d.dpp)) jornada.dpp = data(d.dpp)
  if (definido(d.dataNascimentoBebe)) jornada.dataNascimento = data(d.dataNascimentoBebe)
  if (definido(d.nomeBebe)) jornada.nome = normalizeField(d.nomeBebe ?? '', 80)

  // ---- Identificação ----
  if (definido(d.nome)) jornada.set('titular.nome', normalizeField(d.nome ?? '', 80))
  if (definido(d.dataNascimento)) jornada.set('titular.dataNascimento', data(d.dataNascimento))
  if (definido(d.cpf)) jornada.set('titular.cpf', digitos(d.cpf, 11))
  if (definido(d.rg)) jornada.set('titular.rg', normalizeField(d.rg ?? '', 20))
  if (definido(d.sexo)) jornada.set('titular.sexo', d.sexo ?? '')
  if (definido(d.estadoCivil)) jornada.set('titular.estadoCivil', d.estadoCivil ?? '')
  if (definido(d.profissao)) jornada.set('titular.profissao', normalizeField(d.profissao ?? '', 60))
  // A foto não passa por `normalizeField`: é uma data URL, e colapsar espaço
  // dentro de base64 corromperia a imagem. O formato já foi conferido no schema.
  if (definido(d.foto)) jornada.set('titular.foto', (d.foto ?? '').slice(0, 40_000))

  // ---- Contato ----
  if (definido(d.telefone)) jornada.set('titular.telefone', digitos(d.telefone, 11))
  if (definido(d.telefoneSecundario))
    jornada.set('titular.telefoneSecundario', digitos(d.telefoneSecundario, 11))
  if (definido(d.email)) jornada.set('titular.email', d.email ?? '')
  if (definido(d.observacoes))
    jornada.set('titular.observacoes', normalizeField(d.observacoes ?? '', 500))

  // ---- Endereço ----
  if (definido(d.endereco)) {
    const e = d.endereco ?? {}
    jornada.set('titular.endereco', {
      cep: digitos(e.cep, 8),
      logradouro: normalizeField(e.logradouro ?? '', 120),
      numero: normalizeField(e.numero ?? '', 12),
      complemento: normalizeField(e.complemento ?? '', 60),
      bairro: normalizeField(e.bairro ?? '', 60),
      cidade: normalizeField(e.cidade ?? '', 60),
      uf: normalizeField(e.uf ?? '', 2).toUpperCase(),
    })
  }

  // ---- Contato de emergência ----
  if (definido(d.emergencia)) {
    const c = d.emergencia ?? {}
    jornada.set('titular.contatoEmergencia', {
      nome: normalizeField(c.nome ?? '', 80),
      parentesco: normalizeField(c.parentesco ?? '', 40),
      telefone: digitos(c.telefone, 11),
    })
  }

  // ---- Família ----
  if (definido(d.familia)) {
    const f = d.familia ?? {}
    jornada.set('titular.familia', {
      companheiro: normalizeField(f.companheiro ?? '', 80),
      filhos: (f.filhos ?? [])
        .filter((filho) => (filho.nome ?? '').trim() !== '')
        .slice(0, 20)
        .map((filho) => ({
          nome: normalizeField(filho.nome, 80),
          dataNascimento: data(filho.dataNascimento),
        })),
    })
  }

  // ---- Preferências de horário ----
  if (definido(d.preferencias)) {
    const p = d.preferencias ?? {}
    jornada.set('titular.preferenciasHorario', {
      dias: (p.dias ?? []).filter((dia) => DIAS.includes(dia)),
      periodos: (p.periodos ?? []).filter((per) => PERIODOS.includes(per)),
      restricoes: normalizeField(p.restricoes ?? '', 200),
    })
  }

  // ---- Convênio ----
  if (definido(d.convenio)) {
    const c = d.convenio ?? {}
    const temConvenio = (c.operadora ?? '').trim() !== ''
    jornada.set('convenio.operadora', normalizeField(c.operadora ?? '', 80))
    jornada.set('convenio.plano', normalizeField(c.plano ?? '', 80))
    jornada.set('convenio.numeroCarteirinha', normalizeField(c.carteirinha ?? '', 30))
    jornada.set('convenio.validade', validadeParaData(c.validade))
    // `tipo` alimenta o marketplace e a cobrança; deixá-lo em `particular` com
    // uma operadora preenchida faria a guia sair errada.
    jornada.set('convenio.tipo', temConvenio ? 'convenio' : 'particular')
    jornada.set('convenio.informado', true)
  }
}

/** A ficha de volta para a tela. Espelho exato de `aplicarCadastro`. */
export function serializarCadastro(j: HydratedDocument<JornadaDoc>) {
  const iso = (d?: Date | null) => (d ? new Date(d).toISOString() : null)
  const t = j.titular
  const c = j.convenio

  return {
    titular: {
      nome: t?.nome ?? '',
      dataNascimento: iso(t?.dataNascimento),
      /**
       * O CPF só aparece quando a consulta pediu por ele (`+titular.cpf`). Nas
       * leituras normais ele nem sai do banco, e é isso que faz a ficha da
       * paciente não carregar um documento que a tela não vai mostrar.
       */
      cpf: t?.cpf ?? '',
      rg: t?.rg ?? '',
      sexo: t?.sexo ?? '',
      estadoCivil: t?.estadoCivil ?? '',
      profissao: t?.profissao ?? '',
      foto: t?.foto ?? '',
      telefone: t?.telefone ?? '',
      telefoneSecundario: t?.telefoneSecundario ?? '',
      email: t?.email ?? '',
      observacoes: t?.observacoes ?? '',
      endereco: {
        cep: t?.endereco?.cep ?? '',
        logradouro: t?.endereco?.logradouro ?? '',
        numero: t?.endereco?.numero ?? '',
        complemento: t?.endereco?.complemento ?? '',
        bairro: t?.endereco?.bairro ?? '',
        cidade: t?.endereco?.cidade ?? '',
        uf: t?.endereco?.uf ?? '',
      },
      emergencia: {
        nome: t?.contatoEmergencia?.nome ?? '',
        parentesco: t?.contatoEmergencia?.parentesco ?? '',
        telefone: t?.contatoEmergencia?.telefone ?? '',
      },
      familia: {
        companheiro: t?.familia?.companheiro ?? '',
        filhos: (t?.familia?.filhos ?? []).map((f) => ({
          nome: f.nome ?? '',
          dataNascimento: iso(f.dataNascimento),
        })),
      },
      preferencias: {
        dias: t?.preferenciasHorario?.dias ?? [],
        periodos: t?.preferenciasHorario?.periodos ?? [],
        restricoes: t?.preferenciasHorario?.restricoes ?? '',
      },
    },
    convenio: {
      tipo: c?.tipo ?? 'particular',
      operadora: c?.operadora ?? '',
      plano: c?.plano ?? '',
      carteirinha: c?.numeroCarteirinha ?? '',
      validade: dataParaValidade(c?.validade),
    },
  }
}

/**
 * Quanto da ficha está preenchido, de 0 a 100.
 *
 * Não é gamificação: é o que permite a tela dizer "faltam o endereço e o
 * convênio" em vez de deixar a recepção descobrir na hora de faturar. Pesa o
 * que tem consequência — contato, endereço, convênio — e ignora o resto.
 */
export function completudeCadastro(j: HydratedDocument<JornadaDoc>): number {
  const t = j.titular
  const marcos: boolean[] = [
    Boolean(t?.nome),
    Boolean(t?.cpf),
    Boolean(t?.dataNascimento),
    Boolean(t?.telefone),
    Boolean(t?.email),
    Boolean(t?.endereco?.cep && t?.endereco?.logradouro),
    Boolean(t?.endereco?.cidade),
    Boolean(j.convenio?.informado),
    Boolean(t?.contatoEmergencia?.telefone),
    Boolean((t?.preferenciasHorario?.dias ?? []).length || (t?.preferenciasHorario?.periodos ?? []).length),
  ]
  return Math.round((marcos.filter(Boolean).length / marcos.length) * 100)
}

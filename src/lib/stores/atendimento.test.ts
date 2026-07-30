import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const patch = vi.fn()
const post = vi.fn()

vi.mock('@/lib/api/client', () => ({
  api: {
    patch: (...args: unknown[]) => patch(...args),
    post: (...args: unknown[]) => post(...args),
  },
}))

const { useAtendimento } = await import('./atendimento')

/** Um cockpit mínimo, só com o que o store lê. */
function cockpitFalso(id = 'c1') {
  return {
    consulta: { id, subjetivo: '', objetivo: '', avaliacao: '', plano: '', status: 'rascunho' },
  } as never
}

describe('store do atendimento', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    patch.mockReset()
    post.mockReset()
    useAtendimento.setState({
      cockpit: null,
      pendente: {},
      salvando: false,
      salvoEm: null,
      erro: null,
      carregando: false,
      finalizando: false,
    })
  })

  afterEach(() => {
    useAtendimento.getState().limpar()
    vi.useRealTimers()
  })

  it('acumula edições sem bater no servidor a cada tecla', () => {
    useAtendimento.setState({ cockpit: cockpitFalso() })
    const { editar } = useAtendimento.getState()

    editar({ subjetivo: 'do' })
    editar({ subjetivo: 'dor' })
    editar({ subjetivo: 'dor de' })

    expect(patch).not.toHaveBeenCalled()
    expect(useAtendimento.getState().pendente.subjetivo).toBe('dor de')
  })

  it('salva uma vez só depois da pausa', async () => {
    patch.mockResolvedValue({ consulta: {}, salvoEm: '2026-01-01T00:00:00.000Z' })
    useAtendimento.setState({ cockpit: cockpitFalso() })
    const { editar } = useAtendimento.getState()

    editar({ subjetivo: 'a' })
    editar({ subjetivo: 'ab' })
    await vi.advanceTimersByTimeAsync(1600)

    expect(patch).toHaveBeenCalledTimes(1)
    expect(patch).toHaveBeenCalledWith('/atendimento/c1', { subjetivo: 'ab' })
    expect(useAtendimento.getState().salvoEm).toBe('2026-01-01T00:00:00.000Z')
  })

  /**
   * O caso que faz perder texto de médico: a resposta do autosave chega DEPOIS de
   * a pessoa já ter digitado mais. Se a fila fosse limpa ao voltar a resposta, o
   * que foi escrito durante o voo sumiria em silêncio.
   */
  it('não engole o que foi digitado enquanto o autosave estava no ar', async () => {
    let liberar: (v: unknown) => void = () => {}
    patch.mockImplementation(() => new Promise((r) => (liberar = r)))

    useAtendimento.setState({ cockpit: cockpitFalso() })
    const { editar } = useAtendimento.getState()

    editar({ subjetivo: 'primeiro' })
    await vi.advanceTimersByTimeAsync(1600) // dispara o PATCH, que fica pendurado

    editar({ subjetivo: 'primeiro e segundo' }) // digitado durante o voo
    liberar({ consulta: {}, salvoEm: '2026-01-01T00:00:00.000Z' })
    await vi.advanceTimersByTimeAsync(0)

    expect(useAtendimento.getState().pendente.subjetivo).toBe('primeiro e segundo')
  })

  it('devolve tudo para a fila quando a rede falha', async () => {
    patch.mockRejectedValue(new Error('sem rede'))
    useAtendimento.setState({ cockpit: cockpitFalso() })

    useAtendimento.getState().editar({ subjetivo: 'não me perca' })
    await vi.advanceTimersByTimeAsync(1600)

    const s = useAtendimento.getState()
    expect(s.pendente.subjetivo).toBe('não me perca')
    expect(s.erro).toBe('sem rede')
    expect(s.salvando).toBe(false)
  })

  it('a falha preserva tanto o que voou quanto o que foi digitado depois', async () => {
    let rejeitar: (e: unknown) => void = () => {}
    patch.mockImplementation(() => new Promise((_, rej) => (rejeitar = rej)))

    useAtendimento.setState({ cockpit: cockpitFalso() })
    useAtendimento.getState().editar({ subjetivo: 'S' })
    await vi.advanceTimersByTimeAsync(1600)

    useAtendimento.getState().editar({ plano: 'P' })
    rejeitar(new Error('caiu'))
    await vi.advanceTimersByTimeAsync(0)

    const { pendente } = useAtendimento.getState()
    expect(pendente.subjetivo).toBe('S')
    expect(pendente.plano).toBe('P')
  })

  it('não chama o servidor quando não há nada pendente', async () => {
    useAtendimento.setState({ cockpit: cockpitFalso() })
    await useAtendimento.getState().salvarAgora()
    expect(patch).not.toHaveBeenCalled()
  })

  it('finalizar descarrega o pendente antes de fechar', async () => {
    patch.mockResolvedValue({ consulta: {}, salvoEm: 'x' })
    post.mockResolvedValue({ consulta: { id: 'c1', status: 'finalizada' } })
    useAtendimento.setState({ cockpit: cockpitFalso() })

    useAtendimento.getState().editar({ plano: 'último parágrafo' })
    // Sem esperar o debounce: finalizar tem que salvar mesmo assim.
    const r = await useAtendimento.getState().finalizar(true)

    expect(patch).toHaveBeenCalledWith('/atendimento/c1', { plano: 'último parágrafo' })
    expect(post).toHaveBeenCalledWith('/atendimento/c1/finalizar', { enviarResumo: true })
    expect(r.ok).toBe(true)
  })

  it('limpar cancela o autosave agendado', async () => {
    useAtendimento.setState({ cockpit: cockpitFalso() })
    useAtendimento.getState().editar({ subjetivo: 'a' })
    useAtendimento.getState().limpar()

    await vi.advanceTimersByTimeAsync(3000)
    expect(patch).not.toHaveBeenCalled()
  })
})

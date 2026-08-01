import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '@/lib/api/client'
import { useAuth } from '@/lib/stores/auth'
import { usePerfil } from '@/lib/stores/perfil'
import { useMedicoContext, criancaQuery } from '@/lib/stores/medico-context'
import { useBebeView } from '@/lib/stores/bebe-view'
import { Skeleton } from '@/components/Skeleton'
import { AlertaErro } from '@/components/AlertaErro'
import { Confetti } from '@/features/trilha/Confetti'
import { SeletorPaciente } from '@/features/painel/SeletorPaciente'
import { idadeGestacional } from '@/features/clinico/schedule'
import { FaseGestacao } from '@/features/bebe/FaseGestacao'
import { FasePosNatal } from '@/features/bebe/FasePosNatal'
import { FasePlanejando } from '@/features/bebe/FasePlanejando'
import { calcularSequencia } from '@/features/bebe/sequencia'
import type { Checkin, Fase, PerfilJornada, RespostaBebe, ExameResumo } from '@/features/bebe/tipos'

/**
 * O crescimento do bebê — as duas metades da jornada.
 *
 * Esta página **roteia e busca**, e nada mais: cada fase é um componente
 * próprio em `@/features/bebe/`. Antes eram 848 linhas com a gestação, o
 * pós-natal, o planejamento, o check-in e duas tabelas no mesmo arquivo — o
 * maior do repositório, e o mais difícil de mudar sem quebrar a outra metade.
 */
/**
 * `embutido` = renderizada como aba dentro do hub da paciente (`AppPaciente`).
 *
 * Quando é aba, quem diz de quem é o prontuário e o que a tela é já está no
 * cabeçalho do hub, e o seletor de paciente viraria uma segunda maneira de
 * trocar de pessoa — dois controles para a mesma coisa é a origem do "confuso".
 * Então os dois somem, e só o conteúdo fica.
 */
export default function AppBebe({ embutido = false }: { embutido?: boolean } = {}) {
  const papel = useAuth((s) => s.user?.papel)
  const ehMedico = papel === 'medico'
  const criancaAtiva = useMedicoContext((s) => s.criancaAtiva)

  const perfilProprio = usePerfil((s) => s.perfil)
  const loadPerfil = usePerfil((s) => s.load)
  const perfilLoaded = usePerfil((s) => s.loaded)

  const granularidade = useBebeView((s) => s.granularidade)
  const setGranularidade = useBebeView((s) => s.setGranularidade)

  const [dados, setDados] = useState<RespostaBebe | null>(null)
  const [perfilPaciente, setPerfilPaciente] = useState<PerfilJornada | null>(null)
  const [exames, setExames] = useState<ExameResumo[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [celebrar, setCelebrar] = useState(false)

  useEffect(() => {
    if (!ehMedico && !perfilLoaded) void loadPerfil()
  }, [ehMedico, perfilLoaded, loadPerfil])

  const carregar = useCallback(async () => {
    setCarregando(true)
    try {
      // O médico lê a jornada da paciente SELECIONADA, não a própria.
      //
      // Os exames vêm inteiros numa requisição só, e não filtrados por período:
      // um `?de=&ate=` por cartão seria uma cascata de dez requisições para
      // montar uma tela, e a lista de uma jornada cabe folgada numa resposta.
      // O filtro existe no servidor para quem precisa de uma janela; aqui o
      // recorte é local porque o recorte muda a cada toque no seletor.
      const [d, p, ex] = await Promise.all([
        api.get<RespostaBebe>(`/bebe${criancaQuery(criancaAtiva)}`),
        api.get<{ perfil: PerfilJornada }>(`/perfil${criancaQuery(criancaAtiva)}`).then((r) => r.perfil),
        api
          .get<{ exames: ExameResumo[] }>(`/exames${criancaQuery(criancaAtiva)}`)
          .then((r) => r.exames)
          // Anexo é enfeite da história, não a história. Se a lista falhar, a
          // tela do crescimento continua de pé.
          .catch(() => [] as ExameResumo[]),
      ])
      setDados(d)
      setPerfilPaciente(p)
      setExames(ex)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui carregar agora.')
    } finally {
      setCarregando(false)
    }
  }, [criancaAtiva])

  useEffect(() => {
    void carregar()
  }, [carregar])

  const perfil = ehMedico ? perfilPaciente : (perfilProprio as PerfilJornada | null)
  const fase: Fase = dados?.fase ?? 'planejando'
  const ig = perfil?.dpp && fase === 'gestacao' ? idadeGestacional(new Date(perfil.dpp)) : null

  // Semanas na gestação, meses depois do nascimento — o período do check-in.
  const periodoAtual = fase === 'pos-natal' ? (dados?.idadeMeses ?? 0) : (ig?.semanas ?? 0)

  const sequencia = useMemo(
    () => calcularSequencia(dados?.checkins ?? [], fase, periodoAtual),
    [dados, fase, periodoAtual],
  )
  const jaFezCheckin = (dados?.checkins ?? []).some(
    (c) => c.fase === fase && c.periodo === periodoAtual,
  )

  async function registrarCheckin(nota: string) {
    try {
      const { checkins } = await api.post<{ checkins: Checkin[] }>(
        `/bebe/checkin${criancaQuery(criancaAtiva)}`,
        { periodo: periodoAtual, fase, notaFamilia: nota || undefined },
      )
      setDados((d) => (d ? { ...d, checkins } : d))
      setCelebrar(true)
      setTimeout(() => setCelebrar(false), 2000)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui registrar agora.')
    }
  }

  if (carregando) {
    return (
      <div className="flex flex-col gap-lg">
        {!embutido && <Cabecalho fase="gestacao" />}
        <Skeleton className="h-72" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-lg">
      <Confetti trigger={celebrar} />
      {!embutido && (
        <Cabecalho
          fase={fase}
          ehMedico={ehMedico}
          paciente={perfilPaciente?.nome}
          descricao={
            fase === 'gestacao'
              ? ig
                ? ehMedico
                  ? `${ig.porExtenso} de gestação.`
                  : `Você está com ${ig.porExtenso} de gestação.`
                : undefined
              : fase === 'pos-natal'
                ? descreverIdade(dados?.idadeMeses ?? 0)
                : undefined
          }
        />
      )}

      {!embutido && <SeletorPaciente />}

      {erro && <AlertaErro>{erro}</AlertaErro>}

      {fase === 'planejando' && <FasePlanejando ehMedico={ehMedico} />}

      {fase === 'gestacao' && (
        <FaseGestacao
          dados={dados}
          ehMedico={ehMedico}
          semanaAtual={ig?.semanas ?? 0}
          temDpp={Boolean(perfil?.dpp)}
          sequencia={sequencia}
          jaFezCheckin={jaFezCheckin}
          exames={exames}
          granularidade={granularidade}
          onGranularidade={setGranularidade}
          onCheckin={registrarCheckin}
          onSalvo={() => void carregar()}
        />
      )}

      {fase === 'pos-natal' && (
        <FasePosNatal
          dados={dados}
          ehMedico={ehMedico}
          idadeMeses={dados?.idadeMeses ?? 0}
          sequencia={sequencia}
          jaFezCheckin={jaFezCheckin}
          exames={exames}
          granularidade={granularidade}
          onGranularidade={setGranularidade}
          onCheckin={registrarCheckin}
        />
      )}
    </div>
  )
}

/* --------------------------------- header -------------------------------- */

const TITULO: Record<Fase, { eyebrow: string; titulo: string; padrao: string }> = {
  planejando: {
    eyebrow: 'Antes de engravidar',
    titulo: 'Primeiros passos',
    padrao: 'O que fazer antes de começar a tentar.',
  },
  gestacao: {
    eyebrow: 'Seu bebê',
    titulo: 'Semana a semana',
    padrao: 'O crescimento do bebê, do jeito que dá para ver.',
  },
  'pos-natal': {
    eyebrow: 'Seu bebê',
    titulo: 'Mês a mês',
    padrao: 'Como seu bebê vem crescendo desde o nascimento.',
  },
}

function Cabecalho({
  fase,
  ehMedico,
  paciente,
  descricao,
}: {
  fase: Fase
  ehMedico?: boolean
  paciente?: string
  descricao?: string
}) {
  const t = TITULO[fase]
  return (
    <header className="flex flex-col gap-1">
      <p className="u-eyebrow">{ehMedico ? 'Crescimento' : t.eyebrow}</p>
      <h1 className="text-3xl sm:text-4xl">
        {ehMedico && fase === 'gestacao' ? 'Biometria semana a semana' : t.titulo}
      </h1>
      <p className="text-ink-soft">
        {ehMedico && paciente ? `${paciente} · ` : ''}
        {descricao ?? t.padrao}
      </p>
    </header>
  )
}

function descreverIdade(meses: number): string {
  if (meses === 0) return 'Recém-nascido — as primeiras semanas.'
  if (meses < 12) return `${meses} ${meses === 1 ? 'mês' : 'meses'} de vida.`
  const anos = Math.floor(meses / 12)
  const resto = meses % 12
  const parteAnos = `${anos} ${anos === 1 ? 'ano' : 'anos'}`
  return resto ? `${parteAnos} e ${resto} ${resto === 1 ? 'mês' : 'meses'}.` : `${parteAnos}.`
}

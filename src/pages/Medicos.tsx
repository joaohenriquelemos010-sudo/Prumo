import { Link } from 'react-router-dom'
import { Activity, CalendarCheck, GitMerge, LineChart, ShieldAlert, Syringe } from 'lucide-react'
import { Section, SectionHead } from '@/components/Section'
import { Blob } from '@/components/Blob'
import { PainelClinicoDemo } from '@/features/painel/PainelClinicoDemo'

const RECURSOS = [
  {
    icon: GitMerge,
    titulo: 'Continuidade obstetrícia → pediatria',
    texto:
      'O histórico gestacional não se perde no parto. Intercorrências, exames e condutas seguem visíveis na trilha da criança.',
  },
  {
    icon: LineChart,
    titulo: 'Marcos de desenvolvimento',
    texto: 'Acompanhamento estruturado por faixa etária, com faixas esperadas e sinais de alerta.',
  },
  {
    icon: Syringe,
    titulo: 'Calendário vacinal integrado',
    texto: 'Doses aplicadas, pendentes e próximas — no mesmo lugar, sem planilha paralela.',
  },
  {
    icon: ShieldAlert,
    titulo: 'Fatores de risco em evidência',
    texto: 'O que precisa de atenção aparece primeiro. Menos tempo caçando dado, mais tempo decidindo.',
  },
]

export default function MedicosPage() {
  return (
    <>
      <section className="relative overflow-hidden bg-paper-2">
        <Blob variant="c" intensity={0.4} className="-right-24 -top-16 size-[26rem]" />
        <div className="u-shell grid gap-lg py-3xl lg:grid-cols-[1.1fr_1fr] lg:items-center">
          <div className="flex flex-col gap-md">
            <span className="u-eyebrow">Para médicos</span>
            <h1 className="text-4xl sm:text-display-s">
              A trilha completa, do útero ao consultório
            </h1>
            <p className="max-w-xl text-lg text-ink-soft">
              Dado estruturado, rápido e confiável. A Prumo une o pré-natal e o
              acompanhamento pediátrico numa linha do tempo só — para você decidir com o
              quadro inteiro à vista, não com pedaços.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                to="/painel"
                className="inline-flex h-12 items-center rounded-pill px-6 font-display font-semibold text-white shadow-soft [background-image:var(--grad-brand)] transition-[filter] duration-[var(--dur-fast)] hover:brightness-[1.05]"
              >
                Ver o painel clínico
              </Link>
              <Link
                to="/onboarding"
                className="inline-flex h-12 items-center rounded-pill border border-line bg-paper px-6 font-display font-semibold text-indigo hover:bg-paper-2"
              >
                Criar acesso
              </Link>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-line bg-paper p-md text-sm text-ink-soft shadow-soft">
            <Activity className="size-6 shrink-0 text-indigo" aria-hidden />
            A integração muda a conduta: um recém-nascido com intercorrência gestacional
            chega ao pediatra já sinalizado — não como página em branco.
          </div>
        </div>
      </section>

      <Section>
        <SectionHead
          eyebrow="O que a integração entrega"
          titulo="Menos fricção, mais contexto"
        />
        <div className="mt-xl grid gap-md sm:grid-cols-2">
          {RECURSOS.map((r) => {
            const Icon = r.icon
            return (
              <div key={r.titulo} className="flex gap-4 rounded-2xl border border-line bg-paper p-lg shadow-soft">
                <span className="grid size-12 shrink-0 place-items-center rounded-xl [background-image:var(--grad-brand-soft)] text-indigo">
                  <Icon className="size-6" aria-hidden />
                </span>
                <div>
                  <h3 className="text-lg">{r.titulo}</h3>
                  <p className="mt-1 text-ink-soft">{r.texto}</p>
                </div>
              </div>
            )
          })}
        </div>
      </Section>

      <Section className="bg-paper-2">
        <SectionHead
          eyebrow="Visualização de painel"
          titulo="O panorama clínico, num relance"
          descricao="Um exemplo do painel: histórico contínuo, faixa de risco, vacinas e marcos — dados mockados para demonstração."
        />
        <div className="mt-xl">
          <PainelClinicoDemo />
        </div>
        <p className="mt-md inline-flex items-center gap-2 text-sm text-ink-mute">
          <CalendarCheck className="size-4" aria-hidden />
          Protótipo com dados fictícios. Não representa um paciente real.
        </p>
      </Section>
    </>
  )
}

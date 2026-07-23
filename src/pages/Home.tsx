import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, HeartHandshake, Stethoscope, Route, ShieldCheck, Sparkles } from 'lucide-react'
import { Logo } from '@/components/Logo'
import { Blob } from '@/components/Blob'
import { Section, SectionHead } from '@/components/Section'
import { useReveal } from '@/lib/hooks/useReveal'
import { cn } from '@/lib/cn'

export default function HomePage() {
  return (
    <>
      <Hero />
      <ProblemaSolucao />
      <Publicos />
      <Beneficios />
      <ChamadaFinal />
    </>
  )
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <Blob variant="a" intensity={0.55} className="-left-20 -top-10 size-[30rem]" />
      <Blob variant="b" intensity={0.45} className="-right-24 top-24 size-[26rem]" />

      <div className="u-shell flex flex-col items-center gap-lg py-3xl text-center">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <Logo variant="symbol" className="mx-auto h-20" label="Prumo" />
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.06, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-3xl text-4xl sm:text-display"
        >
          Tudo sobre você e seu bebê, <span className="u-gradient-text">num lugar só</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-xl text-lg text-ink-soft sm:text-xl"
        >
          A Prumo costura a gestação e a pediatria numa trilha só. O histórico do seu
          bebê começa na barriga e segue com ele — sem se perder no caminho.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.18, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col items-center gap-3"
        >
          <Link
            to="/onboarding"
            className="inline-flex h-14 items-center gap-2 rounded-pill px-8 font-display text-lg font-semibold text-white shadow-lift [background-image:var(--grad-brand)] transition-[filter,transform] duration-[var(--dur-fast)] hover:brightness-[1.05] active:translate-y-px"
          >
            Começar a trilha do seu bebê
            <ArrowRight className="size-5" aria-hidden />
          </Link>
          <Link to="/trilha" className="text-sm font-semibold text-indigo underline underline-offset-4 hover:text-azul">
            Ou dê uma olhada na trilha primeiro
          </Link>
        </motion.div>
      </div>

      {/* soft veil into the next section */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 [background-image:var(--grad-veil)]" aria-hidden />
    </section>
  )
}

function ProblemaSolucao() {
  const { ref, shown } = useReveal<HTMLDivElement>()

  return (
    <Section reveal={false} className="bg-paper-2">
      <div ref={ref} className="u-shell">
        <SectionHead
          center
          eyebrow="Por que a Prumo existe"
          titulo="Hoje, o cuidado se parte em dois"
          descricao="Quando o bebê nasce, o foco muda da mãe para a criança — e o histórico da gestação some. A Prumo une as duas pontas."
        />

        <div className="mt-xl grid items-center gap-lg lg:grid-cols-[1fr_auto_1fr]">
          <div
            className={cn('u-reveal rounded-2xl border border-line bg-paper p-lg', shown && 'opacity-100')}
            data-shown={shown}
          >
            <p className="font-display text-sm font-semibold text-ink-mute">Antes</p>
            <h3 className="mt-1 text-xl">Dois mundos que não se falam</h3>
            <ul className="mt-md flex flex-col gap-3 text-ink-soft">
              <li>A obstetrícia cuida da mãe. A pediatria cuida do bebê. Cada uma no seu canto.</li>
              <li>Intercorrências e exames do pré-natal ficam num papel, num PDF, na memória de alguém.</li>
              <li>O médico recomeça do zero. A família repete a história em cada consulta.</li>
            </ul>
          </div>

          <div className="mx-auto hidden size-14 place-items-center rounded-full [background-image:var(--grad-brand)] text-white lg:grid" aria-hidden>
            <ArrowRight className="size-6" />
          </div>

          <div
            className="u-reveal rounded-2xl border-2 border-transparent bg-paper p-lg shadow-lift [background:padding-box_var(--color-paper),border-box_var(--grad-brand)]"
            data-shown={shown}
            style={{ transitionDelay: '120ms' }}
          >
            <p className="u-gradient-text font-display text-sm font-semibold">Com a Prumo</p>
            <h3 className="mt-1 text-xl">Uma trilha contínua</h3>
            <ul className="mt-md flex flex-col gap-3 text-ink-soft">
              <li>Uma linha do tempo única, da vida intrauterina ao acompanhamento da criança.</li>
              <li>Cada exame, cada conduta, cada marco — tudo junto, no lugar certo.</li>
              <li>O médico decide rápido e com segurança. A família sabe sempre o que vem a seguir.</li>
            </ul>
          </div>
        </div>
      </div>
    </Section>
  )
}

const PUBLICOS = [
  {
    icon: HeartHandshake,
    titulo: 'Sou gestante ou mãe',
    texto:
      'Sinta-se amparada e saiba o que vem a seguir — vacinas, marcos, próximos passos — sem virar especialista.',
    to: '/gestantes',
    cta: 'Ver como funciona para você',
  },
  {
    icon: Stethoscope,
    titulo: 'Sou médico',
    texto:
      'Um panorama completo e estruturado da gestação à pediatria. Dado confiável, rápido, sem fricção na hora de decidir.',
    to: '/medicos',
    cta: 'Ver a visão clínica',
  },
]

function Publicos() {
  return (
    <Section>
      <SectionHead
        center
        eyebrow="Um produto, para quem cuida"
        titulo="Por onde você entra?"
      />
      <div className="mt-xl grid gap-md md:grid-cols-2">
        {PUBLICOS.map((p) => {
          const Icon = p.icon
          return (
            <Link
              key={p.to}
              to={p.to}
              className="group flex flex-col gap-3 rounded-2xl border border-line bg-paper p-lg shadow-soft transition-[transform,box-shadow,border-color] duration-[var(--dur-base)] ease-out hover:-translate-y-1 hover:border-[var(--color-lilas-soft)] hover:shadow-lift"
            >
              <span className="grid size-14 place-items-center rounded-2xl [background-image:var(--grad-brand-soft)] text-indigo">
                <Icon className="size-7" aria-hidden />
              </span>
              <h3 className="text-2xl">{p.titulo}</h3>
              <p className="text-ink-soft">{p.texto}</p>
              <span className="mt-auto inline-flex items-center gap-2 font-display font-semibold text-indigo">
                {p.cta}
                <ArrowRight className="size-4 transition-transform duration-[var(--dur-fast)] group-hover:translate-x-1" aria-hidden />
              </span>
            </Link>
          )
        })}
      </div>
    </Section>
  )
}

const BENEFICIOS = [
  {
    icon: Route,
    titulo: 'A trilha é o caminho',
    texto: 'Você sempre sabe onde está e o que vem depois. Sem ansiedade, sem adivinhação.',
  },
  {
    icon: Sparkles,
    titulo: 'Sistematizado, não solto',
    texto: 'Marcos de desenvolvimento, calendário vacinal e condutas, tudo no tempo certo.',
  },
  {
    icon: ShieldCheck,
    titulo: 'Seguro por dentro',
    texto: 'Dados de saúde tratados com o cuidado que eles pedem. Você no controle, sempre.',
  },
]

function Beneficios() {
  return (
    <Section className="bg-paper-2">
      <SectionHead center eyebrow="O que muda no seu dia" titulo="Menos peso, mais direção" />
      <div className="mt-xl grid gap-md sm:grid-cols-3">
        {BENEFICIOS.map((b) => {
          const Icon = b.icon
          return (
            <div key={b.titulo} className="flex flex-col gap-3 rounded-2xl bg-paper p-lg shadow-soft">
              <Icon className="size-8 text-indigo" aria-hidden />
              <h3 className="text-xl">{b.titulo}</h3>
              <p className="text-ink-soft">{b.texto}</p>
            </div>
          )
        })}
      </div>
    </Section>
  )
}

function ChamadaFinal() {
  return (
    <Section>
      <div className="relative overflow-hidden rounded-2xl [background-image:var(--grad-brand)] px-lg py-2xl text-center text-white sm:px-2xl">
        <Blob variant="c" intensity={0.3} className="left-10 top-0 size-72 mix-blend-soft-light" />
        <h2 className="mx-auto max-w-2xl text-3xl text-white sm:text-4xl">
          O caminho do seu bebê começa agora
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-white/90">
          Em três passos, sem formulário chato. Comece pela trilha e sinta como é ter
          tudo no prumo.
        </p>
        <Link
          to="/onboarding"
          className="mt-lg inline-flex h-14 items-center gap-2 rounded-pill bg-paper px-8 font-display text-lg font-semibold text-indigo shadow-lift transition-transform duration-[var(--dur-fast)] hover:scale-[1.02] active:translate-y-px"
        >
          Começar a trilha
          <ArrowRight className="size-5" aria-hidden />
        </Link>
      </div>
    </Section>
  )
}

import { Link } from 'react-router-dom'
import { Bell, HeartHandshake, Lock, MapPin, MessageCircleHeart, ShieldCheck } from 'lucide-react'
import { Section, SectionHead } from '@/components/Section'
import { Blob } from '@/components/Blob'

const COMO = [
  {
    icon: MapPin,
    titulo: 'Você sempre sabe onde está',
    texto: 'A trilha mostra a etapa atual e a próxima. Nada de descobrir as coisas tarde demais.',
  },
  {
    icon: Bell,
    titulo: 'Lembretes na hora certa',
    texto: 'Vacinas, exames e marcos aparecem quando importam — sem virar mais uma lista de tarefas.',
  },
  {
    icon: MessageCircleHeart,
    titulo: 'Explicado como gente fala',
    texto: 'Cada etapa vem com o que fazer e o que esperar, em português claro. Zero jargão.',
  },
]

const DADOS = [
  { icon: Lock, texto: 'Seus dados de saúde ficam protegidos e nunca são vendidos.' },
  { icon: ShieldCheck, texto: 'Só quem você autoriza consegue ver a sua trilha.' },
  { icon: HeartHandshake, texto: 'Você pode exportar tudo ou apagar sua conta quando quiser.' },
]

export default function GestantesPage() {
  return (
    <>
      <section className="relative overflow-hidden">
        <Blob variant="b" intensity={0.5} className="-right-24 -top-10 size-[28rem]" />
        <div className="u-shell flex flex-col gap-md py-3xl">
          <span className="u-eyebrow">Para gestantes e mães</span>
          <h1 className="max-w-3xl text-4xl sm:text-display">
            Você não está sozinha <span className="u-gradient-text">nesse caminho</span>
          </h1>
          <p className="max-w-xl text-lg text-ink-soft sm:text-xl">
            A Prumo transforma a gestação e os primeiros anos numa trilha clara e
            previsível. Você cuida do seu bebê com tranquilidade — a gente organiza o resto.
          </p>
          <div>
            <Link
              to="/onboarding"
              className="inline-flex h-14 items-center rounded-pill px-8 font-display text-lg font-semibold text-white shadow-lift [background-image:var(--grad-brand)] transition-[filter] duration-[var(--dur-fast)] hover:brightness-[1.05]"
            >
              Começar a trilha do seu bebê
            </Link>
          </div>
        </div>
      </section>

      <Section className="bg-paper-2">
        <SectionHead center eyebrow="Como funciona" titulo="Simples de usar, no seu ritmo" />
        <div className="mt-xl grid gap-md sm:grid-cols-3">
          {COMO.map((c) => {
            const Icon = c.icon
            return (
              <div key={c.titulo} className="flex flex-col gap-3 rounded-2xl bg-paper p-lg shadow-soft">
                <span className="grid size-12 place-items-center rounded-xl [background-image:var(--grad-brand-soft)] text-indigo">
                  <Icon className="size-6" aria-hidden />
                </span>
                <h3 className="text-xl">{c.titulo}</h3>
                <p className="text-ink-soft">{c.texto}</p>
              </div>
            )
          })}
        </div>
      </Section>

      <Section>
        <div className="grid items-center gap-xl lg:grid-cols-2">
          <div className="flex flex-col gap-md">
            <SectionHead
              eyebrow="O que você ganha"
              titulo="Menos ansiedade, mais clareza"
              descricao="A gente elimina a dúvida do 'e agora?'. Cada passo é acolhido, explicado e no tempo certo — do pré-natal ao primeiro aninho."
            />
            <Link to="/trilha" className="font-display font-semibold text-indigo underline underline-offset-4 hover:text-azul">
              Ver a trilha completa →
            </Link>
          </div>

          <div className="rounded-2xl border border-line bg-paper-2 p-lg">
            <p className="font-display text-sm font-semibold text-indigo">Seus dados, do seu jeito</p>
            <ul className="mt-md flex flex-col gap-3">
              {DADOS.map((d) => {
                const Icon = d.icon
                return (
                  <li key={d.texto} className="flex items-start gap-3 text-ink-soft">
                    <Icon className="mt-0.5 size-5 shrink-0 text-indigo" aria-hidden />
                    {d.texto}
                  </li>
                )
              })}
            </ul>
            <Link to="/seguranca" className="mt-md inline-block text-sm font-semibold text-indigo underline underline-offset-4">
              Entenda como cuidamos dos seus dados
            </Link>
          </div>
        </div>
      </Section>
    </>
  )
}

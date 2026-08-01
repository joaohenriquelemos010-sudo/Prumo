import { Suspense, useState } from 'react'
import { NavLink, Outlet, useLocation, useMatches, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Material } from '@/components/Material'
import { useMovimento } from '@/lib/motion'
import { useBordaDeRolagem } from '@/lib/hooks/useBordaDeRolagem'
import {
  Home,
  Route,
  CalendarDays,
  Syringe,
  LogOut,
  Activity,
  NotebookPen,
  FlaskConical,
  MapPin,
  Link2,
  Users,
  ShieldCheck,
  BarChart3,
  MoreHorizontal,
  Baby,
  BellRing,
  Wallet,
} from 'lucide-react'
import { Logo } from '@/components/Logo'
import { BottomSheet } from '@/components/BottomSheet'
import { ThemeToggle } from '@/components/ThemeToggle'
import { useAuth } from '@/lib/stores/auth'
import type { Papel } from '@/lib/stores/auth'
import { useTrilha } from '@/lib/stores/trilha'
import { PageFallback } from './PageFallback'
import { cn } from '@/lib/cn'

interface NavItem {
  to: string
  label: string
  icon: typeof Home
}

// The family walks a journey; the doctor reads a clinical record. Different jobs,
// different navigation. Both share Vacinas, Agenda and Caderninho.
//
// The first four of each list are the phone's primary tabs — order matters here.
// Everything after them stays one tap away behind "Mais", never out of reach.
const NAV_PACIENTE: NavItem[] = [
  { to: '/app', label: 'Início', icon: Home },
  { to: '/app/trilha', label: 'Trilha', icon: Route },
  { to: '/app/bebe', label: 'Bebê', icon: Baby },
  { to: '/app/agenda', label: 'Agenda', icon: CalendarDays },
  { to: '/app/profissionais', label: 'Agendar', icon: MapPin },
  { to: '/app/exames', label: 'Exames', icon: FlaskConical },
  { to: '/app/caderninho', label: 'Caderninho', icon: NotebookPen },
  { to: '/app/vacinas', label: 'Vacinas', icon: Syringe },
  { to: '/app/comunidade', label: 'Comunidade', icon: Users },
  { to: '/app/lembretes', label: 'Lembretes', icon: BellRing },
  { to: '/app/compartilhar', label: 'Conectar', icon: Link2 },
]

/**
 * Rótulos de consultório, não de software. Quem usa isto é uma obstetra entre
 * duas consultas — "Painel" não diz o que tem lá dentro, "Meu dia" diz.
 *
 * E são **quatro** destinos, nenhum deles uma tela clínica.
 *
 * Prontuário, consultas, exames, bebê, vacinas e dúvidas **saíram do menu** — não
 * porque sumiram, mas porque nunca foram lugares: eram seis portas para a mesma
 * sala, todas agindo sobre uma "paciente ativa" invisível que o médico tinha
 * escolhido em outra tela. Trocar de aba sem saber de quem era o prontuário é o
 * defeito, e mais itens no menu era o sintoma.
 *
 * Agora tudo o que é *de alguém* mora dentro da paciente (`/app/pacientes/:id`),
 * onde o nome dela está no cabeçalho e na URL. O menu ficou com o que é do
 * médico: o dia dele, a agenda dele, a lista dele, o dinheiro dele.
 */
const NAV_MEDICO: NavItem[] = [
  { to: '/app', label: 'Meu dia', icon: Activity },
  { to: '/app/agenda', label: 'Agenda', icon: CalendarDays },
  { to: '/app/pacientes', label: 'Pacientes', icon: Users },
  { to: '/app/financeiro', label: 'Financeiro', icon: Wallet },
]

const NAV_ADMIN: NavItem[] = [
  { to: '/app', label: 'Administração', icon: ShieldCheck },
  { to: '/app/admin', label: 'Painel admin', icon: BarChart3 },
]

function navFor(papel: Papel | undefined): NavItem[] {
  if (papel === 'medico') return NAV_MEDICO
  if (papel === 'admin') return NAV_ADMIN
  return NAV_PACIENTE
}

/** How many destinations fit as tabs before "Mais" takes over. */
const TABS_PRIMARIAS = 4

/**
 * The authenticated shell. Duolingo-like: a soft side rail on desktop, a thumb-
 * friendly bottom bar on mobile. One clear place for everything — and everything
 * the rail shows, the phone can reach too.
 */
export function InternalLayout() {
  const user = useAuth((s) => s.user)
  const logout = useAuth((s) => s.logout)
  const resetDemo = useTrilha((s) => s.resetDemo)
  const navigate = useNavigate()
  const location = useLocation()
  const [maisAberto, setMaisAberto] = useState(false)

  const { ativo, duracao } = useMovimento()
  /** `handle: { largura: 'ampla' }` na rota. Ver `router.tsx`. */
  const ampla = useMatches().some(
    (m) => (m.handle as { largura?: string } | undefined)?.largura === 'ampla',
  )
  const { sentinela, rolado } = useBordaDeRolagem()

  const items = navFor(user?.papel)
  const primarias = items.slice(0, TABS_PRIMARIAS)
  const secundarias = items.slice(TABS_PRIMARIAS)
  const temMais = secundarias.length > 0
  const emSecundaria = secundarias.some((i) => location.pathname === i.to)

  async function handleLogout() {
    setMaisAberto(false)
    await logout()
    resetDemo()
    navigate('/')
  }

  return (
    <div className="min-h-screen bg-paper-2 md:grid md:grid-cols-[248px_1fr]">
      {/* Desktop side rail */}
      <aside className="sticky top-0 hidden h-screen flex-col gap-lg border-r border-line bg-paper p-lg md:flex">
        <div className="flex items-center justify-between gap-2">
          <NavLink to="/" aria-label="Prumo — início">
            <Logo variant="full" className="h-9" />
          </NavLink>
          <ThemeToggle className="-mr-2 shrink-0" />
        </div>

        <nav aria-label="Área da plataforma" className="flex flex-1 flex-col gap-1">
          {items.map((item) => (
            <RailLink key={item.to} item={item} />
          ))}
        </nav>

        <div className="flex flex-col gap-1 border-t border-line pt-md">
          <NavLink
            to="/app/perfil"
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-ink-soft hover:bg-paper-2',
                isActive && 'bg-paper-2 text-indigo',
              )
            }
          >
            <Avatar nome={user?.nome} className="size-8 text-sm" />
            <span className="truncate">{user?.nome ?? 'Meu perfil'}</span>
          </NavLink>
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-ink-soft hover:bg-paper-2"
          >
            <LogOut className="size-5" aria-hidden />
            Sair
          </button>
        </div>
      </aside>

      {/* Content. The bottom padding tracks the real bar height + the home
          indicator, instead of guessing with a magic number. */}
      <div className="[padding-bottom:calc(var(--nav-h)+env(safe-area-inset-bottom))] md:pb-0">
        {/* O fio da barra inferior só aparece quando há conteúdo passando por
            baixo dela. Uma borda permanente divide a tela mesmo quando não há
            nada para separar. */}
        <span ref={sentinela} aria-hidden className="block h-px" />
        <AnimatePresence mode="wait">
          <motion.main
            key={location.pathname}
            /**
             * Entra por baixo e sai por cima — a mesma direção da leitura. Com
             * movimento reduzido vira cross-fade puro: `y: 0` nos dois extremos
             * tira o deslocamento vestibular e mantém a transição legível.
             */
            initial={{ opacity: 0, y: ativo ? 8 : 0 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: ativo ? -8 : 0 }}
            transition={duracao(0.24)}
            className={cn(
              'mx-auto px-md py-lg sm:px-lg sm:py-xl',
              /*
               * Largura por rota. O texto do produto quer medida de leitura, mas
               * um calendário de sete colunas dentro de 896px vira scroll
               * horizontal — foi assim que a semana apareceu com cinco dias e
               * uma barra de rolagem embaixo. A rota diz de quanto precisa.
               */
              ampla ? 'max-w-[1400px]' : 'max-w-4xl',
            )}
          >
            <Suspense fallback={<PageFallback />}>
              <Outlet />
            </Suspense>
          </motion.main>
        </AnimatePresence>
      </div>

      {/* Mobile bottom bar */}
      <Material
        as="nav"
        peso="denso"
        aria-label="Área da plataforma"
        className={cn(
          'fixed inset-x-0 bottom-0 z-40 flex items-stretch justify-around px-1',
          '[padding-bottom:env(safe-area-inset-bottom)] md:hidden',
          'transition-[border-color] duration-[var(--dur-fast)]',
          rolado ? 'border-t-line' : 'border-t-transparent',
        )}
      >
        {primarias.map((item) => (
          <BottomLink key={item.to} item={item} />
        ))}
        {temMais ? (
          <button
            type="button"
            onClick={() => setMaisAberto(true)}
            aria-haspopup="dialog"
            aria-expanded={maisAberto}
            className={cn(
              'flex min-h-[var(--nav-h)] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-1 text-[0.7rem] font-semibold',
              emSecundaria || maisAberto ? 'text-indigo' : 'text-ink-soft',
            )}
          >
            <MoreHorizontal className="size-5" aria-hidden />
            <span className="truncate">Mais</span>
          </button>
        ) : (
          <BottomLink item={{ to: '/app/perfil', label: 'Perfil', icon: Home }} perfil />
        )}
      </Material>

      <BottomSheet aberto={maisAberto} onFechar={() => setMaisAberto(false)} titulo="Tudo na Prumo">
        <nav aria-label="Mais destinos" className="flex flex-col gap-1">
          {secundarias.map((item) => (
            <SheetLink key={item.to} item={item} onNavegar={() => setMaisAberto(false)} />
          ))}
        </nav>

        <div className="mt-sm flex flex-col gap-1 border-t border-line pt-sm">
          <NavLink
            to="/app/perfil"
            onClick={() => setMaisAberto(false)}
            className={({ isActive }) =>
              cn(
                'flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-ink-soft hover:bg-paper-2',
                isActive && 'bg-paper-2 text-indigo',
              )
            }
          >
            <Avatar nome={user?.nome} className="size-7 text-xs" />
            <span className="truncate">{user?.nome ?? 'Meu perfil'}</span>
          </NavLink>
          <ThemeToggle variant="linha" />
          <button
            type="button"
            onClick={handleLogout}
            className="flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-ink-soft hover:bg-paper-2"
          >
            <LogOut className="size-5 shrink-0" aria-hidden />
            Sair
          </button>
        </div>
      </BottomSheet>
    </div>
  )
}

function Avatar({ nome, className }: { nome?: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'grid shrink-0 place-items-center rounded-full font-semibold [background-image:var(--grad-brand-soft)] text-indigo',
        className,
      )}
    >
      {nome?.charAt(0).toUpperCase() ?? '?'}
    </span>
  )
}

function RailLink({ item }: { item: NavItem }) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.to}
      end={item.to === '/app'}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-ink-soft transition-colors duration-[var(--dur-fast)] hover:bg-paper-2 hover:text-indigo',
          isActive && 'bg-paper-2 text-indigo',
        )
      }
    >
      <Icon className="size-5" aria-hidden />
      {item.label}
    </NavLink>
  )
}

function SheetLink({ item, onNavegar }: { item: NavItem; onNavegar: () => void }) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.to}
      end={item.to === '/app'}
      onClick={onNavegar}
      className={({ isActive }) =>
        cn(
          'flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-ink-soft hover:bg-paper-2',
          isActive && 'bg-paper-2 text-indigo',
        )
      }
    >
      <Icon className="size-5 shrink-0" aria-hidden />
      {item.label}
    </NavLink>
  )
}

/**
 * Uma aba da barra inferior.
 *
 * O realce da aba ativa é **um** elemento que se move entre as posições, via
 * `layoutId`, e não cinco fundos aparecendo e sumindo. O olho segue o objeto,
 * entende que é o mesmo, e a troca de aba deixa de ser um corte para virar um
 * movimento. Mola firme: houve um toque, não um gesto com momento.
 */
function BottomLink({ item, perfil }: { item: NavItem; perfil?: boolean }) {
  const user = useAuth((s) => s.user)
  const { mola } = useMovimento()
  const Icon = item.icon

  return (
    <NavLink
      to={item.to}
      end={item.to === '/app'}
      className={({ isActive }) =>
        cn(
          'relative flex min-h-[var(--nav-h)] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-1 text-[0.7rem] font-semibold text-ink-soft',
          isActive && 'text-indigo',
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <motion.span
              layoutId="nav-pilula"
              transition={mola('firme')}
              aria-hidden
              className="absolute inset-x-1.5 inset-y-1.5 rounded-xl [background-image:var(--grad-brand-soft)]"
            />
          )}
          {/* Acima da pílula. Z negativo não serviria: dentro de um NavLink
              `relative`, o elemento iria parar atrás do próprio material. */}
          <span className="relative">
            {perfil ? (
              <Avatar nome={user?.nome} className="size-6 text-[0.65rem]" />
            ) : (
              <Icon className="size-5" aria-hidden />
            )}
          </span>
          <span className="relative truncate">{item.label}</span>
        </>
      )}
    </NavLink>
  )
}

import { Link } from 'react-router-dom'
import { Logo } from '@/components/Logo'

/**
 * Footer archetype Ft5 (statement + slim links). A warm closing line, the
 * wordmark, and honest secondary navigation. No fake social proof.
 */
export function Footer() {
  return (
    <footer className="relative mt-3xl overflow-hidden border-t border-line bg-paper-2">
      <div className="u-shell grid gap-xl py-2xl md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="flex flex-col gap-md">
          <Logo variant="wordmark" className="h-7" label="Prumo" />
          <p className="max-w-sm text-ink-soft">
            Estar no prumo é seguir com equilíbrio e direção. A gente cuida para
            que nada do caminho do seu bebê se perca — da gestação ao primeiro ano.
          </p>
        </div>

        <nav aria-label="Navegação do rodapé" className="flex flex-col gap-2 text-sm">
          <span className="font-display font-semibold text-indigo">A plataforma</span>
          <Link to="/trilha" className="text-ink-soft hover:text-indigo">A Trilha</Link>
          <Link to="/gestantes" className="text-ink-soft hover:text-indigo">Para gestantes e mães</Link>
          <Link to="/medicos" className="text-ink-soft hover:text-indigo">Para médicos</Link>
          <Link to="/onboarding" className="text-ink-soft hover:text-indigo">Começar agora</Link>
        </nav>

        <nav aria-label="Confiança e dados" className="flex flex-col gap-2 text-sm">
          <span className="font-display font-semibold text-indigo">Seus dados</span>
          <Link to="/seguranca" className="text-ink-soft hover:text-indigo">Segurança e privacidade</Link>
          <Link to="/seguranca#lgpd" className="text-ink-soft hover:text-indigo">Seus direitos (LGPD)</Link>
          <Link to="/seguranca#controle" className="text-ink-soft hover:text-indigo">Exportar ou excluir dados</Link>
        </nav>
      </div>

      <div className="u-shell flex flex-col gap-2 border-t border-line py-md text-xs text-ink-mute sm:flex-row sm:items-center sm:justify-between">
        <span>© {new Date().getFullYear()} Prumo. Feito com cuidado.</span>
        <span>
          Este é um protótipo. Não substitui a orientação do seu médico ou da sua
          equipe de saúde.
        </span>
      </div>
    </footer>
  )
}

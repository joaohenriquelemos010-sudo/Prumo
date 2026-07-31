import { useState } from 'react'
import { KeyRound } from 'lucide-react'
import { api } from '@/lib/api/client'
import { useAuth } from '@/lib/stores/auth'
import { Button } from '@/components/Button'
import { AlertaErro } from '@/components/AlertaErro'

/**
 * Trocar a senha.
 *
 * Pede a senha atual mesmo com a sessão já válida, e o servidor exige o mesmo.
 * Não é burocracia: é o que impede que um cookie roubado vire uma troca de
 * senha, que é como um invasor tranca a dona do lado de fora da própria conta.
 */
export function TrocarSenha({
  obrigatoria = false,
  onTrocada,
}: {
  obrigatoria?: boolean
  onTrocada?: () => void
}) {
  const [senhaAtual, setSenhaAtual] = useState('')
  const [novaSenha, setNovaSenha] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [pronto, setPronto] = useState(false)
  const recarregar = useAuth((s) => s.recarregar)

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)

    // Conferido aqui e não no servidor: a confirmação é um cuidado com quem
    // digita, não uma regra sobre o dado. O servidor valida o que importa.
    if (novaSenha !== confirmar) {
      setErro('As duas senhas não são iguais.')
      return
    }

    setEnviando(true)
    try {
      await api.post('/auth/trocar-senha', { senhaAtual, novaSenha })
      setPronto(true)
      setSenhaAtual('')
      setNovaSenha('')
      setConfirmar('')
      // Recarrega a sessão: é o que apaga `trocaSenhaObrigatoria` e libera o app.
      await recarregar()
      onTrocada?.()
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não consegui trocar agora.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <section className="rounded-2xl border border-line bg-paper p-lg shadow-soft">
      <div className="flex items-center gap-2">
        <KeyRound className="size-5 text-indigo" aria-hidden />
        <h2 className="text-lg">{obrigatoria ? 'Escolha sua senha' : 'Trocar a senha'}</h2>
      </div>
      <p className="mt-1 text-ink-soft">
        {obrigatoria
          ? 'Sua conta foi criada com uma senha provisória. Escolha uma sua para continuar — uma senha inicial que ninguém troca é uma senha compartilhada.'
          : 'Precisamos da senha atual junto: é o que impede que alguém com acesso ao seu aparelho troque a sua senha.'}
      </p>

      <form onSubmit={enviar} className="mt-md flex max-w-md flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold text-ink">Senha atual</span>
          <input
            type="password"
            className="input"
            autoComplete="current-password"
            value={senhaAtual}
            onChange={(e) => setSenhaAtual(e.target.value)}
            required
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold text-ink">Nova senha</span>
          <input
            type="password"
            className="input"
            autoComplete="new-password"
            minLength={8}
            value={novaSenha}
            onChange={(e) => setNovaSenha(e.target.value)}
            required
          />
          <span className="text-xs text-ink-mute">Pelo menos 8 caracteres.</span>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-semibold text-ink">Repita a nova senha</span>
          <input
            type="password"
            className="input"
            autoComplete="new-password"
            value={confirmar}
            onChange={(e) => setConfirmar(e.target.value)}
            required
          />
        </label>

        {erro && <AlertaErro>{erro}</AlertaErro>}
        {pronto && !erro && (
          <p role="status" className="text-sm font-semibold text-success-ink">
            Senha trocada.
          </p>
        )}

        <Button type="submit" loading={enviando} className="self-start">
          Salvar nova senha
        </Button>
      </form>
    </section>
  )
}

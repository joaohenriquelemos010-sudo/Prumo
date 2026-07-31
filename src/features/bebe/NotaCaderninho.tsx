import { Link } from 'react-router-dom'

/**
 * O convite ao caderninho.
 *
 * Fecha toda tela de leitura da família com a mesma saída: se um número aqui
 * deixou você em dúvida, a dúvida tem para onde ir e volta na próxima consulta.
 * Uma tela clínica que não oferece isso deixa a pessoa sozinha com a pergunta.
 */
export function NotaCaderninho({ texto }: { texto: string }) {
  return (
    <p className="rounded-xl bg-paper-2 p-md text-xs text-ink-mute">
      {texto} Se algo aqui te deixar em dúvida, anote no{' '}
      <Link to="/app/caderninho" className="font-semibold text-indigo underline underline-offset-2">
        caderninho
      </Link>{' '}
      e leve para a próxima consulta.
    </p>
  )
}
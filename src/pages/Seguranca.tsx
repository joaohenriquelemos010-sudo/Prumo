import { useState } from 'react'
import { Cookie, Download, Eye, KeyRound, Lock, Server, Trash2, UserCheck } from 'lucide-react'
import { Section, SectionHead } from '@/components/Section'
import { Blob } from '@/components/Blob'
import { Button } from '@/components/Button'
import { useConsent } from '@/lib/stores/consent'
import { emitAuditEvent } from '@/lib/audit'

const PILARES = [
  {
    icon: Lock,
    titulo: 'Criptografia de ponta a ponta em trânsito',
    texto: 'Tudo que trafega entre você e a Prumo vai protegido. Ninguém no meio do caminho lê seus dados.',
  },
  {
    icon: KeyRound,
    titulo: 'Sessão em cookie seguro',
    texto: 'Sua sessão fica num cookie httpOnly que o JavaScript não acessa. Nada de dado de saúde guardado no navegador.',
  },
  {
    icon: Eye,
    titulo: 'Quem vê o quê',
    texto: 'Só você e os profissionais que você autoriza têm acesso à sua trilha. Cada acesso fica registrado.',
  },
  {
    icon: Server,
    titulo: 'Rastreabilidade clínica',
    texto: 'Toda ação sensível gera um registro. Numa plataforma de saúde, saber quem fez o quê e quando não é opcional.',
  },
]

export default function SegurancaPage() {
  return (
    <>
      <section className="relative overflow-hidden">
        <Blob variant="b" intensity={0.45} className="-right-24 -top-10 size-[26rem]" />
        <div className="u-shell flex flex-col gap-md py-3xl">
          <span className="u-eyebrow">Segurança e privacidade</span>
          <h1 className="max-w-3xl text-4xl sm:text-display-s">
            A saúde do seu bebê pede o cuidado mais alto
          </h1>
          <p className="max-w-2xl text-lg text-ink-soft">
            Aqui a gente explica, sem juridiquês, o que a Prumo faz para proteger seus
            dados — e o que você controla. Segurança é requisito de produto, não detalhe técnico.
          </p>
        </div>
      </section>

      <Section reveal={false} className="bg-paper-2">
        <div className="u-shell grid gap-md sm:grid-cols-2">
          {PILARES.map((p) => {
            const Icon = p.icon
            return (
              <div key={p.titulo} className="flex gap-4 rounded-2xl bg-paper p-lg shadow-soft">
                <span className="grid size-12 shrink-0 place-items-center rounded-xl [background-image:var(--grad-brand-soft)] text-indigo">
                  <Icon className="size-6" aria-hidden />
                </span>
                <div>
                  <h3 className="text-lg">{p.titulo}</h3>
                  <p className="mt-1 text-ink-soft">{p.texto}</p>
                </div>
              </div>
            )
          })}
        </div>
      </Section>

      <Section id="lgpd">
        <SectionHead
          eyebrow="Seus direitos (LGPD)"
          titulo="Os dados são seus. Ponto."
          descricao="A Lei Geral de Proteção de Dados garante que você mande no que é seu. A Prumo nasce alinhada a ela."
        />
        <ul className="mt-lg grid gap-3 sm:grid-cols-2">
          {[
            'Saber exatamente quais dados guardamos e por quê.',
            'Corrigir qualquer informação incorreta.',
            'Retirar seu consentimento a qualquer momento.',
            'Levar seus dados com você (portabilidade).',
          ].map((item) => (
            <li key={item} className="flex items-start gap-3 rounded-xl bg-paper-2 p-md text-ink-soft">
              <UserCheck className="mt-0.5 size-5 shrink-0 text-indigo" aria-hidden />
              {item}
            </li>
          ))}
        </ul>
      </Section>

      <ControleDados />
      <ConsentimentoAtual />
    </>
  )
}

function ControleDados() {
  const [estado, setEstado] = useState<'idle' | 'export' | 'delete'>('idle')

  function exportar() {
    emitAuditEvent('privacy.data_export_requested')
    setEstado('export')
  }

  function excluir() {
    emitAuditEvent('privacy.account_deletion_requested')
    setEstado('delete')
  }

  return (
    <Section id="controle" className="bg-paper-2">
      <SectionHead
        eyebrow="Controle total"
        titulo="Exportar ou excluir — quando você quiser"
        descricao="Sem formulário escondido, sem falar com atendente. Dois botões, de verdade."
      />
      <div className="mt-lg grid gap-md sm:grid-cols-2">
        <div className="flex flex-col gap-3 rounded-2xl border border-line bg-paper p-lg shadow-soft">
          <Download className="size-7 text-indigo" aria-hidden />
          <h3 className="text-lg">Exportar meus dados</h3>
          <p className="text-ink-soft">Baixe tudo o que a Prumo tem sobre você e seu bebê, num arquivo só.</p>
          <div className="mt-auto">
            <Button variant="secondary" onClick={exportar}>
              Exportar meus dados
            </Button>
            {estado === 'export' && (
              <p role="status" className="mt-2 text-sm font-semibold text-success">
                Pedido registrado. Você receberá o arquivo com segurança.
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-2xl border border-line bg-paper p-lg shadow-soft">
          <Trash2 className="size-7 text-indigo" aria-hidden />
          <h3 className="text-lg">Excluir minha conta</h3>
          <p className="text-ink-soft">Apaga sua conta e seus dados de forma definitiva. A decisão é só sua.</p>
          <div className="mt-auto">
            <Button variant="ghost" onClick={excluir}>
              Excluir minha conta
            </Button>
            {estado === 'delete' && (
              <p role="status" className="mt-2 text-sm font-semibold text-warn">
                Pedido registrado. Enviaremos uma confirmação antes de apagar qualquer coisa.
              </p>
            )}
          </div>
        </div>
      </div>
    </Section>
  )
}

function ConsentimentoAtual() {
  const { analytics, comunicacoes, setConsent } = useConsent()

  return (
    <Section>
      <div className="rounded-2xl border border-line bg-paper p-lg shadow-soft">
        <div className="flex items-center gap-2">
          <Cookie className="size-5 text-indigo" aria-hidden />
          <h3 className="text-lg">Suas preferências de consentimento</h3>
        </div>
        <p className="mt-1 text-ink-soft">Mude de ideia quando quiser. O essencial é sempre necessário para a Prumo funcionar.</p>

        <div className="mt-md flex flex-col gap-3">
          <PrefRow
            label="Melhorar a Prumo (analytics anônimo)"
            checked={analytics}
            onChange={(v) => setConsent({ analytics: v, comunicacoes })}
          />
          <PrefRow
            label="Receber comunicações e lembretes"
            checked={comunicacoes}
            onChange={(v) => setConsent({ analytics, comunicacoes: v })}
          />
        </div>
      </div>
    </Section>
  )
}

function PrefRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-md rounded-xl bg-paper-2 px-4 py-3">
      <span className="font-semibold text-ink">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={
          'flex h-6 w-11 shrink-0 items-center rounded-pill p-0.5 transition-colors duration-[var(--dur-fast)] ' +
          (checked ? '[background-image:var(--grad-brand)]' : 'bg-paper-3')
        }
      >
        <span
          className={
            'size-5 rounded-full bg-white shadow-soft transition-transform duration-[var(--dur-fast)] ' +
            (checked ? 'translate-x-5' : '')
          }
        />
      </button>
    </div>
  )
}

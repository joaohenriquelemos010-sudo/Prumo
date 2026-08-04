import { useId, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  Baby,
  BriefcaseMedical,
  Camera,
  CheckCircle2,
  Clock3,
  Heart,
  Loader2,
  MapPin,
  MessageCircle,
  Phone,
  Plus,
  Search,
  Trash2,
  User,
  Users,
  X,
} from 'lucide-react'
import { Campo, CampoArea, CampoSelect } from '@/components/Campo'
import { Button } from '@/components/Button'
import { formatarCPF, formatarTelefone, hojeISO, somenteDigitos, UFS } from '@/lib/br-docs'
import { reduzirParaAvatar } from '@/lib/imagem'
import { cn } from '@/lib/cn'
import { buscarCep, cepCompleto } from '@/features/cadastro/cep'
import {
  DIAS_SEMANA,
  ESTADOS_CIVIS,
  MOMENTOS,
  PARENTESCOS,
  PERIODOS,
  SEXOS,
  formatarCEP,
  formatarValidade,
  limparCarteirinha,
  limparRG,
} from '@/features/cadastro/paciente'
import type { DadosPaciente, Endereco, ErrosPaciente, IdSecao } from '@/features/cadastro/paciente'

/**
 * A ficha da paciente — os oito blocos, um componente.
 *
 * A mesma ficha é preenchida em dois lugares muito diferentes: a recepção, num
 * monitor largo, com pressa e teclado; e a paciente, no celular, sentada na sala
 * de espera. Duas telas separadas divergiriam em uma semana — um campo novo
 * entraria só de um lado, e a metade que a paciente preenche deixaria de casar
 * com a metade que a clínica confere. Então é um componente só, e o que muda
 * entre os dois é o que envolve, não o que se pergunta.
 *
 * ## As decisões de UX que estão dentro daqui
 *
 * - **Máscara enquanto digita**, nunca depois. CPF, telefone, CEP e validade
 *   ganham a pontuação na hora — quem digita não deve traduzir nada.
 * - **O CEP preenche o endereço.** Oito dígitos completos disparam a busca
 *   sozinha, e o foco pula para o número, que é o único campo que o serviço não
 *   sabe. Falhou? Os campos seguem editáveis e ninguém fica preso.
 * - **Erro por campo, no campo.** Nada de lista de reclamações no topo.
 * - **Só o que o momento pede aparece.** DPP para gestante, nascimento para
 *   quem já teve o bebê. Os dois juntos seriam ruído em qualquer um dos casos.
 */

export interface FormularioPacienteProps {
  valor: DadosPaciente
  onChange: (valor: DadosPaciente) => void
  erros: ErrosPaciente
  /** Seções que esta tela não mostra. */
  ocultar?: IdSecao[]
  /**
   * Quem está preenchendo é a própria paciente. Muda os textos de apoio de
   * "pergunte a ela" para "conte pra gente" — e é a diferença entre um
   * formulário de clínica e um formulário que fala com quem está do outro lado.
   */
  publico?: boolean
  /** Foca a seção assim que ela entra na tela (usado pelo índice lateral). */
  registrarSecao?: (id: IdSecao, elemento: HTMLElement | null) => void
}

export function FormularioPaciente({
  valor,
  onChange,
  erros,
  ocultar = [],
  publico = false,
  registrarSecao,
}: FormularioPacienteProps) {
  const mostrar = (id: IdSecao) => !ocultar.includes(id)
  /*
   * O `id` do campo de número vem do React e não de uma string fixa: a mesma
   * ficha pode aparecer duas vezes na mesma página (uma folha por cima de outra),
   * e dois elementos com o mesmo `id` fariam o foco cair no formulário errado.
   */
  const idNumero = useId()

  /*
   * As alterações partem de um `ref`, não da variável do render.
   *
   * Um `onChange({ ...valor, ...patch })` comum funciona para quem digita — o
   * React já entregou o valor novo antes do próximo evento. Ele quebra no
   * **assíncrono**: a busca de CEP responde algumas centenas de milissegundos
   * depois, com o `valor` congelado do render em que o pedido saiu. O resultado
   * era o próprio CEP recém-digitado sendo apagado pela resposta que ele
   * disparou — e qualquer campo preenchido durante a espera, junto. O `ref`
   * aponta sempre para o último estado confirmado.
   */
  const atual = useRef(valor)
  atual.current = valor

  const alterar = (patch: Partial<DadosPaciente>) => onChange({ ...atual.current, ...patch })
  const alterarEndereco = (patch: Partial<Endereco>) =>
    onChange({ ...atual.current, endereco: { ...atual.current.endereco, ...patch } })
  const alterarConvenio = (patch: Partial<DadosPaciente['convenio']>) =>
    onChange({ ...atual.current, convenio: { ...atual.current.convenio, ...patch } })
  const alterarEmergencia = (patch: Partial<DadosPaciente['emergencia']>) =>
    onChange({ ...atual.current, emergencia: { ...atual.current.emergencia, ...patch } })
  const alterarFamilia = (patch: Partial<DadosPaciente['familia']>) =>
    onChange({ ...atual.current, familia: { ...atual.current.familia, ...patch } })
  const alterarPreferencias = (patch: Partial<DadosPaciente['preferencias']>) =>
    onChange({ ...atual.current, preferencias: { ...atual.current.preferencias, ...patch } })

  return (
    <div className="flex flex-col gap-md">
      {mostrar('identificacao') && (
        <Secao
          id="identificacao"
          numero={1}
          icone={<User className="size-4" aria-hidden />}
          titulo="Identificação"
          registrar={registrarSecao}
        >
          <div className="flex flex-col gap-md sm:flex-row">
            <Foto
              valor={valor.foto}
              onChange={(foto) => alterar({ foto })}
              nome={valor.nome}
              publico={publico}
            />

            <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-12">
              <Campo
                rotulo="Nome completo"
                obrigatorio
                className="sm:col-span-5"
                value={valor.nome}
                onChange={(e) => alterar({ nome: e.target.value })}
                erro={erros.nome}
                maxLength={80}
                autoComplete="name"
                placeholder={publico ? 'Seu nome completo' : 'Digite o nome completo'}
                autoFocus
              />
              <Campo
                rotulo="CPF"
                obrigatorio
                className="sm:col-span-4"
                value={valor.cpf}
                onChange={(e) => alterar({ cpf: formatarCPF(e.target.value) })}
                erro={erros.cpf}
                inputMode="numeric"
                placeholder="000.000.000-00"
              />
              <Campo
                rotulo="RG"
                className="sm:col-span-3"
                value={valor.rg}
                onChange={(e) => alterar({ rg: limparRG(e.target.value) })}
                erro={erros.rg}
                placeholder="00.000.000-0"
              />

              <Campo
                rotulo="Data de nascimento"
                obrigatorio
                className="sm:col-span-3"
                type="date"
                value={valor.dataNascimento}
                onChange={(e) => alterar({ dataNascimento: e.target.value })}
                erro={erros.dataNascimento}
                max={hojeISO()}
                autoComplete="bday"
              />
              <CampoSelect
                rotulo="Sexo"
                obrigatorio
                className="sm:col-span-3"
                value={valor.sexo}
                onChange={(e) => alterar({ sexo: e.target.value as DadosPaciente['sexo'] })}
                erro={erros.sexo}
              >
                <option value="">Selecione</option>
                {SEXOS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.rotulo}
                  </option>
                ))}
              </CampoSelect>
              <CampoSelect
                rotulo="Estado civil"
                className="sm:col-span-3"
                value={valor.estadoCivil}
                onChange={(e) =>
                  alterar({ estadoCivil: e.target.value as DadosPaciente['estadoCivil'] })
                }
              >
                <option value="">Selecione</option>
                {ESTADOS_CIVIS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.rotulo}
                  </option>
                ))}
              </CampoSelect>
              <Campo
                rotulo="Profissão"
                className="sm:col-span-3"
                value={valor.profissao}
                onChange={(e) => alterar({ profissao: e.target.value })}
                maxLength={60}
                placeholder="Digite a profissão"
              />
            </div>
          </div>
        </Secao>
      )}

      {mostrar('momento') && (
        <Secao
          id="momento"
          numero={2}
          icone={<Baby className="size-4" aria-hidden />}
          titulo="Momento da jornada"
          descricao={
            publico
              ? 'É o que abre a trilha certa para você — pré-natal, puericultura ou pré-concepcional.'
              : 'Define a trilha clínica, os checklists e a agenda de retornos desta paciente.'
          }
          registrar={registrarSecao}
        >
          <fieldset className="flex flex-col gap-3">
            <legend className="sr-only">Momento da jornada</legend>
            <div className="flex flex-wrap gap-2">
              {MOMENTOS.map((m) => (
                <Escolha
                  key={m.id}
                  ativo={valor.momento === m.id}
                  onClick={() => alterar({ momento: m.id })}
                  titulo={m.rotulo}
                  ajuda={m.ajuda}
                />
              ))}
            </div>

            {/* Só a data que importa para o momento escolhido — as outras seriam ruído. */}
            {valor.momento === 'gestante' && (
              <Campo
                rotulo="Data provável do parto"
                className="sm:max-w-xs"
                type="date"
                value={valor.dpp}
                onChange={(e) => alterar({ dpp: e.target.value })}
                erro={erros.dpp}
                ajuda="Ainda não fez a ultrassonografia? Pode deixar em branco."
              />
            )}
            {valor.momento === 'ja-nasceu' && (
              <div className="grid gap-3 sm:grid-cols-2">
                <Campo
                  rotulo="Nome do bebê"
                  value={valor.nomeBebe}
                  onChange={(e) => alterar({ nomeBebe: e.target.value })}
                  maxLength={80}
                  placeholder="Como vocês chamam"
                />
                <Campo
                  rotulo="Nascimento do bebê"
                  type="date"
                  value={valor.dataNascimentoBebe}
                  onChange={(e) => alterar({ dataNascimentoBebe: e.target.value })}
                  erro={erros.dataNascimentoBebe}
                  max={hojeISO()}
                />
              </div>
            )}
          </fieldset>
        </Secao>
      )}

      {mostrar('contato') && (
        <Secao
          id="contato"
          numero={3}
          icone={<Phone className="size-4" aria-hidden />}
          titulo="Contato"
          descricao={
            publico
              ? 'É por aqui que o consultório confirma a consulta com você.'
              : 'O celular principal é o que recebe os lembretes de consulta.'
          }
          registrar={registrarSecao}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo
              rotulo="Celular principal"
              obrigatorio
              value={valor.telefone}
              onChange={(e) => alterar({ telefone: formatarTelefone(e.target.value) })}
              erro={erros.telefone}
              inputMode="tel"
              autoComplete="tel"
              placeholder="(00) 00000-0000"
              sufixo={<AtalhoWhatsApp telefone={valor.telefone} />}
            />
            <Campo
              rotulo="Celular secundário"
              value={valor.telefoneSecundario}
              onChange={(e) => alterar({ telefoneSecundario: formatarTelefone(e.target.value) })}
              erro={erros.telefoneSecundario}
              inputMode="tel"
              placeholder="(00) 00000-0000"
              sufixo={<AtalhoWhatsApp telefone={valor.telefoneSecundario} />}
            />
            <Campo
              rotulo="E-mail"
              className="sm:col-span-2"
              type="email"
              value={valor.email}
              onChange={(e) => alterar({ email: e.target.value })}
              erro={erros.email}
              maxLength={120}
              autoComplete="email"
              placeholder="nome@email.com"
            />
          </div>
        </Secao>
      )}

      {mostrar('endereco') && (
        <Secao
          id="endereco"
          numero={4}
          icone={<MapPin className="size-4" aria-hidden />}
          titulo="Endereço"
          opcional
          registrar={registrarSecao}
        >
          <div className="grid gap-3 sm:grid-cols-6">
            {/* O CEP abre a linha do logradouro: é ele que preenche o resto dela. */}
            <BuscaCep
              className="sm:col-span-2"
              endereco={valor.endereco}
              erro={erros['endereco.cep']}
              onEncontrado={(achado) => {
                alterarEndereco(achado)
                // O serviço sabe tudo menos o número. Levar o foco para lá é o
                // que transforma "achou o CEP" em "acabou o endereço".
                requestAnimationFrame(() => document.getElementById(idNumero)?.focus())
              }}
              onChange={(cep) => alterarEndereco({ cep })}
            />
            <Campo
              rotulo="Logradouro"
              className="sm:col-span-4"
              value={valor.endereco.logradouro}
              onChange={(e) => alterarEndereco({ logradouro: e.target.value })}
              maxLength={120}
              autoComplete="street-address"
              placeholder="Rua, avenida, travessa…"
            />
            <Campo
              rotulo="Número"
              className="sm:col-span-2"
              id={idNumero}
              value={valor.endereco.numero}
              onChange={(e) => alterarEndereco({ numero: e.target.value })}
              maxLength={12}
              inputMode="numeric"
              placeholder="123"
            />
            <Campo
              rotulo="Complemento"
              className="sm:col-span-2"
              value={valor.endereco.complemento}
              onChange={(e) => alterarEndereco({ complemento: e.target.value })}
              maxLength={60}
              placeholder="Apto, sala, bloco…"
            />
            <Campo
              rotulo="Bairro"
              className="sm:col-span-2"
              value={valor.endereco.bairro}
              onChange={(e) => alterarEndereco({ bairro: e.target.value })}
              maxLength={60}
              placeholder="Digite o bairro"
            />
            <Campo
              rotulo="Cidade"
              className="sm:col-span-4"
              value={valor.endereco.cidade}
              onChange={(e) => alterarEndereco({ cidade: e.target.value })}
              maxLength={60}
              placeholder="Digite a cidade"
            />
            <CampoSelect
              rotulo="Estado"
              className="sm:col-span-2"
              value={valor.endereco.uf}
              onChange={(e) => alterarEndereco({ uf: e.target.value })}
              erro={erros['endereco.uf']}
            >
              <option value="">Selecione</option>
              {UFS.map((uf) => (
                <option key={uf} value={uf}>
                  {uf}
                </option>
              ))}
            </CampoSelect>
          </div>
        </Secao>
      )}

      {mostrar('convenio') && (
        <Secao
          id="convenio"
          numero={5}
          icone={<BriefcaseMedical className="size-4" aria-hidden />}
          titulo="Convênio"
          opcional
          descricao="Deixe em branco se o atendimento é particular."
          registrar={registrarSecao}
        >
          <div className="grid gap-3 sm:grid-cols-4">
            <Campo
              rotulo="Convênio"
              className="sm:col-span-2"
              value={valor.convenio.operadora}
              onChange={(e) => alterarConvenio({ operadora: e.target.value })}
              maxLength={80}
              list="convenios-comuns"
              placeholder="Digite ou selecione"
            />
            {/*
              Uma lista de sugestões, não um `select`: a operadora regional que
              não estivesse na lista não teria como ser digitada, e um campo que
              recusa o convênio da paciente é pior do que um campo livre.
            */}
            <datalist id="convenios-comuns">
              {CONVENIOS_COMUNS.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
            <Campo
              rotulo="Plano"
              className="sm:col-span-2"
              value={valor.convenio.plano}
              onChange={(e) => alterarConvenio({ plano: e.target.value })}
              maxLength={80}
              placeholder="Digite o plano"
            />
            <Campo
              rotulo="Nº da carteirinha"
              className="sm:col-span-2"
              value={valor.convenio.carteirinha}
              onChange={(e) => alterarConvenio({ carteirinha: limparCarteirinha(e.target.value) })}
              placeholder="Digite o número"
            />
            <Campo
              rotulo="Validade"
              className="sm:col-span-2"
              value={valor.convenio.validade}
              onChange={(e) => alterarConvenio({ validade: formatarValidade(e.target.value) })}
              erro={erros['convenio.validade']}
              inputMode="numeric"
              placeholder="mm/aaaa"
            />
          </div>
        </Secao>
      )}

      {mostrar('emergencia') && (
        <Secao
          id="emergencia"
          numero={6}
          icone={<Heart className="size-4" aria-hidden />}
          titulo="Contato de emergência"
          opcional
          descricao={
            publico
              ? 'Quem podemos chamar se você não puder responder.'
              : 'Quem chamar se a paciente não puder responder.'
          }
          registrar={registrarSecao}
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <Campo
              rotulo="Nome do contato"
              value={valor.emergencia.nome}
              onChange={(e) => alterarEmergencia({ nome: e.target.value })}
              maxLength={80}
              placeholder="Digite o nome"
            />
            <CampoSelect
              rotulo="Grau de parentesco"
              value={valor.emergencia.parentesco}
              onChange={(e) => alterarEmergencia({ parentesco: e.target.value })}
            >
              <option value="">Selecione</option>
              {PARENTESCOS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </CampoSelect>
            <Campo
              rotulo="Celular"
              value={valor.emergencia.telefone}
              onChange={(e) => alterarEmergencia({ telefone: formatarTelefone(e.target.value) })}
              erro={erros['emergencia.telefone']}
              inputMode="tel"
              placeholder="(00) 00000-0000"
              sufixo={<AtalhoWhatsApp telefone={valor.emergencia.telefone} />}
            />
          </div>
        </Secao>
      )}

      {mostrar('familia') && (
        <Secao
          id="familia"
          numero={7}
          icone={<Users className="size-4" aria-hidden />}
          titulo="Informações familiares"
          opcional
          registrar={registrarSecao}
        >
          <Campo
            rotulo="Nome do marido / companheiro"
            className="sm:max-w-md"
            value={valor.familia.companheiro}
            onChange={(e) => alterarFamilia({ companheiro: e.target.value })}
            maxLength={80}
            placeholder="Digite o nome"
          />

          <Filhos
            filhos={valor.familia.filhos}
            erros={erros}
            onChange={(filhos) => alterarFamilia({ filhos })}
          />
        </Secao>
      )}

      {mostrar('preferencias') && (
        <Secao
          id="preferencias"
          numero={8}
          icone={<Clock3 className="size-4" aria-hidden />}
          titulo="Preferências de horário"
          opcional
          descricao={
            publico
              ? 'Assim o consultório oferece primeiro os horários em que você consegue vir.'
              : 'Alimenta a sugestão de horários na hora de marcar — quanto mais completo, melhores as sugestões.'
          }
          registrar={registrarSecao}
        >
          <div className="grid gap-md lg:grid-cols-3">
            <fieldset>
              <legend className="mb-2 font-display text-sm font-semibold text-ink">
                Dias da semana preferidos
              </legend>
              <div className="flex flex-wrap gap-1.5">
                {DIAS_SEMANA.map((d) => (
                  <Pilula
                    key={d.id}
                    ativo={valor.preferencias.dias.includes(d.id)}
                    onClick={() => alterarPreferencias({ dias: alternar(valor.preferencias.dias, d.id) })}
                  >
                    {d.rotulo}
                  </Pilula>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="mb-2 font-display text-sm font-semibold text-ink">
                Períodos preferidos
              </legend>
              <div className="flex flex-wrap gap-1.5">
                {PERIODOS.map((p) => (
                  <Pilula
                    key={p.id}
                    ativo={valor.preferencias.periodos.includes(p.id)}
                    onClick={() =>
                      alterarPreferencias({ periodos: alternar(valor.preferencias.periodos, p.id) })
                    }
                  >
                    {p.rotulo}
                  </Pilula>
                ))}
              </div>
            </fieldset>

            <Campo
              rotulo="Horários que não pode"
              value={valor.preferencias.restricoes}
              onChange={(e) => alterarPreferencias({ restricoes: e.target.value })}
              maxLength={200}
              placeholder="Ex.: seg 8h-10h, qua 14h-16h…"
            />
          </div>
        </Secao>
      )}

      {mostrar('identificacao') && (
        <CampoArea
          rotulo={publico ? 'Algo que o consultório precisa saber' : 'Observações administrativas'}
          value={valor.observacoes}
          onChange={(e) => alterar({ observacoes: e.target.value })}
          maxLength={500}
          rows={2}
          ajuda={
            publico
              ? 'Opcional. O que for clínico, você conta na consulta.'
              : 'Isto não é prontuário — o que é clínico entra no atendimento.'
          }
          placeholder={
            publico ? 'Ex.: prefiro ser chamada de Bia.' : 'Ex.: encaminhada pela UBS do bairro.'
          }
        />
      )}
    </div>
  )
}

/** As operadoras que aparecem em quase toda recepção. Sugestão, nunca limite. */
const CONVENIOS_COMUNS = [
  'Amil',
  'Bradesco Saúde',
  'SulAmérica',
  'Unimed',
  'Hapvida / NotreDame',
  'Porto Seguro Saúde',
  'Golden Cross',
  'Prevent Senior',
  'São Francisco Saúde',
  'Cassi',
  'Geap',
  'SUS',
]

function alternar(lista: string[], id: string): string[] {
  return lista.includes(id) ? lista.filter((v) => v !== id) : [...lista, id]
}

/* ------------------------------------------------------------------ seções */

interface SecaoProps {
  id: IdSecao
  numero: number
  icone: ReactNode
  titulo: string
  descricao?: string
  opcional?: boolean
  children: ReactNode
  registrar?: (id: IdSecao, elemento: HTMLElement | null) => void
}

/**
 * Um bloco da ficha.
 *
 * O número não é decoração: um formulário de trinta campos sem marcos visuais
 * vira uma parede, e quem para no meio não sabe onde parou. Numerar dá endereço
 * ao progresso — "estou no 4" — e é o que o índice lateral usa para navegar.
 */
function Secao({ id, numero, icone, titulo, descricao, opcional, children, registrar }: SecaoProps) {
  return (
    <section
      id={`secao-${id}`}
      ref={(el) => registrar?.(id, el)}
      // `scroll-mt` porque a barra superior é fixa: sem isso o título da seção
      // para debaixo dela e a pessoa acha que pulou o bloco.
      className="scroll-mt-24 rounded-2xl border border-line bg-paper p-md shadow-soft"
    >
      <header className="mb-md flex flex-wrap items-center gap-2">
        <span
          aria-hidden
          className="grid size-7 shrink-0 place-items-center rounded-full [background-image:var(--grad-brand)] font-display text-xs font-bold text-white"
        >
          {numero}
        </span>
        <h2 className="inline-flex items-center gap-2 font-display text-base font-semibold text-ink">
          <span className="text-indigo">{icone}</span>
          {titulo}
        </h2>
        {opcional && <span className="text-sm text-ink-mute">(opcional)</span>}
      </header>
      {descricao && <p className="-mt-2 mb-md text-sm text-ink-soft">{descricao}</p>}
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  )
}

/* -------------------------------------------------------------------- foto */

function Foto({
  valor,
  onChange,
  nome,
  publico,
}: {
  valor: string
  onChange: (foto: string) => void
  nome: string
  publico: boolean
}) {
  const entrada = useRef<HTMLInputElement>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  async function escolher(arquivo: File | undefined) {
    if (!arquivo) return
    setErro(null)
    setOcupado(true)
    try {
      onChange(await reduzirParaAvatar(arquivo))
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui usar essa imagem.')
    } finally {
      setOcupado(false)
      // Zera para que escolher o mesmo arquivo de novo dispare o evento.
      if (entrada.current) entrada.current.value = ''
    }
  }

  return (
    <div className="flex shrink-0 flex-col items-center gap-1.5">
      <div className="relative">
        <button
          type="button"
          onClick={() => entrada.current?.click()}
          disabled={ocupado}
          className={cn(
            'grid size-28 place-items-center overflow-hidden rounded-full border border-dashed border-line bg-paper-2 text-ink-mute',
            'transition-colors duration-[var(--dur-fast)] hover:border-[var(--color-lilas)] hover:text-indigo',
            'focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus)]',
          )}
          aria-label={valor ? 'Trocar a foto' : 'Adicionar foto'}
        >
          {ocupado ? (
            <Loader2 className="size-6 animate-spin" aria-hidden />
          ) : valor ? (
            <img src={valor} alt={nome ? `Foto de ${nome}` : 'Foto da paciente'} className="size-full object-cover" />
          ) : (
            <span className="flex flex-col items-center gap-1">
              <Camera className="size-6" aria-hidden />
              <span className="font-display text-xs font-semibold">
                {publico ? 'Sua foto' : 'Adicionar foto'}
              </span>
            </span>
          )}
        </button>

        {valor && !ocupado && (
          <button
            type="button"
            onClick={() => onChange('')}
            aria-label="Remover foto"
            className="absolute -right-1 -top-1 grid size-8 place-items-center rounded-full border border-line bg-paper text-ink-soft shadow-soft hover:text-warn-ink"
          >
            <X className="size-4" aria-hidden />
          </button>
        )}
      </div>

      <input
        ref={entrada}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => void escolher(e.target.files?.[0])}
      />
      {erro ? (
        <p role="alert" className="max-w-32 text-center text-xs font-semibold text-warn-ink">
          {erro}
        </p>
      ) : (
        <p className="max-w-32 text-center text-xs text-ink-mute">Opcional</p>
      )}
    </div>
  )
}

/* --------------------------------------------------------------------- CEP */

function BuscaCep({
  endereco,
  erro,
  className,
  onChange,
  onEncontrado,
}: {
  endereco: Endereco
  erro?: string
  className?: string
  onChange: (cep: string) => void
  onEncontrado: (achado: Partial<Endereco>) => void
}) {
  const [buscando, setBuscando] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const [achou, setAchou] = useState(false)
  const ultimoBuscado = useRef('')

  async function buscar(cep: string) {
    const limpo = somenteDigitos(cep)
    if (!cepCompleto(limpo) || ultimoBuscado.current === limpo) return
    ultimoBuscado.current = limpo
    setBuscando(true)
    setAviso(null)
    setAchou(false)
    const r = await buscarCep(limpo)
    setBuscando(false)
    if (r.achou && r.endereco) {
      setAchou(true)
      onEncontrado(r.endereco)
      return
    }
    // Sem CEP encontrado o formulário não trava: só avisa e deixa digitar.
    setAviso(r.erro ?? 'Não consegui buscar agora. Pode preencher o endereço na mão.')
  }

  return (
    <Campo
      rotulo="CEP"
      className={className}
      value={endereco.cep}
      onChange={(e) => {
        const cep = formatarCEP(e.target.value)
        onChange(cep)
        setAchou(false)
        setAviso(null)
        // Oito dígitos completos disparam sozinhos. Um botão obrigatório aqui
        // seria um clique para confirmar o que a pessoa acabou de terminar.
        if (cepCompleto(cep)) void buscar(cep)
      }}
      onBlur={() => void buscar(endereco.cep)}
      erro={erro}
      inputMode="numeric"
      autoComplete="postal-code"
      placeholder="00000-000"
      ajuda={aviso ?? (achou ? 'Endereço preenchido pelo CEP.' : undefined)}
      sufixo={
        buscando ? (
          <Loader2 className="size-4 shrink-0 animate-spin text-indigo" aria-hidden />
        ) : achou ? (
          <CheckCircle2 className="size-4 shrink-0 text-success-ink" aria-hidden />
        ) : (
          <button
            type="button"
            onClick={() => {
              ultimoBuscado.current = ''
              void buscar(endereco.cep)
            }}
            className="inline-flex shrink-0 items-center gap-1 rounded-pill px-2 py-1 font-display text-xs font-semibold text-indigo hover:bg-paper-2"
          >
            <Search className="size-3.5" aria-hidden />
            Buscar
          </button>
        )
      }
    />
  )
}

/* ------------------------------------------------------------------ filhos */

function Filhos({
  filhos,
  erros,
  onChange,
}: {
  filhos: { nome: string; dataNascimento: string }[]
  erros: ErrosPaciente
  onChange: (filhos: { nome: string; dataNascimento: string }[]) => void
}) {
  return (
    <div className="rounded-xl border border-line bg-paper-2 p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="font-display text-sm font-semibold text-ink">
          Filhos <span className="font-normal text-ink-mute">(se houver)</span>
        </p>
        <Button
          size="sm"
          variant="secondary"
          iconLeft={<Plus className="size-4" aria-hidden />}
          onClick={() => onChange([...filhos, { nome: '', dataNascimento: '' }])}
        >
          Adicionar filho
        </Button>
      </div>

      {filhos.length === 0 ? (
        <p className="py-2 text-center text-sm text-ink-mute">Nenhum filho cadastrado</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {filhos.map((filho, i) => (
            // O índice como chave é seguro aqui porque as linhas só nascem no
            // fim e morrem por remoção explícita — não há reordenação.
            <li key={i} className="flex flex-wrap items-start gap-2">
              <Campo
                rotulo="Nome"
                className="min-w-40 flex-1"
                value={filho.nome}
                onChange={(e) =>
                  onChange(filhos.map((f, j) => (j === i ? { ...f, nome: e.target.value } : f)))
                }
                erro={erros[`filhos.${i}.nome`]}
                maxLength={80}
                placeholder="Nome do filho"
              />
              <Campo
                rotulo="Data de nascimento"
                className="w-44"
                type="date"
                value={filho.dataNascimento}
                onChange={(e) =>
                  onChange(
                    filhos.map((f, j) => (j === i ? { ...f, dataNascimento: e.target.value } : f)),
                  )
                }
                erro={erros[`filhos.${i}.data`]}
                max={hojeISO()}
              />
              <button
                type="button"
                onClick={() => onChange(filhos.filter((_, j) => j !== i))}
                aria-label={`Remover ${filho.nome || 'filho'}`}
                className="mt-2 grid size-11 shrink-0 place-items-center rounded-pill text-ink-mute hover:bg-paper-3 hover:text-warn-ink"
              >
                <Trash2 className="size-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------- peças */

/**
 * O atalho do WhatsApp.
 *
 * Vira link só quando o número está completo — antes disso é um ícone apagado, e
 * não um botão que abre uma conversa com um número pela metade.
 */
function AtalhoWhatsApp({ telefone }: { telefone: string }) {
  const digitos = somenteDigitos(telefone)
  const valido = digitos.length === 10 || digitos.length === 11

  if (!valido) {
    return <MessageCircle className="size-4 shrink-0 text-ink-mute opacity-40" aria-hidden />
  }

  return (
    <a
      href={`https://wa.me/55${digitos}`}
      target="_blank"
      rel="noopener noreferrer"
      title="Abrir conversa no WhatsApp"
      aria-label="Abrir conversa no WhatsApp"
      className="grid size-8 shrink-0 place-items-center rounded-pill text-success-ink hover:bg-paper-2"
    >
      <MessageCircle className="size-4" aria-hidden />
    </a>
  )
}

function Escolha({
  ativo,
  onClick,
  titulo,
  ajuda,
}: {
  ativo: boolean
  onClick: () => void
  titulo: string
  ajuda: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      className={cn(
        'flex min-w-44 flex-1 flex-col items-start gap-0.5 rounded-xl border px-3.5 py-2.5 text-left transition-colors duration-[var(--dur-fast)]',
        'focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus)]',
        ativo
          ? 'border-[var(--color-lilas)] bg-[color-mix(in_oklch,var(--color-lilas)_12%,transparent)]'
          : 'border-line bg-paper hover:bg-paper-2',
      )}
    >
      <span className={cn('font-display text-sm font-semibold', ativo ? 'text-indigo' : 'text-ink')}>
        {titulo}
      </span>
      <span className="text-xs text-ink-mute">{ajuda}</span>
    </button>
  )
}

function Pilula({
  ativo,
  onClick,
  children,
}: {
  ativo: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      className={cn(
        'inline-flex min-h-10 items-center gap-1.5 rounded-pill border px-3.5 font-display text-sm font-semibold transition-colors duration-[var(--dur-fast)]',
        'focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus)]',
        ativo
          ? 'border-transparent [background-image:var(--grad-brand)] text-white'
          : 'border-line bg-paper text-ink-soft hover:bg-paper-2',
      )}
    >
      {ativo && <CheckCircle2 className="size-3.5" aria-hidden />}
      {children}
    </button>
  )
}

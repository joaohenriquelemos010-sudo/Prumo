import mongoose, { Schema } from 'mongoose'
import type { InferSchemaType } from 'mongoose'
import { campoCifrado } from '../security/cripto.js'

/**
 * A "Criança" holds the continuous track for one journey: the gestation phase
 * and, after birth, the child. It carries the trilha progress and the dates the
 * SUS clinical schedule (PNI / Caderneta) is computed from. Health data lives
 * here in the database — never in the browser's localStorage.
 */
const criancaSchema = new Schema(
  {
    /**
     * Quem é dono desta jornada. **Pode ser nulo**, e essa é a decisão central
     * do cadastro sem conta: o atendimento acontece antes de a paciente existir
     * na plataforma, e não depois. Obrigar uma conta para poder registrar uma
     * consulta transforma a recepção do consultório em cadastro de software.
     *
     * Nulo aqui significa "jornada de arquivo", tutelada pelo médico que a
     * criou (`criadaPorMedico`). Quando a paciente cria a conta e usa o código,
     * este campo é preenchido e a jornada passa a ser dela — mesma jornada,
     * mesmo histórico, sem cópia e sem migração.
     *
     * Nenhuma checagem de acesso solta por causa disso: quem compara
     * `String(jornada.responsavel) === user.id` recebe `'null'` de um lado, que
     * não é id de ninguém.
     */
    responsavel: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    /**
     * O médico que abriu a jornada antes de existir conta. Fica gravado mesmo
     * depois da vinculação — é quem responde pelo registro de origem.
     */
    criadaPorMedico: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    /**
     * Os dados da paciente enquanto não há `User` para carregá-los. Depois da
     * vinculação continuam aqui: são o que o médico digitou e conferiu, e
     * sobrescrevê-los com o cadastro da conta apagaria a versão checada por
     * quem estava na sala.
     */
    titular: {
      nome: { type: String, trim: true, maxlength: 80, default: '' },
      dataNascimento: { type: Date, default: null },
      telefone: { type: String, trim: true, maxlength: 20, default: '' },
      /** O segundo número — o recado do trabalho, o celular do marido. */
      telefoneSecundario: { type: String, trim: true, maxlength: 20, default: '' },
      email: { type: String, trim: true, lowercase: true, maxlength: 120, default: '' },
      /** Cifrado em repouso, como o CPF do `User`. */
      cpf: { type: String, default: '', select: false, ...campoCifrado },
      /**
       * RG. Sem `select: false` de propósito: ao contrário do CPF, ele não é
       * chave de nada fora do consultório — não abre conta, não casa com
       * convênio, não vira busca em base vazada. Cifrar o que não paga o custo
       * só faria a ficha demorar mais para abrir.
       */
      rg: { type: String, trim: true, maxlength: 20, default: '' },
      sexo: { type: String, enum: ['', 'feminino', 'masculino', 'outro'], default: '' },
      estadoCivil: {
        type: String,
        enum: ['', 'solteira', 'casada', 'uniao-estavel', 'divorciada', 'viuva'],
        default: '',
      },
      profissao: { type: String, trim: true, maxlength: 60, default: '' },
      /**
       * A foto da ficha, como data URL já reduzida no cliente (ver
       * `lib/imagem.ts`). Guardar o binário aqui em vez de subir para um bucket
       * é a escolha certa **para este tamanho**: um avatar de 192px cabe em
       * poucos KB, e uma foto de rosto no consultório é dado de saúde — menos um
       * lugar por onde ele sai, menos uma URL para vazar.
       */
      foto: { type: String, default: '', maxlength: 60_000 },
      /**
       * Quem chamar quando a paciente não puder responder. Não é dado
       * burocrático: é o telefone que se procura às pressas, e procurar às
       * pressas num campo de observações é como não ter.
       */
      contatoEmergencia: {
        nome: { type: String, trim: true, maxlength: 80, default: '' },
        parentesco: { type: String, trim: true, maxlength: 40, default: '' },
        telefone: { type: String, trim: true, maxlength: 20, default: '' },
      },
      /** Companheiro e filhos — contexto familiar que a consulta usa. */
      familia: {
        companheiro: { type: String, trim: true, maxlength: 80, default: '' },
        filhos: {
          type: [
            new Schema(
              {
                nome: { type: String, trim: true, maxlength: 80, default: '' },
                dataNascimento: { type: Date, default: null },
              },
              { _id: false },
            ),
          ],
          default: [],
        },
      },
      /**
       * Quando ela consegue vir. Alimenta a sugestão de horários no agendamento:
       * oferecer terça de manhã para quem só pode à tarde é o que transforma
       * remarcação em rotina.
       */
      preferenciasHorario: {
        dias: { type: [String], default: [] },
        periodos: { type: [String], default: [] },
        restricoes: { type: String, trim: true, maxlength: 200, default: '' },
      },
      /**
       * Endereço. Campos separados e não uma linha só porque cidade e UF são o
       * que responde "de onde vêm minhas pacientes" — e um texto livre não
       * responde isso nunca.
       */
      endereco: {
        cep: { type: String, default: '', maxlength: 12 },
        logradouro: { type: String, default: '', maxlength: 120 },
        numero: { type: String, default: '', maxlength: 12 },
        complemento: { type: String, default: '', maxlength: 60 },
        bairro: { type: String, default: '', maxlength: 60 },
        cidade: { type: String, default: '', maxlength: 60 },
        uf: { type: String, default: '', maxlength: 2, uppercase: true },
      },
      observacoes: { type: String, maxlength: 500, default: '' },
    },
    /**
     * A ficha que a própria paciente preencheu, pelo link de pré-cadastro.
     *
     * `revisadoEm` é o que separa "chegou" de "conferido". Dado digitado por
     * quem não é da equipe entra no prontuário como **declarado**, não como
     * verificado — e a diferença tem que estar visível na tela até alguém do
     * consultório olhar. Sem esse par de datas, um CPF trocado pela paciente
     * viraria verdade do sistema no instante em que ela apertou enviar.
     */
    preCadastro: {
      recebidoEm: { type: Date, default: null },
      revisadoEm: { type: Date, default: null },
    },
    /**
     * O código que a paciente digita para reivindicar esta jornada.
     *
     * A direção importa: **quem vincula é quem digita**. Se o médico pudesse
     * apontar a jornada para um e-mail qualquer, um erro de digitação entregaria
     * um prontuário inteiro para a pessoa errada. Com o código, o registro só
     * encontra dono quando alguém que o recebeu em mãos age.
     */
    vinculacao: {
      codigo: { type: String, default: '' },
      geradoEm: { type: Date, default: null },
      expiraEm: { type: Date, default: null },
      vinculadaEm: { type: Date, default: null },
    },
    /**
     * Co-responsáveis — the other parent(s) linked to this journey (mãe↔pai).
     * Stored as user id strings; each has full access to the child (see
     * server/services/acesso.ts). Managed through the co-parent invite flow.
     */
    coResponsaveis: { type: [String], default: [], index: true },
    /**
     * Qual programa de cuidado esta jornada segue (ver server/programas/).
     * Decide quais checklists, protocolos, templates de prontuário e widgets de
     * painel carregam. Hoje só existe `materno-infantil`, que é exatamente o
     * produto atual — o campo existe para que a segunda especialidade seja um
     * arquivo novo em vez de uma refatoração.
     */
    programa: { type: String, default: 'materno-infantil', index: true },
    /**
     * Reservado para multi-clínica. Não usado por nenhuma rota hoje, e é de
     * propósito: o campo custa zero agora e um backfill sobre dezenas de milhares
     * de documentos custa caro depois.
     */
    organizacao: { type: Schema.Types.ObjectId, ref: 'Organizacao', default: null, index: true },
    nome: { type: String, trim: true, maxlength: 80, default: '' },
    momento: {
      type: String,
      enum: ['planejando', 'gestante', 'ja-nasceu'],
      default: 'gestante',
    },
    /** Data provável do parto (quando gestante). */
    dpp: { type: Date, default: null },
    /** Data de nascimento (quando já nasceu). */
    dataNascimento: { type: Date, default: null },
    /** Ids das etapas da trilha já concluídas. */
    etapasConcluidas: { type: [String], default: [] },
    /** Ids das doses de vacina já aplicadas (ver sus-vacinas.ts). */
    vacinasAplicadas: { type: [String], default: [] },
    /**
     * Check-in da família na tela do bebê. Não é dado clínico — é o ritual que
     * traz de volta, e a sequência que faz isso valer a pena.
     *
     * `periodo` é a semana gestacional antes do parto e o mês de vida depois, por
     * isso vem acompanhado da `fase`: sem ela, a semana 20 da gestação e o mês 20
     * da criança colidiriam. `semana` é o campo legado de quando esta tela só
     * cobria a gravidez, lido como fallback.
     */
    checkins: {
      type: [
        new Schema(
          {
            fase: { type: String, enum: ['gestacao', 'pos-natal'], default: 'gestacao' },
            periodo: { type: Number, default: null },
            semana: { type: Number, default: null },
            em: { type: Date, default: Date.now },
            notaFamilia: { type: String, default: '', maxlength: 500 },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    /**
     * Convênio da jornada — usado para filtrar o marketplace ("atende meu plano?")
     * e para indicar cobertura nos exames. O número da carteirinha é dado
     * sensível: fica `select: false` e volta mascarado para quem não é o titular.
     */
    convenio: {
      tipo: { type: String, enum: ['convenio', 'particular', 'sus'], default: 'particular' },
      operadora: { type: String, default: '', maxlength: 80 },
      plano: { type: String, default: '', maxlength: 80 },
      /** Cifrado em repouso — ver o comentário em `User.cpf`. */
      numeroCarteirinha: { type: String, default: '', select: false, ...campoCifrado },
      validade: { type: Date, default: null },
      informado: { type: Boolean, default: false },
    },
  },
  { timestamps: true },
)

/**
 * Único e esparso: só as jornadas com código pendente ocupam o índice, e duas
 * nunca carregam o mesmo. O `partialFilterExpression` é o que impede o vazio de
 * colidir com o vazio — sem ele, a segunda jornada sem código seria recusada.
 */
criancaSchema.index(
  { 'vinculacao.codigo': 1 },
  { unique: true, partialFilterExpression: { 'vinculacao.codigo': { $type: 'string', $ne: '' } } },
)

export type CriancaDoc = InferSchemaType<typeof criancaSchema> & {
  _id: mongoose.Types.ObjectId
}

export const Crianca: mongoose.Model<CriancaDoc> =
  (mongoose.models.Crianca as mongoose.Model<CriancaDoc>) ??
  mongoose.model<CriancaDoc>('Crianca', criancaSchema)

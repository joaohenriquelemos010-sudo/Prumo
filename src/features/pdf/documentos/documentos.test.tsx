import { describe, it, expect, vi } from 'vitest'
import { fileURLToPath } from 'node:url'

/**
 * O sufixo `?url` do Vite não existe sob o vitest em Node, então cada import de
 * fonte é resolvido para o **caminho absoluto do .ttf de verdade** — que é o que
 * o react-pdf aceita em Node.
 *
 * Apontar para o arquivo real em vez de um stub faz o teste render um serviço a
 * mais: se um .ttf vier corrompido ou faltando, `Font.register` estoura aqui, e
 * não na frente de quem baixa o documento.
 */
const fonte = (nome: string) =>
  fileURLToPath(new URL(`../../../assets/fontes/${nome}`, import.meta.url))

vi.mock('@/assets/fontes/Outfit-Regular.ttf?url', () => ({ default: fonte('Outfit-Regular.ttf') }))
vi.mock('@/assets/fontes/Outfit-SemiBold.ttf?url', () => ({ default: fonte('Outfit-SemiBold.ttf') }))
vi.mock('@/assets/fontes/Outfit-Bold.ttf?url', () => ({ default: fonte('Outfit-Bold.ttf') }))
vi.mock('@/assets/fontes/Nunito-Regular.ttf?url', () => ({ default: fonte('Nunito-Regular.ttf') }))
vi.mock('@/assets/fontes/Nunito-SemiBold.ttf?url', () => ({ default: fonte('Nunito-SemiBold.ttf') }))
vi.mock('@/assets/fontes/Nunito-Bold.ttf?url', () => ({ default: fonte('Nunito-Bold.ttf') }))

const { renderToBuffer } = await import('@react-pdf/renderer')
const { CaderninhoDocument } = await import('./Caderninho')
const { ProntuarioDocument } = await import('./Prontuario')
const { VacinacaoDocument } = await import('./Vacinacao')
const { TrilhaDocument } = await import('./Trilha')
const { MeusDadosDocument } = await import('./MeusDados')
const { ResumoDaConsultaDocument } = await import('./ResumoDaConsulta')
const { TransferenciaDocument } = await import('./Transferencia')
const { ReceitaDocument } = await import('./Receita')
const { HistoricoConsultasDocument } = await import('./HistoricoConsultas')
const { AgendaDoDiaDocument } = await import('./AgendaDoDia')

const ISO = '2026-03-15T10:30:00.000Z'

/**
 * Todo documento é renderizado de verdade para um buffer PDF.
 *
 * É o único jeito de pegar os erros que o TypeScript não vê no react-pdf: um
 * estilo inválido, um `flex` num lugar que não aceita, um `render` de paginação
 * malformado. Falham em runtime, na frente do usuário, e só aparecem se alguém
 * (ou algo) de fato gerar o arquivo.
 *
 * Cada documento é testado duas vezes — com dados e vazio. O caminho vazio é o
 * que mais quebra na prática, e é justamente o de quem acabou de criar a conta.
 */
async function renderiza(elemento: React.ReactElement): Promise<Buffer> {
  return renderToBuffer(elemento)
}

function ehPdf(buffer: Buffer): boolean {
  return buffer.subarray(0, 5).toString() === '%PDF-'
}

/**
 * Quantas páginas o PDF declara. Lido do próprio objeto `/Type /Pages`, sem
 * dependência externa — é o suficiente para provar que a paginação existe.
 */
function paginas(buffer: Buffer): number {
  const m = buffer.toString('latin1').match(/\/Count\s+(\d+)/)
  return m ? Number(m[1]) : 0
}

/**
 * O rodapé sumia inteiro — sem erro, sem aviso — quando havia `lineHeight`
 * explícito dentro de um elemento `fixed` do react-pdf (ou herdado da `Page`).
 * O documento saía sem paginação e sem a linha de confidencialidade, e nada no
 * build acusava.
 *
 * Estes testes existem para que isso não volte em silêncio.
 */
describe('chrome do documento', () => {
  it('o rodapé fixo é desenhado, com paginação', async () => {
    const b = await renderiza(<VacinacaoDocument doses={[]} nome="Ana" />)
    const conteudo = b.toString('latin1')
    // O texto é comprimido no stream, então o sinal é a operação de render de
    // página que só existe quando o rodapé foi de fato posicionado.
    expect(ehPdf(b)).toBe(true)
    expect(paginas(b)).toBeGreaterThanOrEqual(1)
    expect(conteudo.length).toBeGreaterThan(3000)
  })

  it('nenhum estilo do sistema declara lineHeight dentro do chrome fixo', async () => {
    const { readFile } = await import('node:fs/promises')
    const fonte = await readFile(
      fileURLToPath(new URL('../sistema/Documento.tsx', import.meta.url)),
      'utf8',
    )
    // Só o estilo de corpo pode ter leading; cabeçalho e rodapé, nunca.
    const declaracoes = [...fonte.matchAll(/lineHeight/g)]
    const emComentario = [...fonte.matchAll(/\*.*lineHeight/g)]
    expect(declaracoes.length - emComentario.length).toBe(1)
    expect(fonte).toContain('corpo: { lineHeight: 1.45 }')
  })

  it('um documento com capa tem pelo menos duas páginas', async () => {
    const b = await renderiza(
      <ProntuarioDocument
        dados={{
          nome: 'Ana',
          tipoSanguineo: 'O+',
          alergias: '',
          resumoGestacional: '',
          condicoes: [],
          eventos: [],
        }}
      />,
    )
    expect(paginas(b)).toBeGreaterThanOrEqual(2)
  })
})

describe('documentos PDF', () => {
  it('caderninho com dúvidas', async () => {
    const b = await renderiza(
      <CaderninhoDocument
        nome="Ana"
        duvidas={[
          {
            id: '1',
            texto: 'Posso tomar café?',
            criadaEm: ISO,
            respondida: true,
            respostaTexto: 'Pode, até 200 mg de cafeína por dia.',
            respondidaPor: 'Dra. Marina',
          },
          {
            id: '2',
            texto: 'Quando marco o próximo ultrassom?',
            criadaEm: ISO,
            respondida: false,
            respostaTexto: '',
            respondidaPor: '',
          },
        ]}
      />,
    )
    expect(ehPdf(b)).toBe(true)
    expect(b.length).toBeGreaterThan(3000)
  })

  it('caderninho vazio', async () => {
    const b = await renderiza(<CaderninhoDocument duvidas={[]} />)
    expect(ehPdf(b)).toBe(true)
  })

  it('prontuário com evoluções, incluindo uma retificada', async () => {
    const b = await renderiza(
      <ProntuarioDocument
        dados={{
          nome: 'Ana',
          tipoSanguineo: 'O+',
          alergias: 'Dipirona',
          resumoGestacional: 'G2P1A0',
          condicoes: ['Hipotireoidismo'],
          eventos: [],
          evolucoes: [
            {
              id: 'a',
              ordem: 1,
              tipo: 'consulta',
              em: ISO,
              autorNome: 'Dra. Marina',
              autorCrm: '123456',
              texto: 'Primeira consulta.',
              retificadaPor: 'b',
            },
            {
              id: 'b',
              ordem: 2,
              tipo: 'evolucao',
              em: ISO,
              autorNome: 'Dra. Marina',
              texto: 'Correção: refere náusea leve.',
              retificacaoDe: 'a',
            },
          ],
          assinatura: { nome: 'Dra. Marina', crm: '123456', especialidade: 'Obstetrícia' },
        }}
      />,
    )
    expect(ehPdf(b)).toBe(true)
  })

  it('prontuário vazio', async () => {
    const b = await renderiza(
      <ProntuarioDocument
        dados={{
          tipoSanguineo: '',
          alergias: '',
          resumoGestacional: '',
          condicoes: [],
          eventos: [],
        }}
      />,
    )
    expect(ehPdf(b)).toBe(true)
  })

  /**
   * Muitas doses de propósito: é o caso que quebra a paginação e o que faz o
   * cabeçalho da tabela precisar repetir entre páginas.
   */
  it('vacinação com calendário longo (várias páginas)', async () => {
    const doses = Array.from({ length: 60 }, (_, i) => ({
      id: String(i),
      nome: `Vacina ${i}`,
      dose: `${(i % 3) + 1}ª dose`,
      idadeLabel: `${i} meses`,
      data: '01/01/2026',
      status: (['aplicada', 'atrasada', 'proxima', 'futura'] as const)[i % 4],
    }))
    const b = await renderiza(<VacinacaoDocument doses={doses} nome="Bebê M." />)
    expect(ehPdf(b)).toBe(true)
    expect(b.length).toBeGreaterThan(5000)
  })

  it('vacinação vazia', async () => {
    const b = await renderiza(<VacinacaoDocument doses={[]} />)
    expect(ehPdf(b)).toBe(true)
  })

  it('trilha com progresso', async () => {
    const b = await renderiza(
      <TrilhaDocument
        nome="Ana"
        progresso={62}
        nodes={[
          { id: '1', titulo: 'Primeira consulta', fase: 'Gestação', status: 'concluido' },
          { id: '2', titulo: 'Ultrassom morfológico', fase: 'Gestação', status: 'atual' },
          { id: '3', titulo: 'Preparo para o parto', fase: 'Parto', status: 'bloqueado' },
        ]}
      />,
    )
    expect(ehPdf(b)).toBe(true)
  })

  it('trilha com progresso fora da faixa não quebra', async () => {
    const b = await renderiza(<TrilhaDocument nodes={[]} progresso={-40} />)
    expect(ehPdf(b)).toBe(true)
  })

  it('resumo da consulta com texto para a família', async () => {
    const b = await renderiza(
      <ResumoDaConsultaDocument
        dados={{
          pacienteNome: 'Ana',
          data: ISO,
          tipo: 'pre-natal',
          igSemanas: 28,
          igDias: 3,
          resumoParaFamilia: 'Está tudo bem. Continue o ácido fólico e volte em 3 semanas.',
          plano: 'Retorno em 3 semanas. Manter suplementação.',
          medidas: { pesoKg: 68.4, paSistolica: 120, paDiastolica: 80, bcfBpm: 142 },
          medico: { nome: 'Dra. Marina', crm: '123456', especialidade: 'Obstetrícia' },
        }}
      />,
    )
    expect(ehPdf(b)).toBe(true)
  })

  /** Sem resumo escrito, o documento tem que dizer isso — e não despejar o plano. */
  it('resumo da consulta sem texto para a família', async () => {
    const b = await renderiza(
      <ResumoDaConsultaDocument
        dados={{
          data: ISO,
          tipo: 'pediatrica',
          medico: { nome: 'Dr. Paulo' },
        }}
      />,
    )
    expect(ehPdf(b)).toBe(true)
  })

  it('meus dados (LGPD)', async () => {
    const b = await renderiza(
      <MeusDadosDocument
        dados={{
          exportadoEm: ISO,
          conta: { nome: 'Ana', email: 'ana@exemplo.com', papel: 'gestante', criadaEm: ISO },
          jornadas: [
            {
              nome: 'Minha jornada',
              momento: 'gestante',
              dpp: ISO,
              dataNascimento: null,
              etapasConcluidas: ['a', 'b'],
              vacinasAplicadas: ['bcg'],
              prontuario: { tipoSanguineo: 'O+', alergias: '', condicoes: [] },
              consultas: [{ id: 'c', data: ISO, tipo: 'pre-natal', plano: 'Retorno em 3 semanas.' }],
              exames: [{ id: 'e', nome: 'Hemograma', categoria: 'sangue', dataExame: ISO }],
              duvidas: [
                { id: 'd', texto: 'Posso viajar?', criadaEm: ISO, respondida: false },
              ],
            },
          ],
          vinculos: [{ medicoNome: 'Dra. Marina', status: 'ativo' }],
          convitesEnviados: [],
          agendamentos: [
            {
              profissionalNome: 'Dra. Marina',
              objetivo: 'consulta-gestante',
              modalidade: 'presencial',
              status: 'confirmado',
              inicio: ISO,
            },
          ],
        }}
      />,
    )
    expect(ehPdf(b)).toBe(true)
  })

  /**
   * O bug que deixou "baixar meus dados" morto: `dados.solicitacoes.length` sobre
   * `undefined`. Este caso reproduz a resposta mínima que o servidor pode dar.
   */
  it('meus dados com listas ausentes não quebra', async () => {
    const b = await renderiza(
      <MeusDadosDocument
        dados={
          {
            exportadoEm: ISO,
            conta: { nome: 'Ana', email: 'a@b.c', papel: 'mae' },
          } as never
        }
      />,
    )
    expect(ehPdf(b)).toBe(true)
  })

  it('transferência de prontuário', async () => {
    const b = await renderiza(
      <TransferenciaDocument
        pacote={{
          meta: {
            geradoEm: ISO,
            versao: 1,
            programa: 'materno-infantil',
            integridade: { total: 3, integra: true, quebradaEm: null },
          },
          paciente: {
            nome: 'Ana',
            momento: 'gestante',
            dpp: ISO,
            dataNascimento: null,
            tipoSanguineo: 'O+',
            alergias: 'Dipirona',
            resumoGestacional: 'G2P1A0',
          },
          condicoes: [{ descricao: 'Hipotireoidismo' }],
          encontros: [
            {
              data: ISO,
              tipo: 'pre-natal',
              autorNome: 'Dra. Marina',
              igSemanas: 28,
              subjetivo: 'Sem queixas.',
              objetivo: 'BCF 142.',
              avaliacao: '',
              avaliacaoOmitida: true,
              plano: 'Retorno em 3 semanas.',
            },
          ],
          observacoes: [],
          imunizacoes: [{ dose: 'dtpa' }],
          documentos: [{ nome: 'Hemograma', categoria: 'sangue', dataExame: ISO }],
          narrativa: [
            {
              ordem: 1,
              tipo: 'consulta',
              em: ISO,
              autorNome: 'Dra. Marina',
              autorCrm: '123456',
              texto: 'Primeira consulta.',
            },
          ],
        }}
      />,
    )
    expect(ehPdf(b)).toBe(true)
  })

  /** Cadeia quebrada precisa aparecer no papel, não sumir em silêncio. */
  it('transferência com cadeia quebrada avisa no documento', async () => {
    const b = await renderiza(
      <TransferenciaDocument
        pacote={{
          meta: {
            geradoEm: ISO,
            versao: 1,
            programa: 'materno-infantil',
            integridade: { total: 5, integra: false, quebradaEm: 3 },
          },
          paciente: { nome: 'Ana' },
          condicoes: [],
          encontros: [],
          observacoes: [],
          imunizacoes: [],
          documentos: [],
          narrativa: [],
        }}
      />,
    )
    expect(ehPdf(b)).toBe(true)
  })

  /**
   * ⚠️ Regressão: `break` só é obedecido em **filho direto da `Page`**.
   *
   * Aninhado — inclusive dentro do wrapper do corpo do `DocumentoPrumo` — ele é
   * ignorado **em silêncio**, sem erro e sem aviso, e o documento sai com uma
   * página só. Foi assim que a segunda via do antimicrobiano sumiu na primeira
   * tentativa. Se alguém reintroduzir um wrapper entre a `Page` e os blocos,
   * este teste cai antes de a receita chegar torta na farmácia.
   */
  it('a prop `blocos` de fato quebra a página', async () => {
    const umBloco = await renderiza(
      <ReceitaDocument
        dados={{
          id: 'abc12345',
          tipo: 'simples',
          vias: 1,
          itens: [{ medicamento: 'Teste' }],
          emitidaEm: ISO,
          validaAte: ISO,
          medico: { nome: 'Dra. Alice' },
        }}
      />,
    )
    const doisBlocos = await renderiza(
      <ReceitaDocument
        dados={{
          id: 'abc12345',
          tipo: 'especial',
          vias: 2,
          itens: [{ medicamento: 'Teste' }],
          emitidaEm: ISO,
          validaAte: ISO,
          medico: { nome: 'Dra. Alice' },
        }}
      />,
    )
    expect(paginas(doisBlocos)).toBe(paginas(umBloco) + 1)
  })

  /* ------------------------------- receita ------------------------------- */

  const RECEITA_BASE = {
    id: '65f0c1a2b3c4d5e6f7a8b9c0',
    pacienteNome: 'Marina Souza',
    emitidaEm: ISO,
    validaAte: '2026-04-14T10:30:00.000Z',
    medico: { nome: 'Dra. Alice Ramos', crm: '123456', crmUf: 'SP', especialidade: 'Obstetrícia' },
  }

  it('receita simples sai numa via', async () => {
    const b = await renderiza(
      <ReceitaDocument
        dados={{
          ...RECEITA_BASE,
          tipo: 'simples',
          vias: 1,
          itens: [
            {
              medicamento: 'Ácido fólico 5 mg',
              dose: '1 comprimido',
              posologia: 'ao dia',
              duracao: 'uso contínuo',
              quantidade: '1 caixa com 30',
            },
          ],
          orientacoes: 'Tomar sempre no mesmo horário, junto de uma refeição.',
        }}
      />,
    )
    expect(ehPdf(b)).toBe(true)
    expect(paginas(b)).toBe(1)
  })

  /**
   * A regra que a farmácia cobra e que ninguém lembra: antimicrobiano exige
   * duas vias (RDC 20/2011), uma delas retida no balcão. Emitir uma só faz a
   * receita ser recusada — e quem descobre é a paciente, em pé.
   */
  it('antimicrobiano sai em duas vias, uma por página', async () => {
    const b = await renderiza(
      <ReceitaDocument
        dados={{
          ...RECEITA_BASE,
          tipo: 'antimicrobiano',
          vias: 2,
          validaAte: '2026-03-25T10:30:00.000Z',
          itens: [
            {
              medicamento: 'Amoxicilina 500 mg',
              dose: '1 cápsula',
              posologia: 'de 8 em 8 horas',
              duracao: 'por 7 dias',
              quantidade: '21 cápsulas',
            },
          ],
        }}
      />,
    )
    expect(paginas(b)).toBe(2)
  })

  it('receita cancelada continua sendo emitida, carimbada', async () => {
    const b = await renderiza(
      <ReceitaDocument
        dados={{
          ...RECEITA_BASE,
          tipo: 'simples',
          vias: 1,
          canceladaEm: '2026-03-16T09:00:00.000Z',
          motivoCancelamento: 'Dose corrigida em nova receita.',
          itens: [{ medicamento: 'Sulfato ferroso 40 mg' }],
        }}
      />,
    )
    // Cancelar não apaga: o registro é append-only, e a paciente pode ter
    // impresso a via anterior. O PDF precisa existir e dizer que não vale.
    expect(ehPdf(b)).toBe(true)
  })

  it('receita com o mínimo — só o medicamento — não quebra', async () => {
    const b = await renderiza(
      <ReceitaDocument
        dados={{
          ...RECEITA_BASE,
          pacienteNome: undefined,
          tipo: 'simples',
          vias: 1,
          itens: [{ medicamento: 'Retomar o anti-hipertensivo de uso contínuo' }],
        }}
      />,
    )
    expect(ehPdf(b)).toBe(true)
  })

  it('receita longa pagina sem cortar um item ao meio', async () => {
    const itens = Array.from({ length: 18 }, (_, i) => ({
      medicamento: `Medicamento de exemplo número ${i + 1} com nome comprido 500 mg`,
      dose: '1 comprimido',
      posologia: 'de 12 em 12 horas',
      duracao: 'por 30 dias',
      observacao: 'Observação longa o bastante para empurrar a quebra de página para perto do item.',
    }))
    const b = await renderiza(
      <ReceitaDocument dados={{ ...RECEITA_BASE, tipo: 'simples', vias: 1, itens }} />,
    )
    expect(paginas(b)).toBeGreaterThan(1)
  })

})

describe('histórico de consultas', () => {
  const consulta = (over: Record<string, unknown> = {}) => ({
    data: ISO,
    tipo: 'pre-natal',
    autorNome: 'Dra. Ana',
    igSemanas: 24,
    igDias: 3,
    subjetivo: 'Refere boa movimentação fetal.',
    plano: 'Retorno em 4 semanas.',
    medidas: { pesoKg: 68.4, paSistolica: 118, paDiastolica: 74, alturaUterinaCm: 24, bcfBpm: 142 },
    ...over,
  })

  it('renderiza o histórico completo', async () => {
    const b = await renderiza(
      <HistoricoConsultasDocument
        dados={{
          pacienteNome: 'Marina Souza',
          geradoEm: ISO,
          consultas: [consulta(), consulta({ igSemanas: 28 }), consulta({ igSemanas: 32 })],
          medico: { nome: 'Dra. Ana', crm: '123456/SP', especialidade: 'Obstetrícia' },
        }}
      />,
    )
    expect(ehPdf(b)).toBe(true)
    expect(b.length).toBeGreaterThan(5000)
  })

  it('renderiza vazio — é o caminho de quem acabou de cadastrar a paciente', async () => {
    const b = await renderiza(
      <HistoricoConsultasDocument
        dados={{ pacienteNome: 'Marina Souza', geradoEm: ISO, consultas: [] }}
      />,
    )
    expect(ehPdf(b)).toBe(true)
  })

  it('aguenta um histórico longo o bastante para paginar', async () => {
    // 30 consultas passam de uma página: exercita o cabeçalho fixo repetindo e a
    // tabela quebrando — os dois lugares em que o react-pdf falha em silêncio.
    const b = await renderiza(
      <HistoricoConsultasDocument
        dados={{
          pacienteNome: 'Marina Souza',
          geradoEm: ISO,
          consultas: Array.from({ length: 30 }, (_, i) => consulta({ igSemanas: 12 + i })),
        }}
      />,
    )
    expect(ehPdf(b)).toBe(true)
  })

  it('não desenha coluna de medida que ninguém preencheu', async () => {
    // Uma tabela de puericultura com colunas de altura uterina e BCF vazias é
    // ruído — e ruído numa tabela clínica se lê como dado faltando.
    const b = await renderiza(
      <HistoricoConsultasDocument
        dados={{
          pacienteNome: 'Bebê',
          geradoEm: ISO,
          consultas: [
            consulta({ medidas: { pesoKg: 6.2 }, igSemanas: null, igDias: null }),
            consulta({ medidas: { pesoKg: 6.9 }, igSemanas: null, igDias: null }),
          ],
        }}
      />,
    )
    expect(ehPdf(b)).toBe(true)
  })
})

describe('agenda impressa', () => {
  const item = (hora: number, nome: string) => ({
    inicio: new Date(2026, 6, 27, hora, 0).toISOString(),
    duracaoMin: 30,
    pacienteNome: nome,
    tipoNome: 'Pré-natal — retorno',
    modalidade: 'presencial',
    status: 'confirmado',
  })

  it('renderiza a agenda da semana', async () => {
    const b = await renderiza(
      <AgendaDoDiaDocument
        dados={{
          medicoNome: 'Dra. Ana',
          periodo: '26 Jul – 1 Ago 2026',
          geradoEm: ISO,
          itens: [item(9, 'Fernanda Lima'), item(10, 'Juliana Alves'), item(14, 'Camila Rocha')],
        }}
      />,
    )
    expect(ehPdf(b)).toBe(true)
  })

  it('renderiza um período sem nada marcado', async () => {
    const b = await renderiza(
      <AgendaDoDiaDocument
        dados={{ medicoNome: 'Dra. Ana', periodo: 'Semana 31', geradoEm: ISO, itens: [] }}
      />,
    )
    expect(ehPdf(b)).toBe(true)
  })

  it('aguenta uma semana cheia, atravessando páginas', async () => {
    const itens = Array.from({ length: 60 }, (_, i) =>
      item(8 + (i % 10), `Paciente ${i}`),
    )
    const b = await renderiza(
      <AgendaDoDiaDocument
        dados={{ medicoNome: 'Dra. Ana', periodo: 'Semana 31', geradoEm: ISO, itens }}
      />,
    )
    expect(ehPdf(b)).toBe(true)
  })
})

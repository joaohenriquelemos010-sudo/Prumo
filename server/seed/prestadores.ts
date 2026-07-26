import { Prestador } from '../models/Prestador.js'

/**
 * Seed marketplace listings. Illustrative data for the prototype — exam brands
 * the user named (Alta, Sérgio Franco, Delboni, Hermes Pardini) plus generic
 * doctors, obstetric/pediatric nurses and maternities spread across cities so the
 * proximity sort has something to work with. Coordinates are approximate.
 */
const SEED = [
  // --- Clínicas / laboratórios de exame ---
  { nome: 'Alta Diagnósticos', tipo: 'clinica', especialidade: 'Análises clínicas e imagem', servicos: ['exame'], atende: ['presencial'], cidade: 'São Paulo', uf: 'SP', endereco: 'Av. Paulista, 2000', lat: -23.5613, lng: -46.6558, bio: 'Exames laboratoriais e de imagem com ampla rede de unidades.', convenios: ['Amil', 'Bradesco Saúde', 'SulAmérica', 'Unimed', 'Porto Seguro Saúde'], atendeParticular: true },
  { nome: 'Sérgio Franco Medicina Diagnóstica', tipo: 'clinica', especialidade: 'Análises clínicas e imagem', servicos: ['exame'], atende: ['presencial'], cidade: 'Rio de Janeiro', uf: 'RJ', endereco: 'R. da Passagem, 100', lat: -22.9519, lng: -43.1783, bio: 'Referência em medicina diagnóstica no Rio de Janeiro.', convenios: ['Amil', 'Bradesco Saúde', 'SulAmérica', 'Golden Cross'], atendeParticular: true },
  { nome: 'Delboni Auriemo', tipo: 'clinica', especialidade: 'Análises clínicas', servicos: ['exame'], atende: ['presencial'], cidade: 'São Paulo', uf: 'SP', endereco: 'R. Domingos de Morais, 500', lat: -23.5985, lng: -46.6396, bio: 'Coleta domiciliar disponível em algumas regiões.', convenios: ['Amil', 'SulAmérica', 'Unimed'], atendeParticular: true },
  { nome: 'Hermes Pardini', tipo: 'clinica', especialidade: 'Análises clínicas', servicos: ['exame'], atende: ['presencial'], cidade: 'Belo Horizonte', uf: 'MG', endereco: 'R. Aimorés, 66', lat: -19.9264, lng: -43.9352, bio: 'Laboratório com forte atuação em Minas Gerais.', convenios: ['Unimed', 'Bradesco Saúde', 'Hapvida NotreDame Intermédica'], atendeParticular: true },

  // --- Obstetras / ginecologistas (consulta gestante) ---
  { nome: 'Dra. Helena Prado', tipo: 'medico', especialidade: 'Obstetrícia', servicos: ['consulta-gestante'], atende: ['presencial', 'teleconsulta'], cidade: 'São Paulo', uf: 'SP', endereco: 'R. Oscar Freire, 700', lat: -23.5629, lng: -46.6708, bio: 'Acompanhamento de pré-natal de baixo e alto risco.', convenios: ['Unimed', 'Bradesco Saúde'], atendeParticular: true },
  { nome: 'Dr. Rafael Nunes', tipo: 'medico', especialidade: 'Ginecologia e Obstetrícia', servicos: ['consulta-gestante'], atende: ['teleconsulta'], cidade: 'Rio de Janeiro', uf: 'RJ', endereco: 'Av. das Américas, 500', lat: -23.0, lng: -43.36, bio: 'Teleconsulta para gestantes e planejamento familiar.', convenios: ['SulAmérica', 'Amil'], atendeParticular: true },
  { nome: 'Dra. Marina Costa', tipo: 'medico', especialidade: 'Obstetrícia', servicos: ['consulta-gestante'], atende: ['presencial'], cidade: 'Curitiba', uf: 'PR', endereco: 'R. Comendador Araújo, 300', lat: -25.4358, lng: -49.2776, bio: 'Parto humanizado e acompanhamento gestacional.', convenios: ['Unimed'], atendeParticular: true },

  // --- Pediatras (consulta criança) ---
  { nome: 'Dr. Bruno Almeida', tipo: 'medico', especialidade: 'Pediatria', servicos: ['consulta-crianca'], atende: ['presencial', 'teleconsulta'], cidade: 'São Paulo', uf: 'SP', endereco: 'R. dos Pinheiros, 900', lat: -23.5665, lng: -46.6816, bio: 'Puericultura e acompanhamento do desenvolvimento.', convenios: ['Amil', 'Porto Seguro Saúde'], atendeParticular: true },
  { nome: 'Dra. Camila Rocha', tipo: 'medico', especialidade: 'Pediatria', servicos: ['consulta-crianca'], atende: ['teleconsulta'], cidade: 'Belo Horizonte', uf: 'MG', endereco: 'Av. do Contorno, 4000', lat: -19.9321, lng: -43.9388, bio: 'Teleorientação pediátrica e primeiros cuidados.', convenios: ['Unimed', 'Hapvida NotreDame Intermédica'], atendeParticular: true },
  { nome: 'Dr. Tiago Ferreira', tipo: 'medico', especialidade: 'Pediatria', servicos: ['consulta-crianca'], atende: ['presencial'], cidade: 'Rio de Janeiro', uf: 'RJ', endereco: 'R. Voluntários da Pátria, 200', lat: -22.9532, lng: -43.1899, bio: 'Amamentação, sono e introdução alimentar.', convenios: ['Bradesco Saúde'], atendeParticular: true },

  // --- Enfermeiras obstétricas (domiciliar) ---
  { nome: 'Enf. Patrícia Lopes', tipo: 'enfermeiro', especialidade: 'Enfermagem obstétrica', servicos: ['consulta-gestante'], atende: ['presencial'], aceitaDomiciliar: true, cidade: 'São Paulo', uf: 'SP', endereco: 'Atendimento domiciliar — zona oeste', lat: -23.5505, lng: -46.6900, bio: 'Apoio à gestação e ao pós-parto na sua casa: amamentação, banho, cuidados do bebê.', convenios: [], atendeParticular: true },
  { nome: 'Enf. Sandra Dias', tipo: 'enfermeiro', especialidade: 'Enfermagem obstétrica', servicos: ['consulta-gestante'], atende: ['presencial'], aceitaDomiciliar: true, cidade: 'Curitiba', uf: 'PR', endereco: 'Atendimento domiciliar — região central', lat: -25.43, lng: -49.27, bio: 'Consultoria em amamentação e cuidados no puerpério.', convenios: [], atendeParticular: true },

  // --- Hospitais / maternidades (tudo) ---
  { nome: 'Maternidade Santa Clara', tipo: 'hospital', especialidade: 'Maternidade', servicos: ['consulta-gestante', 'consulta-crianca', 'exame'], atende: ['presencial'], cidade: 'São Paulo', uf: 'SP', endereco: 'R. da Consolação, 3000', lat: -23.5545, lng: -46.6626, bio: 'Pré-natal, parto, pediatria e exames num só lugar.', convenios: ['Unimed', 'Amil', 'SulAmérica'], atendeParticular: true, atendeSus: true },
  { nome: 'Hospital Bem Nascer', tipo: 'hospital', especialidade: 'Maternidade e pediatria', servicos: ['consulta-gestante', 'consulta-crianca', 'exame'], atende: ['presencial'], cidade: 'Rio de Janeiro', uf: 'RJ', endereco: 'Av. Ataulfo de Paiva, 800', lat: -22.984, lng: -43.218, bio: 'Emergência obstétrica e pediátrica 24h.', convenios: ['Bradesco Saúde', 'Golden Cross'], atendeParticular: true, atendeSus: true },
] as const

let seeding: Promise<void> | null = null

/** Idempotent: seeds only when the collection is empty. Safe to call per request. */
export async function ensurePrestadoresSeed(): Promise<void> {
  const count = await Prestador.estimatedDocumentCount()
  if (count > 0) return
  if (!seeding) {
    seeding = Prestador.insertMany(SEED)
      .then(() => undefined)
      .catch(() => undefined)
      .finally(() => {
        seeding = null
      })
  }
  await seeding
}

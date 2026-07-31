import { User } from '../../models/User.js'
import { Crianca } from '../../models/Crianca.js'
import { pareceCifrado } from '../../security/cripto.js'

/**
 * Cifra o que já estava gravado em claro: CPF de médico e número de carteirinha.
 *
 * ## Por que não é um `updateMany`
 *
 * Porque a criptografia acontece no `set` do Mongoose, e um `updateMany` fala
 * direto com o driver — passaria por cima do setter e gravaria em claro de novo.
 * Aqui a leitura e a escrita passam pelo documento, que é onde a camada vive.
 *
 * ## Idempotente
 *
 * O setter reconhece o próprio formato e devolve o valor como está, e o
 * `pareceCifrado` abaixo evita até a escrita. Rodar duas vezes — porque o lease
 * expirou, porque alguém rodou à mão — não empilha camadas nem reescreve nada.
 *
 * ## Sem `CAMPO_CHAVE` esta migração é um no-op
 *
 * O setter devolve o texto original quando não há chave, então os documentos
 * não mudam e a migração é marcada como aplicada. Isso é deliberado: definir a
 * chave depois e rodar de novo é o caminho, e para isso basta apagar o documento
 * desta migração na coleção de migrações. Está documentado em SECURITY.md.
 */
export async function up(): Promise<void> {
  // Os dois campos são `select: false` — sem o `+` eles não vêm, e a migração
  // percorreria todo mundo sem nada para fazer.
  const medicos = await User.find({ papel: 'medico' }).select('+cpf')
  for (const medico of medicos) {
    const cpf = medico.get('cpf', null, { getters: false }) as string | undefined
    if (!cpf || pareceCifrado(cpf)) continue
    // Reatribuir dispara o setter, que cifra. É por isso que o valor é lido
    // com `getters: false`: sem isso, leria decifrado e cifraria o já cifrado.
    medico.cpf = cpf
    await medico.save()
  }

  const jornadas = await Crianca.find({ 'convenio.informado': true }).select(
    '+convenio.numeroCarteirinha',
  )
  for (const jornada of jornadas) {
    const numero = jornada.get('convenio.numeroCarteirinha', null, { getters: false }) as
      | string
      | undefined
    if (!numero || pareceCifrado(numero)) continue
    jornada.set('convenio.numeroCarteirinha', numero)
    await jornada.save()
  }
}

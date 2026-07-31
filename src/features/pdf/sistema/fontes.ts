import { Font } from '@react-pdf/renderer'

import outfitRegular from '@/assets/fontes/Outfit-Regular.ttf?url'
import outfitSemiBold from '@/assets/fontes/Outfit-SemiBold.ttf?url'
import outfitBold from '@/assets/fontes/Outfit-Bold.ttf?url'
import nunitoRegular from '@/assets/fontes/Nunito-Regular.ttf?url'
import nunitoSemiBold from '@/assets/fontes/Nunito-SemiBold.ttf?url'
import nunitoBold from '@/assets/fontes/Nunito-Bold.ttf?url'

/**
 * As fontes da marca dentro do PDF.
 *
 * **Embutidas localmente, nunca buscadas em CDN.** O `Font.register` do react-pdf
 * baixa a URL em tempo de *render* — um soluço de rede produziria um documento
 * quebrado na frente da paciente, e ainda exigiria alargar a CSP para o
 * fonts.gstatic. Com `?url` do Vite os arquivos ficam content-hashed e
 * same-origin, e entram só no chunk do PDF.
 *
 * Custo: ~520 KB, carregados apenas quando alguém baixa um documento. Aceito —
 * fidelidade de marca vale isso num arquivo que a pessoa guarda e imprime.
 */

let registrado = false

export function registrarFontes(): void {
  if (registrado) return
  registrado = true

  Font.register({
    family: 'Outfit',
    fonts: [
      { src: outfitRegular, fontWeight: 400 },
      { src: outfitSemiBold, fontWeight: 600 },
      { src: outfitBold, fontWeight: 700 },
    ],
  })

  Font.register({
    family: 'Nunito',
    fonts: [
      { src: nunitoRegular, fontWeight: 400 },
      { src: nunitoSemiBold, fontWeight: 600 },
      { src: nunitoBold, fontWeight: 700 },
    ],
  })

  /**
   * O hifenizador padrão do react-pdf é feito para inglês e corta palavra em
   * português nos lugares errados ("gesta-nte"). Devolver a palavra inteira
   * desliga a hifenização: prefere-se uma linha com espaço sobrando a um corte
   * errado num documento clínico.
   */
  Font.registerHyphenationCallback((palavra) => [palavra])
}

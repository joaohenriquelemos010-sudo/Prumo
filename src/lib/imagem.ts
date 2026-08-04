/**
 * Redução de imagem no cliente, antes de qualquer viagem de rede.
 *
 * A foto que sai de um celular tem 4 MB e 4000px de largura. O que a ficha da
 * paciente mostra é um círculo de 96px. Subir os 4 MB para exibir 96px gasta o
 * pacote de dados de quem está no 4G da sala de espera, o limite de corpo do
 * servidor e o espaço do banco — três custos para o mesmo pixel.
 *
 * Por isso a redução acontece **aqui**, no `canvas`, e o que trafega é uma data
 * URL de poucos KB. O efeito colateral que importa: a imagem original nunca sai
 * do aparelho. O EXIF vai junto — geolocalização inclusive — e um `canvas`
 * redesenha só os pixels, deixando os metadados para trás sem que ninguém
 * precise lembrar de limpá-los.
 */

export interface OpcoesReducao {
  /** Maior lado da imagem final, em pixels. */
  lado?: number
  /** Teto do resultado em caracteres da data URL. */
  maxCaracteres?: number
}

const TIPOS_ACEITOS = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']

/**
 * Recorta no centro, quadrado, e devolve `data:image/jpeg;base64,…`.
 *
 * Quadrado porque o destino é um avatar circular: deixar o navegador cobrir o
 * círculo com uma imagem retangular corta a cabeça de metade das fotos de
 * retrato. Recortar no centro na hora de gravar é a única forma de o que a
 * pessoa vê ao escolher ser o que ela vê depois.
 *
 * A qualidade cai em degraus até o resultado caber no teto. Uma única passada
 * com qualidade fixa erraria nos dois sentidos: pesada demais para uma foto
 * detalhada, borrada à toa para um fundo liso.
 */
export async function reduzirParaAvatar(
  arquivo: File,
  { lado = 256, maxCaracteres = 40_000 }: OpcoesReducao = {},
): Promise<string> {
  if (!TIPOS_ACEITOS.includes(arquivo.type)) {
    throw new Error('Escolha uma imagem JPG, PNG ou WebP.')
  }
  // 12 MB de entrada. Acima disso o problema não é a foto, é o arquivo errado.
  if (arquivo.size > 12 * 1024 * 1024) {
    throw new Error('Essa imagem é grande demais. Tenta uma menor?')
  }

  const bitmap = await carregar(arquivo)
  const canvas = document.createElement('canvas')
  canvas.width = lado
  canvas.height = lado
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Não consegui preparar a imagem neste navegador.')

  const corte = Math.min(bitmap.width, bitmap.height)
  const x = (bitmap.width - corte) / 2
  const y = (bitmap.height - corte) / 2
  ctx.drawImage(bitmap, x, y, corte, corte, 0, 0, lado, lado)
  if ('close' in bitmap) bitmap.close()

  for (const qualidade of [0.82, 0.7, 0.6, 0.5, 0.4]) {
    const url = canvas.toDataURL('image/jpeg', qualidade)
    if (url.length <= maxCaracteres) return url
  }

  throw new Error('Não consegui reduzir essa imagem o suficiente. Tenta outra?')
}

/**
 * `createImageBitmap` quando existe (decodifica fora da thread principal, sem
 * segurar a digitação), e o `<img>` de sempre quando não.
 */
async function carregar(arquivo: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(arquivo)
    } catch {
      /* formato que o navegador só abre pelo caminho antigo — segue abaixo */
    }
  }

  const url = URL.createObjectURL(arquivo)
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('Não consegui abrir essa imagem.'))
      img.src = url
    })
  } finally {
    // Revogar aqui é seguro: a imagem já foi decodificada para a memória.
    URL.revokeObjectURL(url)
  }
}

import { z } from 'zod'

/**
 * Every form input is validated here before it can move anywhere. Messages are
 * written in the Prumo voice — warm, specific, never scolding.
 */

const nome = z
  .string()
  .trim()
  .min(2, 'Conta pra gente como podemos te chamar.')
  .max(80, 'Esse nome ficou longo demais — pode encurtar?')
  .regex(/^[\p{L}\s'.-]+$/u, 'Use só letras, por favor.')

const email = z
  .string()
  .trim()
  .min(1, 'Precisamos de um e-mail para te encontrar.')
  .email('Esse e-mail parece incompleto. Confere pra mim?')

export const onboardingSchema = z.object({
  perfil: z.enum(['gestante', 'mae', 'medico'], {
    required_error: 'Escolha por onde você entra na trilha.',
  }),
  nome,
})

export type OnboardingInput = z.infer<typeof onboardingSchema>

export const contatoSchema = z.object({
  nome,
  email,
  mensagem: z
    .string()
    .trim()
    .min(10, 'Escreve um pouquinho mais pra gente entender?')
    .max(1000, 'Ficou longo — resuma em até 1000 caracteres.'),
})

export type ContatoInput = z.infer<typeof contatoSchema>

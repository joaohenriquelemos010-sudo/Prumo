import { Router } from 'express'
import { isValidObjectId } from 'mongoose'
import { requireAuth } from '../auth.js'
import { Post } from '../models/Post.js'
import type { PostDoc } from '../models/Post.js'
import type { HydratedDocument } from 'mongoose'
import { postCreateSchema, comentarioCreateSchema } from '../validation.js'
import { normalizeField } from '../sanitize.js'

export const comunidadeRouter = Router()

comunidadeRouter.param('id', (_req, res, next, id) => {
  if (!isValidObjectId(id)) {
    res.status(404).json({ error: 'Não encontramos esse post.' })
    return
  }
  next()
})

function serialize(p: HydratedDocument<PostDoc>, userId: string) {
  return {
    id: String(p._id),
    autorNome: p.anonimo ? 'Anônima' : p.autorNome || 'Alguém',
    anonimo: p.anonimo,
    ehMeu: p.autorId === userId,
    categoria: p.categoria,
    texto: p.texto,
    curtidas: p.curtidas.length,
    curtiu: p.curtidas.includes(userId),
    criadaEm: (p as unknown as { createdAt?: Date }).createdAt?.toISOString() ?? new Date().toISOString(),
    comentarios: p.comentarios.map((c) => ({
      id: String(c._id),
      autorNome: c.autorNome || 'Alguém',
      texto: c.texto,
      criadaEm: c.criadaEm ? new Date(c.criadaEm).toISOString() : new Date().toISOString(),
    })),
  }
}

// GET /api/comunidade — recent feed (optionally filtered by ?categoria=).
comunidadeRouter.get('/', requireAuth, async (req, res) => {
  const filtro: Record<string, unknown> = {}
  const cat = String(req.query.categoria ?? '')
  if (cat) filtro.categoria = cat
  const posts = await Post.find(filtro).sort({ createdAt: -1 }).limit(50)
  res.json({ posts: posts.map((p) => serialize(p, req.user!.id)) })
})

// POST /api/comunidade — share a post.
comunidadeRouter.post('/', requireAuth, async (req, res) => {
  const parsed = postCreateSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Confere o que você escreveu.' })
    return
  }
  const { texto, categoria, anonimo } = parsed.data
  const post = await Post.create({
    autorId: req.user!.id,
    autorNome: req.user!.nome,
    anonimo: Boolean(anonimo),
    categoria,
    texto: normalizeField(texto, 1000),
  })
  res.status(201).json({ post: serialize(post, req.user!.id) })
})

// POST /api/comunidade/:id/curtir — toggle like.
comunidadeRouter.post('/:id/curtir', requireAuth, async (req, res) => {
  const post = await Post.findById(req.params.id)
  if (!post) {
    res.status(404).json({ error: 'Post não encontrado.' })
    return
  }
  const set = new Set(post.curtidas)
  if (set.has(req.user!.id)) set.delete(req.user!.id)
  else set.add(req.user!.id)
  post.curtidas = [...set]
  await post.save()
  res.json({ post: serialize(post, req.user!.id) })
})

// POST /api/comunidade/:id/comentar — add a comment.
comunidadeRouter.post('/:id/comentar', requireAuth, async (req, res) => {
  const parsed = comentarioCreateSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Escreva um comentário.' })
    return
  }
  const post = await Post.findById(req.params.id)
  if (!post) {
    res.status(404).json({ error: 'Post não encontrado.' })
    return
  }
  post.comentarios.push({
    autorId: req.user!.id,
    autorNome: req.user!.nome,
    texto: normalizeField(parsed.data.texto, 500),
    criadaEm: new Date(),
  })
  await post.save()
  res.status(201).json({ post: serialize(post, req.user!.id) })
})

// DELETE /api/comunidade/:id — author removes their own post.
comunidadeRouter.delete('/:id', requireAuth, async (req, res) => {
  const post = await Post.findById(req.params.id)
  if (!post) {
    res.status(404).json({ error: 'Post não encontrado.' })
    return
  }
  if (post.autorId !== req.user!.id) {
    res.status(403).json({ error: 'Você só pode remover os seus próprios posts.' })
    return
  }
  await post.deleteOne()
  res.status(204).end()
})

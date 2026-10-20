import Fastify from 'fastify'

const fastify = Fastify()

fastify.get('/', async (request, reply) => {
  return { hello: 'world' }
})


fastify.listen({ port: 3000 })
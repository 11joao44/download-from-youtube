import Fastify from 'fastify';
import path from 'path';
import downloadRoutes from './routes/download.js';
import fastifyStatic from '@fastify/static';

const fastify = Fastify({
  logger: true,
});

// Registrar rotas de download
fastify.register(downloadRoutes);

// Servir arquivos estáticos
fastify.register(fastifyStatic, {
  root: path.join(process.cwd(), 'public'),
  prefix: '/', // Define o caminho base para os arquivos estáticos
});

// Iniciar o servidor
const start = async () => {
  try {
    await fastify.listen({ port: 3000 });
    console.log('Servidor rodando em http://localhost:3000');
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();

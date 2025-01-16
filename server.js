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

// Porta padrão para Render (ou 3000 para desenvolvimento local)
const PORT = process.env.PORT || 3000;

// Iniciar o servidor
const start = async () => {
  try {
    await fastify.listen({ port: PORT, host: '0.0.0.0' }); // Use host '0.0.0.0' para expor externamente
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();

import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { spawn } from 'child_process';
import path from 'path';

// Definir o tipo para os parâmetros da rota
interface DownloadQuery {
  url: string;
  format?: string;
}

// Função principal com tipagem explícita
export default async function downloadRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/download', async (request: FastifyRequest<{ Querystring: DownloadQuery }>, reply: FastifyReply) => {
    const { url, format } = request.query;

    if (!url) {
      return reply.code(400).send({ error: 'URL do vídeo não fornecida!' });
    }

    try {
      const ytDlpPath = path.resolve('./bin/yt-dlp.exe');
      const args = ['-o', '-', url];
      if (format) {
        args.splice(2, 0, '-f', format);
      }

      const process = spawn(ytDlpPath, args);

      reply.raw.writeHead(200, {
        'Content-Disposition': `attachment; filename="video.${format || 'mp4'}"`,
        'Content-Type': 'video/mp4',
      });

      process.stdout.pipe(reply.raw);

      process.stdout.on('data', (chunk) => {
        console.log(`Recebido ${chunk.length} bytes de dados.`);
      });

      process.stdout.on('end', () => {
        console.log('Download concluído, encerrando resposta.');
        reply.raw.end();
      });

      process.stderr.on('data', (data) => {
        console.error(`[yt-dlp log]: ${data.toString()}`);
      });

      process.on('close', (code) => {
        console.log(`Processo yt-dlp encerrado com código ${code}`);
        if (code !== 0) {
          reply.code(500).send({ error: 'Erro ao processar o download.' });
        }
      });

      process.on('error', (err) => {
        console.error('Erro no processo yt-dlp:', err);
        reply.code(500).send({ error: 'Erro ao processar o download.' });
      });
    } catch (err) {
      console.error('Erro ao executar o yt-dlp:', err);
      reply.code(500).send({ error: 'Erro interno ao processar o download.' });
    }
  });

  fastify.get("/", async (request, reply) => {
    reply.send({ message: "Servidor funcionando! Use /download para baixar vídeos." });
  });
  
}

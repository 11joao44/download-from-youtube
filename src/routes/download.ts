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
  fastify.get("/download", async (request: FastifyRequest<{ Querystring: DownloadQuery }>, reply: FastifyReply) => {
    const { url, format } = request.query;
  
    if (!url) {
      return reply.code(400).send({ error: "URL do vídeo não fornecida!" });
    }
  
    try {
      const ytDlpPath = path.resolve("./bin/yt-dlp");
      const args = ["-o", "-", url];
      if (format) {
        args.splice(2, 0, "-f", format);
      }
  
      const process = spawn(ytDlpPath, args);
  
      // Cabeçalhos de resposta
      reply.raw.writeHead(200, {
        "Content-Disposition": `attachment; filename="video.${format || "mp4"}"`,
        "Content-Type": "video/mp4",
      });
  
      let hasData = false;
  
      // Captura saída do yt-dlp
      process.stdout.on("data", (chunk) => {
        if (chunk.length > 0) {
          hasData = true;
          reply.raw.write(chunk);
        } else {
          console.error("Nenhum dado recebido do yt-dlp.");
        }
      });
  
      process.stderr.on("data", (data) => {
        console.error(`[yt-dlp error]: ${data.toString()}`);
      });
  
      process.on("close", (code) => {
        if (code !== 0 || !hasData) {
          console.error(`Processo yt-dlp finalizado com código ${code} ou sem dados.`);
          if (!reply.raw.headersSent) {
            reply.code(500).send({ error: "Erro ao processar o download." });
          }
        } else {
          console.log("Download concluído, encerrando resposta.");
          reply.raw.end();
        }
      });
  
      process.on("error", (err) => {
        console.error("Erro no processo yt-dlp:", err);
        if (!reply.raw.headersSent) {
          reply.code(500).send({ error: "Erro interno ao processar o download." });
        }
      });
    } catch (err) {
      console.error("Erro ao executar o yt-dlp:", err);
      if (!reply.raw.headersSent) {
        reply.code(500).send({ error: "Erro interno ao processar o download." });
      }
    }
  });
  
}

import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { spawn } from 'child_process';
import path from 'path';
import fs from "fs";
import os from "os";

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

      // Criar arquivo temporário para cookies
      const tempDir = os.tmpdir();
      const cookiesPath = path.join(tempDir, "cookies.txt");
      const cookies = process.env.YOUTUBE_COOKIES;
  
      if (!cookies) {
        return reply.code(500).send({ error: "Cookies não configurados no ambiente." });
      }
  
      // Escrever os cookies no arquivo temporário
      fs.writeFileSync(cookiesPath, cookies, "utf8");
  
      const args = ["--cookies", cookiesPath, "-o", "-", url];
      if (format) {
        args.splice(4, 0, "-f", format);
      }
  
      const processyt = spawn(ytDlpPath, args);
  
      // Cabeçalhos de resposta
      reply.raw.writeHead(200, {
        "Content-Disposition": `attachment; filename="video.${format || "mp4"}"`,
        "Content-Type": "video/mp4",
      });
  
      let hasData = false;
  
      // Captura saída do yt-dlp
      processyt.stdout.on("data", (chunk) => {
        if (chunk.length > 0) {
          hasData = true;
          reply.raw.write(chunk);
        } else {
          console.error("Nenhum dado recebido do yt-dlp.");
        }
      });
  
      processyt.stderr.on("data", (data) => {
        console.error(`[yt-dlp error]: ${data.toString()}`);
      });
  
      processyt.on("close", (code) => {
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
  
      processyt.on("error", (err) => {
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

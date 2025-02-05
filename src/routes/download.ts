import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { spawn } from "child_process";
import path from "path";
import fs from "fs";
import os from "os";

// Definir o tipo para os parâmetros da rota
interface DownloadQuery {
  url: string;
  format?: string;
}

export default async function downloadRoutes(
  fastify: FastifyInstance
): Promise<void> {
  fastify.get(
    "/download",
    async (
      request: FastifyRequest<{ Querystring: DownloadQuery }>,
      reply: FastifyReply
    ) => {
      const { url, format } = request.query;

      if (!url) {
        return reply.code(400).send({ error: "URL do vídeo não fornecida!" });
      }

      // Verificar se as variáveis de ambiente necessárias estão configuradas
      if (!process.env.YOUTUBE_COOKIES) {
        return reply
          .code(500)
          .send({ error: "Cookies não configurados no ambiente." });
      }

      // Caminho para o executável yt-dlp (ajustando a partir do diretório de execução)
      const ytDlpPath = path.join(process.cwd(), "bin", "yt-dlp");
      if (!fs.existsSync(ytDlpPath)) {
        return reply.code(500).send({ error: "yt-dlp não encontrado." });
      }

      // Gerar um nome único para o arquivo temporário de cookies
      const uniqueCookieFile = `cookies-${Date.now()}-${Math.random()
        .toString(36)
        .substr(2)}.txt`;
      const cookiesPath = path.join(os.tmpdir(), uniqueCookieFile);

      try {
        fs.writeFileSync(cookiesPath, process.env.YOUTUBE_COOKIES, "utf8");
      } catch (error) {
        console.error("Erro ao criar arquivo de cookies:", error);
        return reply
          .code(500)
          .send({ error: "Erro ao criar arquivo de cookies." });
      }

      // Construir os argumentos para o yt-dlp
      const args = [
        "--cookies",
        cookiesPath,
        "--no-playlist",
        "--user-agent",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:102.0) Gecko/20100101 Firefox/102.0",
      ];

      if (format) {
        args.push("-f", format);
        if (process.env.YOUTUBE_VISITOR_DATA) {
          args.push(
            "--extractor-args",
            `youtube:visitor_data=${process.env.YOUTUBE_VISITOR_DATA}`
          );
        }
      }

      // Definir a saída para ser enviada diretamente para o cliente
      args.push("-o", "-", url);

      // Iniciar o processo yt-dlp
      const ytDlpProcess = spawn(ytDlpPath, args);

      // Definir os cabeçalhos de resposta para download
      reply.raw.writeHead(200, {
        "Content-Disposition": `attachment; filename="video.${format || "mp4"}"`,
        "Content-Type": "video/mp4",
      });

      let hasData = false;

      // Encaminhar a saída padrão do yt-dlp para a resposta
      ytDlpProcess.stdout.on("data", (chunk) => {
        if (chunk.length > 0) {
          hasData = true;
          reply.raw.write(chunk);
        } else {
          console.error("Nenhum dado recebido do yt-dlp.");
        }
      });

      // Log de erros caso o yt-dlp escreva na saída de erro
      ytDlpProcess.stderr.on("data", (data) => {
        console.error(`[yt-dlp error]: ${data.toString()}`);
      });

      // Ao finalizar o processo, remover o arquivo de cookies e encerrar a resposta
      ytDlpProcess.on("close", (code) => {
        // Remover o arquivo temporário de cookies
        fs.unlink(cookiesPath, (err) => {
          if (err) {
            console.error("Erro ao remover o arquivo de cookies:", err);
          }
        });

        if (code !== 0 || !hasData) {
          console.error(
            `Processo yt-dlp finalizado com código ${code} ou sem dados.`
          );
          if (!reply.raw.headersSent) {
            reply.code(500).send({ error: "Erro ao processar o download." });
          }
        } else {
          console.log("Download concluído, encerrando resposta.");
          reply.raw.end();
        }
      });

      // Tratar erro no processo
      ytDlpProcess.on("error", (err) => {
        console.error("Erro no processo yt-dlp:", err);
        // Remover o arquivo temporário de cookies, mesmo em caso de erro
        fs.unlink(cookiesPath, (unlinkErr) => {
          if (unlinkErr) {
            console.error("Erro ao remover o arquivo de cookies:", unlinkErr);
          }
        });
        if (!reply.raw.headersSent) {
          reply
            .code(500)
            .send({ error: "Erro interno ao processar o download." });
        }
      });
    }
  );
}

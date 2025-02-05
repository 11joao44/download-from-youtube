import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { spawn } from "child_process";
import path from "path";
import fs from "fs";

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
        return reply
          .code(400)
          .send({ error: "URL do vídeo não fornecida!" });
      }

      try {
        // Define o nome do executável conforme o sistema operacional
        const executableName = process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp";
        const ytDlpPath = path.join(process.cwd(), "bin", executableName);

        if (!fs.existsSync(ytDlpPath)) {
          return reply
            .code(500)
            .send({ error: `${executableName} não encontrado no diretório bin.` });
        }

        // Monta os argumentos para o yt-dlp
        const args = [
          "--no-playlist",
          "--user-agent",
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:102.0) Gecko/20100101 Firefox/102.0",
        ];

        if (format) {
          if (format.toLowerCase() === "mp3") {
            // Se o formato solicitado for mp3, extrai o áudio e converte para mp3
            // IMPORTANTE: certifique-se de que o ffmpeg esteja instalado e acessível no PATH
            args.push("-x", "--audio-format", "mp3");
          } else {
            args.push("-f", format);
          }
        }

        // Define a saída para ser enviada diretamente para o cliente
        args.push("-o", "-", url);

        // Inicia o processo do yt-dlp
        const ytDlpProcess = spawn(ytDlpPath, args);

        // Define os cabeçalhos para download (ajuste o Content-Type se necessário)
        // Quando o áudio for extraído para mp3, o Content-Type permanece "video/mp4" ou você pode alterar para "audio/mpeg"
        const contentType = format?.toLowerCase() === "mp3" ? "audio/mpeg" : "video/mp4";
        reply.raw.writeHead(200, {
          "Content-Disposition": `attachment; filename="video.${format || "mp4"}"`,
          "Content-Type": contentType,
        });

        let hasData = false;

        // Encaminha a saída padrão do yt-dlp para a resposta
        ytDlpProcess.stdout.on("data", (chunk) => {
          if (chunk.length > 0) {
            hasData = true;
            reply.raw.write(chunk);
          } else {
            console.error("Nenhum dado recebido do yt-dlp.");
          }
        });

        // Loga a saída de erro do yt-dlp
        ytDlpProcess.stderr.on("data", (data) => {
          console.error(`[yt-dlp error]: ${data.toString()}`);
        });

        // Quando o processo for finalizado, encerra a resposta
        ytDlpProcess.on("close", (code) => {
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

        // Trata erros no processo do yt-dlp
        ytDlpProcess.on("error", (err) => {
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
    }
  );
}

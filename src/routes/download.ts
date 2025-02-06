import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { spawn } from "child_process";
import axios from "axios";
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
        return reply
          .code(400)
          .send({ error: "URL do vídeo não fornecida!" });
      }

      try {
        // Define o nome do executável de acordo com o sistema operacional
        const executableName =
          process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp";
        const ytDlpPath = path.join(process.cwd(), "bin", executableName);

        if (!fs.existsSync(ytDlpPath)) {
          return reply
            .code(500)
            .send({ error: `${executableName} não encontrado no diretório bin.` });
        }

        // Inicia a montagem dos argumentos para o yt-dlp
        const args = [
          "--no-playlist",
          "--user-agent",
          // User-Agent do Chrome 114 em Windows 10
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36",
          "--referer",
          "https://www.youtube.com/",
        ];

        async function getYouTubeCookies() {
          try {
            const response = await axios.get('https://www.youtube.com');
            
            // Os cookies estão no cabeçalho 'set-cookie' da resposta
            const cookies = response.headers['set-cookie'];
            
            // Converte os cookies para o formato de variáveis de ambiente
            const cookieString = cookies.join('; ');
        
            // Definir a variável de ambiente YOUTUBE_COOKIES com os cookies coletados
            process.env.YOUTUBE_COOKIES = cookieString;
        
            console.log('Cookies coletados e definidos na variável de ambiente YOUTUBE_COOKIES');
          } catch (error) {
            console.error('Erro ao coletar os cookies:', error);
          }
        }
        
        // Chama a função para coletar os cookies
        getYouTubeCookies();

        // Se a variável de ambiente YOUTUBE_COOKIES estiver definida, use os cookies
        let cookieFilePath: string | null = null;
        if (process.env.YOUTUBE_COOKIES) {
          // Cria um arquivo temporário para os cookies
          cookieFilePath = path.join(os.tmpdir(), `cookies_${Date.now()}.txt`);
          try {
            fs.writeFileSync(cookieFilePath, process.env.YOUTUBE_COOKIES, "utf8");
            console.log(`Arquivo de cookies criado em: ${cookieFilePath}`);
            args.push("--cookies", cookieFilePath);
          } catch (err) {
            console.error("Erro ao criar arquivo de cookies:", err);
            return reply.code(500).send({ error: "Erro ao criar arquivo de cookies." });
          }
        } else {
          console.warn("YOUTUBE_COOKIES não está definida. Sem cookies, o acesso pode ser bloqueado.");
        }

        // Trata a seleção do formato solicitado
        if (format) {
          if (format.toLowerCase() === "mp3") {
            // Extrai o áudio e converte para mp3 (ffmpeg precisa estar instalado no PATH)
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
        const contentType = format?.toLowerCase() === "mp3" ? "audio/mpeg" : "video/mp4";
        reply.raw.writeHead(200, {
          "Content-Disposition": `attachment; filename="video.${format || "mp4"}"`,
          "Content-Type": contentType,
        });

        let hasData = false;

        ytDlpProcess.stdout.on("data", (chunk) => {
          if (chunk.length > 0) {
            hasData = true;
            reply.raw.write(chunk);
          } else {
            console.error("Nenhum dado recebido do yt-dlp.");
          }
        });

        ytDlpProcess.stderr.on("data", (data) => {
          console.error(`[yt-dlp error]: ${data.toString()}`);
        });

        ytDlpProcess.on("close", (code) => {
          // Remove o arquivo temporário de cookies, se criado
          if (cookieFilePath) {
            fs.unlink(cookieFilePath, (err) => {
              if (err) console.error("Erro ao remover arquivo de cookies:", err);
              else console.log(`Arquivo de cookies ${cookieFilePath} removido.`);
            });
          }

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

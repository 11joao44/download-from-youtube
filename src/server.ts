import fastify from "fastify";
import fastifyStatic from "@fastify/static";
import path from "path";
import fastifyCors from "@fastify/cors";
import { validatorCompiler, serializerCompiler, ZodTypeProvider, jsonSchemaTransform } from "fastify-type-provider-zod";
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";
import downloadRoutes from "./routes/download";

const app = fastify({ logger: true }).withTypeProvider<ZodTypeProvider>();

// Configurar validação e serialização com Zod
app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);

// Configurar CORS (ajustar origin em produção)
app.register(fastifyCors, { origin: "*" });

// Configurar documentação Swagger
app.register(fastifySwagger, {
    openapi: {
        info: {
            title: "API Home",
            version: "1.0.0",
        },
    },
    transform: jsonSchemaTransform,
});

app.register(fastifySwaggerUi, {
    routePrefix: "/docs",
});

// Registrar o plugin de arquivos estáticos
app.register(fastifyStatic, {
    root: path.join(__dirname, "../public"),
    prefix: "/static/", // Prefixo para acessar os arquivos estáticos
});

// Registrar as rotas
app.register(downloadRoutes);

// Porta e host dinâmicos
const PORT = process.env.PORT || 8888;

const start = async () => {
    try {
        await app.listen({ port: Number(PORT), host: "0.0.0.0" });
        console.log(`Servidor rodando na porta ${PORT}`);
    } catch (err) {
        app.log.error(err);
        process.exit(1);
    }
};

start();

export default app;

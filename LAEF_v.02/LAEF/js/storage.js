import { supabase } from "../adm/js/config.js";

// ==========================================
// LAEF — GERENCIAMENTO DO STORAGE
// ==========================================

const SUPABASE_ORIGEM =
    "https://irorrnxpwkomnglxbkul.supabase.co";

const BUCKETS_PERMITIDOS = new Set([
    "ensino",
    "equipe",
    "extensao",
    "materiais",
    "pesquisa",
    "publicacoes"
]);

const TEMPO_EXPIRACAO = 300;

// ==========================================
// OBTER CAMINHO DO ARQUIVO
// ==========================================

export function obterCaminhoStorage(bucket, valor) {

    if (!BUCKETS_PERMITIDOS.has(bucket)) {
        return null;
    }

    if (typeof valor !== "string") {
        return null;
    }

    let caminho = valor.trim();

    if (!caminho) return null;

    // URL completa armazenada anteriormente
    if (/^https?:\/\//i.test(caminho)) {

        try {

            const endereco = new URL(caminho);

            if (endereco.origin !== SUPABASE_ORIGEM) {
                return null;
            }

            const prefixo =
                `/storage/v1/object/public/${bucket}/`;

            if (!endereco.pathname.startsWith(prefixo)) {
                return null;
            }

            caminho = decodeURIComponent(
                endereco.pathname.slice(prefixo.length)
            );

        } catch {

            return null;
        }

    } else {

        // Caminho relativo
        caminho = caminho.replace(/^\/+/, "");

        if (caminho.startsWith(`${bucket}/`)) {
            caminho = caminho.slice(bucket.length + 1);
        }
    }

    // Validar caminho
    if (
        !caminho ||
        caminho.includes("\\") ||
        caminho.includes("\0") ||
        caminho.includes("://") ||
        caminho.split("/").some(
            parte => !parte || parte === ".." || parte === "."
        )
    ) {
        return null;
    }

    return caminho;
}

// ==========================================
// GERAR URL ASSINADA TEMPORÁRIA
// ==========================================

export async function obterUrlAssinada(bucket, valor) {

    const caminho = obterCaminhoStorage(bucket, valor);

    if (!caminho) return null;

    try {

        const { data, error } = await supabase.storage
            .from(bucket)
            .createSignedUrl(
                caminho,
                TEMPO_EXPIRACAO
            );

        if (error) throw error;

        return data?.signedUrl || null;

    } catch (error) {

        console.error(
            `Erro ao acessar arquivo do bucket ${bucket}:`,
            error
        );

        return null;
    }
}
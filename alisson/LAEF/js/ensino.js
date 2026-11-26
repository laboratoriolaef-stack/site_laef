
import { supabase } from "../adm/js/config.js";

// ==========================================
// LAEF — ENSINO PÚBLICO
// Integração com Supabase
// ==========================================

const lista = document.getElementById("ensino-lista");


// ==========================================
// VALIDAR ENDEREÇOS
// ==========================================

function validarUrl(url) {

    if (!url) return null;

    try {

        const endereco = new URL(url);

        if (
            endereco.protocol === "https:" ||
            endereco.protocol === "http:"
        ) {
            return endereco.href;
        }

        return null;

    } catch {
        return null;
    }

}


// ==========================================
// CRIAR ESTADO DA PÁGINA
// ==========================================

function criarEstado(texto, classe = "") {

    const elemento = document.createElement("div");

    elemento.className = `ensino-estado ${classe}`.trim();
    elemento.textContent = texto;

    return elemento;

}


// ==========================================
// CRIAR CARTÃO DE CONTEÚDO
// ==========================================

function criarCartao(conteudo) {

    const card = document.createElement("article");

    card.className = "ensino-card";

    // IMAGEM

    const imagemUrl = validarUrl(conteudo.imagem_url);

    if (imagemUrl) {

        const areaImagem = document.createElement("div");

        areaImagem.className = "ensino-card-image";

        const imagem = document.createElement("img");

        imagem.src = imagemUrl;
        imagem.alt = `Imagem de ${conteudo.titulo}`;
        imagem.loading = "lazy";

        imagem.onerror = () => {
            areaImagem.remove();
        };

        areaImagem.appendChild(imagem);

        card.appendChild(areaImagem);

    }

    // INFORMAÇÕES

    const informacoes = document.createElement("div");

    informacoes.className = "ensino-card-content";

    // CATEGORIA

    const categoria = document.createElement("span");

    categoria.className = "ensino-card-category";

    categoria.textContent = conteudo.categoria || "ENSINO";

    // TÍTULO

    const titulo = document.createElement("h3");

    titulo.textContent = conteudo.titulo;

    informacoes.append(categoria, titulo);

    // DESCRIÇÃO

    if (conteudo.descricao) {

        const descricao = document.createElement("p");

        descricao.textContent = conteudo.descricao;

        informacoes.appendChild(descricao);

    }

    // DOCUMENTO

    const arquivoUrl = validarUrl(conteudo.arquivo_url);

    if (arquivoUrl) {

        const link = document.createElement("a");

        link.className = "ensino-card-link";

        link.href = arquivoUrl;

        link.target = "_blank";

        link.rel = "noopener noreferrer";

        link.textContent = "Acessar material ↗";

        informacoes.appendChild(link);

    }

    card.appendChild(informacoes);

    return card;

}


// ==========================================
// CARREGAR CONTEÚDOS DO SUPABASE
// ==========================================

async function carregarEnsino() {

    if (!lista) {

        console.error(
            "Elemento ensino-lista não encontrado no HTML."
        );

        return;

    }

    lista.replaceChildren(
        criarEstado("Carregando conteúdos...")
    );

    try {

        const { data, error } = await supabase

            .from("ensino")

            .select(`
                id,
                titulo,
                descricao,
                categoria,
                imagem_url,
                arquivo_url,
                created_at
            `)

            .eq("status", "publicado")

            .order("created_at", {
                ascending: false
            });

        if (error) throw error;

        lista.replaceChildren();

        // VERIFICAR SE EXISTEM CONTEÚDOS

        if (!data || data.length === 0) {

            lista.appendChild(
                criarEstado(
                    "Ainda não existem conteúdos publicados nesta área."
                )
            );

            return;

        }

        // EXIBIR CONTEÚDOS

        data.forEach(conteudo => {

            lista.appendChild(
                criarCartao(conteudo)
            );

        });

        console.log(
            `${data.length} conteúdo(s) carregado(s) do Supabase.`
        );

    } catch (error) {

        console.error(
            "Erro ao carregar conteúdos de Ensino:",
            error
        );

        lista.replaceChildren(
            criarEstado(
                "Não foi possível carregar os conteúdos. Tente novamente mais tarde.",
                "erro"
            )
        );

    }

}


// ==========================================
// INICIALIZAÇÃO
// ==========================================

carregarEnsino();

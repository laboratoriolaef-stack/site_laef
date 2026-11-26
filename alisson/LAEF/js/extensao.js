
import { supabase } from "../adm/js/config.js";

// ==========================================
// LAEF — EXTENSÃO PÚBLICA
// Integração com Supabase
// ==========================================

const lista = document.getElementById("extensao-lista");

// ==========================================
// CRIAR MENSAGEM DE ESTADO
// ==========================================

function criarEstado(mensagem, classe = "extension-state") {

    const elemento = document.createElement("div");

    elemento.className = classe;
    elemento.textContent = mensagem;

    return elemento;
}

// ==========================================
// CRIAR CARTÃO DA AÇÃO
// ==========================================

function criarCartao(acao) {

    const card = document.createElement("article");

    card.className = "extension-project-card";

    // Imagem
    if (acao.imagem_url) {

        const areaImagem = document.createElement("div");

        areaImagem.className = "extension-project-image";

        const imagem = document.createElement("img");

        imagem.src = acao.imagem_url;
        imagem.alt = `Imagem de ${acao.titulo}`;
        imagem.loading = "lazy";

        imagem.onerror = () => {
            areaImagem.remove();
        };

        areaImagem.appendChild(imagem);

        card.appendChild(areaImagem);
    }

    // Conteúdo
    const conteudo = document.createElement("div");

    conteudo.className = "extension-project-content";

    // Identificação
    const identificacao = document.createElement("span");

    identificacao.className = "extension-project-label";
    identificacao.textContent = "LAEF · EXTENSÃO";

    // Título
    const titulo = document.createElement("h3");

    titulo.textContent = acao.titulo;

    // Resumo
    conteudo.append(identificacao, titulo);

    if (acao.resumo) {

        const resumo = document.createElement("p");

        resumo.className = "extension-project-summary";
        resumo.textContent = acao.resumo;

        conteudo.appendChild(resumo);
    }

    // Descrição
    if (acao.descricao) {

        const descricao = document.createElement("p");

        descricao.className = "extension-project-description";
        descricao.textContent = acao.descricao;

        conteudo.appendChild(descricao);
    }

    // Responsável
    if (acao.responsavel) {

        const responsavel = document.createElement("p");

        responsavel.className = "extension-project-responsible";
        responsavel.textContent = `Responsável: ${acao.responsavel}`;

        conteudo.appendChild(responsavel);
    }

    // Arquivo de apoio
    if (acao.arquivo_url) {

        const link = document.createElement("a");

        link.className = "extension-project-link";

        link.href = acao.arquivo_url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";

        link.textContent = "Acessar material de apoio ↗";

        conteudo.appendChild(link);
    }

    card.appendChild(conteudo);

    return card;
}

// ==========================================
// CARREGAR AÇÕES DO SUPABASE
// ==========================================

async function carregarExtensao() {

    if (!lista) return;

    lista.replaceChildren(
        criarEstado("Carregando ações de extensão...")
    );

    try {

        const { data, error } = await supabase
            .from("extensao")
            .select(`
                id,
                titulo,
                resumo,
                descricao,
                responsavel,
                imagem_url,
                arquivo_url,
                created_at
            `)
            .eq("status", "publicado")
            .order("created_at", { ascending: false });

        if (error) throw error;

        lista.replaceChildren();

        if (!data || data.length === 0) {

            lista.appendChild(
                criarEstado(
                    "Ainda não existem ações de extensão publicadas."
                )
            );

            return;
        }

        data.forEach(acao => {

            lista.appendChild(
                criarCartao(acao)
            );

        });

        console.log(
            `${data.length} ação(ões) de extensão carregada(s).`
        );

    } catch (error) {

        console.error("Erro ao carregar extensão:", error);

        lista.replaceChildren(
            criarEstado(
                "Não foi possível carregar as ações de extensão. Tente novamente mais tarde.",
                "extension-state extension-error"
            )
        );

    }
}

// ==========================================
// INICIALIZAÇÃO
// ==========================================

carregarExtensao();


import { supabase } from "../adm/js/config.js";

// ==========================================
// LAEF — PESQUISA PÚBLICA
// Integração com Supabase
// ==========================================

const lista = document.getElementById("pesquisa-lista");


// ==========================================
// OBTER URL DO ARQUIVO
// ==========================================

function obterUrlPublica(url) {

    if (!url) return null;

    // Se já for uma URL completa, utilizar diretamente.
    if (
        url.startsWith("https://") ||
        url.startsWith("http://")
    ) {
        return url;
    }

    // Se for apenas um caminho, consultar o Storage.
    const { data } = supabase.storage
        .from("pesquisa")
        .getPublicUrl(url.replace(/^pesquisa\//, ""));

    return data.publicUrl;
}


// ==========================================
// CRIAR MENSAGEM DE ESTADO
// ==========================================

function criarEstado(texto, classe = "") {

    const elemento = document.createElement("div");

    elemento.className = `pesquisa-estado ${classe}`.trim();

    elemento.textContent = texto;

    return elemento;

}


// ==========================================
// CRIAR CARTÃO DO PROJETO
// ==========================================

function criarCartao(projeto) {

    const card = document.createElement("article");

    card.className = "pesquisa-card";


    // IMAGEM

    if (projeto.imagem_url) {

        const areaImagem = document.createElement("div");

        areaImagem.className = "pesquisa-card-image";

        const imagem = document.createElement("img");

        imagem.src = obterUrlPublica(projeto.imagem_url);

        imagem.alt = `Imagem do projeto ${projeto.titulo}`;

        imagem.loading = "lazy";

        imagem.onerror = () => {
            areaImagem.remove();
        };

        areaImagem.appendChild(imagem);

        card.appendChild(areaImagem);

    }


    // CONTEÚDO

    const informacoes = document.createElement("div");

    informacoes.className = "pesquisa-card-content";


    // ÁREA DE PESQUISA

    if (projeto.area) {

        const area = document.createElement("span");

        area.className = "pesquisa-card-area";

        area.textContent = projeto.area;

        informacoes.appendChild(area);

    }


    // TÍTULO

    const titulo = document.createElement("h3");

    titulo.textContent = projeto.titulo;

    informacoes.appendChild(titulo);


    // RESUMO

    if (projeto.resumo) {

        const resumo = document.createElement("p");

        resumo.textContent = projeto.resumo;

        informacoes.appendChild(resumo);

    }


    // RESPONSÁVEL

    if (projeto.responsavel) {

        const responsavel = document.createElement("div");

        responsavel.className = "pesquisa-card-responsavel";

        const identificacao = document.createElement("strong");

        identificacao.textContent = "Responsável: ";

        responsavel.append(
            identificacao,
            document.createTextNode(projeto.responsavel)
        );

        informacoes.appendChild(responsavel);

    }


    // DESCRIÇÃO COMPLETA

    if (projeto.descricao) {

        const descricao = document.createElement("details");

        descricao.className = "pesquisa-card-description";

        const resumoDescricao = document.createElement("summary");

        resumoDescricao.textContent = "Conheça o projeto";

        const textoDescricao = document.createElement("p");

        textoDescricao.textContent = projeto.descricao;

        descricao.append(
            resumoDescricao,
            textoDescricao
        );

        informacoes.appendChild(descricao);

    }


    // ARQUIVO COMPLEMENTAR

    if (projeto.arquivo_url) {

        const link = document.createElement("a");

        link.className = "pesquisa-card-link";

        link.href = obterUrlPublica(projeto.arquivo_url);

        link.target = "_blank";

        link.rel = "noopener noreferrer";

        link.textContent = "Acessar material ↗";

        informacoes.appendChild(link);

    }


    card.appendChild(informacoes);

    return card;

}


// ==========================================
// CARREGAR PROJETOS
// ==========================================

async function carregarPesquisa() {

    if (!lista) {

        console.error(
            "Elemento pesquisa-lista não encontrado no HTML."
        );

        return;

    }

    lista.replaceChildren(
        criarEstado("Carregando projetos de pesquisa...")
    );

    try {

        const { data, error } = await supabase
            .from("pesquisa")
            .select(`
                id,
                titulo,
                resumo,
                descricao,
                responsavel,
                area,
                imagem_url,
                arquivo_url,
                created_at
            `)
            .eq("status", "publicado")
            .order("created_at", {
                ascending: false
            });

        if (error) throw error;


        // LIMPAR CARREGAMENTO

        lista.replaceChildren();


        // NENHUM PROJETO PUBLICADO

        if (!data || data.length === 0) {

            lista.appendChild(
                criarEstado(
                    "Ainda não existem projetos de pesquisa publicados."
                )
            );

            return;

        }


        // EXIBIR PROJETOS

        data.forEach(projeto => {

            lista.appendChild(
                criarCartao(projeto)
            );

        });


        console.log(
            `${data.length} projeto(s) de pesquisa carregado(s) do Supabase.`
        );

    } catch (error) {

        console.error(
            "Erro ao carregar projetos de pesquisa:",
            error
        );

        lista.replaceChildren(
            criarEstado(
                "Não foi possível carregar os projetos de pesquisa. Tente novamente mais tarde.",
                "erro"
            )
        );

    }

}


// ==========================================
// INICIALIZAÇÃO
// ==========================================

carregarPesquisa();

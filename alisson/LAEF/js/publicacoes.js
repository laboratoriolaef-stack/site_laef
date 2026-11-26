
import { supabase } from "../adm/js/config.js";

// ==========================================
// LAEF — PUBLICAÇÕES PÚBLICAS
// Integração com Supabase
// ==========================================

const lista = document.getElementById("publication-list");
const contador = document.getElementById("publication-count");

const campoBusca = document.getElementById("publication-search");
const filtroAno = document.getElementById("publication-year");

const botoesCategoria = document.querySelectorAll(
    ".filter-button"
);

let publicacoes = [];
let categoriaAtual = "todos";


// ==========================================
// ELEMENTOS HTML
// ==========================================

function criarElemento(tag, classe, texto) {
    const elemento = document.createElement(tag);

    if (classe) elemento.className = classe;
    if (texto !== undefined) elemento.textContent = texto;

    return elemento;
}


// ==========================================
// LINKS DA PUBLICAÇÃO
// ==========================================

function criarLink(texto, url, classe = "") {
    if (!url) return null;

    const link = document.createElement("a");

    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.className = classe;
    link.textContent = texto;

    return link;
}


// ==========================================
// CARTÃO DA PUBLICAÇÃO
// ==========================================

function criarCartao(publicacao) {

    const card = criarElemento(
        "article",
        "publication-card"
    );

    const conteudo = criarElemento(
        "div",
        "publication-card-content"
    );

    // Categoria e ano
    const metadados = criarElemento(
        "div",
        "publication-meta"
    );

    metadados.appendChild(
        criarElemento(
            "span",
            "publication-category",
            publicacao.categoria
        )
    );

    if (publicacao.ano) {
        metadados.appendChild(
            criarElemento(
                "span",
                "publication-year",
                String(publicacao.ano)
            )
        );
    }

    // Título
    const titulo = criarElemento(
        "h3",
        "publication-title",
        publicacao.titulo
    );

    // Autores
    const autores = criarElemento(
        "p",
        "publication-authors",
        publicacao.autores || "Autores não informados"
    );

    // Resumo
    conteudo.append(
        metadados,
        titulo,
        autores
    );

    if (publicacao.resumo) {
        conteudo.appendChild(
            criarElemento(
                "p",
                "publication-summary",
                publicacao.resumo
            )
        );
    }

    // Palavras-chave
    if (publicacao.palavras_chave) {
        conteudo.appendChild(
            criarElemento(
                "p",
                "publication-keywords",
                "Palavras-chave: " + publicacao.palavras_chave
            )
        );
    }

    // Links
    const links = criarElemento(
        "div",
        "publication-links"
    );

    const pdf = criarLink(
        "Visualizar PDF ↗",
        publicacao.arquivo_url,
        "publication-link"
    );

    const externo = criarLink(
        "Acessar publicação ↗",
        publicacao.link_externo,
        "publication-link"
    );

    const doiUrl = publicacao.doi
        ? (
            /^https?:\/\//i.test(publicacao.doi)
                ? publicacao.doi
                : "https://doi.org/" + publicacao.doi.replace(
                    /^https?:\/\/doi\.org\//i,
                    ""
                )
        )
        : null;

    const doi = criarLink(
        "DOI ↗",
        doiUrl,
        "publication-link"
    );

    [pdf, externo, doi].forEach(link => {
        if (link) links.appendChild(link);
    });

    if (links.children.length > 0) {
        conteudo.appendChild(links);
    }

    card.appendChild(conteudo);

    return card;
}


// ==========================================
// ESTADO DA LISTAGEM
// ==========================================

function mostrarMensagem(titulo, mensagem, classe = "") {

    lista.replaceChildren();

    const estado = criarElemento(
        "div",
        "publication-empty " + classe
    );

    estado.appendChild(
        criarElemento("span", "", "∅")
    );

    estado.appendChild(
        criarElemento("h3", "", titulo)
    );

    estado.appendChild(
        criarElemento("p", "", mensagem)
    );

    lista.appendChild(estado);
}


// ==========================================
// ATUALIZAR ANOS DISPONÍVEIS
// ==========================================

function atualizarAnos() {

    const anos = [
        ...new Set(
            publicacoes
                .map(item => item.ano)
                .filter(Boolean)
        )
    ].sort((a, b) => b - a);

    filtroAno.replaceChildren(
        new Option("Todos os anos", "")
    );

    anos.forEach(ano => {
        filtroAno.appendChild(
            new Option(String(ano), String(ano))
        );
    });
}


// ==========================================
// FILTRAR PUBLICAÇÕES
// ==========================================

function filtrarPublicacoes() {

    const busca = campoBusca.value
        .trim()
        .toLowerCase();

    const ano = filtroAno.value;

    const resultado = publicacoes.filter(item => {

        const correspondeBusca = [
            item.titulo,
            item.autores,
            item.palavras_chave,
            item.resumo
        ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(busca);

        const correspondeCategoria =
            categoriaAtual === "todos" ||
            item.categoria === categoriaAtual;

        const correspondeAno =
            !ano || String(item.ano) === ano;

        return (
            correspondeBusca &&
            correspondeCategoria &&
            correspondeAno
        );
    });

    renderizarPublicacoes(resultado);
}


// ==========================================
// RENDERIZAR PUBLICAÇÕES
// ==========================================

function renderizarPublicacoes(resultado) {

    lista.replaceChildren();

    if (resultado.length === 0) {

        mostrarMensagem(
            "Nenhuma publicação encontrada",
            "Tente alterar os filtros ou os termos da pesquisa."
        );

        contador.textContent = "Nenhuma publicação encontrada.";

        return;
    }

    resultado.forEach(publicacao => {
        lista.appendChild(
            criarCartao(publicacao)
        );
    });

    contador.textContent =
        resultado.length +
        (resultado.length === 1
            ? " publicação encontrada."
            : " publicações encontradas.");
}


// ==========================================
// EVENTOS DOS FILTROS
// ==========================================

campoBusca.addEventListener(
    "input",
    filtrarPublicacoes
);

filtroAno.addEventListener(
    "change",
    filtrarPublicacoes
);

botoesCategoria.forEach(botao => {

    botao.addEventListener("click", () => {

        botoesCategoria.forEach(item => {
            item.classList.remove("active");
        });

        botao.classList.add("active");

        categoriaAtual = botao.dataset.filter;

        filtrarPublicacoes();
    });

});


// ==========================================
// BUSCAR NO SUPABASE
// ==========================================

async function carregarPublicacoes() {

    mostrarMensagem(
        "Carregando publicações...",
        "Buscando produções acadêmicas do LAEF."
    );

    try {

        const { data, error } = await supabase
            .from("publicacoes")
            .select(`
                id,
                titulo,
                autores,
                categoria,
                ano,
                resumo,
                palavras_chave,
                doi,
                arquivo_url,
                link_externo
            `)
            .eq("status", "publicado")
            .order("ano", {
                ascending: false,
                nullsFirst: false
            })
            .order("titulo", {
                ascending: true
            });

        if (error) throw error;

        publicacoes = data || [];

        atualizarAnos();

        filtrarPublicacoes();

        console.log(
            `${publicacoes.length} publicação(ões) carregada(s).`
        );

    } catch (error) {

        console.error(
            "Erro ao carregar publicações:",
            error
        );

        mostrarMensagem(
            "Não foi possível carregar o acervo",
            "Ocorreu um erro ao consultar as publicações. Tente novamente mais tarde.",
            "publication-error"
        );

        contador.textContent =
            "Erro ao carregar publicações.";

    }
}


// ==========================================
// INICIALIZAÇÃO
// ==========================================

carregarPublicacoes();

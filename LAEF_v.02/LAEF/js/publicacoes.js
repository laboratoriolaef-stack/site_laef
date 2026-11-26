import { supabase } from "../adm/js/config.js";

import {
    obterCaminhoStorage,
    obterUrlAssinada
} from "./storage.js";

// ==========================================
// LAEF — PUBLICAÇÕES PÚBLICAS
// Integração com Supabase
// ==========================================

const BUCKET = "publicacoes";

const lista = document.getElementById("publication-list");

const contador = document.getElementById("publication-count");

const campoBusca = document.getElementById("publication-search");

const filtroAno = document.getElementById("publication-year");

const botoesCategoria = document.querySelectorAll(".filter-button");

let publicacoes = [];

let categoriaAtual = "todos";

let carregandoPublicacoes = false;

let erroCarregamento = false;

// ==========================================
// NORMALIZAR TEXTO
// ==========================================

function normalizarTexto(texto) {

    return String(texto || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLocaleLowerCase("pt-BR")
        .trim();
}

// ==========================================
// CRIAR ELEMENTO HTML
// ==========================================

function criarElemento(tag, classe, texto) {

    const elemento = document.createElement(tag);

    if (classe) {

        elemento.className = classe;
    }

    if (texto !== undefined) {

        elemento.textContent = texto;
    }

    return elemento;
}

// ==========================================
// VALIDAR ENDEREÇOS EXTERNOS
// ==========================================

function validarUrl(valor) {

    if (!valor || typeof valor !== "string") {

        return null;
    }

    try {

        const endereco = new URL(valor.trim());

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
// NORMALIZAR DOI
// ==========================================

function obterUrlDOI(doi) {

    if (!doi) return null;

    let identificador = String(doi).trim();

    if (!identificador) return null;

    // Remover endereço DOI completo.

    identificador = identificador.replace(

        /^https?:\/\/(dx\.)?doi\.org\//i,

        ""
    );

    // Remover prefixo DOI, quando informado.

    identificador = identificador.replace(

        /^doi:\s*/i,

        ""
    );

    // Validar estrutura básica do identificador.

    if (!/^10\.\d{4,}\/\S+$/i.test(identificador)) {

        return null;
    }

    return validarUrl(

        "https://doi.org/" + identificador
    );
}

// ==========================================
// CRIAR LINK EXTERNO
// ==========================================

function criarLink(texto, url, classe = "") {

    const endereco = validarUrl(url);

    if (!endereco) return null;

    const link = document.createElement("a");

    link.href = endereco;

    link.target = "_blank";

    link.rel = "noopener noreferrer";

    link.className = classe;

    link.textContent = texto;

    return link;
}

// ==========================================
// CRIAR LINK ASSINADO DO PDF
// ==========================================

function criarLinkPDF(valor) {

    const caminho = obterCaminhoStorage(

        BUCKET,

        valor
    );

    if (!caminho) return null;

    const link = document.createElement("a");

    link.className = "publication-link";

    link.href = "#";

    link.textContent = "Visualizar PDF ↗";

    let carregando = false;

    link.addEventListener("click", async evento => {

        evento.preventDefault();

        if (carregando) return;

        carregando = true;

        link.setAttribute("aria-busy", "true");

        link.textContent = "Carregando PDF...";

        let janela = null;

        try {

            // Abrir uma janela antes da consulta
            // para reduzir o bloqueio de pop-ups.

            janela = window.open(

                "about:blank",

                "_blank"
            );

            if (janela) {

                janela.opener = null;
            }

            // Gerar uma URL temporária somente
            // quando o visitante solicitar o PDF.

            const url = await obterUrlAssinada(

                BUCKET,

                valor
            );

            if (!url) {

                throw new Error(

                    "Não foi possível acessar o PDF."
                );
            }

            if (janela && !janela.closed) {

                janela.location.replace(url);

            } else {

                window.location.assign(url);
            }

        } catch (error) {

            if (janela && !janela.closed) {

                janela.close();
            }

            console.error(

                "Erro ao acessar PDF da publicação:",

                error
            );

            alert(

                error.message ||

                "Não foi possível acessar o documento."
            );

        } finally {

            carregando = false;

            link.removeAttribute("aria-busy");

            link.textContent = "Visualizar PDF ↗";
        }

    });

    return link;
}

// ==========================================
// FORMATAR CATEGORIA
// ==========================================

function formatarCategoria(categoria) {

    const categorias = {

        artigo: "Artigo",

        evento: "Evento",

        tcc: "Trabalho acadêmico",

        livro: "Livro ou capítulo",

        outros: "Outros"

    };

    return Object.hasOwn(categorias, categoria)

        ? categorias[categoria]

        : categoria || "Publicação";
}

// ==========================================
// CRIAR CARTÃO DA PUBLICAÇÃO
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

    // ======================================
    // CATEGORIA E ANO
    // ======================================

    const metadados = criarElemento(

        "div",

        "publication-meta"
    );

    metadados.appendChild(

        criarElemento(

            "span",

            "publication-category",

            formatarCategoria(publicacao.categoria)
        )
    );

    if (
        publicacao.ano !== null &&
        publicacao.ano !== undefined
    ) {

        metadados.appendChild(

            criarElemento(

                "span",

                "publication-year",

                String(publicacao.ano)
            )
        );
    }

    // ======================================
    // TÍTULO
    // ======================================

    const titulo = criarElemento(

        "h3",

        "publication-title",

        publicacao.titulo
    );

    // ======================================
    // AUTORES
    // ======================================

    const autores = criarElemento(

        "p",

        "publication-authors",

        publicacao.autores ||

        "Autores não informados."
    );

    conteudo.append(

        metadados,

        titulo,

        autores
    );

    // ======================================
    // RESUMO
    // ======================================

    if (publicacao.resumo) {

        conteudo.appendChild(

            criarElemento(

                "p",

                "publication-summary",

                publicacao.resumo
            )
        );
    }

    // ======================================
    // PALAVRAS-CHAVE
    // ======================================

    if (publicacao.palavras_chave) {

        conteudo.appendChild(

            criarElemento(

                "p",

                "publication-keywords",

                "Palavras-chave: " +
                publicacao.palavras_chave
            )
        );
    }

    // ======================================
    // LINKS DA PUBLICAÇÃO
    // ======================================

    const links = criarElemento(

        "div",

        "publication-links"
    );

    // PDF armazenado no Supabase.

    const pdf = criarLinkPDF(

        publicacao.arquivo_url
    );

    // Endereço externo da publicação.

    const externo = criarLink(

        "Acessar publicação ↗",

        publicacao.link_externo,

        "publication-link"
    );

    // Identificador DOI.

    const doi = criarLink(

        "Consultar DOI ↗",

        obterUrlDOI(publicacao.doi),

        "publication-link"
    );

    [pdf, externo, doi].forEach(link => {

        if (link) {

            links.appendChild(link);
        }

    });

    if (links.children.length > 0) {

        conteudo.appendChild(links);
    }

    card.appendChild(conteudo);

    return card;
}

// ==========================================
// MENSAGENS DA LISTAGEM
// ==========================================

function mostrarMensagem(titulo, mensagem, classe = "") {

    if (!lista) return;

    lista.replaceChildren();

    const estado = criarElemento(

        "div",

        `publication-empty ${classe}`.trim()
    );

    estado.append(

        criarElemento("span", "", "∅"),

        criarElemento("h3", "", titulo),

        criarElemento("p", "", mensagem)
    );

    lista.appendChild(estado);
}

// ==========================================
// ATUALIZAR ANOS DISPONÍVEIS
// ==========================================

function atualizarAnos() {

    if (!filtroAno) return;

    const anos = [

        ...new Set(

            publicacoes

                .map(item => item.ano)

                .filter(ano => Number.isInteger(ano))
        )

    ].sort((a, b) => b - a);

    const anoSelecionado = filtroAno.value;

    filtroAno.replaceChildren(

        new Option("Todos os anos", "")
    );

    anos.forEach(ano => {

        filtroAno.appendChild(

            new Option(

                String(ano),

                String(ano)
            )
        );

    });

    if (
        anos.some(
            ano => String(ano) === anoSelecionado
        )
    ) {

        filtroAno.value = anoSelecionado;
    }
}

// ==========================================
// FILTRAR PUBLICAÇÕES
// ==========================================

function filtrarPublicacoes() {

    if (!lista || !contador) return;

    if (carregandoPublicacoes || erroCarregamento) {

        return;
    }

    const busca = normalizarTexto(

        campoBusca?.value
    );

    const ano = filtroAno?.value || "";

    const resultado = publicacoes.filter(item => {

        // ==================================
        // BUSCA TEXTUAL
        // ==================================

        const texto = normalizarTexto([

            item.titulo,

            item.autores,

            item.palavras_chave,

            item.resumo,

            item.categoria,

            formatarCategoria(item.categoria),

            item.ano,

            item.doi

        ].filter(Boolean).join(" "));

        const correspondeBusca =

            texto.includes(busca);

        // ==================================
        // FILTRO POR CATEGORIA
        // ==================================

        const correspondeCategoria =

            categoriaAtual === "todos" ||

            item.categoria === categoriaAtual;

        // ==================================
        // FILTRO POR ANO
        // ==================================

        const correspondeAno =

            !ano ||

            String(item.ano) === ano;

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

    if (!lista || !contador) return;

    lista.replaceChildren();

    // ======================================
    // ACERVO VAZIO OU SEM RESULTADOS
    // ======================================

    if (resultado.length === 0) {

        if (publicacoes.length === 0) {

            mostrarMensagem(

                "Acervo em organização",

                "Ainda não existem publicações disponíveis no acervo do LAEF."
            );

        } else {

            mostrarMensagem(

                "Nenhuma publicação encontrada",

                "Não encontramos resultados com os critérios utilizados. Experimente outros termos ou filtros."
            );
        }

        contador.textContent =

            "Nenhuma publicação encontrada.";

        return;
    }

    // ======================================
    // CRIAR CARTÕES
    // ======================================

    const fragmento =

        document.createDocumentFragment();

    resultado.forEach(publicacao => {

        fragmento.appendChild(

            criarCartao(publicacao)
        );

    });

    lista.appendChild(fragmento);

    // ======================================
    // CONTADOR
    // ======================================

    contador.textContent =

        resultado.length +

        (
            resultado.length === 1

                ? " publicação encontrada."

                : " publicações encontradas."
        );
}

// ==========================================
// EVENTOS DOS FILTROS
// ==========================================

campoBusca?.addEventListener(

    "input",

    filtrarPublicacoes
);

filtroAno?.addEventListener(

    "change",

    filtrarPublicacoes
);

// ==========================================
// FILTROS DE CATEGORIA
// ==========================================

const categoriasPermitidas = new Set([

    "todos",

    "artigo",

    "evento",

    "tcc",

    "livro",

    "outros"

]);

botoesCategoria.forEach(botao => {

    botao.addEventListener("click", () => {

        const categoria = botao.dataset.filter;

        if (!categoriasPermitidas.has(categoria)) {

            return;
        }

        botoesCategoria.forEach(item => {

            item.classList.remove("active");

            item.setAttribute(

                "aria-pressed",

                "false"
            );

        });

        botao.classList.add("active");

        botao.setAttribute(

            "aria-pressed",

            "true"
        );

        categoriaAtual = categoria;

        filtrarPublicacoes();

    });

});

// ==========================================
// BUSCAR PUBLICAÇÕES NO SUPABASE
// ==========================================

async function carregarPublicacoes() {

    if (!lista || !contador) {

        console.error(

            "Elementos da listagem de publicações não encontrados."
        );

        return;
    }

    // Impedir consultas simultâneas.

    if (carregandoPublicacoes) return;

    carregandoPublicacoes = true;

    erroCarregamento = false;

    // ======================================
    // ESTADO DE CARREGAMENTO
    // ======================================

    mostrarMensagem(

        "Carregando publicações...",

        "Buscando produções acadêmicas do LAEF."
    );

    contador.textContent =

        "Carregando acervo...";

    try {

        // ==================================
        // CONSULTAR SOMENTE PUBLICADOS
        // ==================================

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

        carregandoPublicacoes = false;

        filtrarPublicacoes();

        console.log(

            `${publicacoes.length} publicação(ões) carregada(s) do Supabase.`
        );

    } catch (error) {

        console.error(

            "Erro ao carregar publicações:",

            error
        );

        erroCarregamento = true;

        publicacoes = [];

        atualizarAnos();

        // ==================================
        // ESTADO DE ERRO
        // ==================================

        mostrarMensagem(

            "Não foi possível carregar o acervo",

            "Ocorreu um erro ao consultar as publicações. Verifique sua conexão e tente novamente.",

            "publication-error"
        );

        contador.textContent =

            "Erro ao carregar publicações.";

        // ==================================
        // BOTÃO PARA TENTAR NOVAMENTE
        // ==================================

        const botao = criarElemento(

            "button",

            "publication-retry",

            "Tentar novamente"
        );

        botao.type = "button";

        botao.addEventListener(

            "click",

            carregarPublicacoes
        );

        lista.appendChild(botao);

    } finally {

        carregandoPublicacoes = false;
    }
}

// ==========================================
// INICIALIZAÇÃO
// ==========================================

carregarPublicacoes();
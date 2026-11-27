import { supabase } from "../adm/js/config.js";

import {
    obterCaminhoStorage,
    obterUrlAssinada
} from "./storage.js";

// ==========================================
// LAEF — ENSINO PÚBLICO
// Integração com Supabase
// ==========================================

const BUCKET = "ensino";

const lista = document.getElementById("ensino-lista");
const busca = document.getElementById("ensino-busca");
const filtro = document.getElementById("ensino-categoria");
const contador = document.getElementById("ensino-contador");

let conteudos = [];

// ==========================================
// ESTADOS DA PÁGINA
// ==========================================

function criarEstado(texto, classe = "") {

    const elemento = document.createElement("div");

    elemento.className = `ensino-estado ${classe}`.trim();
    elemento.textContent = texto;

    return elemento;
}

// ==========================================
// CRIAR CARTÃO
// ==========================================

function criarCartao(conteudo) {

    const card = document.createElement("article");

    card.className = "ensino-card";

    // ======================================
    // IMAGEM
    // ======================================

    const caminhoImagem = obterCaminhoStorage(
        BUCKET,
        conteudo.imagem_url
    );

    if (caminhoImagem) {

        const areaImagem = document.createElement("div");

        areaImagem.className = "ensino-card-image";

        const imagem = document.createElement("img");

        imagem.alt = `Imagem de ${conteudo.titulo}`;

        imagem.onerror = () => areaImagem.remove();

        areaImagem.appendChild(imagem);

        card.appendChild(areaImagem);

        obterUrlAssinada(BUCKET, caminhoImagem)
            .then(url => {

                if (!url) {

                    areaImagem.remove();

                    return;
                }

                imagem.src = url;
            });
    }

    // ======================================
    // CONTEÚDO
    // ======================================

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

    // ======================================
    // DOCUMENTO
    // ======================================

    const caminhoArquivo = obterCaminhoStorage(
        BUCKET,
        conteudo.arquivo_url
    );

    if (caminhoArquivo) {

        const link = document.createElement("a");

        link.className = "ensino-card-link";

        link.href = "#";

        link.textContent = "Acessar material ↗";

        let carregando = false;

        link.addEventListener("click", async event => {

            event.preventDefault();

            if (carregando) return;

            carregando = true;

            link.textContent = "Carregando material...";

            link.setAttribute("aria-busy", "true");

            // Abrir imediatamente para evitar
            // bloqueadores de pop-ups.

            const janela = window.open(
                "about:blank",
                "_blank"
            );

            if (janela) {
                janela.opener = null;
            }

            try {

                const url = await obterUrlAssinada(
                    BUCKET,
                    caminhoArquivo
                );

                if (!url) {

                    throw new Error(
                        "Não foi possível acessar o material."
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

                console.error(error);

                alert(
                    "Material indisponível. Tente novamente mais tarde."
                );

            } finally {

                carregando = false;

                link.textContent = "Acessar material ↗";

                link.removeAttribute("aria-busy");
            }
        });

        informacoes.appendChild(link);
    }

    card.appendChild(informacoes);

    return card;
}

// ==========================================
// ATUALIZAR FILTROS
// ==========================================

function atualizarCategorias() {

    if (!filtro) return;

    const categoriaAtual = filtro.value;

    const categorias = [
        ...new Set(
            conteudos
                .map(item => item.categoria?.trim())
                .filter(Boolean)
        )
    ];

    filtro.replaceChildren();

    const todas = document.createElement("option");

    todas.value = "todos";

    todas.textContent = "Todas as categorias";

    filtro.appendChild(todas);

    categorias.sort((a, b) =>
        a.localeCompare(b, "pt-BR")
    );

    categorias.forEach(nome => {

        const opcao = document.createElement("option");

        opcao.value = nome;

        opcao.textContent = nome;

        filtro.appendChild(opcao);
    });

    filtro.value = categorias.includes(categoriaAtual)
        ? categoriaAtual
        : "todos";
}

// ==========================================
// NORMALIZAR TEXTO
// ==========================================

function normalizarTexto(valor) {

    return String(valor || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLocaleLowerCase("pt-BR")
        .trim();
}

// ==========================================
// FILTRAR CONTEÚDOS
// ==========================================

function filtrarConteudos() {

    const termo = normalizarTexto(busca?.value);

    const categoriaSelecionada = filtro?.value || "todos";

    const resultados = conteudos.filter(item => {

        const texto = normalizarTexto(
            [
                item.titulo,
                item.descricao,
                item.categoria
            ]
                .filter(Boolean)
                .join(" ")
        );

        const correspondeBusca = texto.includes(termo);

        const correspondeCategoria =
            categoriaSelecionada === "todos" ||
            item.categoria?.trim() === categoriaSelecionada;

        return correspondeBusca && correspondeCategoria;
    });

    renderizarConteudos(resultados);
}

// ==========================================
// EXIBIR CONTEÚDOS
// ==========================================

function renderizarConteudos(dados) {

    if (!lista) return;

    lista.replaceChildren();

    if (contador) {

        contador.textContent =
            `${dados.length} conteúdo(s) encontrado(s).`;
    }

    if (dados.length === 0) {

        lista.appendChild(
            criarEstado(
                conteudos.length === 0
                    ? "Ainda não existem conteúdos publicados nesta área."
                    : "Nenhum conteúdo corresponde à sua pesquisa."
            )
        );

        return;
    }

    const fragmento = document.createDocumentFragment();

    dados.forEach(conteudo => {

        fragmento.appendChild(
            criarCartao(conteudo)
        );
    });

    lista.appendChild(fragmento);
}

// ==========================================
// CARREGAR SUPABASE
// ==========================================

async function carregarEnsino() {

    if (!lista) {

        console.error(
            "Elemento ensino-lista não encontrado."
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

        conteudos = data || [];

        atualizarCategorias();

        filtrarConteudos();

        console.log(
            `${conteudos.length} conteúdo(s) carregado(s) do Supabase.`
        );

    } catch (error) {

        console.error(
            "Erro ao carregar Ensino:",
            error
        );

        lista.replaceChildren(
            criarEstado(
                "Não foi possível carregar os conteúdos. Tente novamente mais tarde.",
                "erro"
            )
        );

        if (contador) {

            contador.textContent =
                "Erro ao carregar conteúdos.";
        }
    }
}

// ==========================================
// EVENTOS
// ==========================================

busca?.addEventListener("input", filtrarConteudos);

filtro?.addEventListener("change", filtrarConteudos);

// ==========================================
// INICIALIZAÇÃO
// ==========================================

carregarEnsino();
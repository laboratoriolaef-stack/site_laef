import { supabase } from "../adm/js/config.js";

import {
    obterCaminhoStorage,
    obterUrlAssinada
} from "./storage.js";

// ==========================================
// LAEF — PESQUISA PÚBLICA
// Integração com Supabase
// ==========================================

const BUCKET = "pesquisa";

const lista = document.getElementById("pesquisa-lista");

let carregandoPesquisa = false;

// ==========================================
// CRIAR MENSAGEM DE ESTADO
// ==========================================

function criarEstado(texto, classe = "") {

    const elemento = document.createElement("div");

    elemento.className =
        `pesquisa-estado ${classe}`.trim();

    elemento.textContent = texto;

    return elemento;
}

// ==========================================
// CRIAR IMAGEM DO PROJETO
// ==========================================

function criarImagem(projeto) {

    const caminho = obterCaminhoStorage(
        BUCKET,
        projeto.imagem_url
    );

    if (!caminho) return null;

    const areaImagem = document.createElement("div");

    areaImagem.className = "pesquisa-card-image";

    const imagem = document.createElement("img");

    imagem.alt =
        `Imagem do projeto ${projeto.titulo}`;

    imagem.decoding = "async";

    // Ocultar a área enquanto a imagem carrega.

    areaImagem.hidden = true;

    imagem.onload = () => {

        areaImagem.hidden = false;
    };

    imagem.onerror = () => {

        areaImagem.remove();
    };

    areaImagem.appendChild(imagem);

    // ======================================
    // GERAR URL ASSINADA
    // ======================================

    obterUrlAssinada(BUCKET, caminho)

        .then(url => {

            if (!url) {

                areaImagem.remove();

                return;
            }

            imagem.src = url;

        })

        .catch(error => {

            console.error(
                "Erro ao carregar imagem do projeto:",
                error
            );

            areaImagem.remove();
        });

    return areaImagem;
}

// ==========================================
// CRIAR LINK DO ARQUIVO COMPLEMENTAR
// ==========================================

function criarLinkArquivo(valor) {

    const caminho = obterCaminhoStorage(
        BUCKET,
        valor
    );

    if (!caminho) return null;

    const link = document.createElement("a");

    link.className = "pesquisa-card-link";

    link.href = "#";

    link.textContent = "Acessar material ↗";

    let carregando = false;

    link.addEventListener("click", async evento => {

        evento.preventDefault();

        if (carregando) return;

        carregando = true;

        link.setAttribute("aria-busy", "true");

        link.textContent = "Carregando material...";

        let janela = null;

        try {

            // Abrir a janela antes da consulta
            // para reduzir o bloqueio de pop-ups.

            janela = window.open(
                "about:blank",
                "_blank"
            );

            if (janela) {

                janela.opener = null;
            }

            // Gerar uma nova URL assinada
            // somente quando o visitante clicar.

            const url = await obterUrlAssinada(
                BUCKET,
                caminho
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

            console.error(
                "Erro ao acessar material de pesquisa:",
                error
            );

            alert(

                error.message ||

                "Não foi possível acessar o arquivo."
            );

        } finally {

            carregando = false;

            link.removeAttribute("aria-busy");

            link.textContent = "Acessar material ↗";
        }

    });

    return link;
}

// ==========================================
// CRIAR CARTÃO DO PROJETO
// ==========================================

function criarCartao(projeto) {

    const card = document.createElement("article");

    card.className = "pesquisa-card";

    // ======================================
    // IMAGEM
    // ======================================

    const areaImagem = criarImagem(projeto);

    if (areaImagem) {

        card.appendChild(areaImagem);
    }

    // ======================================
    // CONTEÚDO
    // ======================================

    const informacoes = document.createElement("div");

    informacoes.className = "pesquisa-card-content";

    // ======================================
    // ÁREA DE PESQUISA
    // ======================================

    if (projeto.area) {

        const area = document.createElement("span");

        area.className = "pesquisa-card-area";

        area.textContent = projeto.area;

        informacoes.appendChild(area);
    }

    // ======================================
    // TÍTULO
    // ======================================

    const titulo = document.createElement("h3");

    titulo.textContent = projeto.titulo;

    informacoes.appendChild(titulo);

    // ======================================
    // RESUMO
    // ======================================

    if (projeto.resumo) {

        const resumo = document.createElement("p");

        resumo.textContent = projeto.resumo;

        informacoes.appendChild(resumo);
    }

    // ======================================
    // RESPONSÁVEL
    // ======================================

    if (projeto.responsavel) {

        const responsavel = document.createElement("div");

        responsavel.className =
            "pesquisa-card-responsavel";

        const identificacao =
            document.createElement("strong");

        identificacao.textContent = "Responsável: ";

        responsavel.append(

            identificacao,

            document.createTextNode(
                projeto.responsavel
            )
        );

        informacoes.appendChild(responsavel);
    }

    // ======================================
    // DESCRIÇÃO COMPLETA
    // ======================================

    if (projeto.descricao) {

        const descricao =
            document.createElement("details");

        descricao.className =
            "pesquisa-card-description";

        const resumoDescricao =
            document.createElement("summary");

        resumoDescricao.textContent =
            "Conheça o projeto";

        const textoDescricao =
            document.createElement("p");

        textoDescricao.textContent =
            projeto.descricao;

        descricao.append(

            resumoDescricao,

            textoDescricao
        );

        informacoes.appendChild(descricao);
    }

    // ======================================
    // ARQUIVO COMPLEMENTAR
    // ======================================

    const linkArquivo = criarLinkArquivo(
        projeto.arquivo_url
    );

    if (linkArquivo) {

        informacoes.appendChild(linkArquivo);
    }

    card.appendChild(informacoes);

    return card;
}

// ==========================================
// RENDERIZAR PROJETOS
// ==========================================

function renderizarPesquisa(dados) {

    if (!lista) return;

    lista.replaceChildren();

    const projetos = Array.isArray(dados)

        ? dados

        : [];

    // ======================================
    // NENHUM PROJETO PUBLICADO
    // ======================================

    if (projetos.length === 0) {

        lista.appendChild(

            criarEstado(

                "Ainda não existem projetos de pesquisa publicados."
            )
        );

        return;
    }

    // ======================================
    // CRIAR CARTÕES
    // ======================================

    const fragmento =
        document.createDocumentFragment();

    projetos.forEach(projeto => {

        fragmento.appendChild(
            criarCartao(projeto)
        );
    });

    lista.appendChild(fragmento);

    console.log(

        `${projetos.length} projeto(s) de pesquisa exibido(s).`
    );
}

// ==========================================
// CARREGAR PROJETOS DO SUPABASE
// ==========================================

async function carregarPesquisa() {

    if (!lista) {

        console.error(

            "Elemento pesquisa-lista não encontrado no HTML."
        );

        return;
    }

    // Impedir consultas simultâneas.

    if (carregandoPesquisa) return;

    carregandoPesquisa = true;

    // ======================================
    // ESTADO DE CARREGAMENTO
    // ======================================

    lista.replaceChildren(

        criarEstado(

            "Carregando projetos de pesquisa..."
        )
    );

    try {

        // Consultar exclusivamente
        // projetos publicados.

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

        // ==================================
        // EXIBIR PROJETOS
        // ==================================

        renderizarPesquisa(data || []);

        console.log(

            `${data?.length || 0} projeto(s) de pesquisa carregado(s) do Supabase.`
        );

    } catch (error) {

        console.error(

            "Erro ao carregar projetos de pesquisa:",

            error
        );

        // ==================================
        // ESTADO DE ERRO
        // ==================================

        const estado = criarEstado(

            "Não foi possível carregar os projetos de pesquisa. Verifique sua conexão e tente novamente.",

            "erro"
        );

        // ==================================
        // BOTÃO PARA TENTAR NOVAMENTE
        // ==================================

        const botao = document.createElement("button");

        botao.type = "button";

        botao.className = "pesquisa-card-link";

        botao.textContent = "Tentar novamente";

        botao.addEventListener(

            "click",

            carregarPesquisa
        );

        lista.replaceChildren(

            estado,

            botao
        );

    } finally {

        carregandoPesquisa = false;
    }
}

// ==========================================
// INICIALIZAÇÃO
// ==========================================

carregarPesquisa();
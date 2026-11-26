import { supabase } from "../adm/js/config.js";

import {
    obterCaminhoStorage,
    obterUrlAssinada
} from "./storage.js";

// ==========================================
// LAEF — EXTENSÃO PÚBLICA
// Integração com Supabase
// ==========================================

const BUCKET = "extensao";

const lista = document.getElementById("extensao-lista");

// ==========================================
// CRIAR ESTADO DA PÁGINA
// ==========================================

function criarEstado(titulo, mensagem, classe = "") {

    const elemento = document.createElement("div");

    elemento.className =
        `extension-state ${classe}`.trim();

    const cabecalho = document.createElement("h3");

    cabecalho.textContent = titulo;

    const descricao = document.createElement("p");

    descricao.textContent = mensagem;

    elemento.append(cabecalho, descricao);

    return elemento;
}

// ==========================================
// CRIAR IMAGEM DA AÇÃO
// ==========================================

function criarImagem(acao) {

    const caminho = obterCaminhoStorage(
        BUCKET,
        acao.imagem_url
    );

    if (!caminho) return null;

    const areaImagem = document.createElement("div");

    areaImagem.className = "extension-project-image";

    const imagem = document.createElement("img");

    imagem.alt = `Imagem de ${acao.titulo}`;

    imagem.decoding = "async";

    // Ocultar enquanto a imagem estiver carregando

    areaImagem.hidden = true;

    imagem.onload = () => {

        areaImagem.hidden = false;
    };

    imagem.onerror = () => {

        areaImagem.remove();
    };

    areaImagem.appendChild(imagem);

    // Gerar URL assinada temporária

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
                "Erro ao carregar imagem da extensão:",
                error
            );

            areaImagem.remove();
        });

    return areaImagem;
}

// ==========================================
// CRIAR LINK DO MATERIAL DE APOIO
// ==========================================

function criarLinkArquivo(valor) {

    const caminho = obterCaminhoStorage(
        BUCKET,
        valor
    );

    if (!caminho) return null;

    const link = document.createElement("a");

    link.className = "extension-project-link";

    link.href = "#";

    link.textContent = "Acessar material de apoio ↗";

    let carregando = false;

    link.addEventListener("click", async event => {

        event.preventDefault();

        if (carregando) return;

        carregando = true;

        link.setAttribute("aria-busy", "true");

        link.textContent = "Carregando material...";

        // Abrir a janela antes da operação assíncrona
        // para reduzir o bloqueio de pop-ups

        const janela = window.open(
            "about:blank",
            "_blank"
        );

        if (janela) {

            janela.opener = null;
        }

        try {

            // Gerar uma nova URL assinada
            // sempre que o visitante solicitar o arquivo

            const url = await obterUrlAssinada(
                BUCKET,
                caminho
            );

            if (!url) {

                throw new Error(
                    "Não foi possível acessar o material de apoio."
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
                "Erro ao acessar material de apoio:",
                error
            );

            alert(
                error.message ||
                "Não foi possível acessar o arquivo."
            );

        } finally {

            carregando = false;

            link.removeAttribute("aria-busy");

            link.textContent =
                "Acessar material de apoio ↗";
        }

    });

    return link;
}

// ==========================================
// CRIAR CARTÃO DA AÇÃO
// ==========================================

function criarCartao(acao) {

    const card = document.createElement("article");

    card.className = "extension-project-card";

    // ======================================
    // IMAGEM
    // ======================================

    const areaImagem = criarImagem(acao);

    if (areaImagem) {

        card.appendChild(areaImagem);
    }

    // ======================================
    // CONTEÚDO
    // ======================================

    const conteudo = document.createElement("div");

    conteudo.className = "extension-project-content";

    // ======================================
    // IDENTIFICAÇÃO
    // ======================================

    const identificacao = document.createElement("span");

    identificacao.className = "extension-project-label";

    identificacao.textContent = "LAEF · EXTENSÃO";

    // ======================================
    // TÍTULO
    // ======================================

    const titulo = document.createElement("h3");

    titulo.textContent = acao.titulo;

    conteudo.append(
        identificacao,
        titulo
    );

    // ======================================
    // RESUMO
    // ======================================

    if (acao.resumo) {

        const resumo = document.createElement("p");

        resumo.className = "extension-project-summary";

        resumo.textContent = acao.resumo;

        conteudo.appendChild(resumo);
    }

    // ======================================
    // DESCRIÇÃO
    // ======================================

    if (acao.descricao) {

        const descricao = document.createElement("p");

        descricao.className =
            "extension-project-description";

        descricao.textContent = acao.descricao;

        conteudo.appendChild(descricao);
    }

    // ======================================
    // RESPONSÁVEL
    // ======================================

    if (acao.responsavel) {

        const responsavel = document.createElement("p");

        responsavel.className =
            "extension-project-responsible";

        responsavel.textContent =
            `Responsável: ${acao.responsavel}`;

        conteudo.appendChild(responsavel);
    }

    // ======================================
    // ARQUIVO DE APOIO
    // ======================================

    const linkArquivo = criarLinkArquivo(
        acao.arquivo_url
    );

    if (linkArquivo) {

        conteudo.appendChild(linkArquivo);
    }

    card.appendChild(conteudo);

    return card;
}

// ==========================================
// EXIBIR AÇÕES
// ==========================================

function renderizarExtensao(dados) {

    if (!lista) return;

    lista.replaceChildren();

    const registros = Array.isArray(dados)
        ? dados
        : [];

    // ======================================
    // ESTADO VAZIO
    // ======================================

    if (registros.length === 0) {

        lista.appendChild(

            criarEstado(

                "Nenhuma ação publicada",

                "Ainda não existem ações de extensão disponíveis. Novas atividades serão apresentadas nesta página quando forem publicadas."
            )
        );

        return;
    }

    // ======================================
    // CRIAR CARTÕES
    // ======================================

    const fragmento =
        document.createDocumentFragment();

    registros.forEach(acao => {

        fragmento.appendChild(
            criarCartao(acao)
        );
    });

    lista.appendChild(fragmento);

    console.log(
        `${registros.length} ação(ões) de extensão exibida(s).`
    );
}

// ==========================================
// CARREGAR AÇÕES DO SUPABASE
// ==========================================

async function carregarExtensao() {

    if (!lista) {

        console.error(
            "Elemento extensao-lista não encontrado no HTML."
        );

        return;
    }

    // ======================================
    // ESTADO DE CARREGAMENTO
    // ======================================

    lista.replaceChildren(

        criarEstado(

            "Carregando ações de extensão",

            "Buscando as atividades publicadas pelo LAEF..."
        )
    );

    try {

        // Consultar exclusivamente
        // os registros publicados

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
            .order("created_at", {

                ascending: false

            });

        if (error) throw error;

        renderizarExtensao(data || []);

        console.log(
            `${data?.length || 0} registro(s) recebido(s) do Supabase.`
        );

    } catch (error) {

        console.error(

            "Erro ao carregar ações de extensão:",

            error
        );

        // ==================================
        // ESTADO DE ERRO
        // ==================================

        lista.replaceChildren(

            criarEstado(

                "Não foi possível carregar as ações",

                "Ocorreu um problema na consulta ao servidor. Verifique sua conexão e tente novamente.",

                "extension-error"
            )
        );

        // ==================================
        // BOTÃO PARA TENTAR NOVAMENTE
        // ==================================

        const botao = document.createElement("button");

        botao.type = "button";

        botao.className = "extension-retry";

        botao.textContent = "Tentar novamente";

        botao.addEventListener(
            "click",
            carregarExtensao
        );

        lista.appendChild(botao);
    }
}

// ==========================================
// INICIALIZAÇÃO
// ==========================================

carregarExtensao();
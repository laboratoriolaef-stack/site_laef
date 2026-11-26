import { supabase } from "../adm/js/config.js";

import {
    obterCaminhoStorage,
    obterUrlAssinada
} from "./storage.js";

// ==========================================
// LAEF — MATERIAIS E EXPERIMENTOS
// Integração pública com Supabase
// ==========================================

const BUCKET = "materiais";

const grade = document.getElementById("materials-grid");

const buscaMaterial = document.getElementById("material-search");

const filtrosMaterial = document.querySelectorAll(".material-filter");

const contadorMaterial = document.getElementById("materials-count");

let materiais = [];

let categoriaMaterial = "todos";

let carregandoMateriais = false;

let falhaCarregamento = false;

// ==========================================
// CATEGORIAS
// ==========================================

function formatarCategoria(categoria) {

    const categorias = {

        experimento: "Experimento",

        roteiro: "Roteiro",

        simulacao: "Simulação",

        didatico: "Material didático",

        computacional: "Computacional"

    };

    return Object.hasOwn(categorias, categoria)

        ? categorias[categoria]

        : categoria || "Material";
}

// ==========================================
// NORMALIZAR TEXTO PARA BUSCA
// ==========================================

function normalizarTexto(texto) {

    return String(texto || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLocaleLowerCase("pt-BR")
        .trim();
}

// ==========================================
// VALIDAR URL EXTERNA
// ==========================================

function validarUrl(valor) {

    if (!valor || typeof valor !== "string") {

        return null;
    }

    try {

        const url = new URL(valor.trim());

        if (
            url.protocol === "https:" ||
            url.protocol === "http:"
        ) {

            return url.href;
        }

        return null;

    } catch {

        return null;
    }
}

// ==========================================
// CRIAR MENSAGEM DE ESTADO
// ==========================================

function criarEstado(titulo, descricao, classe = "") {

    const elemento = document.createElement("div");

    elemento.className =
        `materials-empty ${classe}`.trim();

    const simbolo = document.createElement("span");

    simbolo.textContent = "∅";

    const cabecalho = document.createElement("h3");

    cabecalho.textContent = titulo;

    const texto = document.createElement("p");

    texto.textContent = descricao;

    elemento.append(

        simbolo,

        cabecalho,

        texto
    );

    return elemento;
}

// ==========================================
// ATUALIZAR CONTADOR
// ==========================================

function atualizarContador(texto) {

    if (contadorMaterial) {

        contadorMaterial.textContent = texto;
    }
}

// ==========================================
// CRIAR LINK EXTERNO
// ==========================================

function criarLinkExterno(valor, texto) {

    const endereco = validarUrl(valor);

    if (!endereco) return null;

    const link = document.createElement("a");

    link.className = "material-card-link";

    link.href = endereco;

    link.target = "_blank";

    link.rel = "noopener noreferrer";

    link.textContent = texto;

    return link;
}

// ==========================================
// CRIAR LINK DE ARQUIVO DO STORAGE
// ==========================================

function criarLinkArquivo(valor) {

    const caminho = obterCaminhoStorage(
        BUCKET,
        valor
    );

    if (!caminho) return null;

    const link = document.createElement("a");

    link.className = "material-card-link";

    link.href = "#";

    link.textContent = "Acessar arquivo ↗";

    let carregando = false;

    link.addEventListener("click", async event => {

        event.preventDefault();

        if (carregando) return;

        carregando = true;

        link.setAttribute("aria-busy", "true");

        link.textContent = "Carregando arquivo...";

        // Abrir a janela antes da operação assíncrona
        // para reduzir o bloqueio de pop-ups.

        const janela = window.open(
            "about:blank",
            "_blank"
        );

        if (janela) {

            janela.opener = null;
        }

        try {

            // Gerar uma nova URL assinada
            // sempre que o visitante solicitar o arquivo.

            const url = await obterUrlAssinada(
                BUCKET,
                caminho
            );

            if (!url) {

                throw new Error(
                    "Não foi possível acessar o arquivo."
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
                "Erro ao acessar material:",
                error
            );

            alert(

                error.message ||

                "Não foi possível acessar o material."
            );

        } finally {

            carregando = false;

            link.removeAttribute("aria-busy");

            link.textContent =
                "Acessar arquivo ↗";
        }

    });

    return link;
}

// ==========================================
// CRIAR SÍMBOLO DO MATERIAL
// ==========================================

function criarSimbolo(item) {

    const simbolo = document.createElement("span");

    simbolo.textContent =
        item.simbolo || "∑";

    return simbolo;
}

// ==========================================
// CRIAR IMAGEM DO MATERIAL
// ==========================================

function criarImagem(item) {

    const areaImagem = document.createElement("div");

    areaImagem.className = "material-card-image";

    // Exibir o símbolo enquanto a imagem carrega.

    areaImagem.appendChild(
        criarSimbolo(item)
    );

    const caminho = obterCaminhoStorage(
        BUCKET,
        item.imagem_url
    );

    if (!caminho) {

        return areaImagem;
    }

    obterUrlAssinada(BUCKET, caminho)

        .then(url => {

            if (!url || !areaImagem.isConnected) {

                return;
            }

            const imagem = document.createElement("img");

            imagem.alt =
                `Imagem de ${item.titulo}`;

            imagem.decoding = "async";

            imagem.onload = () => {

                if (!areaImagem.isConnected) return;

                areaImagem.replaceChildren(imagem);
            };

            imagem.onerror = () => {

                areaImagem.replaceChildren(
                    criarSimbolo(item)
                );
            };

            imagem.src = url;

        })

        .catch(error => {

            console.error(
                "Erro ao carregar imagem do material:",
                error
            );
        });

    return areaImagem;
}

// ==========================================
// CRIAR CARTÃO DO MATERIAL
// ==========================================

function criarCartao(item) {

    const cartao = document.createElement("article");

    cartao.className = "material-card";

    // ======================================
    // IMAGEM
    // ======================================

    const areaImagem = criarImagem(item);

    // ======================================
    // INFORMAÇÕES
    // ======================================

    const informacoes = document.createElement("div");

    informacoes.className = "material-card-info";

    // ======================================
    // CATEGORIA
    // ======================================

    const tipo = document.createElement("span");

    tipo.className = "material-card-type";

    tipo.textContent =
        formatarCategoria(item.categoria);

    // ======================================
    // TÍTULO
    // ======================================

    const titulo = document.createElement("h3");

    titulo.textContent = item.titulo;

    // ======================================
    // DESCRIÇÃO
    // ======================================

    const descricao = document.createElement("p");

    descricao.textContent =

        item.descricao ||

        "Material disponibilizado pelo LAEF.";

    // ======================================
    // METADADOS
    // ======================================

    const meta = document.createElement("div");

    meta.className = "material-card-meta";

    const assunto = document.createElement("span");

    assunto.textContent =
        item.assunto || "Física";

    const formato = document.createElement("span");

    formato.textContent =
        item.formato || "Material digital";

    meta.append(

        assunto,

        formato
    );

    informacoes.append(

        tipo,

        titulo,

        descricao,

        meta
    );

    // ======================================
    // ARQUIVO DO STORAGE
    // ======================================

    const linkArquivo = criarLinkArquivo(
        item.arquivo_url
    );

    if (linkArquivo) {

        informacoes.appendChild(linkArquivo);
    }

    // ======================================
    // LINK EXTERNO
    // ======================================

    const linkExterno = criarLinkExterno(

        item.link_externo,

        "Acessar link externo ↗"
    );

    if (linkExterno) {

        informacoes.appendChild(linkExterno);
    }

    cartao.append(

        areaImagem,

        informacoes
    );

    return cartao;
}

// ==========================================
// RENDERIZAR MATERIAIS
// ==========================================

function renderizarMateriais(dados) {

    if (!grade) return;

    grade.replaceChildren();

    const registros = Array.isArray(dados)

        ? dados

        : [];

    // ======================================
    // ESTADO VAZIO
    // ======================================

    if (registros.length === 0) {

        if (materiais.length === 0) {

            grade.appendChild(

                criarEstado(

                    "Biblioteca em organização",

                    "Ainda não existem materiais publicados pelo LAEF."
                )
            );

        } else {

            grade.appendChild(

                criarEstado(

                    "Nenhum resultado encontrado",

                    "Não encontramos materiais com esses critérios. Experimente outras palavras ou selecione outra categoria."
                )
            );
        }

        atualizarContador(
            "Nenhum material encontrado."
        );

        return;
    }

    // ======================================
    // CRIAR CARTÕES
    // ======================================

    const fragmento =
        document.createDocumentFragment();

    registros.forEach(item => {

        fragmento.appendChild(
            criarCartao(item)
        );
    });

    grade.appendChild(fragmento);

    atualizarContador(

        `${registros.length} material(is) encontrado(s).`
    );
}

// ==========================================
// FILTRAR MATERIAIS
// ==========================================

function filtrarMateriais() {

    if (
        !grade ||
        carregandoMateriais ||
        falhaCarregamento
    ) return;

    const termo = normalizarTexto(
        buscaMaterial?.value
    );

    const resultado = materiais.filter(item => {

        const correspondeCategoria =

            categoriaMaterial === "todos" ||

            item.categoria === categoriaMaterial;

        const texto = normalizarTexto([

            item.titulo,

            item.descricao,

            item.assunto,

            item.formato,

            item.palavras_chave,

            item.categoria,

            formatarCategoria(item.categoria)

        ].filter(Boolean).join(" "));

        const correspondeBusca =
            texto.includes(termo);

        return (

            correspondeCategoria &&

            correspondeBusca
        );
    });

    renderizarMateriais(resultado);
}

// ==========================================
// EVENTOS DOS FILTROS
// ==========================================

filtrosMaterial.forEach(botao => {

    botao.addEventListener("click", () => {

        filtrosMaterial.forEach(item => {

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

        categoriaMaterial =
            botao.dataset.filter || "todos";

        filtrarMateriais();
    });
});

// ==========================================
// EVENTO DA BUSCA
// ==========================================

buscaMaterial?.addEventListener(

    "input",

    filtrarMateriais
);

// ==========================================
// CARREGAR MATERIAIS DO SUPABASE
// ==========================================

async function carregarMateriais() {

    if (!grade) {

        console.error(

            "Elemento materials-grid não encontrado no HTML."
        );

        return;
    }

    if (carregandoMateriais) return;

    carregandoMateriais = true;

    falhaCarregamento = false;

    // ======================================
    // ESTADO DE CARREGAMENTO
    // ======================================

    grade.replaceChildren(

        criarEstado(

            "Carregando materiais",

            "Buscando os recursos publicados pelo LAEF..."
        )
    );

    atualizarContador(
        "Carregando materiais..."
    );

    try {

        // Consultar exclusivamente
        // materiais publicados.

        const { data, error } = await supabase
            .from("materiais")
            .select(`
                id,
                titulo,
                categoria,
                descricao,
                assunto,
                formato,
                simbolo,
                imagem_url,
                arquivo_url,
                link_externo,
                palavras_chave,
                status,
                created_at
            `)
            .eq("status", "publicado")
            .order("created_at", {

                ascending: false

            });

        if (error) throw error;

        materiais = data || [];

        carregandoMateriais = false;

        filtrarMateriais();

        console.log(

            `${materiais.length} material(is) carregado(s) do Supabase.`
        );

    } catch (error) {

        falhaCarregamento = true;

        console.error(

            "Erro ao carregar materiais:",

            error
        );

        // ==================================
        // ESTADO DE ERRO
        // ==================================

        const estado = criarEstado(

            "Não foi possível carregar a biblioteca",

            "Ocorreu um erro ao consultar os materiais. Verifique sua conexão e tente novamente.",

            "erro"
        );

        // ==================================
        // BOTÃO PARA TENTAR NOVAMENTE
        // ==================================

        const botao = document.createElement("button");

        botao.type = "button";

        botao.className = "material-card-link";

        botao.textContent = "Tentar novamente";

        botao.addEventListener(

            "click",

            carregarMateriais
        );

        estado.appendChild(botao);

        grade.replaceChildren(estado);

        atualizarContador(

            "Erro ao carregar materiais."
        );

    } finally {

        carregandoMateriais = false;
    }
}

// ==========================================
// INICIALIZAÇÃO
// ==========================================

carregarMateriais();
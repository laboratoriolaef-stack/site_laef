
import { supabase } from "../adm/js/config.js";

// ==========================================
// LAEF — MATERIAIS E EXPERIMENTOS
// Integração pública com Supabase
// ==========================================

const grade = document.getElementById("materials-grid");
const buscaMaterial = document.getElementById("material-search");
const filtrosMaterial = document.querySelectorAll(".material-filter");
const contadorMaterial = document.getElementById("materials-count");

let materiais = [];
let categoriaMaterial = "todos";

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

    return categorias[categoria] || categoria || "Material";
}

// ==========================================
// OBTER URL PÚBLICA DO STORAGE
// ==========================================

function obterUrlPublica(url) {
    if (!url) return null;

    // URL completa
    if (
        url.startsWith("https://") ||
        url.startsWith("http://")
    ) {
        return url;
    }

    // Caminho armazenado no bucket
    const caminho = url.replace(/^materiais\//, "");

    const { data } = supabase.storage
        .from("materiais")
        .getPublicUrl(caminho);

    return data.publicUrl;
}

// ==========================================
// CRIAR MENSAGEM DE ESTADO
// ==========================================

function criarEstado(texto, classe = "") {
    const elemento = document.createElement("div");

    elemento.className = `materials-empty ${classe}`.trim();

    elemento.innerHTML = `
        <span>∅</span>
        <h3>Biblioteca em organização</h3>
    `;

    const descricao = document.createElement("p");
    descricao.textContent = texto;

    elemento.appendChild(descricao);

    return elemento;
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

    const areaImagem = document.createElement("div");

    areaImagem.className = "material-card-image";

    if (item.imagem_url) {
        const imagem = document.createElement("img");

        imagem.src = obterUrlPublica(item.imagem_url);
        imagem.alt = `Imagem de ${item.titulo}`;
        imagem.loading = "lazy";

        imagem.onerror = () => {
            areaImagem.replaceChildren();

            const simbolo = document.createElement("span");
            simbolo.textContent = item.simbolo || "∑";

            areaImagem.appendChild(simbolo);
        };

        areaImagem.appendChild(imagem);

    } else {
        const simbolo = document.createElement("span");

        simbolo.textContent = item.simbolo || "∑";

        areaImagem.appendChild(simbolo);
    }

    // ======================================
    // INFORMAÇÕES
    // ======================================

    const informacoes = document.createElement("div");

    informacoes.className = "material-card-info";

    // Categoria

    const tipo = document.createElement("span");

    tipo.className = "material-card-type";
    tipo.textContent = formatarCategoria(item.categoria);

    // Título

    const titulo = document.createElement("h3");

    titulo.textContent = item.titulo;

    // Descrição

    const descricao = document.createElement("p");

    descricao.textContent =
        item.descricao || "Material disponibilizado pelo LAEF.";

    // Metadados

    const meta = document.createElement("div");

    meta.className = "material-card-meta";

    const assunto = document.createElement("span");

    assunto.textContent = item.assunto || "Física";

    const formato = document.createElement("span");

    formato.textContent = item.formato || "Material digital";

    meta.append(assunto, formato);

    informacoes.append(
        tipo,
        titulo,
        descricao,
        meta
    );

    // ======================================
    // ACESSO AO MATERIAL
    // ======================================

    const urlArquivo = obterUrlPublica(item.arquivo_url);

    const urlExterna = item.link_externo;

    if (urlArquivo || urlExterna) {
        const link = document.createElement("a");

        link.className = "material-card-link";

        link.href = urlArquivo || urlExterna;

        link.target = "_blank";

        link.rel = "noopener noreferrer";

        link.textContent = "Acessar material ↗";

        informacoes.appendChild(link);
    }

    cartao.append(areaImagem, informacoes);

    return cartao;
}

// ==========================================
// RENDERIZAR MATERIAIS
// ==========================================

function renderizarMateriais(dados) {
    grade.replaceChildren();

    if (dados.length === 0) {
        grade.appendChild(
            criarEstado(
                "Nenhum material foi encontrado. Tente alterar os filtros ou volte em outro momento."
            )
        );

        contadorMaterial.textContent =
            "Nenhum material encontrado.";

        return;
    }

    dados.forEach(item => {
        grade.appendChild(criarCartao(item));
    });

    contadorMaterial.textContent =
        `${dados.length} material(is) encontrado(s).`;
}

// ==========================================
// FILTRAR MATERIAIS
// ==========================================

function filtrarMateriais() {
    const termo = buscaMaterial.value
        .toLowerCase()
        .trim();

    const resultado = materiais.filter(item => {

        const correspondeCategoria =
            categoriaMaterial === "todos" ||
            item.categoria === categoriaMaterial;

        const texto = [
            item.titulo,
            item.descricao,
            item.assunto,
            item.formato,
            item.palavras_chave,
            item.categoria
        ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

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
        });

        botao.classList.add("active");

        categoriaMaterial = botao.dataset.filter;

        filtrarMateriais();
    });

});

// ==========================================
// EVENTO DA BUSCA
// ==========================================

buscaMaterial.addEventListener(
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

    grade.replaceChildren(
        criarEstado("Carregando materiais do laboratório...")
    );

    try {

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

        if (error) {
            throw error;
        }

        materiais = data || [];

        // Exibir resultados

        filtrarMateriais();

        console.log(
            `${materiais.length} material(is) carregado(s) do Supabase.`
        );

    } catch (error) {

        console.error(
            "Erro ao carregar materiais:",
            error
        );

        grade.replaceChildren(
            criarEstado(
                "Não foi possível carregar os materiais. Tente novamente mais tarde.",
                "erro"
            )
        );

        contadorMaterial.textContent =
            "Erro ao carregar materiais.";
    }
}

// ==========================================
// INICIALIZAÇÃO
// ==========================================

carregarMateriais();

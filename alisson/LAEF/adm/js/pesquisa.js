import { supabase } from "./config.js";

// ==========================================
// LAEF — GERENCIAMENTO DE PESQUISA
// ==========================================

const BUCKET = "pesquisa";

const form = document.getElementById("pesquisa-form");
const lista = document.getElementById("pesquisa-list");
const mensagem = document.getElementById("form-message");
const botaoSalvar = document.getElementById("save-pesquisa");

let pesquisas = [];
let autorizado = false;
let imagemTemporaria = null;

const campos = {
    id: document.getElementById("pesquisa-id"),
    titulo: document.getElementById("titulo"),
    resumo: document.getElementById("resumo"),
    descricao: document.getElementById("descricao"),
    responsavel: document.getElementById("responsavel"),
    area: document.getElementById("area"),
    imagem: document.getElementById("imagem"),
    arquivo: document.getElementById("arquivo"),
    status: document.getElementById("status"),
    removerImagem: document.getElementById("remover-imagem"),
    removerArquivo: document.getElementById("remover-arquivo")
};

// ==========================================
// AUTENTICAÇÃO
// ==========================================

async function verificarAdministrador() {

    const {
        data: { session },
        error: sessionError
    } = await supabase.auth.getSession();

    if (sessionError || !session) {
        window.location.replace("login.html");
        return false;
    }

    const { data: perfil, error } = await supabase
        .from("perfis")
        .select("nome, ativo, cargo")
        .eq("id", session.user.id)
        .maybeSingle();

    if (
        error ||
        !perfil ||
        !perfil.ativo ||
        perfil.cargo !== "Administrador"
    ) {
        await supabase.auth.signOut();
        window.location.replace("login.html");
        return false;
    }

    const nome = (perfil.nome || "Administrador").trim();

    document.getElementById("admin-name").textContent = nome;

    document.getElementById("admin-initial").textContent =
        nome.charAt(0).toUpperCase();

    autorizado = true;

    return true;
}

// ==========================================
// MENSAGENS
// ==========================================

function mostrarMensagem(texto, tipo = "") {

    mensagem.textContent = texto;
    mensagem.className = "form-message";

    if (tipo) {
        mensagem.classList.add(tipo);
    }
}

// ==========================================
// CAMINHOS DOS ARQUIVOS
// ==========================================

function obterCaminho(url) {

    if (!url) return null;

    const marcador =
        `/storage/v1/object/public/${BUCKET}/`;

    if (!url.includes(marcador)) return null;

    try {

        return decodeURIComponent(
            url.split(marcador)[1].split("?")[0]
        );

    } catch {
        return null;
    }
}

// ==========================================
// URL PÚBLICA
// ==========================================

function obterUrlPublica(caminho) {

    const { data } = supabase.storage
        .from(BUCKET)
        .getPublicUrl(caminho);

    return data.publicUrl;
}

// ==========================================
// VALIDAR IMAGEM
// ==========================================

function validarImagem(arquivo) {

    const permitidos = [
        "image/jpeg",
        "image/png",
        "image/webp"
    ];

    if (!permitidos.includes(arquivo.type)) {
        throw new Error("Formato de imagem não permitido.");
    }

    if (arquivo.size > 5 * 1024 * 1024) {
        throw new Error("A imagem deve ter no máximo 5 MB.");
    }
}

// ==========================================
// VALIDAR DOCUMENTO
// ==========================================

function validarArquivo(arquivo) {

    const extensoes = [
        "pdf", "doc", "docx",
        "ppt", "pptx", "odt", "odp"
    ];

    const extensao = arquivo.name
        .split(".")
        .pop()
        .toLowerCase();

    if (!extensoes.includes(extensao)) {
        throw new Error("Formato de documento não permitido.");
    }

    if (arquivo.size > 20 * 1024 * 1024) {
        throw new Error("O documento deve ter no máximo 20 MB.");
    }
}

// ==========================================
// ENVIAR ARQUIVO
// ==========================================

async function enviarArquivo(arquivo, tipo) {

    const extensao = arquivo.name
        .split(".")
        .pop()
        .toLowerCase();

    const nome = `${crypto.randomUUID()}.${extensao}`;

    const caminho = `${tipo}/${nome}`;

    const { error } = await supabase.storage
        .from(BUCKET)
        .upload(caminho, arquivo, {
            cacheControl: "3600",
            upsert: false,
            contentType: arquivo.type
        });

    if (error) throw error;

    return obterUrlPublica(caminho);
}

// ==========================================
// EXCLUIR ARQUIVO
// ==========================================

async function excluirArquivo(url) {

    const caminho = obterCaminho(url);

    if (!caminho) return;

    const { error } = await supabase.storage
        .from(BUCKET)
        .remove([caminho]);

    if (error) {
        console.error(
            "Erro ao excluir arquivo do Storage:",
            error
        );
    }
}

// ==========================================
// PRÉ-VISUALIZAÇÃO DA IMAGEM
// ==========================================

campos.imagem.addEventListener("change", () => {

    const arquivo = campos.imagem.files[0];

    if (!arquivo) return;

    try {

        validarImagem(arquivo);

        if (imagemTemporaria) {
            URL.revokeObjectURL(imagemTemporaria);
        }

        imagemTemporaria = URL.createObjectURL(arquivo);

        const preview =
            document.getElementById("imagem-preview");

        const area =
            document.getElementById("imagem-preview-area");

        preview.src = imagemTemporaria;
        preview.hidden = false;

        area.querySelector("span").hidden = true;

        campos.removerImagem.checked = false;

        mostrarMensagem("");

    } catch (error) {

        campos.imagem.value = "";

        mostrarMensagem(error.message, "error");
    }
});

// ==========================================
// EXIBIR ARQUIVO ATUAL
// ==========================================

function mostrarArquivoAtual(url) {

    const area = document.getElementById("arquivo-atual");

    area.replaceChildren();

    if (!url) {

        area.textContent = "Nenhum arquivo cadastrado.";

        return;
    }

    const link = document.createElement("a");

    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";

    link.textContent = "Visualizar arquivo atual ↗";

    area.appendChild(link);
}

// ==========================================
// INDICADORES
// ==========================================

function atualizarIndicadores() {

    const publicados = pesquisas.filter(
        item => item.status === "publicado"
    ).length;

    document.getElementById("total-pesquisa").textContent =
        pesquisas.length;

    document.getElementById("total-publicados").textContent =
        publicados;

    document.getElementById("total-rascunhos").textContent =
        pesquisas.length - publicados;
}

// ==========================================
// CARREGAR PESQUISAS
// ==========================================

async function carregarPesquisas() {

    document.getElementById("list-status").textContent =
        "Carregando pesquisas...";

    const { data, error } = await supabase
        .from("pesquisa")
        .select("*")
        .order("created_at", { ascending: false });

    if (error) {

        console.error("Erro ao carregar pesquisas:", error);

        document.getElementById("list-status").textContent =
            "Erro ao carregar pesquisas.";

        mostrarMensagem(
            "Não foi possível carregar as pesquisas. Verifique a conexão e as permissões.",
            "error"
        );

        return;
    }

    pesquisas = data || [];

    atualizarIndicadores();

    renderizarPesquisas();

    document.getElementById("list-status").textContent =
        "Dados atualizados";
}

// ==========================================
// RENDERIZAR TABELA
// ==========================================

function renderizarPesquisas() {

    const termo = document
        .getElementById("search-pesquisa")
        .value.trim().toLowerCase();

    const area = document
        .getElementById("filter-area")
        .value.trim().toLowerCase();

    const status = document
        .getElementById("filter-status").value;

    const filtradas = pesquisas.filter(item => {

        const correspondePesquisa = [
            item.titulo,
            item.resumo,
            item.responsavel,
            item.descricao
        ].some(valor =>
            (valor || "").toLowerCase().includes(termo)
        );

        const correspondeArea =
            !area ||
            (item.area || "").toLowerCase().includes(area);

        const correspondeStatus =
            !status || item.status === status;

        return (
            correspondePesquisa &&
            correspondeArea &&
            correspondeStatus
        );
    });

    lista.replaceChildren();

    if (!filtradas.length) {

        const linha = document.createElement("tr");

        const celula = document.createElement("td");

        celula.colSpan = 7;

        celula.textContent =
            "Nenhuma pesquisa encontrada.";

        linha.appendChild(celula);

        lista.appendChild(linha);

    } else {

        filtradas.forEach(item => {

            const linha = document.createElement("tr");

            // TÍTULO

            const titulo = document.createElement("td");

            titulo.textContent = item.titulo;

            // RESPONSÁVEL

            const responsavel = document.createElement("td");

            responsavel.textContent =
                item.responsavel || "—";

            // ÁREA

            const areaCelula = document.createElement("td");

            areaCelula.textContent =
                item.area || "—";

            // IMAGEM

            const imagem = document.createElement("td");

            imagem.textContent =
                item.imagem_url ? "Sim" : "Não";

            // ARQUIVO

            const arquivo = document.createElement("td");

            arquivo.textContent =
                item.arquivo_url ? "Sim" : "Não";

            // STATUS

            const statusCelula = document.createElement("td");

            const etiqueta = document.createElement("span");

            etiqueta.className =
                item.status === "publicado"
                    ? "status-label status-publicado"
                    : "status-label status-rascunho";

            etiqueta.textContent =
                item.status === "publicado"
                    ? "Publicado"
                    : "Rascunho";

            statusCelula.appendChild(etiqueta);

            // AÇÕES

            const acoes = document.createElement("td");

            const grupo = document.createElement("div");

            grupo.className = "table-actions";

            // EDITAR

            const editar = document.createElement("button");

            editar.type = "button";

            editar.textContent = "Editar";

            editar.addEventListener("click", () => {
                editarPesquisa(item.id);
            });

            // EXCLUIR

            const excluir = document.createElement("button");

            excluir.type = "button";

            excluir.className = "delete-button";

            excluir.textContent = "Excluir";

            excluir.addEventListener("click", () => {
                excluirPesquisa(item.id);
            });

            grupo.append(editar, excluir);

            acoes.appendChild(grupo);

            linha.append(
                titulo,
                responsavel,
                areaCelula,
                imagem,
                arquivo,
                statusCelula,
                acoes
            );

            lista.appendChild(linha);
        });
    }

    document.getElementById("list-count").textContent =
        `${filtradas.length} pesquisa(s) encontrada(s)`;
}

// ==========================================
// CADASTRAR E EDITAR
// ==========================================

form.addEventListener("submit", async event => {

    event.preventDefault();

    if (!autorizado) return;

    const id = campos.id.value;

    const anterior = pesquisas.find(
        item => item.id === id
    );

    botaoSalvar.disabled = true;

    botaoSalvar.textContent = "Salvando...";

    mostrarMensagem("");

    const novosUploads = [];

    let registroSalvo = false;

    try {

        const titulo = campos.titulo.value.trim();

        if (!titulo) {
            throw new Error("O título é obrigatório.");
        }

        const dados = {

            titulo,

            resumo:
                campos.resumo.value.trim() || null,

            descricao:
                campos.descricao.value.trim() || null,

            responsavel:
                campos.responsavel.value.trim() || null,

            area:
                campos.area.value.trim() || null,

            status: campos.status.value,

            updated_at: new Date().toISOString()
        };

        // ==================================
        // IMAGEM
        // ==================================

        if (campos.removerImagem.checked) {

            dados.imagem_url = null;

        } else if (campos.imagem.files[0]) {

            const imagem = campos.imagem.files[0];

            validarImagem(imagem);

            dados.imagem_url =
                await enviarArquivo(imagem, "imagens");

            novosUploads.push(dados.imagem_url);
        }

        // ==================================
        // DOCUMENTO
        // ==================================

        if (campos.removerArquivo.checked) {

            dados.arquivo_url = null;

        } else if (campos.arquivo.files[0]) {

            const arquivo = campos.arquivo.files[0];

            validarArquivo(arquivo);

            dados.arquivo_url =
                await enviarArquivo(arquivo, "documentos");

            novosUploads.push(dados.arquivo_url);
        }

        // ==================================
        // SALVAR NO SUPABASE
        // ==================================

        let resultado;

        if (id) {

            resultado = await supabase
                .from("pesquisa")
                .update(dados)
                .eq("id", id)
                .select("id")
                .maybeSingle();

        } else {

            resultado = await supabase
                .from("pesquisa")
                .insert(dados)
                .select("id")
                .single();
        }

        if (resultado.error) {
            throw resultado.error;
        }

        if (!resultado.data) {
            throw new Error(
                "Não foi possível confirmar a gravação."
            );
        }

        registroSalvo = true;

        // ==================================
        // EXCLUIR ARQUIVOS ANTIGOS
        // ==================================

        if (anterior) {

            if (
                anterior.imagem_url &&
                dados.imagem_url !== undefined &&
                dados.imagem_url !== anterior.imagem_url
            ) {
                await excluirArquivo(anterior.imagem_url);
            }

            if (
                anterior.arquivo_url &&
                dados.arquivo_url !== undefined &&
                dados.arquivo_url !== anterior.arquivo_url
            ) {
                await excluirArquivo(anterior.arquivo_url);
            }
        }

        // ==================================
        // FINALIZAR
        // ==================================

        limparFormulario();

        await carregarPesquisas();

        mostrarMensagem(
            id
                ? "Pesquisa atualizada com sucesso!"
                : "Pesquisa cadastrada com sucesso!",
            "success"
        );

    } catch (error) {

        console.error("Erro ao salvar pesquisa:", error);

        if (!registroSalvo) {

            for (const url of novosUploads) {
                await excluirArquivo(url);
            }
        }

        mostrarMensagem(
            error.message ||
            "Não foi possível salvar a pesquisa.",
            "error"
        );

    } finally {

        botaoSalvar.disabled = false;

        botaoSalvar.innerHTML =
            campos.id.value
                ? 'Atualizar pesquisa <span>↗</span>'
                : 'Salvar pesquisa <span>↗</span>';
    }

});

// ==========================================
// EDITAR PESQUISA
// ==========================================

function editarPesquisa(id) {

    const item = pesquisas.find(
        pesquisa => pesquisa.id === id
    );

    if (!item) return;

    campos.id.value = item.id;

    campos.titulo.value = item.titulo || "";

    campos.resumo.value = item.resumo || "";

    campos.descricao.value = item.descricao || "";

    campos.responsavel.value = item.responsavel || "";

    campos.area.value = item.area || "";

    campos.status.value = item.status || "rascunho";

    campos.imagem.value = "";

    campos.arquivo.value = "";

    campos.removerImagem.checked = false;

    campos.removerArquivo.checked = false;

    const preview =
        document.getElementById("imagem-preview");

    const area =
        document.getElementById("imagem-preview-area");

    if (item.imagem_url) {

        preview.src = item.imagem_url;

        preview.hidden = false;

        area.querySelector("span").hidden = true;

    } else {

        preview.src = "";

        preview.hidden = true;

        area.querySelector("span").hidden = false;
    }

    mostrarArquivoAtual(item.arquivo_url);

    document.getElementById("form-title").textContent =
        "Editar pesquisa.";

    document.getElementById("cancel-edit").hidden = false;

    botaoSalvar.innerHTML =
        'Atualizar pesquisa <span>↗</span>';

    mostrarMensagem("");

    document.getElementById("form-section").scrollIntoView({
        behavior: "smooth"
    });
}

// ==========================================
// EXCLUIR PESQUISA
// ==========================================

async function excluirPesquisa(id) {

    if (!autorizado) return;

    const item = pesquisas.find(
        pesquisa => pesquisa.id === id
    );

    if (!item) return;

    const confirmar = confirm(
        `Deseja realmente excluir a pesquisa "${item.titulo}"?`
    );

    if (!confirmar) return;

    try {

        const { data, error } = await supabase
            .from("pesquisa")
            .delete()
            .eq("id", id)
            .select("id")
            .single();

        if (error) throw error;

        if (!data) {
            throw new Error(
                "Não foi possível confirmar a exclusão."
            );
        }

        // REMOVER IMAGEM

        if (item.imagem_url) {
            await excluirArquivo(item.imagem_url);
        }

        // REMOVER DOCUMENTO

        if (item.arquivo_url) {
            await excluirArquivo(item.arquivo_url);
        }

        await carregarPesquisas();

        mostrarMensagem(
            "Pesquisa excluída com sucesso.",
            "success"
        );

    } catch (error) {

        console.error("Erro ao excluir pesquisa:", error);

        mostrarMensagem(
            error.message ||
            "Não foi possível excluir a pesquisa.",
            "error"
        );
    }
}

// ==========================================
// LIMPAR FORMULÁRIO
// ==========================================

function limparFormulario() {

    form.reset();

    campos.id.value = "";

    campos.status.value = "rascunho";

    if (imagemTemporaria) {

        URL.revokeObjectURL(imagemTemporaria);

        imagemTemporaria = null;
    }

    const preview =
        document.getElementById("imagem-preview");

    const area =
        document.getElementById("imagem-preview-area");

    preview.src = "";

    preview.hidden = true;

    area.querySelector("span").hidden = false;

    mostrarArquivoAtual(null);

    document.getElementById("form-title").textContent =
        "Nova pesquisa.";

    document.getElementById("cancel-edit").hidden = true;

    botaoSalvar.innerHTML =
        'Salvar pesquisa <span>↗</span>';

    mostrarMensagem("");
}

// ==========================================
// FILTROS
// ==========================================

document.getElementById("search-pesquisa")
    .addEventListener("input", renderizarPesquisas);

document.getElementById("filter-area")
    .addEventListener("input", renderizarPesquisas);

document.getElementById("filter-status")
    .addEventListener("change", renderizarPesquisas);

// ==========================================
// CANCELAR EDIÇÃO
// ==========================================

document.getElementById("cancel-edit")
    .addEventListener("click", limparFormulario);

// ==========================================
// RESET DO FORMULÁRIO
// ==========================================

form.addEventListener("reset", () => {

    setTimeout(() => {

        if (campos.id.value) return;

        if (imagemTemporaria) {

            URL.revokeObjectURL(imagemTemporaria);

            imagemTemporaria = null;
        }

        const preview =
            document.getElementById("imagem-preview");

        const area =
            document.getElementById("imagem-preview-area");

        preview.src = "";

        preview.hidden = true;

        area.querySelector("span").hidden = false;

        mostrarArquivoAtual(null);

        mostrarMensagem("");

    }, 0);

});

// ==========================================
// ENCERRAR SESSÃO
// ==========================================

document.getElementById("logout-button")
    .addEventListener("click", async () => {

        const botao =
            document.getElementById("logout-button");

        botao.disabled = true;

        try {

            const { error } = await supabase.auth.signOut();

            if (error) throw error;

            window.location.replace("login.html");

        } catch (error) {

            console.error(
                "Erro ao encerrar sessão:",
                error
            );

            alert("Não foi possível encerrar a sessão.");

            botao.disabled = false;
        }

    });

// ==========================================
// INICIALIZAÇÃO
// ==========================================

async function iniciarPesquisa() {

    const autorizado = await verificarAdministrador();

    if (!autorizado) return;

    await carregarPesquisas();
}

iniciarPesquisa();
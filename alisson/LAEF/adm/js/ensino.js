
import { supabase } from "./config.js";

// ==========================================
// LAEF — GERENCIAMENTO DE ENSINO
// ==========================================

const BUCKET = "ensino";

const form = document.getElementById("ensino-form");
const lista = document.getElementById("ensino-list");
const mensagem = document.getElementById("form-message");
const botaoSalvar = document.getElementById("save-ensino");

let conteudos = [];
let autorizado = false;
let imagemAtual = null;
let arquivoAtual = null;
let imagemTemporaria = null;


// ==========================================
// ELEMENTOS
// ==========================================

const campos = {
    id: document.getElementById("conteudo-id"),
    titulo: document.getElementById("titulo"),
    categoria: document.getElementById("categoria"),
    descricao: document.getElementById("descricao"),
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

    const nome = perfil.nome.trim();

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
// CAMINHO DOS ARQUIVOS
// ==========================================

function obterCaminho(url) {

    if (!url) return null;

    const marcador = `/storage/v1/object/public/${BUCKET}/`;

    if (!url.includes(marcador)) {
        return null;
    }

    try {

        return decodeURIComponent(
            url.split(marcador)[1].split("?")[0]
        );

    } catch {
        return null;
    }
}


function obterUrlPublica(caminho) {

    const { data } = supabase.storage
        .from(BUCKET)
        .getPublicUrl(caminho);

    return data.publicUrl;
}


// ==========================================
// VALIDAR ARQUIVOS
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
// EXCLUIR ARQUIVOS DO STORAGE
// ==========================================

async function excluirArquivo(url) {

    const caminho = obterCaminho(url);

    if (!caminho) return;

    const { error } = await supabase.storage
        .from(BUCKET)
        .remove([caminho]);

    if (error) {
        console.error("Erro ao excluir arquivo:", error);
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

        const preview = document.getElementById("imagem-preview");

        preview.src = imagemTemporaria;
        preview.hidden = false;

        document.querySelector(
            "#imagem-preview-area span"
        ).hidden = true;

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

    const publicados = conteudos.filter(
        item => item.status === "publicado"
    ).length;

    document.getElementById("total-ensino").textContent =
        conteudos.length;

    document.getElementById("total-publicados").textContent =
        publicados;

    document.getElementById("total-rascunhos").textContent =
        conteudos.length - publicados;
}


// ==========================================
// CARREGAR CONTEÚDOS
// ==========================================

async function carregarConteudos() {

    document.getElementById("list-status").textContent =
        "Carregando conteúdos...";

    const { data, error } = await supabase
        .from("ensino")
        .select("*")
        .order("created_at", { ascending: false });

    if (error) {

        console.error(error);

        document.getElementById("list-status").textContent =
            "Erro ao carregar conteúdos.";

        return;
    }

    conteudos = data || [];

    atualizarIndicadores();

    renderizarConteudos();

    document.getElementById("list-status").textContent =
        "Dados atualizados";
}


// ==========================================
// RENDERIZAR TABELA
// ==========================================

function renderizarConteudos() {

    const pesquisa = document
        .getElementById("search-ensino")
        .value.trim().toLowerCase();

    const categoria = document
        .getElementById("filter-categoria")
        .value.trim().toLowerCase();

    const status = document
        .getElementById("filter-status")
        .value;

    const filtrados = conteudos.filter(item => {

        const correspondePesquisa =
            item.titulo.toLowerCase().includes(pesquisa) ||
            (item.descricao || "").toLowerCase().includes(pesquisa);

        const correspondeCategoria =
            !categoria ||
            (item.categoria || "").toLowerCase().includes(categoria);

        const correspondeStatus =
            !status || item.status === status;

        return (
            correspondePesquisa &&
            correspondeCategoria &&
            correspondeStatus
        );
    });

    lista.replaceChildren();

    if (!filtrados.length) {

        const linha = document.createElement("tr");
        const celula = document.createElement("td");

        celula.colSpan = 6;
        celula.textContent = "Nenhum conteúdo encontrado.";

        linha.appendChild(celula);
        lista.appendChild(linha);

    } else {

        filtrados.forEach(item => {

            const linha = document.createElement("tr");

            const titulo = document.createElement("td");
            titulo.textContent = item.titulo;

            const categoria = document.createElement("td");
            categoria.textContent = item.categoria || "—";

            const imagem = document.createElement("td");
            imagem.textContent = item.imagem_url ? "Sim" : "Não";

            const arquivo = document.createElement("td");
            arquivo.textContent = item.arquivo_url ? "Sim" : "Não";

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

            const acoes = document.createElement("td");

            const grupo = document.createElement("div");
            grupo.className = "table-actions";

            const editar = document.createElement("button");

            editar.type = "button";
            editar.textContent = "Editar";

            editar.addEventListener("click", () => {
                editarConteudo(item.id);
            });

            const excluir = document.createElement("button");

            excluir.type = "button";
            excluir.className = "delete-button";
            excluir.textContent = "Excluir";

            excluir.addEventListener("click", () => {
                excluirConteudo(item.id);
            });

            grupo.append(editar, excluir);
            acoes.appendChild(grupo);

            linha.append(
                titulo,
                categoria,
                imagem,
                arquivo,
                statusCelula,
                acoes
            );

            lista.appendChild(linha);

        });
    }

    document.getElementById("list-count").textContent =
        `${filtrados.length} conteúdo(s) encontrado(s)`;
}


// ==========================================
// CADASTRAR E EDITAR
// ==========================================

form.addEventListener("submit", async event => {

    event.preventDefault();

    if (!autorizado) return;

    const id = campos.id.value;

    botaoSalvar.disabled = true;
    botaoSalvar.textContent = "Salvando...";

    mostrarMensagem("");

    const novosUploads = [];

    try {

        const titulo = campos.titulo.value.trim();

        if (!titulo) {
            throw new Error("O título é obrigatório.");
        }

        const dados = {
            titulo,
            categoria: campos.categoria.value.trim() || null,
            descricao: campos.descricao.value.trim() || null,
            status: campos.status.value,
            updated_at: new Date().toISOString()
        };

        // IMAGEM

        if (campos.removerImagem.checked) {

            dados.imagem_url = null;

        } else if (campos.imagem.files[0]) {

            const imagem = campos.imagem.files[0];

            validarImagem(imagem);

            dados.imagem_url = await enviarArquivo(imagem, "imagens");

            novosUploads.push(dados.imagem_url);

        }

        // DOCUMENTO

        if (campos.removerArquivo.checked) {

            dados.arquivo_url = null;

        } else if (campos.arquivo.files[0]) {

            const arquivo = campos.arquivo.files[0];

            validarArquivo(arquivo);

            dados.arquivo_url = await enviarArquivo(arquivo, "documentos");

            novosUploads.push(dados.arquivo_url);

        }

        let resultado;

        if (id) {

            resultado = await supabase
                .from("ensino")
                .update(dados)
                .eq("id", id)
                .select("id")
                .maybeSingle();

        } else {

            resultado = await supabase
                .from("ensino")
                .insert(dados)
                .select("id")
                .single();

        }

        if (resultado.error) {
            throw resultado.error;
        }

        if (!resultado.data) {
            throw new Error("Não foi possível confirmar a gravação.");
        }

        // EXCLUIR ARQUIVOS ANTIGOS APÓS SALVAR

        const anterior = conteudos.find(item => item.id === id);

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

        limparFormulario();

        await carregarConteudos();

        mostrarMensagem(
            id
                ? "Conteúdo atualizado com sucesso!"
                : "Conteúdo cadastrado com sucesso!",
            "success"
        );

    } catch (error) {

        console.error("Erro ao salvar conteúdo:", error);

        // Limpar uploads que não foram vinculados ao registro

        for (const url of novosUploads) {
            await excluirArquivo(url);
        }

        mostrarMensagem(
            error.message || "Não foi possível salvar o conteúdo.",
            "error"
        );

    } finally {

        botaoSalvar.disabled = false;

        botaoSalvar.innerHTML =
            campos.id.value
                ? 'Atualizar conteúdo <span>↗</span>'
                : 'Salvar conteúdo <span>↗</span>';

    }

});


// ==========================================
// EDITAR CONTEÚDO
// ==========================================

function editarConteudo(id) {

    const item = conteudos.find(
        conteudo => conteudo.id === id
    );

    if (!item) return;

    campos.id.value = item.id;
    campos.titulo.value = item.titulo;
    campos.categoria.value = item.categoria || "";
    campos.descricao.value = item.descricao || "";
    campos.status.value = item.status;

    imagemAtual = item.imagem_url;
    arquivoAtual = item.arquivo_url;

    campos.imagem.value = "";
    campos.arquivo.value = "";

    campos.removerImagem.checked = false;
    campos.removerArquivo.checked = false;

    const preview = document.getElementById("imagem-preview");
    const area = document.getElementById("imagem-preview-area");

    if (imagemAtual) {

        preview.src = imagemAtual;
        preview.hidden = false;

        area.querySelector("span").hidden = true;

    } else {

        preview.src = "";
        preview.hidden = true;

        area.querySelector("span").hidden = false;

    }

    mostrarArquivoAtual(arquivoAtual);

    document.getElementById("form-title").textContent =
        "Editar conteúdo.";

    document.getElementById("cancel-edit").hidden = false;

    botaoSalvar.innerHTML =
        'Atualizar conteúdo <span>↗</span>';

    mostrarMensagem("");

    document.getElementById("form-section").scrollIntoView({
        behavior: "smooth"
    });

}


// ==========================================
// EXCLUIR CONTEÚDO
// ==========================================

async function excluirConteudo(id) {

    if (!autorizado) return;

    const item = conteudos.find(
        conteudo => conteudo.id === id
    );

    if (!item) return;

    const confirmar = confirm(
        `Deseja realmente excluir "${item.titulo}"?`
    );

    if (!confirmar) return;

    try {

        const { data, error } = await supabase
            .from("ensino")
            .delete()
            .eq("id", id)
            .select("id")
            .single();

        if (error) throw error;

        if (!data) {
            throw new Error("Não foi possível confirmar a exclusão.");
        }

        // Remover arquivos associados

        if (item.imagem_url) {
            await excluirArquivo(item.imagem_url);
        }

        if (item.arquivo_url) {
            await excluirArquivo(item.arquivo_url);
        }

        await carregarConteudos();

        mostrarMensagem(
            "Conteúdo excluído com sucesso.",
            "success"
        );

    } catch (error) {

        console.error("Erro ao excluir conteúdo:", error);

        mostrarMensagem(
            error.message || "Não foi possível excluir o conteúdo.",
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

    imagemAtual = null;
    arquivoAtual = null;

    if (imagemTemporaria) {
        URL.revokeObjectURL(imagemTemporaria);
        imagemTemporaria = null;
    }

    const preview = document.getElementById("imagem-preview");
    const area = document.getElementById("imagem-preview-area");

    preview.src = "";
    preview.hidden = true;

    area.querySelector("span").hidden = false;

    mostrarArquivoAtual(null);

    document.getElementById("form-title").textContent =
        "Novo conteúdo.";

    document.getElementById("cancel-edit").hidden = true;

    botaoSalvar.innerHTML =
        'Salvar conteúdo <span>↗</span>';

    mostrarMensagem("");
}


// ==========================================
// FILTROS
// ==========================================

document.getElementById("search-ensino")
    .addEventListener("input", renderizarConteudos);

document.getElementById("filter-categoria")
    .addEventListener("input", renderizarConteudos);

document.getElementById("filter-status")
    .addEventListener("change", renderizarConteudos);


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

        document.getElementById("imagem-preview").src = "";
        document.getElementById("imagem-preview").hidden = true;

        document.querySelector(
            "#imagem-preview-area span"
        ).hidden = false;

        mostrarArquivoAtual(null);
        mostrarMensagem("");

    }, 0);

});


// ==========================================
// ENCERRAR SESSÃO
// ==========================================

document.getElementById("logout-button")
    .addEventListener("click", async () => {

        const botao = document.getElementById("logout-button");

        botao.disabled = true;

        try {

            const { error } = await supabase.auth.signOut();

            if (error) throw error;

            window.location.replace("login.html");

        } catch (error) {

            console.error(error);

            alert("Não foi possível encerrar a sessão.");

            botao.disabled = false;

        }

    });


// ==========================================
// INICIALIZAÇÃO
// ==========================================

async function iniciarEnsino() {

    const autorizado = await verificarAdministrador();

    if (!autorizado) return;
async function iniciarEnsino() {

    const autorizado = await verificarAdministrador();

    if (!autorizado) return;

    // DIAGNÓSTICO TEMPORÁRIO

    const { data: { session } } =
        await supabase.auth.getSession();

    console.log("Sessão:", !!session);

    if (session) {

        const payload = JSON.parse(
            atob(
                session.access_token
                    .split(".")[1]
                    .replace(/-/g, "+")
                    .replace(/_/g, "/")
            )
        );

        console.log("Usuário:", payload.sub);
        console.log("Role JWT:", payload.role);

        const { data, error } =
            await supabase.rpc("is_admin");

        console.log("Administrador:", data);
        console.log("Erro de autorização:", error);
    }

    await carregarConteudos();
}

iniciarEnsino();
    await carregarConteudos();

}

iniciarEnsino();

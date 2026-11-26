
import { supabase } from "./config.js";

// ==========================================
// LAEF — GERENCIAMENTO DA EQUIPE
// ==========================================

const BUCKET = "equipe";

const form = document.getElementById("equipe-form");
const mensagem = document.getElementById("form-message");
const lista = document.getElementById("equipe-list");
const botaoSalvar = document.getElementById("save-integrante");

let integrantes = [];
let usuarioAutorizado = false;
let fotoAtual = null;
let fotoTemporaria = null;


// ==========================================
// ELEMENTOS DO FORMULÁRIO
// ==========================================

const campos = {
    id: document.getElementById("integrante-id"),
    nome: document.getElementById("nome"),
    categoria: document.getElementById("categoria"),
    funcao: document.getElementById("funcao"),
    formacao: document.getElementById("formacao"),
    descricao: document.getElementById("descricao"),
    email: document.getElementById("email"),
    lattes: document.getElementById("lattes"),
    foto: document.getElementById("foto"),
    ordem: document.getElementById("ordem"),
    status: document.getElementById("status")
};


// ==========================================
// PROTEÇÃO ADMINISTRATIVA
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

    usuarioAutorizado = true;

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
// CAMINHO E URL DAS FOTOGRAFIAS
// ==========================================

function obterUrlFoto(caminho) {

    if (!caminho) return "";

    // Compatibilidade com URLs antigas

    if (caminho.startsWith("http")) {
        return caminho;
    }

    const { data } = supabase.storage
        .from(BUCKET)
        .getPublicUrl(caminho);

    return data.publicUrl;
}


function obterCaminhoFoto(valor) {

    if (!valor) return null;

    // Se já for um caminho do Storage

    if (!valor.startsWith("http")) {
        return valor;
    }

    // Recuperar caminho de uma URL pública do bucket

    const marcador = `/storage/v1/object/public/${BUCKET}/`;

    if (valor.includes(marcador)) {

        return decodeURIComponent(
            valor.split(marcador)[1]
        );
    }

    return null;
}


// ==========================================
// PRÉ-VISUALIZAÇÃO DA FOTOGRAFIA
// ==========================================

const campoFoto = document.getElementById("foto");
const previewImagem = document.getElementById("preview-image");
const previewArea = document.getElementById("photo-preview");

campoFoto.addEventListener("change", () => {

    const arquivo = campoFoto.files[0];

    if (!arquivo) return;

    if (!arquivo.type.startsWith("image/")) {

        mostrarMensagem(
            "Selecione um arquivo de imagem válido.",
            "error"
        );

        campoFoto.value = "";
        return;
    }

    if (arquivo.size > 5 * 1024 * 1024) {

        mostrarMensagem(
            "A fotografia deve ter no máximo 5 MB.",
            "error"
        );

        campoFoto.value = "";
        return;
    }

    if (fotoTemporaria) {
        URL.revokeObjectURL(fotoTemporaria);
    }

    fotoTemporaria = URL.createObjectURL(arquivo);

    previewImagem.src = fotoTemporaria;
    previewImagem.hidden = false;

    previewArea.querySelector("span").hidden = true;

    mostrarMensagem("");
});


// ==========================================
// ENVIAR FOTOGRAFIA AO STORAGE
// ==========================================

async function enviarFotografia(arquivo) {

    const extensoesPermitidas = [
        "jpg",
        "jpeg",
        "png",
        "webp"
    ];

    const extensao = arquivo.name
        .split(".")
        .pop()
        .toLowerCase();

    if (!extensoesPermitidas.includes(extensao)) {
        throw new Error("Formato de fotografia não permitido.");
    }

    const nomeArquivo =
        `${crypto.randomUUID()}.${extensao}`;

    const caminho = `integrantes/${nomeArquivo}`;

    const { error } = await supabase.storage
        .from(BUCKET)
        .upload(caminho, arquivo, {
            cacheControl: "3600",
            upsert: false,
            contentType: arquivo.type
        });

    if (error) {
        throw error;
    }

    return caminho;
}


// ==========================================
// EXCLUIR FOTOGRAFIA DO STORAGE
// ==========================================

async function excluirFotografia(caminho) {

    const arquivo = obterCaminhoFoto(caminho);

    if (!arquivo) return;

    const { error } = await supabase.storage
        .from(BUCKET)
        .remove([arquivo]);

    if (error) {
        console.error(
            "Não foi possível excluir a fotografia:",
            error
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
    campos.ordem.value = 0;

    fotoAtual = null;

    if (fotoTemporaria) {
        URL.revokeObjectURL(fotoTemporaria);
        fotoTemporaria = null;
    }

    previewImagem.src = "";
    previewImagem.hidden = true;

    previewArea.querySelector("span").hidden = false;

    document.getElementById("form-title").textContent =
        "Novo integrante.";

    botaoSalvar.innerHTML =
        'Salvar integrante <span>↗</span>';

    document.getElementById("cancel-edit").hidden = true;

    mostrarMensagem("");
}


// ==========================================
// ATUALIZAR INDICADORES
// ==========================================

function atualizarIndicadores() {

    const total = integrantes.length;

    const publicados = integrantes.filter(
        item => item.status === "publicado"
    ).length;

    const rascunhos = integrantes.filter(
        item => item.status === "rascunho"
    ).length;

    document.getElementById("total-integrantes").textContent =
        total;

    document.getElementById("total-publicados").textContent =
        publicados;

    document.getElementById("total-rascunhos").textContent =
        rascunhos;
}


// ==========================================
// BUSCAR INTEGRANTES
// ==========================================

async function carregarIntegrantes() {

    document.getElementById("list-status").textContent =
        "Carregando integrantes...";

    const { data, error } = await supabase
        .from("equipe")
        .select("*")
        .order("ordem", { ascending: true })
        .order("nome", { ascending: true });

    if (error) {

        console.error(error);

        document.getElementById("list-status").textContent =
            "Erro ao carregar integrantes.";

        return;
    }

    integrantes = data || [];

    atualizarIndicadores();

    renderizarIntegrantes();

    document.getElementById("list-status").textContent =
        "Dados atualizados";
}


// ==========================================
// RENDERIZAR INTEGRANTES
// ==========================================

function renderizarIntegrantes() {

    const pesquisa = document
        .getElementById("search-integrante")
        .value.trim()
        .toLowerCase();

    const categoria = document.getElementById(
        "filter-categoria"
    ).value;

    const status = document.getElementById(
        "filter-status"
    ).value;

    const filtrados = integrantes.filter(item => {

        const correspondePesquisa =
            item.nome.toLowerCase().includes(pesquisa) ||
            (item.funcao || "").toLowerCase().includes(pesquisa) ||
            (item.formacao || "").toLowerCase().includes(pesquisa);

        const correspondeCategoria =
            !categoria || item.categoria === categoria;

        const correspondeStatus =
            !status || item.status === status;

        return (
            correspondePesquisa &&
            correspondeCategoria &&
            correspondeStatus
        );
    });

    lista.replaceChildren();

    if (filtrados.length === 0) {

        const linha = document.createElement("tr");
        const celula = document.createElement("td");

        celula.colSpan = 6;
        celula.textContent = "Nenhum integrante encontrado.";

        linha.appendChild(celula);
        lista.appendChild(linha);

    } else {

        filtrados.forEach(item => {

            const linha = document.createElement("tr");

            // Integrante

            const nome = document.createElement("td");
            nome.textContent = item.nome;

            // Categoria

            const categoria = document.createElement("td");
            categoria.textContent = item.categoria;

            // Função

            const funcao = document.createElement("td");
            funcao.textContent = item.funcao || "—";

            // Ordem

            const ordem = document.createElement("td");
            ordem.textContent = item.ordem ?? 0;

            // Status

            const status = document.createElement("td");

            const etiqueta = document.createElement("span");

            etiqueta.className =
                item.status === "publicado"
                    ? "status-label status-publicado"
                    : "status-label status-rascunho";

            etiqueta.textContent =
                item.status === "publicado"
                    ? "Publicado"
                    : "Rascunho";

            status.appendChild(etiqueta);

            // Ações

            const acoes = document.createElement("td");

            const grupo = document.createElement("div");
            grupo.className = "table-actions";

            const editar = document.createElement("button");
            editar.type = "button";
            editar.textContent = "Editar";

            editar.addEventListener("click", () => {
                editarIntegrante(item.id);
            });

            const excluir = document.createElement("button");
            excluir.type = "button";
            excluir.className = "delete-button";
            excluir.textContent = "Excluir";

            excluir.addEventListener("click", () => {
                excluirIntegrante(item.id);
            });

            grupo.append(editar, excluir);
            acoes.appendChild(grupo);

            linha.append(
                nome,
                categoria,
                funcao,
                ordem,
                status,
                acoes
            );

            lista.appendChild(linha);

        });
    }

    document.getElementById("list-count").textContent =
        `${filtrados.length} integrante(s) encontrado(s)`;
}


// ==========================================
// CADASTRAR / EDITAR INTEGRANTE
// ==========================================

form.addEventListener("submit", async event => {

    event.preventDefault();

    if (!usuarioAutorizado) return;

    const id = campos.id.value;

    botaoSalvar.disabled = true;
    botaoSalvar.textContent = "Salvando...";

    mostrarMensagem("");

    let novaFoto = null;

    try {

        const dados = {

            nome: campos.nome.value.trim(),

            categoria: campos.categoria.value,

            funcao: campos.funcao.value.trim() || null,

            formacao: campos.formacao.value.trim() || null,

            descricao: campos.descricao.value.trim() || null,

            email: campos.email.value.trim() || null,

            lattes_url: campos.lattes.value.trim() || null,

            ordem: Number(campos.ordem.value) || 0,

            status: campos.status.value,

            updated_at: new Date().toISOString()

        };

        if (!dados.nome || !dados.categoria) {
            throw new Error("Preencha os campos obrigatórios.");
        }

        const arquivo = campos.foto.files[0];

        // Enviar nova fotografia, se existir

        if (arquivo) {

            novaFoto = await enviarFotografia(arquivo);

            dados.foto_url = novaFoto;

        } else if (!id) {

            dados.foto_url = null;

        }

        let resultado;

        // Atualizar cadastro existente

        if (id) {

            resultado = await supabase
                .from("equipe")
                .update(dados)
                .eq("id", id)
                .select("id")
                .maybeSingle();

        } else {

            // Novo cadastro

            resultado = await supabase
                .from("equipe")
                .insert(dados)
                .select("id")
                .single();

        }

        if (resultado.error) {
            throw resultado.error;
        }

        if (!resultado.data) {
            throw new Error(
                "Não foi possível confirmar a gravação do registro."
            );
        }

        // Excluir fotografia antiga somente após salvar a nova

        if (id && novaFoto && fotoAtual) {
            await excluirFotografia(fotoAtual);
        }

        limparFormulario();

        mostrarMensagem(
            id
                ? "Integrante atualizado com sucesso!"
                : "Integrante cadastrado com sucesso!",
            "success"
        );

        await carregarIntegrantes();

    } catch (error) {

        console.error("Erro ao salvar integrante:", error);

        // Remover fotografia enviada se o cadastro falhou

        if (novaFoto) {
            await excluirFotografia(novaFoto);
        }

        mostrarMensagem(
            error.message || "Não foi possível salvar o integrante.",
            "error"
        );

    } finally {

        botaoSalvar.disabled = false;

        botaoSalvar.innerHTML =
            campos.id.value
                ? 'Atualizar integrante <span>↗</span>'
                : 'Salvar integrante <span>↗</span>';

    }

});


// ==========================================
// EDITAR INTEGRANTE
// ==========================================

function editarIntegrante(id) {

    const item = integrantes.find(
        integrante => integrante.id === id
    );

    if (!item) return;

    campos.id.value = item.id;
    campos.nome.value = item.nome;
    campos.categoria.value = item.categoria;
    campos.funcao.value = item.funcao || "";
    campos.formacao.value = item.formacao || "";
    campos.descricao.value = item.descricao || "";
    campos.email.value = item.email || "";
    campos.lattes.value = item.lattes_url || "";
    campos.ordem.value = item.ordem ?? 0;
    campos.status.value = item.status;

    fotoAtual = item.foto_url;

    campos.foto.value = "";

    if (fotoTemporaria) {
        URL.revokeObjectURL(fotoTemporaria);
        fotoTemporaria = null;
    }

    if (item.foto_url) {

        previewImagem.src = obterUrlFoto(item.foto_url);
        previewImagem.hidden = false;

        previewArea.querySelector("span").hidden = true;

    } else {

        previewImagem.src = "";
        previewImagem.hidden = true;

        previewArea.querySelector("span").hidden = false;

    }

    document.getElementById("form-title").textContent =
        "Editar integrante.";

    botaoSalvar.innerHTML =
        'Atualizar integrante <span>↗</span>';

    document.getElementById("cancel-edit").hidden = false;

    mostrarMensagem("");

    document.getElementById("form-section").scrollIntoView({
        behavior: "smooth"
    });
}


// ==========================================
// EXCLUIR INTEGRANTE
// ==========================================

async function excluirIntegrante(id) {

    if (!usuarioAutorizado) return;

    const item = integrantes.find(
        integrante => integrante.id === id
    );

    if (!item) return;

    const confirmar = confirm(
        `Deseja realmente excluir o integrante ${item.nome}?`
    );

    if (!confirmar) return;

    try {

        const { error } = await supabase
            .from("equipe")
            .delete()
            .eq("id", id)
            .select("id")
            .single();

        if (error) {
            throw error;
        }

        // Excluir fotografia após excluir o registro

        if (item.foto_url) {
            await excluirFotografia(item.foto_url);
        }

        await carregarIntegrantes();

        mostrarMensagem(
            "Integrante excluído com sucesso.",
            "success"
        );

    } catch (error) {

        console.error("Erro ao excluir integrante:", error);

        mostrarMensagem(
            error.message || "Não foi possível excluir o integrante.",
            "error"
        );

    }
}


// ==========================================
// FILTROS E PESQUISA
// ==========================================

document
    .getElementById("search-integrante")
    .addEventListener("input", renderizarIntegrantes);

document
    .getElementById("filter-categoria")
    .addEventListener("change", renderizarIntegrantes);

document
    .getElementById("filter-status")
    .addEventListener("change", renderizarIntegrantes);


// ==========================================
// CANCELAR EDIÇÃO
// ==========================================

document
    .getElementById("cancel-edit")
    .addEventListener("click", limparFormulario);


// ==========================================
// LIMPAR FORMULÁRIO
// ==========================================

form.addEventListener("reset", () => {

    setTimeout(() => {

        if (campos.id.value) return;

        fotoAtual = null;

        if (fotoTemporaria) {
            URL.revokeObjectURL(fotoTemporaria);
            fotoTemporaria = null;
        }

        previewImagem.src = "";
        previewImagem.hidden = true;

        previewArea.querySelector("span").hidden = false;

        mostrarMensagem("");

    }, 0);

});


// ==========================================
// ENCERRAR SESSÃO
// ==========================================

document
    .getElementById("logout-button")
    .addEventListener("click", async () => {

        const botao = document.getElementById("logout-button");

        botao.disabled = true;

        const { error } = await supabase.auth.signOut();

        if (error) {

            console.error(error);

            alert("Não foi possível encerrar a sessão.");

            botao.disabled = false;

            return;
        }

        window.location.replace("login.html");

    });


// ==========================================
// INICIALIZAÇÃO
// ==========================================

async function iniciarEquipe() {

    const autorizado = await verificarAdministrador();

    if (!autorizado) return;

    await carregarIntegrantes();

}

iniciarEquipe();

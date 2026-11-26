
import { supabase } from "./config.js";

// ==========================================
// LAEF — GERENCIAMENTO DE MATERIAIS
// ==========================================

const BUCKET = "materiais";
const LIMITE_ARQUIVO = 20 * 1024 * 1024;

let materiais = [];
let imagemAtual = null;
let arquivoAtual = null;
let removerImagemAtual = false;
let removerArquivoAtual = false;

// ==========================================
// ELEMENTOS DO HTML
// ==========================================

const formulario = document.getElementById("form-material");
const lista = document.getElementById("lista-materiais");

const campoId = document.getElementById("material-id");
const campoTitulo = document.getElementById("titulo");
const campoCategoria = document.getElementById("categoria");
const campoDescricao = document.getElementById("descricao");
const campoAssunto = document.getElementById("assunto");
const campoFormato = document.getElementById("formato");
const campoSimbolo = document.getElementById("simbolo");
const campoPalavras = document.getElementById("palavras-chave");
const campoLink = document.getElementById("link-externo");
const campoStatus = document.getElementById("status");
const campoImagem = document.getElementById("imagem");
const campoArquivo = document.getElementById("arquivo");

const campoBusca = document.getElementById("filtro-busca");
const filtroCategoria = document.getElementById("filtro-categoria");
const filtroStatus = document.getElementById("filtro-status");

const mensagemFormulario = document.getElementById("mensagem-formulario");
const mensagemListagem = document.getElementById("mensagem-listagem");

const botaoSalvar = document.getElementById("salvar-material");
const botaoCancelar = document.getElementById("cancelar-edicao");
const botaoRemoverImagem = document.getElementById("remover-imagem");
const botaoRemoverArquivo = document.getElementById("remover-arquivo");

// ==========================================
// UTILITÁRIOS
// ==========================================

function mostrarMensagem(elemento, mensagem, tipo = "") {
    if (!elemento) return;

    elemento.textContent = mensagem;
    elemento.className = `form-message ${tipo}`;
}

function escaparHTML(valor = "") {
    return String(valor).replace(/[&<>"']/g, caractere => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[caractere]);
}

function formatarCategoria(categoria) {
    const nomes = {
        experimento: "Experimento",
        roteiro: "Roteiro",
        simulacao: "Simulação",
        didatico: "Material didático",
        computacional: "Computacional"
    };

    return nomes[categoria] || categoria || "—";
}

function nomeArquivoDaUrl(url) {
    if (!url) return "";

    try {
        return decodeURIComponent(
            new URL(url).pathname.split("/").pop()
        );
    } catch {
        return "Arquivo cadastrado";
    }
}

// ==========================================
// AUTENTICAÇÃO
// ==========================================

async function verificarAdministrador() {
    const {
        data: { user },
        error
    } = await supabase.auth.getUser();

    if (error || !user) {
        window.location.href = "login.html";
        return false;
    }

    const { data: perfil, error: erroPerfil } = await supabase
        .from("perfis")
        .select("nome, cargo, ativo")
        .eq("id", user.id)
        .single();

    if (
        erroPerfil ||
        !perfil ||
        perfil.ativo !== true ||
        perfil.cargo !== "Administrador"
    ) {
        alert("Você não possui autorização para acessar este módulo.");

        window.location.href = "dashboard.html";
        return false;
    }

    const nomeAdministrador = document.getElementById("admin-name");

    if (nomeAdministrador) {
        nomeAdministrador.textContent =
            perfil.nome || "Administrador";
    }

    return true;
}

// ==========================================
// INDICADORES
// ==========================================

function atualizarIndicadores() {
    document.getElementById("total-materiais").textContent =
        materiais.length;

    document.getElementById("materiais-publicados").textContent =
        materiais.filter(item => item.status === "publicado").length;

    document.getElementById("materiais-rascunhos").textContent =
        materiais.filter(item => item.status === "rascunho").length;
}

// ==========================================
// CARREGAR MATERIAIS
// ==========================================

async function carregarMateriais() {
    lista.innerHTML = `
        <tr>
            <td colspan="5">Carregando materiais...</td>
        </tr>
    `;

    const { data, error } = await supabase
        .from("materiais")
        .select("*")
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Erro ao carregar materiais:", error);

        lista.innerHTML = `
            <tr>
                <td colspan="5">
                    Não foi possível carregar os materiais.
                </td>
            </tr>
        `;

        mostrarMensagem(
            mensagemListagem,
            error.message,
            "error"
        );

        return;
    }

    materiais = data || [];

    atualizarIndicadores();
    renderizarMateriais();
}

// ==========================================
// RENDERIZAR LISTAGEM
// ==========================================

function renderizarMateriais() {
    const busca = campoBusca.value.trim().toLowerCase();
    const categoria = filtroCategoria.value;
    const status = filtroStatus.value;

    const filtrados = materiais.filter(item => {
        const texto = [
            item.titulo,
            item.assunto,
            item.descricao,
            item.palavras_chave
        ].join(" ").toLowerCase();

        return (
            texto.includes(busca) &&
            (!categoria || item.categoria === categoria) &&
            (!status || item.status === status)
        );
    });

    lista.replaceChildren();

    if (filtrados.length === 0) {
        const linha = document.createElement("tr");
        const coluna = document.createElement("td");

        coluna.colSpan = 5;
        coluna.textContent = "Nenhum material encontrado.";

        linha.appendChild(coluna);
        lista.appendChild(linha);

        return;
    }

    filtrados.forEach(item => {
        const linha = document.createElement("tr");

        const statusClasse =
            item.status === "publicado"
                ? "status-publicado"
                : "status-rascunho";

        linha.innerHTML = `
            <td>
                <strong>${escaparHTML(item.titulo)}</strong>
                <small class="material-subtitle">
                    ${escaparHTML(item.formato || "Formato não informado")}
                </small>
            </td>

            <td>${escaparHTML(formatarCategoria(item.categoria))}</td>

            <td>${escaparHTML(item.assunto || "—")}</td>

            <td>
                <span class="status-badge ${statusClasse}">
                    ${escaparHTML(item.status)}
                </span>
            </td>

            <td>
                <div class="material-actions">

                    <button
                        type="button"
                        class="action-edit"
                        data-action="editar"
                        data-id="${item.id}">
                        Editar
                    </button>

                    <button
                        type="button"
                        class="action-delete"
                        data-action="excluir"
                        data-id="${item.id}">
                        Excluir
                    </button>

                </div>
            </td>
        `;

        lista.appendChild(linha);
    });
}

// ==========================================
// VALIDAÇÃO DE ARQUIVOS
// ==========================================

function validarArquivo(arquivo, tipo) {
    if (!arquivo) return;

    if (arquivo.size > LIMITE_ARQUIVO) {
        throw new Error("O arquivo ultrapassa o limite de 20 MB.");
    }

    if (tipo === "imagem") {
        const permitidos = [
            "image/jpeg",
            "image/png",
            "image/webp"
        ];

        if (!permitidos.includes(arquivo.type)) {
            throw new Error(
                "A imagem deve estar no formato JPEG, PNG ou WebP."
            );
        }
    }

    if (tipo === "pdf" && arquivo.type !== "application/pdf") {
        throw new Error("O arquivo do material deve ser um PDF.");
    }
}

// ==========================================
// UPLOAD PARA O STORAGE
// ==========================================

function gerarCaminho(arquivo, pasta) {
    const nomeSeguro = arquivo.name
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9._-]/g, "_");

    return `${pasta}/${crypto.randomUUID()}-${nomeSeguro}`;
}

async function enviarParaStorage(arquivo, pasta, tipo) {
    validarArquivo(arquivo, tipo);

    const caminho = gerarCaminho(arquivo, pasta);

    const { error } = await supabase.storage
        .from(BUCKET)
        .upload(caminho, arquivo, {
            contentType: arquivo.type,
            upsert: false
        });

    if (error) throw error;

    const { data } = supabase.storage
        .from(BUCKET)
        .getPublicUrl(caminho);

    return data.publicUrl;
}

// ==========================================
// EXCLUIR ARQUIVO DO STORAGE
// ==========================================

async function excluirArquivoStorage(url) {
    if (!url) return;

    try {
        const endereco = new URL(url);

        const marcador =
            `/storage/v1/object/public/${BUCKET}/`;

        const indice = endereco.pathname.indexOf(marcador);

        if (indice === -1) {
            console.warn("URL de Storage não reconhecida:", url);
            return;
        }

        const caminho = decodeURIComponent(
            endereco.pathname.slice(indice + marcador.length)
        );

        const { error } = await supabase.storage
            .from(BUCKET)
            .remove([caminho]);

        if (error) throw error;

    } catch (error) {
        console.error("Erro ao remover arquivo:", error);
    }
}

// ==========================================
// INFORMAÇÕES DOS ARQUIVOS
// ==========================================

function atualizarInformacoesArquivos() {
    const areaImagem = document.getElementById("imagem-atual-info");
    const nomeImagem = document.getElementById("imagem-nome");

    const areaArquivo = document.getElementById("arquivo-atual-info");
    const nomeArquivo = document.getElementById("arquivo-nome");

    if (imagemAtual && !removerImagemAtual) {
        nomeImagem.textContent = nomeArquivoDaUrl(imagemAtual);
        areaImagem.hidden = false;
    } else {
        nomeImagem.textContent = "";
        areaImagem.hidden = true;
    }

    if (arquivoAtual && !removerArquivoAtual) {
        nomeArquivo.textContent = nomeArquivoDaUrl(arquivoAtual);
        areaArquivo.hidden = false;
    } else {
        nomeArquivo.textContent = "";
        areaArquivo.hidden = true;
    }
}

// ==========================================
// SALVAR MATERIAL
// ==========================================

async function salvarMaterial(evento) {
    evento.preventDefault();

    mostrarMensagem(mensagemFormulario, "");

    botaoSalvar.disabled = true;
    botaoSalvar.textContent = "Salvando...";

    let novaImagemUrl = null;
    let novoArquivoUrl = null;

    try {
        const id = campoId.value;

        const imagemSelecionada = campoImagem.files[0];
        const arquivoSelecionado = campoArquivo.files[0];

        const dados = {
            titulo: campoTitulo.value.trim(),
            categoria: campoCategoria.value,
            descricao: campoDescricao.value.trim() || null,
            assunto: campoAssunto.value.trim() || null,
            formato: campoFormato.value.trim() || null,
            simbolo: campoSimbolo.value.trim() || null,
            palavras_chave: campoPalavras.value.trim() || null,
            link_externo: campoLink.value.trim() || null,
            status: campoStatus.value,
            updated_at: new Date().toISOString()
        };

        if (!dados.titulo) {
            throw new Error("Informe o título do material.");
        }

        const categoriasValidas = [
            "experimento",
            "roteiro",
            "simulacao",
            "didatico",
            "computacional"
        ];

        if (!categoriasValidas.includes(dados.categoria)) {
            throw new Error("Selecione uma categoria válida.");
        }

        // Upload da imagem
        if (imagemSelecionada) {
            novaImagemUrl = await enviarParaStorage(
                imagemSelecionada,
                "imagens",
                "imagem"
            );

            dados.imagem_url = novaImagemUrl;

        } else if (id && removerImagemAtual) {
            dados.imagem_url = null;
        }

        // Upload do arquivo PDF
        if (arquivoSelecionado) {
            novoArquivoUrl = await enviarParaStorage(
                arquivoSelecionado,
                "arquivos",
                "pdf"
            );

            dados.arquivo_url = novoArquivoUrl;

        } else if (id && removerArquivoAtual) {
            dados.arquivo_url = null;
        }

        // Cadastro ou atualização
        const resultado = id
            ? await supabase
                .from("materiais")
                .update(dados)
                .eq("id", id)
            : await supabase
                .from("materiais")
                .insert(dados);

        if (resultado.error) {
            throw resultado.error;
        }

        // Remove os arquivos antigos após salvar
        const registroAntigo = materiais.find(
            item => item.id === id
        );

        if (
            registroAntigo?.imagem_url &&
            (novaImagemUrl || removerImagemAtual)
        ) {
            await excluirArquivoStorage(registroAntigo.imagem_url);
        }

        if (
            registroAntigo?.arquivo_url &&
            (novoArquivoUrl || removerArquivoAtual)
        ) {
            await excluirArquivoStorage(registroAntigo.arquivo_url);
        }

        mostrarMensagem(
            mensagemFormulario,
            id
                ? "Material atualizado com sucesso!"
                : "Material cadastrado com sucesso!",
            "success"
        );

        limparFormulario();
        await carregarMateriais();

    } catch (error) {
        console.error("Erro ao salvar material:", error);

        // Remove uploads que ficaram sem registro
        if (novaImagemUrl) {
            await excluirArquivoStorage(novaImagemUrl);
        }

        if (novoArquivoUrl) {
            await excluirArquivoStorage(novoArquivoUrl);
        }

        mostrarMensagem(
            mensagemFormulario,
            error.message || "Não foi possível salvar o material.",
            "error"
        );

    } finally {
        botaoSalvar.disabled = false;

        botaoSalvar.textContent = campoId.value
            ? "Atualizar material"
            : "Salvar material";
    }
}

// ==========================================
// EDITAR MATERIAL
// ==========================================

function editarMaterial(id) {
    const item = materiais.find(
        material => material.id === id
    );

    if (!item) return;

    campoId.value = item.id;

    campoTitulo.value = item.titulo || "";
    campoCategoria.value = item.categoria || "";
    campoDescricao.value = item.descricao || "";
    campoAssunto.value = item.assunto || "";
    campoFormato.value = item.formato || "";
    campoSimbolo.value = item.simbolo || "";
    campoPalavras.value = item.palavras_chave || "";
    campoLink.value = item.link_externo || "";
    campoStatus.value = item.status || "rascunho";

    imagemAtual = item.imagem_url || null;
    arquivoAtual = item.arquivo_url || null;

    removerImagemAtual = false;
    removerArquivoAtual = false;

    campoImagem.value = "";
    campoArquivo.value = "";

    atualizarInformacoesArquivos();

    document.getElementById("formulario-titulo").textContent =
        "Editar material";

    botaoSalvar.textContent = "Atualizar material";
    botaoCancelar.hidden = false;

    document.getElementById("formulario-section").scrollIntoView({
        behavior: "smooth"
    });
}

// ==========================================
// EXCLUIR MATERIAL
// ==========================================

async function excluirMaterial(id) {
    const item = materiais.find(
        material => material.id === id
    );

    if (!item) return;

    const confirmar = confirm(
        `Deseja realmente excluir "${item.titulo}"?`
    );

    if (!confirmar) return;

    try {
        const { error } = await supabase
            .from("materiais")
            .delete()
            .eq("id", id);

        if (error) throw error;

        if (item.imagem_url) {
            await excluirArquivoStorage(item.imagem_url);
        }

        if (item.arquivo_url) {
            await excluirArquivoStorage(item.arquivo_url);
        }

        mostrarMensagem(
            mensagemListagem,
            "Material excluído com sucesso.",
            "success"
        );

        await carregarMateriais();

    } catch (error) {
        console.error("Erro ao excluir material:", error);

        mostrarMensagem(
            mensagemListagem,
            error.message || "Não foi possível excluir o material.",
            "error"
        );
    }
}

// ==========================================
// LIMPAR FORMULÁRIO
// ==========================================

function limparFormulario() {
    formulario.reset();

    campoId.value = "";

    imagemAtual = null;
    arquivoAtual = null;

    removerImagemAtual = false;
    removerArquivoAtual = false;

    atualizarInformacoesArquivos();

    document.getElementById("formulario-titulo").textContent =
        "Cadastrar material";

    botaoSalvar.textContent = "Salvar material";
    botaoCancelar.hidden = true;
}

function cancelarEdicao() {
    limparFormulario();
    mostrarMensagem(mensagemFormulario, "");
}

// ==========================================
// REMOVER IMAGEM
// ==========================================

function marcarRemocaoImagem() {
    if (!imagemAtual) return;

    if (!confirm("Deseja remover a imagem deste material?")) {
        return;
    }

    removerImagemAtual = true;

    atualizarInformacoesArquivos();

    mostrarMensagem(
        mensagemFormulario,
        "A imagem será removida quando você salvar as alterações.",
        "success"
    );
}

// ==========================================
// REMOVER ARQUIVO
// ==========================================

function marcarRemocaoArquivo() {
    if (!arquivoAtual) return;

    if (!confirm("Deseja remover o arquivo deste material?")) {
        return;
    }

    removerArquivoAtual = true;

    atualizarInformacoesArquivos();

    mostrarMensagem(
        mensagemFormulario,
        "O arquivo será removido quando você salvar as alterações.",
        "success"
    );
}

// ==========================================
// EVENTOS DA LISTAGEM
// ==========================================

lista.addEventListener("click", evento => {
    const botao = evento.target.closest("button[data-action]");

    if (!botao) return;

    const id = botao.dataset.id;

    if (botao.dataset.action === "editar") {
        editarMaterial(id);
    }

    if (botao.dataset.action === "excluir") {
        excluirMaterial(id);
    }
});

// ==========================================
// FILTROS
// ==========================================

campoBusca.addEventListener("input", renderizarMateriais);

filtroCategoria.addEventListener("change", renderizarMateriais);

filtroStatus.addEventListener("change", renderizarMateriais);

// ==========================================
// EVENTOS DO FORMULÁRIO
// ==========================================

formulario.addEventListener("submit", salvarMaterial);

botaoCancelar.addEventListener("click", cancelarEdicao);

botaoRemoverImagem.addEventListener("click", marcarRemocaoImagem);

botaoRemoverArquivo.addEventListener("click", marcarRemocaoArquivo);

// ==========================================
// LOGOUT
// ==========================================

document.getElementById("logout-button")
    .addEventListener("click", async () => {

        const confirmar = confirm(
            "Deseja realmente sair do painel?"
        );

        if (!confirmar) return;

        await supabase.auth.signOut();

        window.location.href = "login.html";
    });

// ==========================================
// INICIALIZAÇÃO
// ==========================================

async function inicializar() {
    const autorizado = await verificarAdministrador();

    if (!autorizado) return;

    await carregarMateriais();
}

inicializar();

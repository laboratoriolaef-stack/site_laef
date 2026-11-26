import { supabase } from "./config.js";

// ==========================================
// LAEF — GERENCIAMENTO DE PUBLICAÇÕES
// ==========================================

const BUCKET = "publicacoes";

let publicacoes = [];
let arquivoAtual = null;
let removerArquivoAtual = false;

// ==========================================
// ELEMENTOS DO HTML
// ==========================================

const formulario = document.getElementById("form-publicacao");
const lista = document.getElementById("lista-publicacoes");

const campoId = document.getElementById("publicacao-id");
const campoTitulo = document.getElementById("titulo");
const campoAutores = document.getElementById("autores");
const campoCategoria = document.getElementById("categoria");
const campoAno = document.getElementById("ano");
const campoResumo = document.getElementById("resumo");
const campoPalavras = document.getElementById("palavras-chave");
const campoDoi = document.getElementById("doi");
const campoLink = document.getElementById("link-externo");
const campoStatus = document.getElementById("status");
const campoArquivo = document.getElementById("arquivo");

const campoBusca = document.getElementById("filtro-busca");
const filtroCategoria = document.getElementById("filtro-categoria");
const filtroStatus = document.getElementById("filtro-status");

const mensagemFormulario = document.getElementById("mensagem-formulario");
const mensagemListagem = document.getElementById("mensagem-listagem");

const botaoSalvar = document.getElementById("salvar-publicacao");
const botaoCancelar = document.getElementById("cancelar-edicao");
const botaoRemoverArquivo = document.getElementById("remover-arquivo");

// ==========================================
// VALIDAÇÃO AUTOMÁTICA DO ANO
// ==========================================

function configurarLimiteAno() {
    if (!campoAno) return;

    const anoAtual = new Date().getFullYear();

    campoAno.min = "1900";
    campoAno.max = String(anoAtual);

    campoAno.addEventListener("input", () => {
        validarAno();
    });

    campoAno.addEventListener("change", () => {
        validarAno();
    });
}

function validarAno() {
    if (!campoAno) return false;

    const anoAtual = new Date().getFullYear();
    const valor = campoAno.value.trim();

    if (!valor) {
        campoAno.setCustomValidity("");
        return true;
    }

    const ano = Number(valor);

    if (
        !Number.isInteger(ano) ||
        ano < 1900 ||
        ano > anoAtual
    ) {
        campoAno.setCustomValidity(
            `Informe um ano entre 1900 e ${anoAtual}.`
        );

        return false;
    }

    campoAno.setCustomValidity("");
    return true;
}

// ==========================================
// MENSAGENS
// ==========================================

function mostrarMensagem(elemento, mensagem, tipo = "") {
    if (!elemento) return;

    elemento.textContent = mensagem;
    elemento.className = `form-message ${tipo}`;
}

function escaparHTML(valor = "") {
    return String(valor).replace(/[&<>"']/g, caractere => {
        const entidades = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        };

        return entidades[caractere];
    });
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
// FORMATAR CATEGORIA
// ==========================================

function formatarCategoria(categoria) {
    const categorias = {
        artigo: "Artigo",
        evento: "Evento",
        tcc: "TCC",
        livro: "Livro",
        outros: "Outros"
    };

    return categorias[categoria] || categoria;
}

// ==========================================
// INDICADORES
// ==========================================

function atualizarIndicadores() {
    const total = publicacoes.length;

    const publicados = publicacoes.filter(
        item => item.status === "publicado"
    ).length;

    const rascunhos = publicacoes.filter(
        item => item.status === "rascunho"
    ).length;

    document.getElementById("total-publicacoes").textContent = total;

    document.getElementById("publicacoes-publicadas").textContent =
        publicados;

    document.getElementById("publicacoes-rascunhos").textContent =
        rascunhos;
}

// ==========================================
// CARREGAR PUBLICAÇÕES
// ==========================================

async function carregarPublicacoes() {
    lista.innerHTML = `
        <tr>
            <td colspan="5">Carregando publicações...</td>
        </tr>
    `;

    const { data, error } = await supabase
        .from("publicacoes")
        .select("*")
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Erro ao carregar publicações:", error);

        lista.innerHTML = `
            <tr>
                <td colspan="5">
                    Não foi possível carregar as publicações.
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

    publicacoes = data || [];

    atualizarIndicadores();
    renderizarPublicacoes();
}

// ==========================================
// RENDERIZAR LISTAGEM
// ==========================================

function renderizarPublicacoes() {
    const busca = campoBusca.value.trim().toLowerCase();

    const categoria = filtroCategoria.value;
    const status = filtroStatus.value;

    const filtradas = publicacoes.filter(item => {
        const correspondeBusca =
            item.titulo.toLowerCase().includes(busca) ||
            (item.autores || "").toLowerCase().includes(busca);

        const correspondeCategoria =
            !categoria || item.categoria === categoria;

        const correspondeStatus =
            !status || item.status === status;

        return (
            correspondeBusca &&
            correspondeCategoria &&
            correspondeStatus
        );
    });

    lista.replaceChildren();

    if (filtradas.length === 0) {
        const linha = document.createElement("tr");
        const coluna = document.createElement("td");

        coluna.colSpan = 5;
        coluna.textContent = "Nenhuma publicação encontrada.";

        linha.appendChild(coluna);
        lista.appendChild(linha);

        return;
    }

    filtradas.forEach(item => {
        const linha = document.createElement("tr");

        const statusClasse =
            item.status === "publicado"
                ? "status-publicado"
                : "status-rascunho";

        linha.innerHTML = `
            <td>
                <strong>${escaparHTML(item.titulo)}</strong>

                <small class="publication-author">
                    ${escaparHTML(item.autores || "Autor não informado")}
                </small>
            </td>

            <td>${escaparHTML(formatarCategoria(item.categoria))}</td>

            <td>${item.ano || "—"}</td>

            <td>
                <span class="status-badge ${statusClasse}">
                    ${escaparHTML(item.status)}
                </span>
            </td>

            <td>
                <div class="publication-actions">

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
// UPLOAD DO PDF
// ==========================================

async function enviarArquivo(arquivo) {
    if (!arquivo) return null;

    if (arquivo.type !== "application/pdf") {
        throw new Error("Selecione um arquivo PDF válido.");
    }

    if (arquivo.size > 20 * 1024 * 1024) {
        throw new Error("O arquivo ultrapassa o limite de 20 MB.");
    }

    const nomeSeguro = arquivo.name
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9._-]/g, "_");

    const caminho = `${crypto.randomUUID()}-${nomeSeguro}`;

    const { error } = await supabase.storage
        .from(BUCKET)
        .upload(caminho, arquivo, {
            contentType: "application/pdf",
            upsert: false
        });

    if (error) throw error;

    const { data } = supabase.storage
        .from(BUCKET)
        .getPublicUrl(caminho);

    return data.publicUrl;
}

// ==========================================
// REMOVER ARQUIVO DO STORAGE
// ==========================================

async function excluirArquivoStorage(url) {
    if (!url) return;

    try {
        const endereco = new URL(url);

        const marcador =
            `/storage/v1/object/public/${BUCKET}/`;

        const indice = endereco.pathname.indexOf(marcador);

        if (indice === -1) {
            console.warn("URL de arquivo não reconhecida:", url);
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
// SALVAR PUBLICAÇÃO
// ==========================================

async function salvarPublicacao(evento) {
    evento.preventDefault();

    mostrarMensagem(mensagemFormulario, "");

    // Impede o cadastro ou a edição com ano futuro.
    if (!validarAno()) {
        mostrarMensagem(
            mensagemFormulario,
            `O ano não pode ser superior a ${new Date().getFullYear()}.`,
            "error"
        );

        campoAno.reportValidity();
        campoAno.focus();

        return;
    }

    botaoSalvar.disabled = true;
    botaoSalvar.textContent = "Salvando...";

    let novoArquivoUrl = null;

    try {
        const id = campoId.value;

        const arquivoSelecionado = campoArquivo.files[0];

        const dados = {
            titulo: campoTitulo.value.trim(),

            autores: campoAutores.value.trim() || null,

            categoria: campoCategoria.value,

            ano: campoAno.value
                ? Number(campoAno.value)
                : null,

            resumo: campoResumo.value.trim() || null,

            palavras_chave: campoPalavras.value.trim() || null,

            doi: campoDoi.value.trim() || null,

            link_externo: campoLink.value.trim() || null,

            status: campoStatus.value,

            updated_at: new Date().toISOString()
        };

        if (!dados.titulo) {
            throw new Error("Informe o título da publicação.");
        }

        // Segunda verificação antes de enviar ao Supabase.
        const anoAtual = new Date().getFullYear();

        if (
            dados.ano !== null &&
            (
                !Number.isInteger(dados.ano) ||
                dados.ano < 1900 ||
                dados.ano > anoAtual
            )
        ) {
            throw new Error(
                `Informe um ano entre 1900 e ${anoAtual}. Não são permitidos anos futuros.`
            );
        }

        if (arquivoSelecionado) {
            novoArquivoUrl = await enviarArquivo(arquivoSelecionado);

            dados.arquivo_url = novoArquivoUrl;

        } else if (id && removerArquivoAtual) {
            dados.arquivo_url = null;
        }

        let resultado;

        if (id) {
            resultado = await supabase
                .from("publicacoes")
                .update(dados)
                .eq("id", id);

        } else {
            resultado = await supabase
                .from("publicacoes")
                .insert(dados);
        }

        if (resultado.error) throw resultado.error;

        // Remover arquivo antigo somente após salvar com sucesso.
        const registroAntigo = publicacoes.find(
            item => item.id === id
        );

        if (
            registroAntigo?.arquivo_url &&
            (
                novoArquivoUrl ||
                removerArquivoAtual
            )
        ) {
            await excluirArquivoStorage(registroAntigo.arquivo_url);
        }

        mostrarMensagem(
            mensagemFormulario,
            id
                ? "Publicação atualizada com sucesso!"
                : "Publicação cadastrada com sucesso!",
            "success"
        );

        formulario.reset();

        campoId.value = "";
        campoArquivo.value = "";

        arquivoAtual = null;
        removerArquivoAtual = false;

        atualizarInformacaoArquivo();

        document.getElementById("formulario-titulo").textContent =
            "Cadastrar publicação";

        botaoSalvar.textContent = "Salvar publicação";

        botaoCancelar.hidden = true;

        await carregarPublicacoes();

    } catch (error) {
        console.error("Erro ao salvar publicação:", error);

        // Evita arquivos órfãos se o cadastro falhar.
        if (novoArquivoUrl) {
            await excluirArquivoStorage(novoArquivoUrl);
        }

        mostrarMensagem(
            mensagemFormulario,
            error.message || "Não foi possível salvar a publicação.",
            "error"
        );

    } finally {
        botaoSalvar.disabled = false;

        if (campoId.value) {
            botaoSalvar.textContent = "Atualizar publicação";
        } else {
            botaoSalvar.textContent = "Salvar publicação";
        }
    }
}

// ==========================================
// EDITAR PUBLICAÇÃO
// ==========================================

function editarPublicacao(id) {
    const item = publicacoes.find(
        publicacao => publicacao.id === id
    );

    if (!item) return;

    campoId.value = item.id;

    campoTitulo.value = item.titulo || "";
    campoAutores.value = item.autores || "";
    campoCategoria.value = item.categoria || "";
    campoAno.value = item.ano || "";
    campoResumo.value = item.resumo || "";
    campoPalavras.value = item.palavras_chave || "";
    campoDoi.value = item.doi || "";
    campoLink.value = item.link_externo || "";
    campoStatus.value = item.status;

    // Atualiza a validação ao carregar uma publicação.
    validarAno();

    arquivoAtual = item.arquivo_url || null;
    removerArquivoAtual = false;

    atualizarInformacaoArquivo();

    document.getElementById("formulario-titulo").textContent =
        "Editar publicação";

    botaoSalvar.textContent = "Atualizar publicação";

    botaoCancelar.hidden = false;

    document.getElementById("formulario-section").scrollIntoView({
        behavior: "smooth"
    });
}

// ==========================================
// EXCLUIR PUBLICAÇÃO
// ==========================================

async function excluirPublicacao(id) {
    const item = publicacoes.find(
        publicacao => publicacao.id === id
    );

    if (!item) return;

    const confirmar = confirm(
        `Deseja realmente excluir "${item.titulo}"?`
    );

    if (!confirmar) return;

    try {
        const { error } = await supabase
            .from("publicacoes")
            .delete()
            .eq("id", id);

        if (error) throw error;

        if (item.arquivo_url) {
            await excluirArquivoStorage(item.arquivo_url);
        }

        mostrarMensagem(
            mensagemListagem,
            "Publicação excluída com sucesso.",
            "success"
        );

        await carregarPublicacoes();

    } catch (error) {
        console.error("Erro ao excluir publicação:", error);

        mostrarMensagem(
            mensagemListagem,
            error.message || "Não foi possível excluir a publicação.",
            "error"
        );
    }
}

// ==========================================
// CANCELAR EDIÇÃO
// ==========================================

function cancelarEdicao() {
    formulario.reset();

    campoId.value = "";

    arquivoAtual = null;
    removerArquivoAtual = false;

    atualizarInformacaoArquivo();

    document.getElementById("formulario-titulo").textContent =
        "Cadastrar publicação";

    botaoSalvar.textContent = "Salvar publicação";

    botaoCancelar.hidden = true;

    mostrarMensagem(mensagemFormulario, "");
}

// ==========================================
// INFORMAÇÕES DO ARQUIVO
// ==========================================

function atualizarInformacaoArquivo() {
    const area = document.getElementById("arquivo-atual-info");
    const nome = document.getElementById("arquivo-nome");

    if (!area || !nome) return;

    if (arquivoAtual && !removerArquivoAtual) {
        nome.textContent = "PDF já cadastrado";
        area.hidden = false;

    } else {
        nome.textContent = "";
        area.hidden = true;
    }
}

// ==========================================
// REMOVER ARQUIVO DO REGISTRO
// ==========================================

function marcarRemocaoArquivo() {
    if (!arquivoAtual) return;

    const confirmar = confirm(
        "Deseja remover o PDF desta publicação?"
    );

    if (!confirmar) return;

    removerArquivoAtual = true;

    atualizarInformacaoArquivo();

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
        editarPublicacao(id);
    }

    if (botao.dataset.action === "excluir") {
        excluirPublicacao(id);
    }
});

// ==========================================
// FILTROS
// ==========================================

campoBusca.addEventListener("input", renderizarPublicacoes);

filtroCategoria.addEventListener("change", renderizarPublicacoes);

filtroStatus.addEventListener("change", renderizarPublicacoes);

// ==========================================
// EVENTOS DO FORMULÁRIO
// ==========================================

formulario.addEventListener("submit", salvarPublicacao);

botaoCancelar.addEventListener("click", cancelarEdicao);

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

    configurarLimiteAno();

    await carregarPublicacoes();
}

inicializar();
import { supabase } from "./config.js";

import {
    obterCaminhoStorage,
    obterUrlAssinada
} from "../../js/storage.js";

// ==========================================
// LAEF — GERENCIAMENTO DE MATERIAIS
// ==========================================

const BUCKET = "materiais";

const LIMITE_ARQUIVO = 20 * 1024 * 1024;

const CATEGORIAS = {
    experimento: "Experimento",
    roteiro: "Roteiro",
    simulacao: "Simulação",
    didatico: "Material didático",
    computacional: "Computacional"
};

let materiais = [];

let imagemAtual = null;
let arquivoAtual = null;

let removerImagemAtual = false;
let removerArquivoAtual = false;

let autorizado = false;
let operacaoEmAndamento = false;

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

    elemento.className =
        `form-message ${tipo}`.trim();
}

function escaparHTML(valor = "") {

    return String(valor ?? "").replace(
        /[&<>"']/g,
        caractere => ({

            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"

        })[caractere]
    );
}

function normalizarTexto(valor) {

    return String(valor || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLocaleLowerCase("pt-BR")
        .trim();
}

function formatarCategoria(categoria) {

    return Object.hasOwn(CATEGORIAS, categoria)

        ? CATEGORIAS[categoria]

        : categoria || "—";
}

// ==========================================
// VALIDAR LINK EXTERNO
// ==========================================

function validarLinkExterno(valor) {

    if (!valor) return null;

    try {

        const url = new URL(valor.trim());

        if (
            url.protocol !== "https:" &&
            url.protocol !== "http:"
        ) {

            throw new Error("Protocolo inválido.");
        }

        return url.href;

    } catch {

        throw new Error(
            "Informe um link externo válido, iniciado por HTTP ou HTTPS."
        );
    }
}

// ==========================================
// OBTER CAMINHO DO STORAGE
// ==========================================

function obterCaminho(valor) {

    return obterCaminhoStorage(
        BUCKET,
        valor
    );
}

// ==========================================
// OBTER NOME DO ARQUIVO
// ==========================================

function nomeArquivoDaUrl(valor) {

    const caminho = obterCaminho(valor);

    if (!caminho) {

        return "Arquivo cadastrado";
    }

    const nome = caminho.split("/").pop();

    // Remover o UUID utilizado no upload.

    return nome.replace(

        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/i,

        ""
    );
}

// ==========================================
// AUTENTICAÇÃO ADMINISTRATIVA
// ==========================================

async function verificarAdministrador() {

    const {

        data: { user },

        error

    } = await supabase.auth.getUser();

    if (error || !user) {

        window.location.replace("login.html");

        return false;
    }

    const { data: perfil, error: erroPerfil } = await supabase

        .from("perfis")

        .select("nome, cargo, ativo")

        .eq("id", user.id)

        .maybeSingle();

    if (

        erroPerfil ||

        !perfil ||

        perfil.ativo !== true ||

        perfil.cargo !== "Administrador"

    ) {

        alert(
            "Você não possui autorização para acessar este módulo."
        );

        await supabase.auth.signOut();

        window.location.replace("login.html");

        return false;
    }

    const nomeAdministrador =
        document.getElementById("admin-name");

    if (nomeAdministrador) {

        nomeAdministrador.textContent =
            perfil.nome || "Administrador";
    }

    const inicialAdministrador =
        document.getElementById("admin-initial");

    if (inicialAdministrador) {

        inicialAdministrador.textContent =

            (perfil.nome || "Administrador")

                .trim()

                .charAt(0)

                .toUpperCase();
    }

    autorizado = true;

    return true;
}

// ==========================================
// BLOQUEAR FORMULÁRIO
// ==========================================

function bloquearFormulario(bloqueado) {

    operacaoEmAndamento = bloqueado;

    formulario.querySelectorAll(
        "input, select, textarea, button"
    ).forEach(elemento => {

        elemento.disabled = bloqueado;
    });

    botaoSalvar.disabled = bloqueado;

    botaoCancelar.disabled = bloqueado;

    botaoRemoverImagem.disabled = bloqueado;

    botaoRemoverArquivo.disabled = bloqueado;
}

// ==========================================
// INDICADORES
// ==========================================

function atualizarIndicadores() {

    document.getElementById("total-materiais").textContent =
        materiais.length;

    document.getElementById("materiais-publicados").textContent =

        materiais.filter(

            item => item.status === "publicado"

        ).length;

    document.getElementById("materiais-rascunhos").textContent =

        materiais.filter(

            item => item.status === "rascunho"

        ).length;
}

// ==========================================
// CARREGAR MATERIAIS
// ==========================================

async function carregarMateriais() {

    lista.innerHTML = `
        <tr>
            <td colspan="5">
                Carregando materiais...
            </td>
        </tr>
    `;

    try {

        const { data, error } = await supabase

            .from("materiais")

            .select("*")

            .order("created_at", {

                ascending: false

            });

        if (error) throw error;

        materiais = data || [];

        atualizarIndicadores();

        renderizarMateriais();

        return true;

    } catch (error) {

        console.error(
            "Erro ao carregar materiais:",
            error
        );

        lista.innerHTML = `
            <tr>
                <td colspan="5">
                    Não foi possível carregar os materiais.
                </td>
            </tr>
        `;

        mostrarMensagem(

            mensagemListagem,

            error.message ||
            "Erro ao carregar materiais.",

            "error"
        );

        return false;
    }
}

// ==========================================
// RENDERIZAR LISTAGEM
// ==========================================

function renderizarMateriais() {

    const busca = normalizarTexto(
        campoBusca.value
    );

    const categoria = filtroCategoria.value;

    const status = filtroStatus.value;

    const filtrados = materiais.filter(item => {

        const texto = normalizarTexto([

            item.titulo,

            item.assunto,

            item.descricao,

            item.palavras_chave,

            item.formato,

            formatarCategoria(item.categoria)

        ].filter(Boolean).join(" "));

        return (

            texto.includes(busca) &&

            (!categoria || item.categoria === categoria) &&

            (!status || item.status === status)

        );
    });

    lista.replaceChildren();

    // ======================================
    // LISTA VAZIA
    // ======================================

    if (filtrados.length === 0) {

        const linha = document.createElement("tr");

        const coluna = document.createElement("td");

        coluna.colSpan = 5;

        coluna.textContent =
            "Nenhum material encontrado.";

        linha.appendChild(coluna);

        lista.appendChild(linha);

        return;
    }

    // ======================================
    // LISTAGEM
    // ======================================

    const fragmento =
        document.createDocumentFragment();

    filtrados.forEach(item => {

        const linha = document.createElement("tr");

        const statusClasse =

            item.status === "publicado"

                ? "status-publicado"

                : "status-rascunho";

        linha.innerHTML = `

            <td>

                <strong>
                    ${escaparHTML(item.titulo)}
                </strong>

                <small class="material-subtitle">

                    ${escaparHTML(
                        item.formato ||
                        "Formato não informado"
                    )}

                </small>

            </td>

            <td>

                ${escaparHTML(
                    formatarCategoria(item.categoria)
                )}

            </td>

            <td>

                ${escaparHTML(item.assunto || "—")}

            </td>

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
                        data-id="${escaparHTML(item.id)}">

                        Editar

                    </button>

                    <button
                        type="button"
                        class="action-delete"
                        data-action="excluir"
                        data-id="${escaparHTML(item.id)}">

                        Excluir

                    </button>

                </div>

            </td>
        `;

        fragmento.appendChild(linha);

    });

    lista.appendChild(fragmento);
}

// ==========================================
// VALIDAÇÃO DE ARQUIVOS
// ==========================================

function validarArquivo(arquivo, tipo) {

    if (!arquivo) {

        throw new Error(
            "Nenhum arquivo selecionado."
        );
    }

    if (arquivo.size === 0) {

        throw new Error(
            "O arquivo selecionado está vazio."
        );
    }

    if (arquivo.size > LIMITE_ARQUIVO) {

        throw new Error(
            "O arquivo ultrapassa o limite de 20 MB."
        );
    }

    const extensao = arquivo.name

        .split(".")

        .pop()

        .toLowerCase();

    // ======================================
    // VALIDAR IMAGEM
    // ======================================

    if (tipo === "imagem") {

        const formatos = {

            jpg: "image/jpeg",

            jpeg: "image/jpeg",

            png: "image/png",

            webp: "image/webp"

        };

        if (!Object.hasOwn(formatos, extensao)) {

            throw new Error(
                "A imagem deve estar no formato JPEG, PNG ou WebP."
            );
        }

        const mimeEsperado = formatos[extensao];

        if (arquivo.type !== mimeEsperado) {

            throw new Error(
                "O tipo da imagem é incompatível com sua extensão."
            );
        }

        return mimeEsperado;
    }

    // ======================================
    // VALIDAR PDF
    // ======================================

    if (tipo === "pdf") {

        if (

            extensao !== "pdf" ||

            arquivo.type !== "application/pdf"

        ) {

            throw new Error(
                "O arquivo do material deve ser um PDF."
            );
        }

        return "application/pdf";
    }

    throw new Error(
        "Categoria de arquivo inválida."
    );
}

// ==========================================
// GERAR CAMINHO DO ARQUIVO
// ==========================================

function gerarCaminho(arquivo, pasta) {

    const nomeSeguro = arquivo.name

        .normalize("NFD")

        .replace(/[\u0300-\u036f]/g, "")

        .replace(/[^a-zA-Z0-9._-]/g, "_");

    return `${pasta}/${crypto.randomUUID()}-${nomeSeguro}`;
}

// ==========================================
// UPLOAD PARA O STORAGE
// ==========================================

async function enviarParaStorage(arquivo, pasta, tipo) {

    const mimeType = validarArquivo(
        arquivo,
        tipo
    );

    const caminho = gerarCaminho(
        arquivo,
        pasta
    );

    const { error } = await supabase.storage

        .from(BUCKET)

        .upload(caminho, arquivo, {

            contentType: mimeType,

            cacheControl: "300",

            upsert: false

        });

    if (error) throw error;

    // Armazenar somente o caminho relativo.
    // Nunca armazenar URLs assinadas no banco.

    return caminho;
}

// ==========================================
// EXCLUIR ARQUIVO DO STORAGE
// ==========================================

async function excluirArquivoStorage(valor) {

    const caminho = obterCaminho(valor);

    if (!caminho) return false;

    try {

        const { error } = await supabase.storage

            .from(BUCKET)

            .remove([caminho]);

        if (error) throw error;

        return true;

    } catch (error) {

        console.error(
            "Erro ao remover arquivo:",
            error
        );

        return false;
    }
}

// ==========================================
// CRIAR LINK ASSINADO
// ==========================================

function criarLinkArquivo(valor, texto) {

    const caminho = obterCaminho(valor);

    if (!caminho) return null;

    const link = document.createElement("a");

    link.href = "#";

    link.textContent = texto;

    let carregando = false;

    link.addEventListener("click", async evento => {

        evento.preventDefault();

        if (!autorizado || carregando) return;

        carregando = true;

        link.setAttribute("aria-busy", "true");

        link.textContent = "Carregando...";

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

            mostrarMensagem(

                mensagemFormulario,

                error.message,

                "error"
            );

        } finally {

            carregando = false;

            link.removeAttribute("aria-busy");

            link.textContent = texto;
        }

    });

    return link;
}

// ==========================================
// INFORMAÇÕES DOS ARQUIVOS
// ==========================================

function atualizarInformacoesArquivos() {

    const areaImagem = document.getElementById(
        "imagem-atual-info"
    );

    const nomeImagem = document.getElementById(
        "imagem-nome"
    );

    const areaArquivo = document.getElementById(
        "arquivo-atual-info"
    );

    const nomeArquivo = document.getElementById(
        "arquivo-nome"
    );

    // ======================================
    // IMAGEM CADASTRADA
    // ======================================

    nomeImagem.replaceChildren();

    if (imagemAtual && !removerImagemAtual) {

        const link = criarLinkArquivo(

            imagemAtual,

            nomeArquivoDaUrl(imagemAtual)
        );

        if (link) {

            nomeImagem.appendChild(link);

        } else {

            nomeImagem.textContent =
                nomeArquivoDaUrl(imagemAtual);
        }

        areaImagem.hidden = false;

    } else {

        areaImagem.hidden = true;
    }

    // ======================================
    // PDF CADASTRADO
    // ======================================

    nomeArquivo.replaceChildren();

    if (arquivoAtual && !removerArquivoAtual) {

        const link = criarLinkArquivo(

            arquivoAtual,

            nomeArquivoDaUrl(arquivoAtual)
        );

        if (link) {

            nomeArquivo.appendChild(link);

        } else {

            nomeArquivo.textContent =
                nomeArquivoDaUrl(arquivoAtual);
        }

        areaArquivo.hidden = false;

    } else {

        areaArquivo.hidden = true;
    }
}

// ==========================================
// SELECIONAR IMAGEM
// ==========================================

campoImagem.addEventListener("change", () => {

    if (!autorizado || operacaoEmAndamento) return;

    const arquivo = campoImagem.files[0];

    if (!arquivo) return;

    try {

        validarArquivo(arquivo, "imagem");

        removerImagemAtual = false;

        atualizarInformacoesArquivos();

        mostrarMensagem(

            mensagemFormulario,

            "Nova imagem selecionada.",

            "success"
        );

    } catch (error) {

        campoImagem.value = "";

        mostrarMensagem(

            mensagemFormulario,

            error.message,

            "error"
        );
    }
});

// ==========================================
// SELECIONAR PDF
// ==========================================

campoArquivo.addEventListener("change", () => {

    if (!autorizado || operacaoEmAndamento) return;

    const arquivo = campoArquivo.files[0];

    if (!arquivo) return;

    try {

        validarArquivo(arquivo, "pdf");

        removerArquivoAtual = false;

        atualizarInformacoesArquivos();

        mostrarMensagem(

            mensagemFormulario,

            "Novo arquivo PDF selecionado.",

            "success"
        );

    } catch (error) {

        campoArquivo.value = "";

        mostrarMensagem(

            mensagemFormulario,

            error.message,

            "error"
        );
    }
});

// ==========================================
// SALVAR MATERIAL
// ==========================================

async function salvarMaterial(evento) {

    evento.preventDefault();

    if (!autorizado || operacaoEmAndamento) return;

    const id = campoId.value;

    const registroAntigo = materiais.find(

        item => item.id === id
    );

    const removerImagem = removerImagemAtual;

    const removerArquivo = removerArquivoAtual;

    bloquearFormulario(true);

    botaoSalvar.textContent = "Salvando...";

    mostrarMensagem(
        mensagemFormulario,
        ""
    );

    const novosUploads = [];

    let registroSalvo = false;

    let gravacaoIniciada = false;

    let falhaLimpeza = false;

    try {

        const imagemSelecionada =
            campoImagem.files[0];

        const arquivoSelecionado =
            campoArquivo.files[0];

        const dados = {

            titulo:
                campoTitulo.value.trim(),

            categoria:
                campoCategoria.value,

            descricao:
                campoDescricao.value.trim() || null,

            assunto:
                campoAssunto.value.trim() || null,

            formato:
                campoFormato.value.trim() || null,

            simbolo:
                campoSimbolo.value.trim() || null,

            palavras_chave:
                campoPalavras.value.trim() || null,

            link_externo:
                validarLinkExterno(
                    campoLink.value.trim()
                ),

            status:
                campoStatus.value,

            updated_at:
                new Date().toISOString()

        };

        // ==================================
        // VALIDAR TÍTULO
        // ==================================

        if (!dados.titulo) {

            throw new Error(
                "Informe o título do material."
            );
        }

        // ==================================
        // VALIDAR CATEGORIA
        // ==================================

        if (!Object.hasOwn(
            CATEGORIAS,
            dados.categoria
        )) {

            throw new Error(
                "Selecione uma categoria válida."
            );
        }

        // ==================================
        // VALIDAR STATUS
        // ==================================

        if (!["publicado", "rascunho"].includes(
            dados.status
        )) {

            throw new Error(
                "Selecione um status válido."
            );
        }

        // ==================================
        // VALIDAR ARQUIVOS ANTES DOS UPLOADS
        // ==================================

        if (imagemSelecionada && !removerImagem) {

            validarArquivo(
                imagemSelecionada,
                "imagem"
            );
        }

        if (arquivoSelecionado && !removerArquivo) {

            validarArquivo(
                arquivoSelecionado,
                "pdf"
            );
        }

        // ==================================
        // UPLOAD DA IMAGEM
        // ==================================

        if (removerImagem) {

            dados.imagem_url = null;

        } else if (imagemSelecionada) {

            dados.imagem_url = await enviarParaStorage(

                imagemSelecionada,

                "imagens",

                "imagem"
            );

            novosUploads.push(
                dados.imagem_url
            );
        }

        // ==================================
        // UPLOAD DO PDF
        // ==================================

        if (removerArquivo) {

            dados.arquivo_url = null;

        } else if (arquivoSelecionado) {

            dados.arquivo_url = await enviarParaStorage(

                arquivoSelecionado,

                "arquivos",

                "pdf"
            );

            novosUploads.push(
                dados.arquivo_url
            );
        }

        // ==================================
        // CADASTRO OU ATUALIZAÇÃO
        // ==================================

        gravacaoIniciada = true;

        let resultado;

        if (id) {

            resultado = await supabase

                .from("materiais")

                .update(dados)

                .eq("id", id)

                .select("id")

                .maybeSingle();

        } else {

            resultado = await supabase

                .from("materiais")

                .insert(dados)

                .select("id")

                .single();
        }

        if (resultado.error) {

            throw resultado.error;
        }

        if (!resultado.data) {

            throw new Error(
                "Não foi possível confirmar a gravação do material."
            );
        }

        registroSalvo = true;

        // ==================================
        // EXCLUIR IMAGEM ANTIGA
        // ==================================

        if (

            registroAntigo?.imagem_url &&

            dados.imagem_url !== undefined &&

            dados.imagem_url !== registroAntigo.imagem_url

        ) {

            const excluido =
                await excluirArquivoStorage(

                    registroAntigo.imagem_url
                );

            if (!excluido) {

                falhaLimpeza = true;
            }
        }

        // ==================================
        // EXCLUIR PDF ANTIGO
        // ==================================

        if (

            registroAntigo?.arquivo_url &&

            dados.arquivo_url !== undefined &&

            dados.arquivo_url !== registroAntigo.arquivo_url

        ) {

            const excluido =
                await excluirArquivoStorage(

                    registroAntigo.arquivo_url
                );

            if (!excluido) {

                falhaLimpeza = true;
            }
        }

        // ==================================
        // FINALIZAR OPERAÇÃO
        // ==================================

        limparFormulario();

        const listaAtualizada =
            await carregarMateriais();

        const mensagem = id

            ? "Material atualizado com sucesso!"

            : "Material cadastrado com sucesso!";

        if (falhaLimpeza || !listaAtualizada) {

            mostrarMensagem(

                mensagemFormulario,

                mensagem +
                " Verifique a limpeza dos arquivos antigos e a atualização da lista.",

                "error"
            );

        } else {

            mostrarMensagem(

                mensagemFormulario,

                mensagem,

                "success"
            );
        }

    } catch (error) {

        console.error(
            "Erro ao salvar material:",
            error
        );

        // Excluir uploads somente quando nenhuma
        // gravação no banco tiver sido iniciada.

        if (!registroSalvo && !gravacaoIniciada) {

            for (const caminho of novosUploads) {

                await excluirArquivoStorage(caminho);
            }
        }

        // Preservar os arquivos caso o resultado
        // da gravação no banco seja incerto.

        if (!registroSalvo && gravacaoIniciada) {

            mostrarMensagem(

                mensagemFormulario,

                "Não foi possível confirmar a gravação. Atualize a página e verifique o material antes de tentar novamente.",

                "error"
            );

        } else if (registroSalvo) {

            mostrarMensagem(

                mensagemFormulario,

                "O material foi salvo, mas ocorreu um problema na atualização do painel.",

                "error"
            );

        } else {

            mostrarMensagem(

                mensagemFormulario,

                error.message ||
                "Não foi possível salvar o material.",

                "error"
            );
        }

    } finally {

        bloquearFormulario(false);

        botaoSalvar.textContent = campoId.value

            ? "Atualizar material"

            : "Salvar material";
    }
}

// ==========================================
// EDITAR MATERIAL
// ==========================================

function editarMaterial(id) {

    if (!autorizado || operacaoEmAndamento) return;

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

    botaoSalvar.textContent =
        "Atualizar material";

    botaoCancelar.hidden = false;

    mostrarMensagem(
        mensagemFormulario,
        ""
    );

    document.getElementById("formulario-section").scrollIntoView({

        behavior: "smooth"

    });
}

// ==========================================
// EXCLUIR MATERIAL
// ==========================================

async function excluirMaterial(id) {

    if (!autorizado || operacaoEmAndamento) return;

    const item = materiais.find(

        material => material.id === id
    );

    if (!item) return;

    const confirmar = confirm(

        `Deseja realmente excluir "${item.titulo}"?`
    );

    if (!confirmar) return;

    bloquearFormulario(true);

    let registroExcluido = false;

    let falhaLimpeza = false;

    try {

        const { data, error } = await supabase

            .from("materiais")

            .delete()

            .eq("id", id)

            .select("id")

            .maybeSingle();

        if (error) throw error;

        if (!data) {

            throw new Error(
                "Não foi possível confirmar a exclusão do material."
            );
        }

        registroExcluido = true;

        // ==================================
        // EXCLUIR IMAGEM
        // ==================================

        if (item.imagem_url) {

            const excluido =
                await excluirArquivoStorage(

                    item.imagem_url
                );

            if (!excluido) {

                falhaLimpeza = true;
            }
        }

        // ==================================
        // EXCLUIR PDF
        // ==================================

        if (item.arquivo_url) {

            const excluido =
                await excluirArquivoStorage(

                    item.arquivo_url
                );

            if (!excluido) {

                falhaLimpeza = true;
            }
        }

        // ==================================
        // LIMPAR EDIÇÃO
        // ==================================

        if (campoId.value === id) {

            limparFormulario();
        }

        const listaAtualizada =
            await carregarMateriais();

        if (falhaLimpeza || !listaAtualizada) {

            mostrarMensagem(

                mensagemListagem,

                "O material foi excluído, mas a limpeza dos arquivos ou a atualização da lista precisa ser verificada.",

                "error"
            );

        } else {

            mostrarMensagem(

                mensagemListagem,

                "Material excluído com sucesso.",

                "success"
            );
        }

    } catch (error) {

        console.error(
            "Erro ao excluir material:",
            error
        );

        mostrarMensagem(

            mensagemListagem,

            registroExcluido

                ? "O material foi excluído, mas ocorreu um problema na atualização do painel."

                : error.message ||
                  "Não foi possível confirmar a exclusão do material.",

            "error"
        );

    } finally {

        bloquearFormulario(false);
    }
}

// ==========================================
// LIMPAR FORMULÁRIO
// ==========================================

function limparFormulario() {

    formulario.reset();

    campoId.value = "";

    campoStatus.value = "rascunho";

    imagemAtual = null;

    arquivoAtual = null;

    removerImagemAtual = false;

    removerArquivoAtual = false;

    atualizarInformacoesArquivos();

    document.getElementById("formulario-titulo").textContent =

        "Cadastrar material";

    botaoSalvar.textContent =
        "Salvar material";

    botaoCancelar.hidden = true;

    mostrarMensagem(
        mensagemFormulario,
        ""
    );
}

// ==========================================
// CANCELAR EDIÇÃO
// ==========================================

function cancelarEdicao() {

    if (!autorizado || operacaoEmAndamento) return;

    limparFormulario();
}

// ==========================================
// REMOVER IMAGEM
// ==========================================

function marcarRemocaoImagem() {

    if (!autorizado || operacaoEmAndamento) return;

    if (!imagemAtual) return;

    if (!confirm(

        "Deseja remover a imagem deste material?"

    )) {

        return;
    }

    removerImagemAtual = true;

    campoImagem.value = "";

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

    if (!autorizado || operacaoEmAndamento) return;

    if (!arquivoAtual) return;

    if (!confirm(

        "Deseja remover o arquivo deste material?"

    )) {

        return;
    }

    removerArquivoAtual = true;

    campoArquivo.value = "";

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

    if (!autorizado || operacaoEmAndamento) return;

    const botao = evento.target.closest(
        "button[data-action]"
    );

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

campoBusca.addEventListener(

    "input",

    renderizarMateriais
);

filtroCategoria.addEventListener(

    "change",

    renderizarMateriais
);

filtroStatus.addEventListener(

    "change",

    renderizarMateriais
);

// ==========================================
// EVENTOS DO FORMULÁRIO
// ==========================================

formulario.addEventListener(

    "submit",

    salvarMaterial
);

botaoCancelar.addEventListener(

    "click",

    cancelarEdicao
);

botaoRemoverImagem.addEventListener(

    "click",

    marcarRemocaoImagem
);

botaoRemoverArquivo.addEventListener(

    "click",

    marcarRemocaoArquivo
);

// ==========================================
// LOGOUT
// ==========================================

document.getElementById("logout-button")

    .addEventListener("click", async () => {

        if (operacaoEmAndamento) {

            alert(
                "Aguarde a conclusão da operação atual."
            );

            return;
        }

        const confirmar = confirm(

            "Deseja realmente sair do painel?"
        );

        if (!confirmar) return;

        const botao = document.getElementById(
            "logout-button"
        );

        botao.disabled = true;

        try {

            const { error } =
                await supabase.auth.signOut();

            if (error) throw error;

            autorizado = false;

            window.location.replace("login.html");

        } catch (error) {

            console.error(
                "Erro ao encerrar sessão:",
                error
            );

            alert(
                "Não foi possível encerrar a sessão."
            );

            botao.disabled = false;
        }

    });

// ==========================================
// INICIALIZAÇÃO
// ==========================================

async function inicializar() {

    bloquearFormulario(true);

    try {

        const acessoPermitido =
            await verificarAdministrador();

        if (!acessoPermitido) return;

        await carregarMateriais();

    } catch (error) {

        console.error(
            "Erro ao inicializar o módulo:",
            error
        );

        mostrarMensagem(

            mensagemFormulario,

            "Não foi possível inicializar o módulo de materiais.",

            "error"
        );

    } finally {

        if (autorizado) {

            bloquearFormulario(false);
        }
    }
}

inicializar();
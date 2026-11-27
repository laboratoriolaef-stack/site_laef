import { supabase } from "./config.js";

import {
    obterCaminhoStorage,
    obterUrlAssinada
} from "../../js/storage.js";

// ==========================================
// LAEF — GERENCIAMENTO DE EXTENSÃO
// ==========================================

const BUCKET = "extensao";

const form = document.getElementById("extensao-form");
const lista = document.getElementById("extensao-list");
const mensagem = document.getElementById("form-message");
const botaoSalvar = document.getElementById("save-extensao");

let extensoes = [];
let autorizado = false;
let imagemTemporaria = null;
let versaoPreview = 0;
let operacaoEmAndamento = false;

// ==========================================
// CAMPOS DO FORMULÁRIO
// ==========================================

const campos = {

    id: document.getElementById("extensao-id"),
    titulo: document.getElementById("titulo"),
    resumo: document.getElementById("resumo"),
    descricao: document.getElementById("descricao"),
    responsavel: document.getElementById("responsavel"),
    imagem: document.getElementById("imagem"),
    arquivo: document.getElementById("arquivo"),
    status: document.getElementById("status"),
    removerImagem: document.getElementById("remover-imagem"),
    removerArquivo: document.getElementById("remover-arquivo")

};

const preview = document.getElementById("imagem-preview");

const areaPreview = document.getElementById(
    "imagem-preview-area"
);

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
        perfil.ativo !== true ||
        perfil.cargo !== "Administrador"
    ) {

        await supabase.auth.signOut();

        window.location.replace("login.html");

        return false;
    }

    const nome = (
        perfil.nome || "Administrador"
    ).trim();

    document.getElementById("admin-name").textContent =
        nome;

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
// CAMINHO DO ARQUIVO
// ==========================================

function obterCaminho(valor) {

    return obterCaminhoStorage(
        BUCKET,
        valor
    );
}

// ==========================================
// VALIDAR IMAGEM
// ==========================================

function validarImagem(arquivo) {

    const formatosPermitidos = {

        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        png: "image/png",
        webp: "image/webp"

    };

    const extensao = arquivo.name
        .split(".")
        .pop()
        .toLowerCase();

    if (!Object.hasOwn(formatosPermitidos, extensao)) {

        throw new Error(
            "Formato de imagem não permitido."
        );
    }

    const mimeEsperado =
        formatosPermitidos[extensao];

    if (arquivo.type !== mimeEsperado) {

        throw new Error(
            "O tipo da imagem é incompatível com sua extensão."
        );
    }

    if (arquivo.size === 0) {

        throw new Error(
            "A imagem está vazia."
        );
    }

    if (arquivo.size > 5 * 1024 * 1024) {

        throw new Error(
            "A imagem deve ter no máximo 5 MB."
        );
    }

    return mimeEsperado;
}

// ==========================================
// VALIDAR DOCUMENTO
// ==========================================

function validarArquivo(arquivo) {

    const formatosPermitidos = {

        pdf: "application/pdf",

        doc: "application/msword",

        docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",

        ppt: "application/vnd.ms-powerpoint",

        pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",

        odt: "application/vnd.oasis.opendocument.text",

        odp: "application/vnd.oasis.opendocument.presentation"

    };

    const extensao = arquivo.name
        .split(".")
        .pop()
        .toLowerCase();

    if (!Object.hasOwn(formatosPermitidos, extensao)) {

        throw new Error(
            "Formato de documento não permitido."
        );
    }

    const mimeEsperado =
        formatosPermitidos[extensao];

    if (arquivo.size === 0) {

        throw new Error(
            "O documento está vazio."
        );
    }

    if (arquivo.size > 20 * 1024 * 1024) {

        throw new Error(
            "O documento deve ter no máximo 20 MB."
        );
    }

    if (
        arquivo.type &&
        arquivo.type !== "application/octet-stream" &&
        arquivo.type !== mimeEsperado
    ) {

        throw new Error(
            "O tipo do documento é incompatível com sua extensão."
        );
    }

    return mimeEsperado;
}

// ==========================================
// ENVIAR ARQUIVO
// ==========================================

async function enviarArquivo(arquivo, tipo) {

    let mimeType;

    if (tipo === "imagens") {

        mimeType = validarImagem(arquivo);

    } else if (tipo === "documentos") {

        mimeType = validarArquivo(arquivo);

    } else {

        throw new Error(
            "Categoria de arquivo inválida."
        );
    }

    const extensao = arquivo.name
        .split(".")
        .pop()
        .toLowerCase();

    const nome =
        `${crypto.randomUUID()}.${extensao}`;

    const caminho =
        `${tipo}/${nome}`;

    const { error } = await supabase.storage
        .from(BUCKET)
        .upload(caminho, arquivo, {

            cacheControl: "300",

            upsert: false,

            contentType: mimeType

        });

    if (error) throw error;

    // Armazenar somente o caminho relativo.
    // Nunca armazenar URLs assinadas no banco.

    return caminho;
}

// ==========================================
// EXCLUIR ARQUIVO
// ==========================================

async function excluirArquivo(valor) {

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
            "Erro ao excluir arquivo:",
            error
        );

        return false;
    }
}

// ==========================================
// LIMPAR PRÉ-VISUALIZAÇÃO
// ==========================================

function limparPreview() {

    ++versaoPreview;

    if (imagemTemporaria) {

        URL.revokeObjectURL(imagemTemporaria);

        imagemTemporaria = null;
    }

    preview.onerror = null;

    preview.removeAttribute("src");

    preview.hidden = true;

    areaPreview.querySelector("span").hidden = false;
}

// ==========================================
// ATUALIZAR PRÉ-VISUALIZAÇÃO
// ==========================================

async function atualizarPreviewImagem() {

    limparPreview();

    const versao = versaoPreview;

    if (campos.removerImagem.checked) return;

    const arquivo = campos.imagem.files[0];

    let url = null;

    if (arquivo) {

        imagemTemporaria = URL.createObjectURL(
            arquivo
        );

        url = imagemTemporaria;

    } else {

        const item = extensoes.find(
            extensao =>
                extensao.id === campos.id.value
        );

        if (item?.imagem_url) {

            url = await obterUrlAssinada(
                BUCKET,
                item.imagem_url
            );
        }
    }

    // Impedir a exibição de imagens antigas
    // quando o administrador troca de registro.

    if (versao !== versaoPreview || !url) return;

    preview.onerror = () => {

        if (versao !== versaoPreview) return;

        preview.hidden = true;

        areaPreview.querySelector("span").hidden =
            false;
    };

    preview.src = url;

    preview.hidden = false;

    areaPreview.querySelector("span").hidden = true;
}

// ==========================================
// SELECIONAR IMAGEM
// ==========================================

campos.imagem.addEventListener("change", async () => {

    if (!autorizado || operacaoEmAndamento) return;

    try {

        const arquivo = campos.imagem.files[0];

        if (arquivo) {

            validarImagem(arquivo);

            campos.removerImagem.checked = false;
        }

        mostrarMensagem("");

        await atualizarPreviewImagem();

    } catch (error) {

        campos.imagem.value = "";

        await atualizarPreviewImagem();

        mostrarMensagem(
            error.message,
            "error"
        );
    }
});

// ==========================================
// REMOVER IMAGEM
// ==========================================

campos.removerImagem.addEventListener(
    "change",
    async () => {

        if (!autorizado || operacaoEmAndamento) return;

        if (campos.removerImagem.checked) {

            campos.imagem.value = "";
        }

        await atualizarPreviewImagem();
    }
);

// ==========================================
// SELECIONAR DOCUMENTO
// ==========================================

campos.arquivo.addEventListener("change", () => {

    if (!autorizado || operacaoEmAndamento) return;

    const arquivo = campos.arquivo.files[0];

    if (!arquivo) return;

    try {

        validarArquivo(arquivo);

        campos.removerArquivo.checked = false;

        mostrarMensagem("");

        mostrarArquivoAtual(
            extensoes.find(
                item => item.id === campos.id.value
            )?.arquivo_url
        );

    } catch (error) {

        campos.arquivo.value = "";

        mostrarMensagem(
            error.message,
            "error"
        );
    }
});

// ==========================================
// REMOVER DOCUMENTO
// ==========================================

campos.removerArquivo.addEventListener("change", () => {

    if (!autorizado || operacaoEmAndamento) return;

    if (campos.removerArquivo.checked) {

        campos.arquivo.value = "";
    }

    const item = extensoes.find(
        extensao =>
            extensao.id === campos.id.value
    );

    mostrarArquivoAtual(item?.arquivo_url);
});

// ==========================================
// EXIBIR ARQUIVO ATUAL
// ==========================================

function mostrarArquivoAtual(valor) {

    const area = document.getElementById(
        "arquivo-atual"
    );

    area.replaceChildren();

    if (campos.removerArquivo.checked) {

        area.textContent =
            "O arquivo será removido ao salvar.";

        return;
    }

    const caminho = obterCaminho(valor);

    if (!caminho) {

        area.textContent =
            "Nenhum arquivo cadastrado.";

        return;
    }

    const link = document.createElement("a");

    link.href = "#";

    link.textContent =
        "Visualizar arquivo atual ↗";

    let carregando = false;

    link.addEventListener("click", async event => {

        event.preventDefault();

        if (!autorizado || carregando) return;

        carregando = true;

        link.setAttribute("aria-busy", "true");

        link.textContent = "Carregando arquivo...";

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
                error.message,
                "error"
            );

        } finally {

            carregando = false;

            link.removeAttribute("aria-busy");

            link.textContent =
                "Visualizar arquivo atual ↗";
        }

    });

    area.appendChild(link);
}

// ==========================================
// INDICADORES
// ==========================================

function atualizarIndicadores() {

    const publicados = extensoes.filter(
        item => item.status === "publicado"
    ).length;

    document.getElementById("total-extensao").textContent =
        extensoes.length;

    document.getElementById("total-publicados").textContent =
        publicados;

    document.getElementById("total-rascunhos").textContent =
        extensoes.length - publicados;
}

// ==========================================
// CARREGAR EXTENSÕES
// ==========================================

async function carregarExtensoes() {

    document.getElementById("list-status").textContent =
        "Carregando ações...";

    const { data, error } = await supabase
        .from("extensao")
        .select("*")
        .order("created_at", {

            ascending: false

        });

    if (error) {

        console.error(
            "Erro ao carregar extensão:",
            error
        );

        document.getElementById("list-status").textContent =
            "Erro ao carregar ações.";

        mostrarMensagem(

            "Não foi possível carregar as ações de extensão.",

            "error"
        );

        return false;
    }

    extensoes = data || [];

    atualizarIndicadores();

    renderizarExtensoes();

    document.getElementById("list-status").textContent =
        "Dados atualizados";

    return true;
}

// ==========================================
// RENDERIZAR LISTAGEM
// ==========================================

function renderizarExtensoes() {

    const termo = document
        .getElementById("search-extensao")
        .value.trim()
        .toLowerCase();

    const status = document
        .getElementById("filter-status")
        .value;

    const filtradas = extensoes.filter(item => {

        const correspondePesquisa = [

            item.titulo,

            item.resumo,

            item.responsavel,

            item.descricao

        ].some(valor =>

            (valor || "")
                .toLowerCase()
                .includes(termo)
        );

        const correspondeStatus =

            !status ||
            item.status === status;

        return (

            correspondePesquisa &&
            correspondeStatus
        );
    });

    lista.replaceChildren();

    // ======================================
    // LISTA VAZIA
    // ======================================

    if (filtradas.length === 0) {

        const linha = document.createElement("tr");

        const celula = document.createElement("td");

        celula.colSpan = 6;

        celula.textContent =
            "Nenhuma ação de extensão encontrada.";

        linha.appendChild(celula);

        lista.appendChild(linha);

    } else {

        const fragmento =
            document.createDocumentFragment();

        filtradas.forEach(item => {

            const linha = document.createElement("tr");

            // TÍTULO

            const titulo = document.createElement("td");

            titulo.textContent = item.titulo;

            // RESPONSÁVEL

            const responsavel = document.createElement("td");

            responsavel.textContent =
                item.responsavel || "—";

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

            // BOTÃO EDITAR

            const editar = document.createElement("button");

            editar.type = "button";

            editar.textContent = "Editar";

            editar.addEventListener("click", () => {

                editarExtensao(item.id);
            });

            // BOTÃO EXCLUIR

            const excluir = document.createElement("button");

            excluir.type = "button";

            excluir.className = "delete-button";

            excluir.textContent = "Excluir";

            excluir.addEventListener("click", () => {

                excluirExtensao(item.id);
            });

            grupo.append(
                editar,
                excluir
            );

            acoes.appendChild(grupo);

            linha.append(

                titulo,

                responsavel,

                imagem,

                arquivo,

                statusCelula,

                acoes
            );

            fragmento.appendChild(linha);

        });

        lista.appendChild(fragmento);
    }

    document.getElementById("list-count").textContent =

        `${filtradas.length} ação(ões) encontrada(s)`;
}

// ==========================================
// BLOQUEAR FORMULÁRIO DURANTE OPERAÇÕES
// ==========================================

function bloquearFormulario(bloqueado) {

    operacaoEmAndamento = bloqueado;

    Object.values(campos).forEach(campo => {

        campo.disabled = bloqueado;
    });

    botaoSalvar.disabled = bloqueado;

    document.getElementById("cancel-edit").disabled =
        bloqueado;
}

// ==========================================
// CADASTRAR E EDITAR
// ==========================================

form.addEventListener("submit", async event => {

    event.preventDefault();

    if (!autorizado || operacaoEmAndamento) return;

    const id = campos.id.value;

    const anterior = extensoes.find(
        item => item.id === id
    );

    bloquearFormulario(true);

    botaoSalvar.textContent = "Salvando...";

    mostrarMensagem("");

    const novosUploads = [];

    let registroSalvo = false;

    let gravacaoIniciada = false;

    let falhaLimpeza = false;

    try {

        const titulo = campos.titulo.value.trim();

        if (!titulo) {

            throw new Error(
                "O título é obrigatório."
            );
        }

        if (
            !["publicado", "rascunho"].includes(
                campos.status.value
            )
        ) {

            throw new Error(
                "Status inválido."
            );
        }

        const dados = {

            titulo,

            resumo:
                campos.resumo.value.trim() || null,

            descricao:
                campos.descricao.value.trim() || null,

            responsavel:
                campos.responsavel.value.trim() || null,

            status:
                campos.status.value,

            updated_at:
                new Date().toISOString()
        };

        const imagem = campos.imagem.files[0];

        const arquivo = campos.arquivo.files[0];

        // Validar os dois arquivos antes de iniciar
        // qualquer operação de upload.

        if (imagem && !campos.removerImagem.checked) {

            validarImagem(imagem);
        }

        if (arquivo && !campos.removerArquivo.checked) {

            validarArquivo(arquivo);
        }

        // ==================================
        // IMAGEM
        // ==================================

        if (campos.removerImagem.checked) {

            dados.imagem_url = null;

        } else if (imagem) {

            dados.imagem_url = await enviarArquivo(
                imagem,
                "imagens"
            );

            novosUploads.push(dados.imagem_url);
        }

        // ==================================
        // DOCUMENTO
        // ==================================

        if (campos.removerArquivo.checked) {

            dados.arquivo_url = null;

        } else if (arquivo) {

            dados.arquivo_url = await enviarArquivo(
                arquivo,
                "documentos"
            );

            novosUploads.push(dados.arquivo_url);
        }

        // ==================================
        // SALVAR NO SUPABASE
        // ==================================

        let resultado;

        gravacaoIniciada = true;

        if (id) {

            resultado = await supabase
                .from("extensao")
                .update(dados)
                .eq("id", id)
                .select("id")
                .maybeSingle();

        } else {

            resultado = await supabase
                .from("extensao")
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

                const excluido = await excluirArquivo(
                    anterior.imagem_url
                );

                if (!excluido) {

                    falhaLimpeza = true;
                }
            }

            if (
                anterior.arquivo_url &&
                dados.arquivo_url !== undefined &&
                dados.arquivo_url !== anterior.arquivo_url
            ) {

                const excluido = await excluirArquivo(
                    anterior.arquivo_url
                );

                if (!excluido) {

                    falhaLimpeza = true;
                }
            }
        }

        // ==================================
        // FINALIZAR
        // ==================================

        limparFormulario();

        const listaAtualizada =
            await carregarExtensoes();

        const texto = id

            ? "Ação de extensão atualizada com sucesso!"

            : "Ação de extensão cadastrada com sucesso!";

        if (falhaLimpeza || !listaAtualizada) {

            mostrarMensagem(

                texto +
                " Verifique a atualização da lista e a limpeza dos arquivos antigos.",

                "error"
            );

        } else {

            mostrarMensagem(
                texto,
                "success"
            );
        }

    } catch (error) {

        console.error(
            "Erro ao salvar extensão:",
            error
        );

        // Limpar uploads somente quando nenhuma
        // gravação no banco tiver sido iniciada.

        if (!registroSalvo && !gravacaoIniciada) {

            for (const caminho of novosUploads) {

                await excluirArquivo(caminho);
            }
        }

        // Preservar arquivos quando o resultado
        // da gravação no banco for incerto.

        if (
            !registroSalvo &&
            gravacaoIniciada
        ) {

            mostrarMensagem(

                "Não foi possível confirmar a gravação. Atualize a página e verifique o registro antes de tentar novamente.",

                "error"
            );

        } else if (registroSalvo) {

            mostrarMensagem(

                "O registro foi salvo, mas ocorreu um problema na atualização do painel.",

                "error"
            );

        } else {

            mostrarMensagem(

                error.message ||
                "Não foi possível salvar a ação.",

                "error"
            );
        }

    } finally {

        bloquearFormulario(false);

        botaoSalvar.innerHTML =

            campos.id.value

                ? 'Atualizar ação <span>↗</span>'

                : 'Salvar ação <span>↗</span>';
    }

});

// ==========================================
// EDITAR EXTENSÃO
// ==========================================

async function editarExtensao(id) {

    if (!autorizado || operacaoEmAndamento) return;

    const item = extensoes.find(
        extensao => extensao.id === id
    );

    if (!item) return;

    campos.id.value = item.id;

    campos.titulo.value = item.titulo || "";

    campos.resumo.value = item.resumo || "";

    campos.descricao.value = item.descricao || "";

    campos.responsavel.value = item.responsavel || "";

    campos.status.value = item.status || "rascunho";

    campos.imagem.value = "";

    campos.arquivo.value = "";

    campos.removerImagem.checked = false;

    campos.removerArquivo.checked = false;

    mostrarArquivoAtual(item.arquivo_url);

    document.getElementById("form-title").textContent =
        "Editar ação de extensão.";

    document.getElementById("cancel-edit").hidden =
        false;

    botaoSalvar.innerHTML =
        'Atualizar ação <span>↗</span>';

    mostrarMensagem("");

    document.getElementById("form-section").scrollIntoView({

        behavior: "smooth"

    });

    await atualizarPreviewImagem();
}

// ==========================================
// EXCLUIR EXTENSÃO
// ==========================================

async function excluirExtensao(id) {

    if (!autorizado || operacaoEmAndamento) return;

    const item = extensoes.find(
        extensao => extensao.id === id
    );

    if (!item) return;

    const confirmar = confirm(

        `Deseja realmente excluir a ação "${item.titulo}"?`
    );

    if (!confirmar) return;

    bloquearFormulario(true);

    let registroExcluido = false;

    let falhaLimpeza = false;

    try {

        const { data, error } = await supabase
            .from("extensao")
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

        registroExcluido = true;

        // Excluir arquivos somente após confirmar
        // a exclusão do registro.

        if (item.imagem_url) {

            const excluido = await excluirArquivo(
                item.imagem_url
            );

            if (!excluido) {

                falhaLimpeza = true;
            }
        }

        if (item.arquivo_url) {

            const excluido = await excluirArquivo(
                item.arquivo_url
            );

            if (!excluido) {

                falhaLimpeza = true;
            }
        }

        if (campos.id.value === id) {

            limparFormulario();
        }

        const listaAtualizada =
            await carregarExtensoes();

        if (falhaLimpeza || !listaAtualizada) {

            mostrarMensagem(

                "A ação foi excluída, mas a limpeza dos arquivos ou a atualização da lista precisa ser verificada.",

                "error"
            );

        } else {

            mostrarMensagem(

                "Ação de extensão excluída com sucesso.",

                "success"
            );
        }

    } catch (error) {

        console.error(
            "Erro ao excluir extensão:",
            error
        );

        mostrarMensagem(

            registroExcluido

                ? "A ação foi excluída, mas ocorreu um problema na atualização do painel."

                : error.message ||
                  "Não foi possível confirmar a exclusão da ação.",

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

    form.reset();

    campos.id.value = "";

    campos.status.value = "rascunho";

    campos.removerImagem.checked = false;

    campos.removerArquivo.checked = false;

    limparPreview();

    mostrarArquivoAtual(null);

    document.getElementById("form-title").textContent =
        "Nova ação de extensão.";

    document.getElementById("cancel-edit").hidden =
        true;

    botaoSalvar.innerHTML =
        'Salvar ação <span>↗</span>';

    mostrarMensagem("");
}

// ==========================================
// FILTROS
// ==========================================

document.getElementById("search-extensao")

    .addEventListener(
        "input",
        renderizarExtensoes
    );

document.getElementById("filter-status")

    .addEventListener(
        "change",
        renderizarExtensoes
    );

// ==========================================
// CANCELAR EDIÇÃO
// ==========================================

document.getElementById("cancel-edit")

    .addEventListener("click", () => {

        if (!operacaoEmAndamento) {

            limparFormulario();
        }
    });

// ==========================================
// RESET DO FORMULÁRIO
// ==========================================

form.addEventListener("reset", event => {

    // Impedir reset manual durante uma operação.
    // A limpeza programática é concluída pela
    // função limparFormulario().

    limparPreview();

    if (!operacaoEmAndamento) {

        queueMicrotask(() => {

            campos.id.value = "";

            campos.status.value = "rascunho";

            campos.removerImagem.checked = false;

            campos.removerArquivo.checked = false;

            mostrarArquivoAtual(null);

            document.getElementById("form-title").textContent =
                "Nova ação de extensão.";

            document.getElementById("cancel-edit").hidden =
                true;

            botaoSalvar.innerHTML =
                'Salvar ação <span>↗</span>';

            mostrarMensagem("");
        });
    }
});

// ==========================================
// ENCERRAR SESSÃO
// ==========================================

document.getElementById("logout-button")

    .addEventListener("click", async () => {

        if (operacaoEmAndamento) {

            alert(
                "Aguarde a conclusão da operação atual."
            );

            return;
        }

        const botao = document.getElementById(
            "logout-button"
        );

        botao.disabled = true;

        try {

            const { error } = await supabase.auth.signOut();

            if (error) throw error;

            autorizado = false;

            limparPreview();

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

async function iniciarExtensao() {

    const acessoPermitido =
        await verificarAdministrador();

    if (!acessoPermitido) return;

    await carregarExtensoes();
}

iniciarExtensao();
import { supabase } from "./config.js";

import {
    obterCaminhoStorage,
    obterUrlAssinada
} from "../../js/storage.js";

// ==========================================
// LAEF — GERENCIAMENTO DE PESQUISA
// ==========================================

const BUCKET = "pesquisa";

const LIMITE_IMAGEM = 5 * 1024 * 1024;
const LIMITE_DOCUMENTO = 20 * 1024 * 1024;

const form = document.getElementById("pesquisa-form");

const lista = document.getElementById("pesquisa-list");

const mensagem = document.getElementById("form-message");

const botaoSalvar = document.getElementById("save-pesquisa");

const botaoCancelar = document.getElementById("cancel-edit");

const preview = document.getElementById("imagem-preview");

const areaPreview = document.getElementById("imagem-preview-area");

const areaArquivo = document.getElementById("arquivo-atual");

let pesquisas = [];

let autorizado = false;

let operacaoEmAndamento = false;

let imagemTemporaria = null;

let imagemAtual = null;

let arquivoAtual = null;

let versaoPreview = 0;

let resetInterno = false;

// ==========================================
// CAMPOS DO FORMULÁRIO
// ==========================================

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
// AUTENTICAÇÃO ADMINISTRATIVA
// ==========================================

async function verificarAdministrador() {

    const {
        data: { user },
        error: erroUsuario
    } = await supabase.auth.getUser();

    if (erroUsuario || !user) {

        window.location.replace("login.html");

        return false;
    }

    const { data: perfil, error } = await supabase

        .from("perfis")

        .select("nome, ativo, cargo")

        .eq("id", user.id)

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

    const nome =
        (perfil.nome || "Administrador").trim();

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
// NORMALIZAR TEXTO
// ==========================================

function normalizarTexto(valor) {

    return String(valor || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLocaleLowerCase("pt-BR")
        .trim();
}

// ==========================================
// BLOQUEAR FORMULÁRIO
// ==========================================

function bloquearFormulario(bloqueado) {

    operacaoEmAndamento = bloqueado;

    form.querySelectorAll(
        "input, select, textarea, button"
    ).forEach(elemento => {

        elemento.disabled = bloqueado;
    });

    botaoSalvar.disabled = bloqueado;

    botaoCancelar.disabled = bloqueado;

    lista.querySelectorAll("button").forEach(botao => {

        botao.disabled = bloqueado;
    });
}

// ==========================================
// CAMINHOS DOS ARQUIVOS
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

    if (!Object.hasOwn(
        formatosPermitidos,
        extensao
    )) {

        throw new Error(
            "Formato não permitido. Utilize JPEG, PNG ou WebP."
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

    if (arquivo.size > LIMITE_IMAGEM) {

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

    if (!Object.hasOwn(
        formatosPermitidos,
        extensao
    )) {

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

    if (arquivo.size > LIMITE_DOCUMENTO) {

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
// ENVIAR ARQUIVO PARA O STORAGE
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
    // Não armazenar URLs públicas ou assinadas.

    return caminho;
}

// ==========================================
// EXCLUIR ARQUIVO DO STORAGE
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

            "Erro ao excluir arquivo do Storage:",

            error
        );

        return false;
    }
}

// ==========================================
// LIBERAR IMAGEM TEMPORÁRIA
// ==========================================

function liberarImagemTemporaria() {

    if (imagemTemporaria) {

        URL.revokeObjectURL(imagemTemporaria);

        imagemTemporaria = null;
    }
}

// ==========================================
// OCULTAR PRÉ-VISUALIZAÇÃO
// ==========================================

function ocultarPreview() {

    preview.removeAttribute("src");

    preview.hidden = true;

    areaPreview.querySelector("span").hidden = false;
}

// ==========================================
// ATUALIZAR PRÉ-VISUALIZAÇÃO
// ==========================================

async function atualizarPreviewImagem() {

    const versao = ++versaoPreview;

    liberarImagemTemporaria();

    ocultarPreview();

    if (campos.removerImagem.checked) return;

    const arquivo = campos.imagem.files[0];

    let url = null;

    // ======================================
    // IMAGEM SELECIONADA LOCALMENTE
    // ======================================

    if (arquivo) {

        imagemTemporaria =
            URL.createObjectURL(arquivo);

        url = imagemTemporaria;

    // ======================================
    // IMAGEM CADASTRADA NO STORAGE
    // ======================================

    } else if (imagemAtual) {

        url = await obterUrlAssinada(

            BUCKET,

            imagemAtual
        );
    }

    // Impedir que uma consulta antiga
    // substitua a imagem de outra edição.

    if (versao !== versaoPreview || !url) {

        return;
    }

    preview.onerror = () => {

        if (versao !== versaoPreview) return;

        ocultarPreview();
    };

    preview.src = url;

    preview.hidden = false;

    areaPreview.querySelector("span").hidden = true;
}

// ==========================================
// SELECIONAR NOVA IMAGEM
// ==========================================

campos.imagem.addEventListener("change", async () => {

    if (!autorizado || operacaoEmAndamento) return;

    const arquivo = campos.imagem.files[0];

    try {

        if (arquivo) {

            validarImagem(arquivo);

            campos.removerImagem.checked = false;
        }

        mostrarMensagem("");

        await atualizarPreviewImagem();

    } catch (error) {

        campos.imagem.value = "";

        mostrarMensagem(

            error.message,

            "error"
        );

        await atualizarPreviewImagem();
    }
});

// ==========================================
// EXIBIR ARQUIVO ATUAL
// ==========================================

function mostrarArquivoAtual(valor) {

    areaArquivo.replaceChildren();

    if (campos.removerArquivo.checked) {

        areaArquivo.textContent =
            "O arquivo será removido ao salvar.";

        return;
    }

    const arquivoSelecionado =
        campos.arquivo.files[0];

    if (arquivoSelecionado) {

        areaArquivo.textContent =

            `Novo arquivo: ${arquivoSelecionado.name}`;

        return;
    }

    if (!valor) {

        areaArquivo.textContent =
            "Nenhum arquivo cadastrado.";

        return;
    }

    const caminho = obterCaminho(valor);

    if (!caminho) {

        areaArquivo.textContent =
            "Caminho do arquivo inválido.";

        return;
    }

    const link = document.createElement("a");

    link.href = "#";

    link.textContent =
        "Visualizar arquivo atual ↗";

    let carregando = false;

    link.addEventListener("click", async evento => {

        evento.preventDefault();

        if (
            !autorizado ||
            operacaoEmAndamento ||
            carregando
        ) return;

        carregando = true;

        link.setAttribute("aria-busy", "true");

        link.textContent = "Carregando arquivo...";

        let janela = null;

        try {

            janela = window.open(

                "about:blank",

                "_blank"
            );

            if (janela) {

                janela.opener = null;
            }

            const url = await obterUrlAssinada(

                BUCKET,

                valor
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

                "Erro ao acessar documento:",

                error
            );

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

    areaArquivo.appendChild(link);
}

// ==========================================
// SELECIONAR NOVO DOCUMENTO
// ==========================================

campos.arquivo.addEventListener("change", () => {

    if (!autorizado || operacaoEmAndamento) return;

    const arquivo = campos.arquivo.files[0];

    try {

        if (arquivo) {

            validarArquivo(arquivo);

            campos.removerArquivo.checked = false;
        }

        mostrarArquivoAtual(arquivoAtual);

        mostrarMensagem("");

    } catch (error) {

        campos.arquivo.value = "";

        mostrarArquivoAtual(arquivoAtual);

        mostrarMensagem(

            error.message,

            "error"
        );
    }
});

// ==========================================
// MARCAR REMOÇÃO DA IMAGEM
// ==========================================

campos.removerImagem.addEventListener("change", async () => {

    if (!autorizado || operacaoEmAndamento) return;

    if (campos.removerImagem.checked) {

        campos.imagem.value = "";
    }

    await atualizarPreviewImagem();
});

// ==========================================
// MARCAR REMOÇÃO DO DOCUMENTO
// ==========================================

campos.removerArquivo.addEventListener("change", () => {

    if (!autorizado || operacaoEmAndamento) return;

    if (campos.removerArquivo.checked) {

        campos.arquivo.value = "";
    }

    mostrarArquivoAtual(arquivoAtual);
});

// ==========================================
// INDICADORES
// ==========================================

function atualizarIndicadores() {

    const publicados = pesquisas.filter(

        item => item.status === "publicado"

    ).length;

    const rascunhos = pesquisas.filter(

        item => item.status === "rascunho"

    ).length;

    document.getElementById("total-pesquisa").textContent =
        pesquisas.length;

    document.getElementById("total-publicados").textContent =
        publicados;

    document.getElementById("total-rascunhos").textContent =
        rascunhos;
}

// ==========================================
// CARREGAR PESQUISAS
// ==========================================

async function carregarPesquisas() {

    const statusLista =
        document.getElementById("list-status");

    statusLista.textContent =
        "Carregando pesquisas...";

    try {

        const { data, error } = await supabase

            .from("pesquisa")

            .select("*")

            .order("created_at", {

                ascending: false

            });

        if (error) throw error;

        pesquisas = data || [];

        atualizarIndicadores();

        renderizarPesquisas();

        statusLista.textContent =
            "Dados atualizados";

        return true;

    } catch (error) {

        console.error(

            "Erro ao carregar pesquisas:",

            error
        );

        pesquisas = [];

        atualizarIndicadores();

        lista.replaceChildren();

        const linha = document.createElement("tr");

        const celula = document.createElement("td");

        celula.colSpan = 7;

        celula.textContent =
            "Não foi possível carregar as pesquisas.";

        linha.appendChild(celula);

        lista.appendChild(linha);

        statusLista.textContent =
            "Erro ao carregar pesquisas.";

        document.getElementById("list-count").textContent =
            "Dados indisponíveis";

        mostrarMensagem(

            "Não foi possível carregar as pesquisas. Verifique a conexão e as permissões.",

            "error"
        );

        return false;
    }
}

// ==========================================
// RENDERIZAR TABELA
// ==========================================

function renderizarPesquisas() {

    const termo = normalizarTexto(

        document.getElementById("search-pesquisa").value
    );

    const area = normalizarTexto(

        document.getElementById("filter-area").value
    );

    const status =

        document.getElementById("filter-status").value;

    const filtradas = pesquisas.filter(item => {

        const texto = normalizarTexto([

            item.titulo,

            item.resumo,

            item.responsavel,

            item.descricao,

            item.area

        ].filter(Boolean).join(" "));

        const correspondePesquisa =
            texto.includes(termo);

        const correspondeArea =

            !area ||

            normalizarTexto(item.area).includes(area);

        const correspondeStatus =

            !status ||

            item.status === status;

        return (

            correspondePesquisa &&

            correspondeArea &&

            correspondeStatus
        );
    });

    lista.replaceChildren();

    // ======================================
    // LISTA VAZIA
    // ======================================

    if (!filtradas.length) {

        const linha = document.createElement("tr");

        const celula = document.createElement("td");

        celula.colSpan = 7;

        celula.textContent =
            "Nenhuma pesquisa encontrada.";

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

            // ÁREA

            const areaCelula = document.createElement("td");

            areaCelula.textContent =
                item.area || "—";

            // IMAGEM

            const imagem = document.createElement("td");

            imagem.textContent =
                item.imagem_url ? "Sim" : "Não";

            // DOCUMENTO

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

            editar.disabled = operacaoEmAndamento;

            editar.addEventListener("click", () => {

                editarPesquisa(item.id);
            });

            // EXCLUIR

            const excluir = document.createElement("button");

            excluir.type = "button";

            excluir.className = "delete-button";

            excluir.textContent = "Excluir";

            excluir.disabled = operacaoEmAndamento;

            excluir.addEventListener("click", () => {

                excluirPesquisa(item.id);
            });

            grupo.append(

                editar,

                excluir
            );

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

            fragmento.appendChild(linha);
        });

        lista.appendChild(fragmento);
    }

    document.getElementById("list-count").textContent =

        `${filtradas.length} pesquisa(s) encontrada(s)`;
}

// ==========================================
// CADASTRAR E ATUALIZAR PESQUISA
// ==========================================

form.addEventListener("submit", async event => {

    event.preventDefault();

    if (!autorizado || operacaoEmAndamento) return;

    const id = campos.id.value;

    const anterior = pesquisas.find(

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

            status:
                campos.status.value,

            updated_at:
                new Date().toISOString()

        };

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

        const imagemSelecionada =
            campos.imagem.files[0];

        const arquivoSelecionado =
            campos.arquivo.files[0];

        // ==================================
        // VALIDAR ANTES DOS UPLOADS
        // ==================================

        if (
            imagemSelecionada &&
            !campos.removerImagem.checked
        ) {

            validarImagem(imagemSelecionada);
        }

        if (
            arquivoSelecionado &&
            !campos.removerArquivo.checked
        ) {

            validarArquivo(arquivoSelecionado);
        }

        // ==================================
        // IMAGEM
        // ==================================

        if (campos.removerImagem.checked) {

            dados.imagem_url = null;

        } else if (imagemSelecionada) {

            dados.imagem_url = await enviarArquivo(

                imagemSelecionada,

                "imagens"
            );

            novosUploads.push(dados.imagem_url);
        }

        // ==================================
        // DOCUMENTO
        // ==================================

        if (campos.removerArquivo.checked) {

            dados.arquivo_url = null;

        } else if (arquivoSelecionado) {

            dados.arquivo_url = await enviarArquivo(

                arquivoSelecionado,

                "documentos"
            );

            novosUploads.push(dados.arquivo_url);
        }

        // ==================================
        // SALVAR NO SUPABASE
        // ==================================

        gravacaoIniciada = true;

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

                const excluido =
                    await excluirArquivo(anterior.imagem_url);

                if (!excluido) {

                    falhaLimpeza = true;
                }
            }

            if (
                anterior.arquivo_url &&
                dados.arquivo_url !== undefined &&
                dados.arquivo_url !== anterior.arquivo_url
            ) {

                const excluido =
                    await excluirArquivo(anterior.arquivo_url);

                if (!excluido) {

                    falhaLimpeza = true;
                }
            }
        }

        // ==================================
        // FINALIZAR OPERAÇÃO
        // ==================================

        limparFormulario();

        const listaAtualizada =
            await carregarPesquisas();

        const texto = id

            ? "Pesquisa atualizada com sucesso!"

            : "Pesquisa cadastrada com sucesso!";

        if (falhaLimpeza || !listaAtualizada) {

            mostrarMensagem(

                texto +
                " Verifique a limpeza dos arquivos antigos e a atualização da lista.",

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

            "Erro ao salvar pesquisa:",

            error
        );

        // ==================================
        // LIMPEZA SEGURA DOS UPLOADS
        // ==================================

        // Remover arquivos novos somente quando
        // nenhuma gravação tiver sido iniciada.

        if (!registroSalvo && !gravacaoIniciada) {

            for (const caminho of novosUploads) {

                await excluirArquivo(caminho);
            }
        }

        // Se a gravação estiver incerta,
        // preservar os arquivos para conferência.

        if (!registroSalvo && gravacaoIniciada) {

            mostrarMensagem(

                "Não foi possível confirmar a gravação. Atualize a página e verifique a pesquisa antes de tentar novamente.",

                "error"
            );

        } else if (registroSalvo) {

            mostrarMensagem(

                "A pesquisa foi salva, mas ocorreu um problema na atualização do painel.",

                "error"
            );

        } else {

            mostrarMensagem(

                error.message ||

                "Não foi possível salvar a pesquisa.",

                "error"
            );
        }

    } finally {

        bloquearFormulario(false);

        botaoSalvar.innerHTML =

            campos.id.value

                ? 'Atualizar pesquisa <span>↗</span>'

                : 'Salvar pesquisa <span>↗</span>';
    }

});

// ==========================================
// EDITAR PESQUISA
// ==========================================

async function editarPesquisa(id) {

    if (!autorizado || operacaoEmAndamento) return;

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

    imagemAtual = item.imagem_url || null;

    arquivoAtual = item.arquivo_url || null;

    mostrarArquivoAtual(arquivoAtual);

    document.getElementById("form-title").textContent =

        "Editar pesquisa.";

    botaoCancelar.hidden = false;

    botaoSalvar.innerHTML =

        'Atualizar pesquisa <span>↗</span>';

    mostrarMensagem("");

    document.getElementById("form-section").scrollIntoView({

        behavior: "smooth"

    });

    // Carregar a imagem cadastrada
    // utilizando uma URL assinada.

    await atualizarPreviewImagem();
}

// ==========================================
// EXCLUIR PESQUISA
// ==========================================

async function excluirPesquisa(id) {

    if (!autorizado || operacaoEmAndamento) return;

    const item = pesquisas.find(

        pesquisa => pesquisa.id === id
    );

    if (!item) return;

    const confirmar = confirm(

        `Deseja realmente excluir a pesquisa "${item.titulo}"?`
    );

    if (!confirmar) return;

    bloquearFormulario(true);

    let registroExcluido = false;

    let falhaLimpeza = false;

    try {

        // ==================================
        // EXCLUIR REGISTRO
        // ==================================

        const { data, error } = await supabase

            .from("pesquisa")

            .delete()

            .eq("id", id)

            .select("id")

            .maybeSingle();

        if (error) throw error;

        if (!data) {

            throw new Error(
                "Não foi possível confirmar a exclusão."
            );
        }

        registroExcluido = true;

        // ==================================
        // REMOVER IMAGEM
        // ==================================

        if (item.imagem_url) {

            const excluido =
                await excluirArquivo(item.imagem_url);

            if (!excluido) {

                falhaLimpeza = true;
            }
        }

        // ==================================
        // REMOVER DOCUMENTO
        // ==================================

        if (item.arquivo_url) {

            const excluido =
                await excluirArquivo(item.arquivo_url);

            if (!excluido) {

                falhaLimpeza = true;
            }
        }

        // ==================================
        // LIMPAR EDIÇÃO ATUAL
        // ==================================

        if (campos.id.value === id) {

            limparFormulario();
        }

        const listaAtualizada =
            await carregarPesquisas();

        if (falhaLimpeza || !listaAtualizada) {

            mostrarMensagem(

                "A pesquisa foi excluída, mas a limpeza dos arquivos ou a atualização da lista precisa ser verificada.",

                "error"
            );

        } else {

            mostrarMensagem(

                "Pesquisa excluída com sucesso.",

                "success"
            );
        }

    } catch (error) {

        console.error(

            "Erro ao excluir pesquisa:",

            error
        );

        mostrarMensagem(

            registroExcluido

                ? "A pesquisa foi excluída, mas ocorreu um problema na atualização do painel."

                : error.message ||
                  "Não foi possível confirmar a exclusão da pesquisa.",

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

    ++versaoPreview;

    resetInterno = true;

    try {

        form.reset();

    } finally {

        resetInterno = false;
    }

    campos.id.value = "";

    campos.status.value = "rascunho";

    campos.removerImagem.checked = false;

    campos.removerArquivo.checked = false;

    imagemAtual = null;

    arquivoAtual = null;

    liberarImagemTemporaria();

    ocultarPreview();

    mostrarArquivoAtual(null);

    document.getElementById("form-title").textContent =

        "Nova pesquisa.";

    botaoCancelar.hidden = true;

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

botaoCancelar.addEventListener("click", evento => {

    evento.preventDefault();

    if (!autorizado || operacaoEmAndamento) return;

    limparFormulario();
});

// ==========================================
// RESET DO FORMULÁRIO
// ==========================================

form.addEventListener("reset", evento => {

    if (resetInterno) return;

    evento.preventDefault();

    if (!autorizado || operacaoEmAndamento) return;

    limparFormulario();
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

        const botao =
            document.getElementById("logout-button");

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

async function iniciarPesquisa() {

    bloquearFormulario(true);

    try {

        const acessoPermitido =
            await verificarAdministrador();

        if (!acessoPermitido) return;

        await carregarPesquisas();

    } catch (error) {

        console.error(

            "Erro ao inicializar o módulo de pesquisa:",

            error
        );

        mostrarMensagem(

            "Não foi possível inicializar o módulo de pesquisa.",

            "error"
        );

    } finally {

        if (autorizado) {

            bloquearFormulario(false);
        }
    }
}

iniciarPesquisa();
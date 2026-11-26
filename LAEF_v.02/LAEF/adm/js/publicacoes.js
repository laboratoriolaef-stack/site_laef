import { supabase } from "./config.js";

import {
    obterCaminhoStorage,
    obterUrlAssinada
} from "../../js/storage.js";

// ==========================================
// LAEF — GERENCIAMENTO DE PUBLICAÇÕES
// ==========================================

const BUCKET = "publicacoes";

const LIMITE_PDF = 20 * 1024 * 1024;

let publicacoes = [];

let arquivoAtual = null;

let removerArquivoAtual = false;

let autorizado = false;

let operacaoEmAndamento = false;

let resetInterno = false;

let erroListagem = false;

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

    const anoAtual = new Date().getFullYear();

    campoAno.min = "1900";

    campoAno.max = String(anoAtual);

    campoAno.step = "1";

    campoAno.addEventListener("input", validarAno);

    campoAno.addEventListener("change", validarAno);

    validarAno();
}

function validarAno() {

    const anoAtual = new Date().getFullYear();

    const valor = campoAno.value.trim();

    if (campoAno.validity.badInput) {

        campoAno.setCustomValidity(
            "Informe um ano válido."
        );

        return false;
    }

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

    elemento.className =
        `form-message ${tipo}`.trim();
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
// VALIDAR LINK EXTERNO
// ==========================================

function validarUrl(valor) {

    if (!valor) return null;

    try {

        const endereco = new URL(valor.trim());

        if (
            endereco.protocol === "https:" ||
            endereco.protocol === "http:"
        ) {

            return endereco.href;
        }

        return null;

    } catch {

        return null;
    }
}

// ==========================================
// BLOQUEAR OPERAÇÕES SIMULTÂNEAS
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

    botaoRemoverArquivo.disabled = bloqueado;

    lista.querySelectorAll("button").forEach(botao => {

        botao.disabled = bloqueado;
    });
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

    const {
        data: perfil,
        error: erroPerfil
    } = await supabase

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

        await supabase.auth.signOut();

        alert(
            "Você não possui autorização para acessar este módulo."
        );

        window.location.replace("login.html");

        return false;
    }

    const nome =
        (perfil.nome || "Administrador").trim();

    const nomeAdministrador =
        document.getElementById("admin-name");

    const inicialAdministrador =
        document.getElementById("admin-initial");

    if (nomeAdministrador) {

        nomeAdministrador.textContent = nome;
    }

    if (inicialAdministrador) {

        inicialAdministrador.textContent =
            nome.charAt(0).toUpperCase();
    }

    autorizado = true;

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

    return Object.hasOwn(categorias, categoria)

        ? categorias[categoria]

        : categoria || "Publicação";
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

    document.getElementById("total-publicacoes").textContent =
        total;

    document.getElementById("publicacoes-publicadas").textContent =
        publicados;

    document.getElementById("publicacoes-rascunhos").textContent =
        rascunhos;
}

// ==========================================
// CRIAR MENSAGEM NA TABELA
// ==========================================

function mostrarEstadoTabela(texto) {

    const linha = document.createElement("tr");

    const coluna = document.createElement("td");

    coluna.colSpan = 5;

    coluna.textContent = texto;

    linha.appendChild(coluna);

    lista.replaceChildren(linha);
}

// ==========================================
// CARREGAR PUBLICAÇÕES
// ==========================================

async function carregarPublicacoes() {

    if (!autorizado) return false;

    erroListagem = false;

    mostrarMensagem(mensagemListagem, "");

    mostrarEstadoTabela(
        "Carregando publicações..."
    );

    try {

        const { data, error } = await supabase

            .from("publicacoes")

            .select("*")

            .order("created_at", {

                ascending: false

            });

        if (error) throw error;

        publicacoes = data || [];

        atualizarIndicadores();

        renderizarPublicacoes();

        return true;

    } catch (error) {

        console.error(
            "Erro ao carregar publicações:",
            error
        );

        erroListagem = true;

        publicacoes = [];

        atualizarIndicadores();

        mostrarEstadoTabela(

            "Não foi possível carregar as publicações."
        );

        mostrarMensagem(

            mensagemListagem,

            error.message ||
            "Erro ao consultar o acervo.",

            "error"
        );

        return false;
    }
}

// ==========================================
// RENDERIZAR LISTAGEM
// ==========================================

function renderizarPublicacoes() {

    if (!autorizado || erroListagem) return;

    const busca = normalizarTexto(
        campoBusca.value
    );

    const categoria = filtroCategoria.value;

    const status = filtroStatus.value;

    const filtradas = publicacoes.filter(item => {

        const texto = normalizarTexto([

            item.titulo,

            item.autores,

            item.resumo,

            item.palavras_chave,

            item.doi,

            item.ano,

            formatarCategoria(item.categoria)

        ].filter(Boolean).join(" "));

        const correspondeBusca =
            texto.includes(busca);

        const correspondeCategoria =

            !categoria ||

            item.categoria === categoria;

        const correspondeStatus =

            !status ||

            item.status === status;

        return (

            correspondeBusca &&

            correspondeCategoria &&

            correspondeStatus
        );
    });

    lista.replaceChildren();

    if (filtradas.length === 0) {

        mostrarEstadoTabela(

            "Nenhuma publicação encontrada."
        );

        return;
    }

    const fragmento =
        document.createDocumentFragment();

    filtradas.forEach(item => {

        const linha = document.createElement("tr");

        // ==================================
        // TÍTULO E AUTORES
        // ==================================

        const colunaTitulo =
            document.createElement("td");

        const titulo =
            document.createElement("strong");

        titulo.textContent = item.titulo;

        const autores =
            document.createElement("small");

        autores.className = "publication-author";

        autores.textContent =

            item.autores || "Autor não informado";

        colunaTitulo.append(titulo, autores);

        // ==================================
        // CATEGORIA
        // ==================================

        const colunaCategoria =
            document.createElement("td");

        colunaCategoria.textContent =

            formatarCategoria(item.categoria);

        // ==================================
        // ANO
        // ==================================

        const colunaAno =
            document.createElement("td");

        colunaAno.textContent = item.ano ?? "—";

        // ==================================
        // STATUS
        // ==================================

        const colunaStatus =
            document.createElement("td");

        const etiqueta =
            document.createElement("span");

        const statusClasse =

            item.status === "publicado"

                ? "status-publicado"

                : "status-rascunho";

        etiqueta.className =

            `status-badge ${statusClasse}`;

        etiqueta.textContent = item.status;

        colunaStatus.appendChild(etiqueta);

        // ==================================
        // AÇÕES
        // ==================================

        const colunaAcoes =
            document.createElement("td");

        const acoes =
            document.createElement("div");

        acoes.className = "publication-actions";

        // BOTÃO EDITAR

        const editar =
            document.createElement("button");

        editar.type = "button";

        editar.className = "action-edit";

        editar.dataset.action = "editar";

        editar.dataset.id = item.id;

        editar.textContent = "Editar";

        editar.disabled = operacaoEmAndamento;

        // BOTÃO EXCLUIR

        const excluir =
            document.createElement("button");

        excluir.type = "button";

        excluir.className = "action-delete";

        excluir.dataset.action = "excluir";

        excluir.dataset.id = item.id;

        excluir.textContent = "Excluir";

        excluir.disabled = operacaoEmAndamento;

        acoes.append(editar, excluir);

        colunaAcoes.appendChild(acoes);

        linha.append(

            colunaTitulo,

            colunaCategoria,

            colunaAno,

            colunaStatus,

            colunaAcoes
        );

        fragmento.appendChild(linha);
    });

    lista.appendChild(fragmento);
}

// ==========================================
// VALIDAR ARQUIVO PDF
// ==========================================

function validarArquivo(arquivo) {

    if (!arquivo) return;

    if (
        arquivo.type !== "application/pdf" ||
        !arquivo.name.toLowerCase().endsWith(".pdf")
    ) {

        throw new Error(

            "Selecione um arquivo PDF válido."
        );
    }

    if (arquivo.size === 0) {

        throw new Error(

            "O arquivo PDF está vazio."
        );
    }

    if (arquivo.size > LIMITE_PDF) {

        throw new Error(

            "O arquivo ultrapassa o limite de 20 MB."
        );
    }
}

// ==========================================
// UPLOAD DO PDF
// ==========================================

async function enviarArquivo(arquivo) {

    if (!arquivo) return null;

    validarArquivo(arquivo);

    const nomeSeguro = arquivo.name

        .normalize("NFD")

        .replace(/[\u0300-\u036f]/g, "")

        .replace(/[^a-zA-Z0-9._-]/g, "_");

    const caminho =

        `${crypto.randomUUID()}-${nomeSeguro}`;

    const { error } = await supabase.storage

        .from(BUCKET)

        .upload(caminho, arquivo, {

            contentType: "application/pdf",

            cacheControl: "300",

            upsert: false

        });

    if (error) throw error;

    // Armazenar somente o caminho relativo.
    // Nunca armazenar uma URL assinada.

    return caminho;
}

// ==========================================
// REMOVER ARQUIVO DO STORAGE
// ==========================================

async function excluirArquivoStorage(valor) {

    const caminho = obterCaminhoStorage(

        BUCKET,

        valor
    );

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
// ABRIR PDF COM URL ASSINADA
// ==========================================

async function visualizarArquivo(valor) {

    if (!autorizado || operacaoEmAndamento) return;

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

                "Não foi possível acessar o PDF."
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

            "Erro ao visualizar PDF:",

            error
        );

        mostrarMensagem(

            mensagemFormulario,

            error.message ||

            "Não foi possível visualizar o arquivo.",

            "error"
        );
    }
}

// ==========================================
// INFORMAÇÕES DO ARQUIVO
// ==========================================

function atualizarInformacaoArquivo() {

    const area =
        document.getElementById("arquivo-atual-info");

    const nome =
        document.getElementById("arquivo-nome");

    if (!area || !nome) return;

    nome.replaceChildren();

    botaoRemoverArquivo.hidden = true;

    // ======================================
    // ARQUIVO SELECIONADO LOCALMENTE
    // ======================================

    const selecionado = campoArquivo.files[0];

    if (selecionado) {

        nome.textContent =

            `Novo PDF: ${selecionado.name}`;

        area.hidden = false;

        return;
    }

    // ======================================
    // ARQUIVO MARCADO PARA REMOÇÃO
    // ======================================

    if (removerArquivoAtual) {

        nome.textContent =

            "O PDF será removido ao salvar.";

        area.hidden = false;

        return;
    }

    // ======================================
    // NENHUM ARQUIVO CADASTRADO
    // ======================================

    if (!arquivoAtual) {

        area.hidden = true;

        return;
    }

    area.hidden = false;

    botaoRemoverArquivo.hidden = false;

    const caminho = obterCaminhoStorage(

        BUCKET,

        arquivoAtual
    );

    if (!caminho) {

        nome.textContent =

            "PDF cadastrado com caminho inválido.";

        return;
    }

    // ======================================
    // LINK PARA VISUALIZAR PDF
    // ======================================

    const link = document.createElement("a");

    link.href = "#";

    link.textContent = "Visualizar PDF cadastrado ↗";

    let carregando = false;

    const valor = arquivoAtual;

    link.addEventListener("click", async evento => {

        evento.preventDefault();

        if (
            !autorizado ||
            operacaoEmAndamento ||
            carregando
        ) return;

        carregando = true;

        link.setAttribute("aria-busy", "true");

        link.textContent = "Carregando PDF...";

        try {

            await visualizarArquivo(valor);

        } finally {

            carregando = false;

            link.removeAttribute("aria-busy");

            link.textContent =

                "Visualizar PDF cadastrado ↗";
        }

    });

    nome.appendChild(link);
}

// ==========================================
// SELECIONAR NOVO PDF
// ==========================================

campoArquivo.addEventListener("change", () => {

    if (!autorizado || operacaoEmAndamento) return;

    const arquivo = campoArquivo.files[0];

    try {

        if (arquivo) {

            validarArquivo(arquivo);

            removerArquivoAtual = false;
        }

        atualizarInformacaoArquivo();

        mostrarMensagem(mensagemFormulario, "");

    } catch (error) {

        campoArquivo.value = "";

        atualizarInformacaoArquivo();

        mostrarMensagem(

            mensagemFormulario,

            error.message,

            "error"
        );
    }
});

// ==========================================
// MARCAR REMOÇÃO DO PDF
// ==========================================

function marcarRemocaoArquivo(evento) {

    evento?.preventDefault();

    if (
        !autorizado ||
        operacaoEmAndamento ||
        !arquivoAtual
    ) return;

    const confirmar = confirm(

        "Deseja remover o PDF desta publicação?"
    );

    if (!confirmar) return;

    campoArquivo.value = "";

    removerArquivoAtual = true;

    atualizarInformacaoArquivo();

    mostrarMensagem(

        mensagemFormulario,

        "O arquivo será removido quando você salvar as alterações.",

        "success"
    );
}

// ==========================================
// SALVAR PUBLICAÇÃO
// ==========================================

async function salvarPublicacao(evento) {

    evento.preventDefault();

    if (!autorizado || operacaoEmAndamento) return;

    mostrarMensagem(mensagemFormulario, "");

    // ======================================
    // VALIDAR ANO
    // ======================================

    if (!validarAno()) {

        mostrarMensagem(

            mensagemFormulario,

            `Informe um ano entre 1900 e ${new Date().getFullYear()}.`,

            "error"
        );

        campoAno.reportValidity();

        campoAno.focus();

        return;
    }

    const id = campoId.value;

    const registroAntigo = publicacoes.find(

        item => item.id === id
    );

    bloquearFormulario(true);

    botaoSalvar.textContent = "Salvando...";

    let novoArquivo = null;

    let registroSalvo = false;

    let gravacaoIniciada = false;

    let falhaLimpeza = false;

    try {

        const arquivoSelecionado =
            campoArquivo.files[0];

        const dados = {

            titulo:
                campoTitulo.value.trim(),

            autores:
                campoAutores.value.trim() || null,

            categoria:
                campoCategoria.value,

            ano:
                campoAno.value
                    ? Number(campoAno.value)
                    : null,

            resumo:
                campoResumo.value.trim() || null,

            palavras_chave:
                campoPalavras.value.trim() || null,

            doi:
                campoDoi.value.trim() || null,

            link_externo:
                campoLink.value.trim() || null,

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

                "Informe o título da publicação."
            );
        }

        // ==================================
        // VALIDAR CATEGORIA
        // ==================================

        const categoriasPermitidas = [

            "artigo",

            "evento",

            "tcc",

            "livro",

            "outros"

        ];

        if (!categoriasPermitidas.includes(

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
        // VALIDAR ANO NOVAMENTE
        // ==================================

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

                `Informe um ano entre 1900 e ${anoAtual}.`
            );
        }

        // ==================================
        // VALIDAR LINK EXTERNO
        // ==================================

        if (dados.link_externo) {

            const endereco =
                validarUrl(dados.link_externo);

            if (!endereco) {

                throw new Error(

                    "Informe um endereço HTTP ou HTTPS válido."
                );
            }

            dados.link_externo = endereco;
        }

        // ==================================
        // VALIDAR E NORMALIZAR DOI
        // ==================================

        if (dados.doi) {

            const doi = dados.doi

                .replace(/^doi:\s*/i, "")

                .replace(
                    /^https?:\/\/(dx\.)?doi\.org\//i,
                    ""
                )

                .trim();

            if (!/^10\.\d{4,}\/\S+$/i.test(doi)) {

                throw new Error(

                    "Informe um DOI válido."
                );
            }

            dados.doi = doi;
        }

        // ==================================
        // ENVIAR NOVO PDF
        // ==================================

        if (arquivoSelecionado) {

            validarArquivo(arquivoSelecionado);

            novoArquivo = await enviarArquivo(

                arquivoSelecionado
            );

            dados.arquivo_url = novoArquivo;

        } else if (id && removerArquivoAtual) {

            dados.arquivo_url = null;

        } else if (!id) {

            dados.arquivo_url = null;
        }

        // ==================================
        // SALVAR NO BANCO DE DADOS
        // ==================================

        gravacaoIniciada = true;

        let resultado;

        if (id) {

            resultado = await supabase

                .from("publicacoes")

                .update(dados)

                .eq("id", id)

                .select("id")

                .maybeSingle();

        } else {

            resultado = await supabase

                .from("publicacoes")

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
        // EXCLUIR PDF ANTIGO
        // ==================================

        if (

            registroAntigo?.arquivo_url &&

            dados.arquivo_url !== undefined &&

            dados.arquivo_url !== registroAntigo.arquivo_url

        ) {

            const excluido = await excluirArquivoStorage(

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
            await carregarPublicacoes();

        const texto = id

            ? "Publicação atualizada com sucesso!"

            : "Publicação cadastrada com sucesso!";

        if (falhaLimpeza || !listaAtualizada) {

            mostrarMensagem(

                mensagemFormulario,

                texto +
                " Verifique a limpeza dos arquivos antigos e a atualização da lista.",

                "error"
            );

        } else {

            mostrarMensagem(

                mensagemFormulario,

                texto,

                "success"
            );
        }

    } catch (error) {

        console.error(

            "Erro ao salvar publicação:",

            error
        );

        // ==================================
        // LIMPEZA SEGURA DO NOVO PDF
        // ==================================

        if (
            !registroSalvo &&
            !gravacaoIniciada &&
            novoArquivo
        ) {

            await excluirArquivoStorage(novoArquivo);
        }

        // Preservar arquivos quando não for
        // possível confirmar a gravação.

        if (!registroSalvo && gravacaoIniciada) {

            mostrarMensagem(

                mensagemFormulario,

                "Não foi possível confirmar a gravação. Atualize a página e verifique a publicação antes de tentar novamente.",

                "error"
            );

        } else if (registroSalvo) {

            mostrarMensagem(

                mensagemFormulario,

                "A publicação foi salva, mas ocorreu um problema na atualização do painel.",

                "error"
            );

        } else {

            mostrarMensagem(

                mensagemFormulario,

                error.message ||

                "Não foi possível salvar a publicação.",

                "error"
            );
        }

    } finally {

        bloquearFormulario(false);

        botaoSalvar.textContent =

            campoId.value

                ? "Atualizar publicação"

                : "Salvar publicação";
    }
}

// ==========================================
// EDITAR PUBLICAÇÃO
// ==========================================

function editarPublicacao(id) {

    if (!autorizado || operacaoEmAndamento) return;

    const item = publicacoes.find(

        publicacao => publicacao.id === id
    );

    if (!item) return;

    campoId.value = item.id;

    campoTitulo.value = item.titulo || "";

    campoAutores.value = item.autores || "";

    campoCategoria.value = item.categoria || "";

    campoAno.value = item.ano ?? "";

    campoResumo.value = item.resumo || "";

    campoPalavras.value = item.palavras_chave || "";

    campoDoi.value = item.doi || "";

    campoLink.value = item.link_externo || "";

    campoStatus.value = item.status || "rascunho";

    // Limpar arquivo selecionado anteriormente.

    campoArquivo.value = "";

    validarAno();

    arquivoAtual = item.arquivo_url || null;

    removerArquivoAtual = false;

    atualizarInformacaoArquivo();

    document.getElementById("formulario-titulo").textContent =

        "Editar publicação";

    botaoSalvar.textContent =

        "Atualizar publicação";

    botaoCancelar.hidden = false;

    mostrarMensagem(mensagemFormulario, "");

    document.getElementById("formulario-section").scrollIntoView({

        behavior: "smooth"

    });
}

// ==========================================
// EXCLUIR PUBLICAÇÃO
// ==========================================

async function excluirPublicacao(id) {

    if (!autorizado || operacaoEmAndamento) return;

    const item = publicacoes.find(

        publicacao => publicacao.id === id
    );

    if (!item) return;

    const confirmar = confirm(

        `Deseja realmente excluir a publicação "${item.titulo}"?`
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

            .from("publicacoes")

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
        // EXCLUIR PDF VINCULADO
        // ==================================

        if (item.arquivo_url) {

            const excluido = await excluirArquivoStorage(

                item.arquivo_url
            );

            if (!excluido) {

                falhaLimpeza = true;
            }
        }

        // ==================================
        // LIMPAR EDIÇÃO ATUAL
        // ==================================

        if (campoId.value === id) {

            limparFormulario();
        }

        const listaAtualizada =
            await carregarPublicacoes();

        if (falhaLimpeza || !listaAtualizada) {

            mostrarMensagem(

                mensagemListagem,

                "A publicação foi excluída, mas a limpeza do PDF ou a atualização da lista precisa ser verificada.",

                "error"
            );

        } else {

            mostrarMensagem(

                mensagemListagem,

                "Publicação excluída com sucesso.",

                "success"
            );
        }

    } catch (error) {

        console.error(

            "Erro ao excluir publicação:",

            error
        );

        mostrarMensagem(

            mensagemListagem,

            registroExcluido

                ? "A publicação foi excluída, mas ocorreu um problema na atualização do painel."

                : error.message ||
                  "Não foi possível confirmar a exclusão.",

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

    resetInterno = true;

    try {

        formulario.reset();

    } finally {

        resetInterno = false;
    }

    campoId.value = "";

    campoArquivo.value = "";

    campoStatus.value = "rascunho";

    arquivoAtual = null;

    removerArquivoAtual = false;

    validarAno();

    atualizarInformacaoArquivo();

    document.getElementById("formulario-titulo").textContent =

        "Cadastrar publicação";

    botaoSalvar.textContent =

        "Salvar publicação";

    botaoCancelar.hidden = true;

    mostrarMensagem(mensagemFormulario, "");
}

// ==========================================
// CANCELAR EDIÇÃO
// ==========================================

function cancelarEdicao(evento) {

    evento?.preventDefault();

    if (!autorizado || operacaoEmAndamento) return;

    limparFormulario();
}

// ==========================================
// RESET DO FORMULÁRIO
// ==========================================

formulario.addEventListener("reset", evento => {

    if (resetInterno) return;

    evento.preventDefault();

    if (!autorizado || operacaoEmAndamento) return;

    limparFormulario();
});

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

    if (!id) return;

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

campoBusca.addEventListener(

    "input",

    renderizarPublicacoes
);

filtroCategoria.addEventListener(

    "change",

    renderizarPublicacoes
);

filtroStatus.addEventListener(

    "change",

    renderizarPublicacoes
);

// ==========================================
// EVENTOS DO FORMULÁRIO
// ==========================================

formulario.addEventListener(

    "submit",

    salvarPublicacao
);

botaoCancelar.addEventListener(

    "click",

    cancelarEdicao
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

async function inicializar() {

    bloquearFormulario(true);

    try {

        const acessoPermitido =
            await verificarAdministrador();

        if (!acessoPermitido) return;

        configurarLimiteAno();

        atualizarInformacaoArquivo();

        await carregarPublicacoes();

    } catch (error) {

        console.error(

            "Erro ao inicializar publicações:",

            error
        );

        mostrarMensagem(

            mensagemFormulario,

            "Não foi possível inicializar o módulo de publicações.",

            "error"
        );

    } finally {

        if (autorizado) {

            bloquearFormulario(false);
        }
    }
}

inicializar();
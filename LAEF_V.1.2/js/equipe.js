import { supabase } from "../adm/js/config.js";

import {
    obterCaminhoStorage,
    obterUrlAssinada
} from "./storage.js";

// ==========================================
// LAEF — EQUIPE PÚBLICA
// Integração com Supabase
// ==========================================

const BUCKET = "equipe";

const categorias = {

    professor: {
        elemento: "professores-lista",
        numero: "01",
        vazio: "Os professores e coordenadores serão apresentados aqui."
    },

    pesquisador: {
        elemento: "pesquisadores-lista",
        numero: "02",
        vazio: "Os pesquisadores serão apresentados aqui."
    },

    estudante: {
        elemento: "estudantes-lista",
        numero: "03",
        vazio: "Os estudantes serão apresentados aqui."
    },

    colaborador: {
        elemento: "colaboradores-lista",
        numero: "04",
        vazio: "Os colaboradores serão apresentados aqui."
    }
};

// ==========================================
// VALIDAR URL EXTERNA
// ==========================================

function validarUrlExterna(valor) {

    if (typeof valor !== "string") return null;

    try {

        const url = new URL(valor.trim());

        if (
            url.protocol !== "https:" &&
            url.protocol !== "http:"
        ) {

            return null;
        }

        return url.href;

    } catch {

        return null;
    }
}

// ==========================================
// CRIAR ESTADO VAZIO
// ==========================================

function criarEstado(
    texto,
    classe = "team-empty",
    numero = ""
) {

    const elemento = document.createElement("div");

    elemento.className = classe;

    const identificador = document.createElement("span");

    identificador.textContent = numero;

    const mensagem = document.createElement("p");

    mensagem.textContent = texto;

    elemento.append(identificador, mensagem);

    return elemento;
}

// ==========================================
// PLACEHOLDER DA FOTO
// ==========================================

function criarPlaceholder(nome) {

    const placeholder = document.createElement("div");

    placeholder.className = "team-card-placeholder";

    placeholder.textContent =
        String(nome || "")
            .trim()
            .charAt(0)
            .toUpperCase() || "?";

    return placeholder;
}

// ==========================================
// CRIAR CARTÃO DO INTEGRANTE
// ==========================================

function criarCartao(integrante) {

    const card = document.createElement("article");

    card.className = "team-card";

    // ======================================
    // IMAGEM
    // ======================================

    const areaImagem = document.createElement("div");

    areaImagem.className = "team-card-image";

    // Exibir placeholder inicialmente

    areaImagem.appendChild(
        criarPlaceholder(integrante.nome)
    );

    const caminhoFoto = obterCaminhoStorage(
        BUCKET,
        integrante.foto_url
    );

    if (caminhoFoto) {

        obterUrlAssinada(BUCKET, caminhoFoto)
            .then(url => {

                if (!url) return;

                const imagem = document.createElement("img");

                imagem.alt = `Foto de ${integrante.nome}`;

                imagem.decoding = "async";

                imagem.onload = () => {

                    areaImagem.replaceChildren(imagem);
                };

                imagem.onerror = () => {

                    areaImagem.replaceChildren(
                        criarPlaceholder(integrante.nome)
                    );
                };

                imagem.src = url;

            })
            .catch(error => {

                console.error(
                    "Erro ao carregar fotografia:",
                    error
                );
            });
    }

    // ======================================
    // INFORMAÇÕES
    // ======================================

    const informacoes = document.createElement("div");

    informacoes.className = "team-card-info";

    const funcao = document.createElement("span");

    funcao.textContent =
        integrante.funcao || integrante.categoria || "";

    const nome = document.createElement("h3");

    nome.textContent = integrante.nome;

    informacoes.append(funcao, nome);

    // ======================================
    // FORMAÇÃO
    // ======================================

    if (integrante.formacao) {

        const formacao = document.createElement("p");

        formacao.textContent = integrante.formacao;

        informacoes.appendChild(formacao);
    }

    // ======================================
    // DESCRIÇÃO
    // ======================================

    if (integrante.descricao) {

        const descricao = document.createElement("p");

        descricao.className = "team-description";

        descricao.textContent = integrante.descricao;

        informacoes.appendChild(descricao);
    }

    // ======================================
    // CURRÍCULO LATTES
    // ======================================

    const lattesUrl = validarUrlExterna(
        integrante.lattes_url
    );

    if (lattesUrl) {

        const link = document.createElement("a");

        link.className = "team-card-link";

        link.href = lattesUrl;

        link.target = "_blank";

        link.rel = "noopener noreferrer";

        link.textContent = "Currículo Lattes ↗";

        informacoes.appendChild(link);
    }

    // ======================================
    // E-MAIL
    // ======================================

    const enderecoEmail = String(
        integrante.email || ""
    ).trim();

    const emailValido =
        /^[^\s@?&#%]+@[^\s@?&#%]+\.[^\s@?&#%]+$/
            .test(enderecoEmail);

    if (emailValido) {

        const email = document.createElement("a");

        email.className = "team-card-link";

        email.href = `mailto:${enderecoEmail}`;

        email.textContent = "Entrar em contato";

        informacoes.appendChild(email);
    }

    card.append(areaImagem, informacoes);

    return card;
}

// ==========================================
// CARREGAR INTEGRANTES
// ==========================================

async function carregarEquipe() {

    const listas = {};

    Object.entries(categorias).forEach(
        ([categoria, dados]) => {

            const elemento = document.getElementById(
                dados.elemento
            );

            if (!elemento) return;

            listas[categoria] = elemento;

            elemento.replaceChildren(

                criarEstado(
                    "Carregando integrantes...",
                    "team-loading"
                )
            );
        }
    );

    try {

        const { data, error } = await supabase
            .from("equipe")
            .select(`
                id,
                nome,
                categoria,
                funcao,
                formacao,
                descricao,
                foto_url,
                lattes_url,
                email,
                ordem
            `)
            .eq("status", "publicado")
            .order("ordem", {
                ascending: true
            })
            .order("nome", {
                ascending: true
            });

        if (error) throw error;

        const registros = data || [];

        // ==================================
        // LIMPAR CARREGAMENTO
        // ==================================

        Object.values(listas).forEach(lista => {

            lista.replaceChildren();
        });

        // ==================================
        // DISTRIBUIR POR CATEGORIA
        // ==================================

        Object.entries(categorias).forEach(
            ([categoria, dados]) => {

                const lista = listas[categoria];

                if (!lista) return;

                const integrantes = registros.filter(
                    integrante =>
                        integrante.categoria === categoria
                );

                if (integrantes.length === 0) {

                    lista.appendChild(

                        criarEstado(
                            dados.vazio,
                            "team-empty",
                            dados.numero
                        )
                    );

                    return;
                }

                const fragmento =
                    document.createDocumentFragment();

                integrantes.forEach(integrante => {

                    fragmento.appendChild(
                        criarCartao(integrante)
                    );
                });

                lista.appendChild(fragmento);
            }
        );

        console.log(
            `${registros.length} integrante(s) carregado(s) do Supabase.`
        );

    } catch (error) {

        console.error(
            "Erro ao carregar equipe:",
            error
        );

        Object.values(listas).forEach(lista => {

            lista.replaceChildren(

                criarEstado(
                    "Não foi possível carregar os integrantes. Tente novamente mais tarde.",
                    "team-error"
                )
            );
        });
    }
}

// ==========================================
// INICIALIZAÇÃO
// ==========================================

carregarEquipe();
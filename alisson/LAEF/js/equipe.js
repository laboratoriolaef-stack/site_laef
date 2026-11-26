
import { supabase } from "../adm/js/config.js";

// ==========================================
// LAEF — EQUIPE PÚBLICA
// Integração com Supabase
// ==========================================

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
// GERAR URL PÚBLICA DA FOTOGRAFIA
// ==========================================

function obterUrlFoto(fotoUrl) {

    if (!fotoUrl) return null;

    // Se já for uma URL completa, utiliza diretamente
    if (fotoUrl.startsWith("http://") ||
        fotoUrl.startsWith("https://")) {
        return fotoUrl;
    }

    // Remove eventual identificação do bucket no caminho
    const caminho = fotoUrl.replace(/^equipe\//, "");

    const { data } = supabase
        .storage
        .from("equipe")
        .getPublicUrl(caminho);

    return data.publicUrl;
}


// ==========================================
// CRIAR ESTADO VAZIO
// ==========================================

function criarEstado(texto, classe = "team-empty", numero = "") {

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
// CRIAR CARTÃO DO INTEGRANTE
// ==========================================

function criarCartao(integrante) {

    const card = document.createElement("article");
    card.className = "team-card";

    // IMAGEM
    const areaImagem = document.createElement("div");
    areaImagem.className = "team-card-image";

    if (integrante.foto_url) {

        const imagem = document.createElement("img");

        imagem.src = obterUrlFoto(integrante.foto_url);
        imagem.alt = `Foto de ${integrante.nome}`;
        imagem.loading = "lazy";

        imagem.onerror = () => {

            areaImagem.replaceChildren(
                criarPlaceholder(integrante.nome)
            );

        };

        areaImagem.appendChild(imagem);

    } else {

        areaImagem.appendChild(
            criarPlaceholder(integrante.nome)
        );

    }

    // INFORMAÇÕES
    const informacoes = document.createElement("div");
    informacoes.className = "team-card-info";

    const funcao = document.createElement("span");
    funcao.textContent = integrante.funcao || integrante.categoria;

    const nome = document.createElement("h3");
    nome.textContent = integrante.nome;

    informacoes.append(funcao, nome);

    // FORMAÇÃO
    if (integrante.formacao) {

        const formacao = document.createElement("p");
        formacao.textContent = integrante.formacao;

        informacoes.appendChild(formacao);
    }

    // DESCRIÇÃO
    if (integrante.descricao) {

        const descricao = document.createElement("p");
        descricao.className = "team-description";
        descricao.textContent = integrante.descricao;

        informacoes.appendChild(descricao);
    }

    // CURRÍCULO LATTES
    if (integrante.lattes_url) {

        const link = document.createElement("a");

        link.className = "team-card-link";
        link.href = integrante.lattes_url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = "Currículo Lattes ↗";

        informacoes.appendChild(link);
    }

    // E-MAIL
    if (integrante.email) {

        const email = document.createElement("a");

        email.className = "team-card-link";
        email.href = `mailto:${integrante.email}`;
        email.textContent = "Entrar em contato";

        informacoes.appendChild(email);
    }

    card.append(areaImagem, informacoes);

    return card;
}


// ==========================================
// PLACEHOLDER DA FOTO
// ==========================================

function criarPlaceholder(nome) {

    const placeholder = document.createElement("div");

    placeholder.className = "team-card-placeholder";

    placeholder.textContent = nome
        .trim()
        .charAt(0)
        .toUpperCase();

    return placeholder;
}


// ==========================================
// CARREGAR INTEGRANTES
// ==========================================

async function carregarEquipe() {

    const listas = {};

    Object.entries(categorias).forEach(([categoria, dados]) => {

        const elemento = document.getElementById(dados.elemento);

        if (!elemento) return;

        listas[categoria] = elemento;

        elemento.replaceChildren(
            criarEstado("Carregando integrantes...", "team-loading")
        );

    });

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
            .order("ordem", { ascending: true })
            .order("nome", { ascending: true });

        if (error) throw error;

        // LIMPAR CARREGAMENTO
        Object.values(listas).forEach(lista => {
            lista.replaceChildren();
        });

        // DISTRIBUIR INTEGRANTES POR CATEGORIA
        Object.entries(categorias).forEach(([categoria, dados]) => {

            const lista = listas[categoria];

            if (!lista) return;

            const integrantes = data.filter(
                integrante => integrante.categoria === categoria
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

            integrantes.forEach(integrante => {

                lista.appendChild(
                    criarCartao(integrante)
                );

            });

        });

        console.log(
            `${data.length} integrante(s) carregado(s) do Supabase.`
        );

    } catch (error) {

        console.error("Erro ao carregar equipe:", error);

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

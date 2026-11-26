
import { supabase } from "./config.js";

// ======================================
// PROTEÇÃO DO DASHBOARD
// ======================================

async function iniciarDashboard() {

    const status = document.getElementById("dashboard-status");

    try {

        // Verificar sessão

        const {
            data: { session },
            error: sessionError
        } = await supabase.auth.getSession();

        if (sessionError || !session) {
            window.location.replace("login.html");
            return;
        }

        // Consultar perfil do usuário

        const { data: perfil, error: perfilError } =
            await supabase
                .from("perfis")
                .select("nome, ativo, cargo")
                .eq("id", session.user.id)
                .maybeSingle();

        // Verificar autorização administrativa

        if (
            perfilError ||
            !perfil ||
            !perfil.ativo ||
            perfil.cargo !== "Administrador"
        ) {

            await supabase.auth.signOut();

            window.location.replace("login.html");
            return;
        }

        // Identificação do administrador

        const nomeAdmin = perfil.nome.trim();

        document.getElementById("admin-name").textContent =
            nomeAdmin;

        document.getElementById("admin-initial").textContent =
            nomeAdmin.charAt(0).toUpperCase();

        // Carregar indicadores

        await carregarIndicadores(status);

    } catch (error) {

        console.error("Erro ao iniciar dashboard:", error);

        status.textContent = "Erro ao verificar acesso.";

    }
}


// ======================================
// CONTAR CONTEÚDOS
// ======================================

async function contarTabela(tabela) {

    const { count, error } = await supabase
        .from(tabela)
        .select("*", {
            count: "exact",
            head: true
        });

    if (error) {

        console.error(`Erro em ${tabela}:`, error);

        return "—";
    }

    return count ?? 0;
}


// ======================================
// ATUALIZAR INDICADORES
// ======================================

async function carregarIndicadores(status) {

    // Tabelas do Supabase

    const tabelas = [
        "equipe",
        "ensino",
        "pesquisa",
        "extensao",
        "publicacoes",
        "materiais",
        "destaques"
    ];

    // Identificadores dos elementos HTML

    const elementos = [
        "count-equipe",
        "count-ensino",
        "count-pesquisa",
        "count-extensao",
        "count-publicacoes",
        "count-materiais",
        "count-destaques"
    ];

    try {

        // Consultar todas as tabelas

        const resultados = await Promise.all(
            tabelas.map(tabela => contarTabela(tabela))
        );

        // Atualizar os indicadores na página

        resultados.forEach((valor, indice) => {

            const elemento = document.getElementById(
                elementos[indice]
            );

            if (elemento) {
                elemento.textContent = valor;
            }

        });

        // Verificar se alguma consulta falhou

        const houveErro = resultados.includes("—");

        status.textContent = houveErro
            ? "Alguns dados não puderam ser carregados"
            : "Dados atualizados";

    } catch (error) {

        console.error("Erro nos indicadores:", error);

        status.textContent = "Erro ao carregar indicadores";

    }
}


// ======================================
// ENCERRAR SESSÃO
// ======================================

document
    .getElementById("logout-button")
    .addEventListener("click", async () => {

        const botao = document.getElementById("logout-button");

        botao.disabled = true;

        try {

            const { error } = await supabase.auth.signOut();

            if (error) {
                throw error;
            }

            window.location.replace("login.html");

        } catch (error) {

            console.error("Erro ao sair:", error);

            alert("Não foi possível encerrar a sessão.");

            botao.disabled = false;

        }

    });


// ======================================
// INICIAR DASHBOARD
// ======================================

iniciarDashboard();

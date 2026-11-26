
import { supabase } from "./config.js";

const form = document.getElementById("login-form");
const mensagem = document.getElementById("login-message");
const botao = document.getElementById("login-button");

// ======================================
// VERIFICAR AUTORIZAÇÃO ADMINISTRATIVA
// ======================================

async function verificarPerfil(userId) {

    const { data: perfil, error } = await supabase
        .from("perfis")
        .select("id, nome, ativo")
        .eq("id", userId)
        .maybeSingle();

    console.log("Perfil encontrado:", perfil);
    console.log("Erro na consulta:", error);

    if (error) {
        throw error;
    }

    if (!perfil || !perfil.ativo) {
        throw new Error(
            "Esta conta não possui autorização administrativa."
        );
    }

    return perfil;
}


// ======================================
// VERIFICAR SESSÃO EXISTENTE
// ======================================

async function verificarSessao() {

    try {

        const { data: { session }, error } =
            await supabase.auth.getSession();

        if (error) throw error;

        if (!session) return;

        console.log("Usuário autenticado:", session.user);

        await verificarPerfil(session.user.id);

        window.location.replace("dashboard.html");

    } catch (error) {

        console.error("Erro ao verificar sessão:", error);

        await supabase.auth.signOut();

    }
}


// ======================================
// AUTENTICAÇÃO
// ======================================

form.addEventListener("submit", async (event) => {

    event.preventDefault();

    mensagem.textContent = "";
    botao.disabled = true;
    botao.textContent = "Verificando acesso...";

    const email = document
        .getElementById("email")
        .value.trim();

    const password = document
        .getElementById("password")
        .value;

    try {

        // AUTENTICAR USUÁRIO

        const { data, error } =
            await supabase.auth.signInWithPassword({
                email,
                password
            });

        if (error) throw error;

        console.log("Usuário autenticado:", data.user);

        // VERIFICAR PERFIL ADMINISTRATIVO

        const perfil = await verificarPerfil(data.user.id);

        console.log("Administrador autorizado:", perfil);

        // REDIRECIONAR PARA O PAINEL

        window.location.replace("dashboard.html");

    } catch (error) {

        console.error("Erro no login:", error);

        // Encerrar sessão se a autenticação já ocorreu

        await supabase.auth.signOut();

        mensagem.textContent =
            error.message || "Não foi possível realizar o acesso.";

        botao.disabled = false;

        botao.innerHTML =
            'Entrar no painel <span>↗</span>';

    }

});


// ======================================
// INICIAR
// ======================================

verificarSessao();

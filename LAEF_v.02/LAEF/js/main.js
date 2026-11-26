
// ==========================================
// LAEF — INTERAÇÕES PRINCIPAIS
// ==========================================

const menuToggle = document.querySelector(".menu-toggle");
const navigation = document.querySelector(".navigation");

if (menuToggle && navigation) {

    menuToggle.addEventListener("click", () => {

        const aberto = navigation.classList.toggle("open");

        menuToggle.setAttribute(
            "aria-expanded",
            String(aberto)
        );

        menuToggle.setAttribute(
            "aria-label",
            aberto ? "Fechar menu" : "Abrir menu"
        );

    });

    navigation.querySelectorAll("a").forEach(link => {

        link.addEventListener("click", () => {

            navigation.classList.remove("open");

            menuToggle.setAttribute("aria-expanded", "false");
            menuToggle.setAttribute("aria-label", "Abrir menu");

        });

    });

}


/* ==========================================
   LAEF — VOLTAR AO TOPO
========================================== */

(function () {

    // Evita criar o botão mais de uma vez
    if (document.querySelector(".back-to-top")) return;

    // Criação do botão
    const botaoTopo = document.createElement("button");

    botaoTopo.className = "back-to-top";
    botaoTopo.type = "button";
    botaoTopo.innerHTML = "&#8593;";

    botaoTopo.setAttribute("aria-label", "Voltar ao topo");
    botaoTopo.setAttribute("title", "Voltar ao topo");

    document.body.appendChild(botaoTopo);


    // Controla a visibilidade
    function controlarBotao() {

        if (window.scrollY > 350) {
            botaoTopo.classList.add("visible");
        } else {
            botaoTopo.classList.remove("visible");
        }

    }

    window.addEventListener("scroll", controlarBotao, {
        passive: true
    });


    // Retorna ao início da página
    botaoTopo.addEventListener("click", function () {

        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });

    });

    controlarBotao();

})();

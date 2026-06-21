// app.js — login por e-mail e senha + troca de telas

(function () {
  const statusLogin = document.getElementById("status-login");

  function definirStatus(texto, tipo) {
    statusLogin.textContent = texto || "";
    if (tipo) statusLogin.setAttribute("data-tipo", tipo);
    else statusLogin.removeAttribute("data-tipo");
  }

  // Sem isto o resto quebra silenciosamente — avisa na própria tela de login
  if (!window.APP_CONFIG) {
    definirStatus("Erro: config.js não carregou.", "erro");
    return;
  }
  if (!window.supabase || typeof window.supabase.createClient !== "function") {
    definirStatus("Erro: biblioteca do Supabase não carregou (verifique a conexão).", "erro");
    return;
  }

  const cliente = window.supabase.createClient(
    window.APP_CONFIG.SUPABASE_URL,
    window.APP_CONFIG.SUPABASE_ANON_KEY
  );

  const telaLogin  = document.getElementById("tela-login");
  const telaApp    = document.getElementById("tela-app");
  const formLogin  = document.getElementById("form-login");
  const campoEmail = document.getElementById("email");
  const campoSenha = document.getElementById("senha");
  const botaoSair  = document.getElementById("botao-sair");

  function mostrarTela(sessao) {
    const logado = Boolean(sessao);
    telaLogin.hidden = logado;
    telaApp.hidden = !logado;
  }

  formLogin.addEventListener("submit", async function (ev) {
    ev.preventDefault();
    const email = campoEmail.value.trim();
    const senha = campoSenha.value;
    if (!email || !senha) return;

    definirStatus("Entrando...", null);
    const { error } = await cliente.auth.signInWithPassword({
      email,
      password: senha,
    });

    if (error) {
      definirStatus("Não foi possível entrar: " + error.message, "erro");
      return;
    }

    definirStatus("", null);
    campoSenha.value = ""; // não deixa a senha parada no campo após entrar
  });

  botaoSair.addEventListener("click", function () { cliente.auth.signOut(); });

  // onAuthStateChange cobre login, logout e a sessão inicial (já guardada
  // no navegador) — por isso não é preciso pedir login a cada visita
  cliente.auth.onAuthStateChange(function (_evento, sessao) { mostrarTela(sessao); });
  cliente.auth.getSession().then(function (r) { mostrarTela(r.data.session); });
})();

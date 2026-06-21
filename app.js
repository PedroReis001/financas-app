// app.js — VERSÃO DE DIAGNÓSTICO (mostra o erro na tela)

function mostrarBanner(texto, cor) {
  let b = document.getElementById("erro-debug");
  if (!b) {
    b = document.createElement("div");
    b.id = "erro-debug";
    b.style.cssText =
      "position:fixed;top:0;left:0;right:0;z-index:9999;color:#fff;" +
      "font:14px/1.4 system-ui;padding:12px;white-space:pre-wrap;";
    document.body.appendChild(b);
  }
  b.style.background = cor || "#8C3B2E";
  b.textContent = texto;
}

window.addEventListener("error", function (e) {
  mostrarBanner("ERRO: " + (e.message || "?") + " @" + (e.filename || "") + ":" + (e.lineno || ""));
});
window.addEventListener("unhandledrejection", function (e) {
  mostrarBanner("ERRO (promise): " + (e.reason && e.reason.message ? e.reason.message : e.reason));
});

try {
  if (!window.APP_CONFIG) throw new Error("config.js não carregou (APP_CONFIG ausente)");
  if (String(window.APP_CONFIG.SUPABASE_URL).includes("COLE_AQUI"))
    throw new Error("config.js está com o texto de exemplo (COLE_AQUI)");
  if (!window.supabase || typeof window.supabase.createClient !== "function")
    throw new Error("biblioteca do Supabase não carregou (CDN não abriu)");

  const cliente = window.supabase.createClient(
    window.APP_CONFIG.SUPABASE_URL,
    window.APP_CONFIG.SUPABASE_ANON_KEY,
    { auth: { detectSessionInUrl: true } }
  );

  const telaLogin   = document.getElementById("tela-login");
  const telaApp     = document.getElementById("tela-app");
  const formLogin   = document.getElementById("form-login");
  const campoEmail  = document.getElementById("email");
  const statusLogin = document.getElementById("status-login");
  const botaoSair   = document.getElementById("botao-sair");

  function mostrarTela(s) { telaLogin.hidden = Boolean(s); telaApp.hidden = !s; }
  function definirStatus(t, tipo) {
    statusLogin.textContent = t;
    if (tipo) statusLogin.setAttribute("data-tipo", tipo);
    else statusLogin.removeAttribute("data-tipo");
  }

  formLogin.addEventListener("submit", async function (ev) {
    ev.preventDefault();
    const email = campoEmail.value.trim();
    if (!email) return;
    definirStatus("Enviando link...", null);
    const { error } = await cliente.auth.signInWithOtp({
      email, options: { emailRedirectTo: window.location.href },
    });
    if (error) { definirStatus("Erro: " + error.message, "erro"); mostrarBanner("ENVIO FALHOU: " + error.message); return; }
    definirStatus("Link enviado! Confira o e-mail (" + email + ").", "ok");
    mostrarBanner("ENVIO OK: o Supabase aceitou. Veja e-mail/spam.", "#2F5D3A");
  });

  botaoSair.addEventListener("click", function () { cliente.auth.signOut(); });

  // onAuthStateChange já cobre tanto o retorno do magic link (SIGNED_IN)
  // quanto sessões existentes (INITIAL_SESSION) — getSession() separado não é necessário
  cliente.auth.onAuthStateChange(function (evento, s) {
    mostrarBanner("AUTH: " + evento + " | sessão: " + (s ? "sim" : "não"), s ? "#2F5D3A" : "#8C3B2E");
    mostrarTela(s);
  });

  mostrarBanner("OK: app carregou e o botão está ligado.", "#2F5D3A");
} catch (err) {
  mostrarBanner("FALHA: " + (err && err.message ? err.message : err));
}

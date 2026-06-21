// =====================================================================
// app.js — autenticação (link mágico) e troca entre tela de login/app
//
// A lista de lançamentos e o cálculo de saldo entram na próxima etapa.
// Por enquanto este arquivo só garante: "eu consigo entrar e sair".
// =====================================================================

if (!window.APP_CONFIG || window.APP_CONFIG.SUPABASE_URL.includes("COLE_AQUI")) {
  document.body.innerHTML =
    '<p style="padding:24px;font-family:sans-serif">' +
    'Faltou configurar o config.js com a URL e a chave do seu projeto Supabase. ' +
    'Veja o README.</p>';
  throw new Error("config.js não preenchido");
}

const supabase = window.supabase.createClient(
  window.APP_CONFIG.SUPABASE_URL,
  window.APP_CONFIG.SUPABASE_ANON_KEY
);

// ---- referências da tela -------------------------------------------
const telaLogin   = document.getElementById("tela-login");
const telaApp     = document.getElementById("tela-app");
const formLogin   = document.getElementById("form-login");
const campoEmail  = document.getElementById("email");
const statusLogin = document.getElementById("status-login");
const botaoSair   = document.getElementById("botao-sair");

// ---- alternar entre tela de login e tela do app ---------------------
function mostrarTela(sessao) {
  const logado = Boolean(sessao);
  telaLogin.hidden = logado;
  telaApp.hidden = !logado;
}

// ---- enviar o link mágico --------------------------------------------
async function enviarLinkMagico(evento) {
  evento.preventDefault();

  const email = campoEmail.value.trim();
  if (!email) return;

  definirStatus("Enviando link...", null);

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.href },
  });

  if (error) {
    definirStatus("Não deu certo: " + error.message, "erro");
    return;
  }

  definirStatus("Link enviado! Confira seu e-mail (" + email + ").", "ok");
}

function definirStatus(texto, tipo) {
  statusLogin.textContent = texto;
  if (tipo) {
    statusLogin.setAttribute("data-tipo", tipo);
  } else {
    statusLogin.removeAttribute("data-tipo");
  }
}

// ---- sair --------------------------------------------------------------
async function sair() {
  await supabase.auth.signOut();
}

// ---- ligar os eventos ----------------------------------------------
formLogin.addEventListener("submit", enviarLinkMagico);
botaoSair.addEventListener("click", sair);

// reage a qualquer mudança de sessão (login, logout, link clicado)
supabase.auth.onAuthStateChange((_evento, sessao) => {
  mostrarTela(sessao);
});

// estado inicial, ao abrir o app
supabase.auth.getSession().then(({ data }) => {
  mostrarTela(data.session);
});

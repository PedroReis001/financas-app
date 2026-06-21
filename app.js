// app.js — login (e-mail/senha) + lançamentos (criar, listar, apagar, saldo)

(function () {
  const statusLogin = document.getElementById("status-login");

  function definirStatusLogin(texto, tipo) {
    statusLogin.textContent = texto || "";
    if (tipo) statusLogin.setAttribute("data-tipo", tipo);
    else statusLogin.removeAttribute("data-tipo");
  }

  // Sem isto o resto quebra silenciosamente — avisa na própria tela de login
  if (!window.APP_CONFIG) {
    definirStatusLogin("Erro: config.js não carregou.", "erro");
    return;
  }
  if (!window.supabase || typeof window.supabase.createClient !== "function") {
    definirStatusLogin("Erro: biblioteca do Supabase não carregou (verifique a conexão).", "erro");
    return;
  }

  const cliente = window.supabase.createClient(
    window.APP_CONFIG.SUPABASE_URL,
    window.APP_CONFIG.SUPABASE_ANON_KEY
  );

  // =====================================================================
  // Dinheiro: SEMPRE em centavos inteiros — nunca float.
  // =====================================================================

  // "1.234,56" / "1234,5" / "1234.56" / "1234" -> 123456 (centavos)
  // Faz a conta só com inteiros para não herdar erro de ponto flutuante.
  function paraCentavos(texto) {
    const limpo = String(texto).trim().replace(/[^\d.,]/g, "");
    if (!limpo) return null;

    // o último separador (vírgula ou ponto) é o decimal; o resto é milhar
    const posDecimal = Math.max(limpo.lastIndexOf(","), limpo.lastIndexOf("."));

    let reais, centavos;
    if (posDecimal === -1) {
      reais = limpo.replace(/\D/g, "");
      centavos = "00";
    } else {
      reais = limpo.slice(0, posDecimal).replace(/\D/g, "");
      centavos = (limpo.slice(posDecimal + 1).replace(/\D/g, "") + "00").slice(0, 2);
    }

    const total = parseInt(reais || "0", 10) * 100 + parseInt(centavos, 10);
    return Number.isFinite(total) ? total : null;
  }

  // 123456 -> "1.234,56"  (parte inteira formatada via toLocaleString, é seguro)
  function formatarReais(centavos) {
    const sinal = centavos < 0 ? "-" : "";
    const abs = Math.abs(centavos);
    const reais = Math.floor(abs / 100);
    const resto = String(abs % 100).padStart(2, "0");
    return sinal + reais.toLocaleString("pt-BR") + "," + resto;
  }

  // "2026-06-21" -> "21 jun" (sem usar Date, para não cair em fuso horário)
  const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  function formatarData(iso) {
    const [, mes, dia] = iso.split("-").map(Number);
    return Number(dia) + " " + MESES[mes - 1];
  }

  // data de hoje no fuso LOCAL (não UTC) no formato "AAAA-MM-DD"
  function hojeLocal() {
    const agora = new Date();
    const local = new Date(agora.getTime() - agora.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  }

  // =====================================================================
  // Elementos
  // =====================================================================
  const telaLogin   = document.getElementById("tela-login");
  const telaApp     = document.getElementById("tela-app");
  const formLogin   = document.getElementById("form-login");
  const campoEmail  = document.getElementById("email");
  const campoSenha  = document.getElementById("senha");
  const botaoSair   = document.getElementById("botao-sair");

  const saldoValor       = document.getElementById("saldo-valor");
  const formLancamento   = document.getElementById("form-lancamento");
  const campoValor       = document.getElementById("campo-valor");
  const campoDescricao   = document.getElementById("campo-descricao");
  const campoData        = document.getElementById("campo-data");
  const statusLancamento = document.getElementById("status-lancamento");
  const lista            = document.getElementById("lista");
  const estadoVazio      = document.getElementById("estado-vazio");
  const botoesTipo       = document.querySelectorAll(".tipo-botao");

  let tipoSelecionado = "expense";

  function definirStatusLancamento(texto, tipo) {
    statusLancamento.textContent = texto || "";
    if (tipo) statusLancamento.setAttribute("data-tipo", tipo);
    else statusLancamento.removeAttribute("data-tipo");
  }

  // =====================================================================
  // Telas
  // =====================================================================
  function mostrarTela(sessao) {
    const logado = Boolean(sessao);
    telaLogin.hidden = logado;
    telaApp.hidden = !logado;
    if (logado) {
      campoData.value = hojeLocal();
      carregarLancamentos();
    }
  }

  // =====================================================================
  // Lançamentos
  // =====================================================================
  function renderizar(transacoes) {
    lista.innerHTML = "";

    let saldo = 0;
    for (const t of transacoes) {
      saldo += t.kind === "income" ? t.amount_cents : -t.amount_cents;
    }
    saldoValor.textContent = "R$ " + formatarReais(saldo);

    estadoVazio.hidden = transacoes.length > 0;

    for (const t of transacoes) {
      const entrada = t.kind === "income";
      const li = document.createElement("li");
      li.className = "item";
      li.innerHTML =
        '<div class="item-info">' +
          '<div class="item-descricao"></div>' +
          '<div class="item-data"></div>' +
        '</div>' +
        '<span class="item-valor ' + (entrada ? "entrada" : "saida") + '">' +
          (entrada ? "+" : "−") + formatarReais(t.amount_cents) +
        '</span>' +
        '<button class="item-apagar" type="button" aria-label="Apagar lançamento">×</button>';
      // textContent (não innerHTML) na descrição: evita injeção de HTML
      li.querySelector(".item-descricao").textContent = t.description || "(sem descrição)";
      li.querySelector(".item-data").textContent = formatarData(t.occurred_on);
      li.querySelector(".item-apagar").addEventListener("click", function () {
        apagarLancamento(t.id);
      });
      lista.appendChild(li);
    }
  }

  async function carregarLancamentos() {
    const { data, error } = await cliente
      .from("transactions")
      .select("*")
      .order("occurred_on", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      definirStatusLancamento("Erro ao carregar: " + error.message, "erro");
      return;
    }
    renderizar(data || []);
  }

  async function apagarLancamento(id) {
    if (!confirm("Apagar este lançamento?")) return;
    const { error } = await cliente.from("transactions").delete().eq("id", id);
    if (error) {
      definirStatusLancamento("Erro ao apagar: " + error.message, "erro");
      return;
    }
    carregarLancamentos();
  }

  botoesTipo.forEach(function (botao) {
    botao.addEventListener("click", function () {
      tipoSelecionado = botao.dataset.kind;
      botoesTipo.forEach(function (b) { b.classList.toggle("tipo-ativo", b === botao); });
    });
  });

  formLancamento.addEventListener("submit", async function (ev) {
    ev.preventDefault();

    const centavos = paraCentavos(campoValor.value);
    if (!centavos || centavos <= 0) {
      definirStatusLancamento("Informe um valor válido.", "erro");
      return;
    }

    definirStatusLancamento("Salvando...", null);
    // user_id é preenchido pelo default auth.uid() da tabela — não enviamos aqui
    const { error } = await cliente.from("transactions").insert({
      kind: tipoSelecionado,
      amount_cents: centavos,
      description: campoDescricao.value.trim() || null,
      occurred_on: campoData.value || hojeLocal(),
    });

    if (error) {
      definirStatusLancamento("Erro ao salvar: " + error.message, "erro");
      return;
    }

    campoValor.value = "";
    campoDescricao.value = "";
    definirStatusLancamento("", null);
    campoValor.focus();
    carregarLancamentos();
  });

  // =====================================================================
  // Login
  // =====================================================================
  formLogin.addEventListener("submit", async function (ev) {
    ev.preventDefault();
    const email = campoEmail.value.trim();
    const senha = campoSenha.value;
    if (!email || !senha) return;

    definirStatusLogin("Entrando...", null);
    const { error } = await cliente.auth.signInWithPassword({ email, password: senha });
    if (error) {
      definirStatusLogin("Não foi possível entrar: " + error.message, "erro");
      return;
    }
    definirStatusLogin("", null);
    campoSenha.value = "";
  });

  botaoSair.addEventListener("click", function () { cliente.auth.signOut(); });

  // onAuthStateChange cobre login, logout e a sessão inicial já guardada
  cliente.auth.onAuthStateChange(function (_evento, sessao) { mostrarTela(sessao); });
  cliente.auth.getSession().then(function (r) { mostrarTela(r.data.session); });
})();

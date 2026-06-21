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
  const totalReceitas    = document.getElementById("total-receitas");
  const totalDespesas    = document.getElementById("total-despesas");
  const formLancamento   = document.getElementById("form-lancamento");
  const campoValor       = document.getElementById("campo-valor");
  const campoDescricao   = document.getElementById("campo-descricao");
  const campoCategoria   = document.getElementById("campo-categoria");
  const novaCategoria    = document.getElementById("nova-categoria");
  const emojiBotoes      = document.querySelectorAll(".emoji-opt");
  const novaCatNome      = document.getElementById("nova-cat-nome");
  const novaCatCor       = document.getElementById("nova-cat-cor");
  const botaoCriarCat    = document.getElementById("criar-categoria");
  const botaoCancelarCat = document.getElementById("cancelar-categoria");
  const abrirCategoriasBtn = document.getElementById("abrir-categorias");
  const listaCategorias  = document.getElementById("lista-categorias");
  const statusCategoria  = document.getElementById("status-categoria");
  const campoData        = document.getElementById("campo-data");
  const statusLancamento = document.getElementById("status-lancamento");
  const lista            = document.getElementById("lista");
  const estadoVazio      = document.getElementById("estado-vazio");
  const botoesTipo       = document.querySelectorAll(".tipo-botao");

  let tipoSelecionado = "expense";
  let categorias = [];
  let emojiSelecionado = "🏷️";
  let categoriaEditando = null; // null = criando; id = editando essa categoria

  // Categorias padrão criadas na primeira vez (ícone = emoji, sem CDN).
  const CATEGORIAS_PADRAO = [
    { name: "Moradia",     kind: "expense", color: "#6B33E0", icon: "🏠" },
    { name: "Alimentação", kind: "expense", color: "#E2557B", icon: "🍔" },
    { name: "Transporte",  kind: "expense", color: "#2F80ED", icon: "🚗" },
    { name: "Saúde",       kind: "expense", color: "#27AE60", icon: "💊" },
    { name: "Lazer",       kind: "expense", color: "#F2994A", icon: "🎮" },
    { name: "Outros",      kind: "expense", color: "#828282", icon: "📦" },
    { name: "Salário",     kind: "income",  color: "#27AE60", icon: "💰" },
    { name: "Renda extra", kind: "income",  color: "#6B33E0", icon: "➕" },
  ];

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
      carregarCategorias();
      carregarLancamentos();
    }
  }

  // =====================================================================
  // Categorias
  // =====================================================================
  async function carregarCategorias() {
    let { data, error } = await cliente.from("categories").select("*").order("name");
    if (error) {
      definirStatusLancamento("Erro ao carregar categorias: " + error.message, "erro");
      return;
    }
    // primeira vez: cria as categorias padrão e recarrega
    if (!data || data.length === 0) {
      const { error: erroInsert } = await cliente.from("categories").insert(CATEGORIAS_PADRAO);
      if (erroInsert) {
        definirStatusLancamento("Erro ao criar categorias: " + erroInsert.message, "erro");
        return;
      }
      const recarga = await cliente.from("categories").select("*").order("name");
      data = recarga.data;
    }
    categorias = data || [];
    popularCategorias();
  }

  // preenche o seletor só com categorias do tipo escolhido (Gasto/Entrada)
  function popularCategorias() {
    campoCategoria.innerHTML = "";
    const doTipo = categorias.filter(function (c) { return c.kind === tipoSelecionado; });
    for (const c of doTipo) {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = (c.icon ? c.icon + " " : "") + c.name;
      campoCategoria.appendChild(opt);
    }
    // opção especial no fim: abre o painel de categorias em modo de criação
    const optNova = document.createElement("option");
    optNova.value = "__nova__";
    optNova.textContent = "➕ Nova categoria…";
    campoCategoria.appendChild(optNova);
  }

  function definirStatusCategoria(texto, tipo) {
    statusCategoria.textContent = texto || "";
    if (tipo) statusCategoria.setAttribute("data-tipo", tipo);
    else statusCategoria.removeAttribute("data-tipo");
  }

  // deixa o editor pronto para CRIAR uma nova categoria
  function resetarEditorCategoria() {
    categoriaEditando = null;
    novaCatNome.value = "";
    emojiSelecionado = "🏷️";
    emojiBotoes.forEach(function (b) { b.classList.remove("emoji-ativo"); });
    novaCatCor.value = "#6B33E0";
    botaoCriarCat.textContent = "Adicionar categoria";
    definirStatusCategoria("", null);
  }

  function abrirPainelCategorias() {
    if (campoCategoria.value === "__nova__") campoCategoria.selectedIndex = 0;
    resetarEditorCategoria();
    renderCategorias();
    novaCategoria.hidden = false;
    novaCatNome.focus();
  }

  function esconderNovaCategoria() {
    novaCategoria.hidden = true;
    resetarEditorCategoria();
    if (campoCategoria.value === "__nova__") campoCategoria.selectedIndex = 0;
  }

  // lista as categorias com botões de editar e apagar
  function renderCategorias() {
    listaCategorias.innerHTML = "";
    for (const c of categorias) {
      const li = document.createElement("li");
      li.className = "item";
      li.innerHTML =
        '<span class="item-icone"></span>' +
        '<div class="item-info">' +
          '<div class="item-descricao"></div>' +
          '<div class="item-data"></div>' +
        '</div>' +
        '<button class="item-editar" type="button" aria-label="Editar categoria">✎</button>' +
        '<button class="item-apagar" type="button" aria-label="Apagar categoria">×</button>';

      const iconeEl = li.querySelector(".item-icone");
      iconeEl.textContent = c.icon || "🏷️";
      if (c.color) iconeEl.style.background = c.color + "22";
      li.querySelector(".item-descricao").textContent = c.name;
      li.querySelector(".item-data").textContent = c.kind === "income" ? "Entrada" : "Gasto";
      li.querySelector(".item-editar").addEventListener("click", function () { editarCategoria(c); });
      li.querySelector(".item-apagar").addEventListener("click", function () { apagarCategoria(c); });
      listaCategorias.appendChild(li);
    }
  }

  // carrega uma categoria existente no editor
  function editarCategoria(c) {
    categoriaEditando = c.id;
    novaCatNome.value = c.name;
    emojiSelecionado = c.icon || "🏷️";
    emojiBotoes.forEach(function (b) { b.classList.toggle("emoji-ativo", b.dataset.emoji === emojiSelecionado); });
    novaCatCor.value = /^#[0-9a-fA-F]{6}$/.test(c.color || "") ? c.color : "#6B33E0";
    botaoCriarCat.textContent = "Salvar alterações";
    definirStatusCategoria('Editando "' + c.name + '"', null);
    novaCatNome.focus();
  }

  // cria (insert) ou salva edição (update), conforme o estado
  async function salvarCategoria() {
    const nome = novaCatNome.value.trim();
    if (!nome) {
      definirStatusCategoria("Dê um nome à categoria.", "erro");
      return;
    }
    const cor = novaCatCor.value || "#6B33E0";

    let error;
    if (categoriaEditando) {
      definirStatusCategoria("Salvando...", null);
      // o tipo (kind) não muda na edição — só nome, cor e ícone
      ({ error } = await cliente
        .from("categories")
        .update({ name: nome, color: cor, icon: emojiSelecionado })
        .eq("id", categoriaEditando));
    } else {
      definirStatusCategoria("Criando...", null);
      // a nova categoria nasce com o tipo atual do formulário (Gasto/Entrada)
      ({ error } = await cliente
        .from("categories")
        .insert({ name: nome, kind: tipoSelecionado, color: cor, icon: emojiSelecionado }));
    }

    if (error) {
      definirStatusCategoria("Erro: " + error.message, "erro");
      return;
    }

    await carregarCategorias();  // repopula o seletor
    renderCategorias();          // atualiza a lista do painel
    carregarLancamentos();       // ícone/nome podem ter mudado na lista
    resetarEditorCategoria();    // pronto para a próxima (painel continua aberto)
  }

  async function apagarCategoria(c) {
    if (!confirm('Apagar a categoria "' + c.name + '"? Os lançamentos dela ficam sem categoria.')) return;
    const { error } = await cliente.from("categories").delete().eq("id", c.id);
    if (error) {
      definirStatusCategoria("Erro ao apagar: " + error.message, "erro");
      return;
    }
    if (categoriaEditando === c.id) resetarEditorCategoria();
    await carregarCategorias();
    renderCategorias();
    carregarLancamentos();       // os lançamentos dessa categoria ficaram sem ela
  }

  // =====================================================================
  // Lançamentos
  // =====================================================================
  function renderizar(transacoes) {
    lista.innerHTML = "";

    let receitas = 0;
    let despesas = 0;
    for (const t of transacoes) {
      if (t.kind === "income") receitas += t.amount_cents;
      else despesas += t.amount_cents;
    }
    saldoValor.textContent = "R$ " + formatarReais(receitas - despesas);
    totalReceitas.textContent = formatarReais(receitas);
    totalDespesas.textContent = formatarReais(despesas);

    estadoVazio.hidden = transacoes.length > 0;

    for (const t of transacoes) {
      const entrada = t.kind === "income";
      const cat = t.categoria; // objeto embutido (ou null)
      const li = document.createElement("li");
      li.className = "item";
      li.innerHTML =
        '<span class="item-icone ' + (entrada ? "entrada" : "saida") + '"></span>' +
        '<div class="item-info">' +
          '<div class="item-descricao"></div>' +
          '<div class="item-data"></div>' +
        '</div>' +
        '<span class="item-valor ' + (entrada ? "entrada" : "saida") + '">' +
          (entrada ? "+" : "−") + formatarReais(t.amount_cents) +
        '</span>' +
        '<button class="item-apagar" type="button" aria-label="Apagar lançamento">×</button>';

      // ícone: emoji da categoria sobre fundo na cor dela; senão, seta padrão.
      // textContent/style por propriedade evitam injeção (cor/ícone vêm do banco).
      const iconeEl = li.querySelector(".item-icone");
      if (cat && cat.icon) {
        iconeEl.textContent = cat.icon;
        if (cat.color) iconeEl.style.background = cat.color + "22"; // ~13% de opacidade
      } else {
        iconeEl.textContent = entrada ? "↓" : "↑";
      }

      // título: descrição (ou nome da categoria); subtítulo: categoria · data
      const temDescricao = Boolean(t.description);
      li.querySelector(".item-descricao").textContent =
        temDescricao ? t.description : (cat ? cat.name : "(sem descrição)");
      li.querySelector(".item-data").textContent =
        (temDescricao && cat ? cat.name + " · " : "") + formatarData(t.occurred_on);

      li.querySelector(".item-apagar").addEventListener("click", function () {
        apagarLancamento(t.id);
      });
      lista.appendChild(li);
    }
  }

  async function carregarLancamentos() {
    const { data, error } = await cliente
      .from("transactions")
      .select("*, categoria:categories(name, color, icon)")
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
      popularCategorias(); // troca as opções para as do tipo escolhido
    });
  });

  // "➕ Nova categoria…" no seletor abre o painel em modo de criação
  campoCategoria.addEventListener("change", function () {
    if (campoCategoria.value === "__nova__") abrirPainelCategorias();
  });

  // botão "Gerenciar categorias" abre o mesmo painel
  abrirCategoriasBtn.addEventListener("click", abrirPainelCategorias);

  // seleção do emoji por toque
  emojiBotoes.forEach(function (botao) {
    botao.addEventListener("click", function () {
      emojiSelecionado = botao.dataset.emoji;
      emojiBotoes.forEach(function (b) { b.classList.toggle("emoji-ativo", b === botao); });
    });
  });

  botaoCriarCat.addEventListener("click", salvarCategoria);
  botaoCancelarCat.addEventListener("click", esconderNovaCategoria);

  formLancamento.addEventListener("submit", async function (ev) {
    ev.preventDefault();

    const centavos = paraCentavos(campoValor.value);
    if (!centavos || centavos <= 0) {
      definirStatusLancamento("Informe um valor válido.", "erro");
      return;
    }

    // "__nova__" é a opção de criar categoria, não uma categoria de verdade
    const categoriaId =
      campoCategoria.value && campoCategoria.value !== "__nova__"
        ? campoCategoria.value
        : null;

    definirStatusLancamento("Salvando...", null);
    // user_id é preenchido pelo default auth.uid() da tabela — não enviamos aqui
    const { error } = await cliente.from("transactions").insert({
      kind: tipoSelecionado,
      amount_cents: centavos,
      description: campoDescricao.value.trim() || null,
      category_id: categoriaId,
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

const API_URL = window.location.hostname.includes("github.io")
  ? "https://lojavirtual-production.up.railway.app"
  : "http://localhost:3000";

const cartItemsEl = document.querySelector("#cartItems");
const totalEl = document.querySelector("#total");
const whatsappBtn = document.querySelector("#whatsappBtn");
const clearCartBtn = document.querySelector("#clearCartBtn");
const paymentSelect = document.querySelector("#paymentSelect");

// ✅ Campos (precisam existir no carrinho.html)
const nomeClienteInput = document.querySelector("#nomeCliente");
const telefoneInput = document.querySelector("#telefone");
const enderecoInput = document.querySelector("#endereco");

// ✅ TROQUE AQUI PELO WHATSAPP DA VENDEDORA (55 + DDD + número, sem espaços)
const WHATSAPP_NUMERO = "5597984588022";

// Carrinho salvo
let carrinho = JSON.parse(localStorage.getItem("carrinho")) || [];

// Pagamento salvo
let pagamento = localStorage.getItem("pagamento") || "Pix";
paymentSelect.value = pagamento;

// Dados do cliente salvos (pra não perder quando atualizar/voltar)
function carregarDadosCliente() {
  if (nomeClienteInput) nomeClienteInput.value = localStorage.getItem("nomeCliente") || "";
  if (telefoneInput) telefoneInput.value = localStorage.getItem("telefone") || "";
  if (enderecoInput) enderecoInput.value = localStorage.getItem("endereco") || "";
}

function salvarDadosCliente() {
  if (nomeClienteInput) localStorage.setItem("nomeCliente", nomeClienteInput.value || "");
  if (telefoneInput) localStorage.setItem("telefone", telefoneInput.value || "");
  if (enderecoInput) localStorage.setItem("endereco", enderecoInput.value || "");
}

function salvarCarrinho() {
  localStorage.setItem("carrinho", JSON.stringify(carrinho));
}

function formatarPreco(valor) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function calcularTotal() {
  return carrinho.reduce((acc, item) => acc + item.preco * item.quantidade, 0);
}

function removerItem(id) {
  carrinho = carrinho.filter((item) => item.id !== id);
  salvarCarrinho();
  atualizarContadorCarrinho();
  renderCarrinho();
}

function alterarQuantidade(id, delta) {
  const item = carrinho.find((i) => i.id === id);
  if (!item) return;

  item.quantidade += delta;

  if (item.quantidade <= 0) {
    removerItem(id);
    return;
  }

  salvarCarrinho();
  atualizarContadorCarrinho();
  renderCarrinho();
}

function renderCarrinho() {
  cartItemsEl.innerHTML = "";

  if (carrinho.length === 0) {
    cartItemsEl.innerHTML = "<p class='muted'>Seu carrinho está vazio.</p>";
    totalEl.textContent = "";
    whatsappBtn.disabled = true;
    whatsappBtn.style.opacity = "0.6";
    clearCartBtn.disabled = true;
    clearCartBtn.style.opacity = "0.6";
    return;
  }

  whatsappBtn.disabled = false;
  whatsappBtn.style.opacity = "1";
  clearCartBtn.disabled = false;
  clearCartBtn.style.opacity = "1";

  carrinho.forEach((item) => {
    const div = document.createElement("div");
    div.classList.add("cartItem");

    div.innerHTML = `
      <div class="cartTopRow">
        <div>
          <strong>${item.nome}</strong>
          <div class="muted">${item.marca} • ${item.volume}</div>
        </div>

        <div class="qtyControls">
          <button class="qtyBtn" data-minus="${item.id}">−</button>
          <div class="qtyNumber">${item.quantidade}</div>
          <button class="qtyBtn" data-plus="${item.id}">+</button>
        </div>
      </div>

      <div>
        <div class="muted">Subtotal</div>
        <div class="price">${formatarPreco(item.preco * item.quantidade)}</div>
      </div>
    `;

    cartItemsEl.appendChild(div);
  });

  // Eventos dos botões +/-
  cartItemsEl.querySelectorAll("[data-minus]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = Number(btn.getAttribute("data-minus"));
      alterarQuantidade(id, -1);
    });
  });

  cartItemsEl.querySelectorAll("[data-plus]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = Number(btn.getAttribute("data-plus"));
      alterarQuantidade(id, +1);
    });
  });

  totalEl.textContent = "Total: " + formatarPreco(calcularTotal());
}

// Salvar pagamento quando mudar
paymentSelect.addEventListener("change", () => {
  localStorage.setItem("pagamento", paymentSelect.value);
});

// Salvar dados do cliente quando digitar
if (nomeClienteInput) nomeClienteInput.addEventListener("input", salvarDadosCliente);
if (telefoneInput) telefoneInput.addEventListener("input", salvarDadosCliente);
if (enderecoInput) enderecoInput.addEventListener("input", salvarDadosCliente);

// Limpar carrinho
clearCartBtn.addEventListener("click", () => {
  const ok = confirm("Tem certeza que deseja limpar o carrinho?");
  if (!ok) return;

  carrinho = [];
  salvarCarrinho();
  atualizarContadorCarrinho();
  renderCarrinho();
});

// ✅ Criar pedido no banco (agora com total + dados + endereco)
async function criarPedidoNoBanco() {
  const formaPagamento = paymentSelect.value;
  const total = calcularTotal();

  const nomeCliente = nomeClienteInput ? nomeClienteInput.value.trim() : "";
  const telefone = telefoneInput ? telefoneInput.value.trim() : "";
  const endereco = enderecoInput ? enderecoInput.value.trim() : "";

  // validações simples
  if (!endereco) {
    throw new Error("Informe o endereço de entrega antes de finalizar.");
  }

  const payload = {
    pagamento: formaPagamento,
    total, // ✅ manda o total pro backend validar/usar
    nomeCliente: nomeCliente || null,
    telefone: telefone || null,
    endereco: endereco || null, // ✅ manda endereco
    itens: carrinho.map((item) => ({
      id: item.id,
      nome: item.nome,
      preco: item.preco,
      quantidade: item.quantidade,
    })),
  };

  const resp = await fetch(`${API_URL}/api/pedidos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error || "Falha ao salvar pedido no banco");
  }

  return resp.json();
}

// Finalizar no WhatsApp
whatsappBtn.addEventListener("click", async () => {
  try {
    if (carrinho.length === 0) return;

    // salva dados (garantia)
    salvarDadosCliente();

    const pedido = await criarPedidoNoBanco();

    const total = calcularTotal();
    const formaPagamento = paymentSelect.value;

    const nomeCliente = nomeClienteInput ? nomeClienteInput.value.trim() : "";
    const telefone = telefoneInput ? telefoneInput.value.trim() : "";
    const endereco = enderecoInput ? enderecoInput.value.trim() : "";

    let mensagem = `Olá! Quero fazer um pedido 😊\n\n`;
    mensagem += `Pedido: #${pedido.id}\n\n`;
    mensagem += `Itens:\n`;

    carrinho.forEach((item) => {
      mensagem += `- ${item.nome} (${item.volume}) — ${item.quantidade}x — ${formatarPreco(
        item.preco * item.quantidade
      )}\n`;
    });

    mensagem += `\nTotal: ${formatarPreco(total)}\n`;
    mensagem += `Pagamento: ${formaPagamento}\n`;

    if (nomeCliente) mensagem += `Nome: ${nomeCliente}\n`;
    if (telefone) mensagem += `Telefone: ${telefone}\n`;
    mensagem += `Endereço: ${endereco}\n`;

    const texto = encodeURIComponent(mensagem);
    const link = `https://wa.me/${WHATSAPP_NUMERO}?text=${texto}`;
    window.location.href = link;

    // limpar carrinho (opcional)
    carrinho = [];
    salvarCarrinho();
    atualizarContadorCarrinho();
    renderCarrinho();
  } catch (e) {
    alert(e.message);
  }
});

// Inicialização
carregarDadosCliente();
renderCarrinho();
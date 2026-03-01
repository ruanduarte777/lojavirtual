const API_URL = window.location.hostname.includes("github.io")
  ? "https://lojavirtual-production.up.railway.app"
  : "http://localhost:3000";
const cartItemsEl = document.querySelector("#cartItems");
const totalEl = document.querySelector("#total");
const whatsappBtn = document.querySelector("#whatsappBtn");
const clearCartBtn = document.querySelector("#clearCartBtn");
const paymentSelect = document.querySelector("#paymentSelect");

// ✅ TROQUE AQUI PELO WHATSAPP DA VENDEDORA (55 + DDD + número, sem espaços)
const WHATSAPP_NUMERO = "5597984588022";

// Carrinho salvo
let carrinho = JSON.parse(localStorage.getItem("carrinho")) || [];

// Pagamento salvo
let pagamento = localStorage.getItem("pagamento") || "Pix";
paymentSelect.value = pagamento;

function salvarCarrinho(){
  localStorage.setItem("carrinho", JSON.stringify(carrinho));
}

function formatarPreco(valor){
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function calcularTotal(){
  return carrinho.reduce((acc, item) => acc + item.preco * item.quantidade, 0);
}

function removerItem(id){
  carrinho = carrinho.filter(item => item.id !== id);
  salvarCarrinho();
  atualizarContadorCarrinho();
  renderCarrinho();
}

function alterarQuantidade(id, delta){
  const item = carrinho.find(i => i.id === id);
  if(!item) return;

  item.quantidade += delta;

  if(item.quantidade <= 0){
    removerItem(id);
    return;
  }

  salvarCarrinho();
  atualizarContadorCarrinho();
  renderCarrinho();
}

function renderCarrinho(){
  cartItemsEl.innerHTML = "";

  if(carrinho.length === 0){
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

  carrinho.forEach(item => {
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
  cartItemsEl.querySelectorAll("[data-minus]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = Number(btn.getAttribute("data-minus"));
      alterarQuantidade(id, -1);
    });
  });

  cartItemsEl.querySelectorAll("[data-plus]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = Number(btn.getAttribute("data-plus"));
      alterarQuantidade(id, +1);
    });
  });

  totalEl.textContent = "Total: " + formatarPreco(calcularTotal());
}

function gerarMensagemWhatsApp(){
  const total = calcularTotal();
  const formaPagamento = paymentSelect.value;

  let mensagem = "Olá! Quero fazer um pedido 😊%0A%0A";
  mensagem += "*Itens:*%0A";

  carrinho.forEach(item => {
    mensagem += `- ${item.nome} (${item.volume}) — ${item.quantidade}x — ${formatarPreco(item.preco * item.quantidade)}%0A`;
  });

  mensagem += `%0A*Total:* ${formatarPreco(total)}%0A`;
  mensagem += `*Pagamento:* ${formaPagamento}%0A`;
  mensagem += "*Entrega:* a combinar%0A";

  return mensagem;
}

// Salvar pagamento quando mudar
paymentSelect.addEventListener("change", () => {
  localStorage.setItem("pagamento", paymentSelect.value);
});

// Limpar carrinho
clearCartBtn.addEventListener("click", () => {
  const ok = confirm("Tem certeza que deseja limpar o carrinho?");
  if(!ok) return;

  carrinho = [];
  salvarCarrinho();
  atualizarContadorCarrinho();
  renderCarrinho();
});

// Finalizar no WhatsApp
async function criarPedidoNoBanco() {
  const formaPagamento = paymentSelect.value;

  const payload = {
    pagamento: formaPagamento,
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

    const pedido = await criarPedidoNoBanco();

    const total = calcularTotal();
    const formaPagamento = paymentSelect.value;

    // ✅ monta mensagem normal com \n
    let mensagem = `Olá! Quero fazer um pedido 😊\n\n`;
    mensagem += `Pedido: #${pedido.id}\n\n`;
    mensagem += `Itens:\n`;

    carrinho.forEach(item => {
      mensagem += `- ${item.nome} (${item.volume}) — ${item.quantidade}x — ${formatarPreco(item.preco * item.quantidade)}\n`;
    });

    mensagem += `\nTotal: ${formatarPreco(total)}\n`;
    mensagem += `Pagamento: ${formaPagamento}\n`;
    mensagem += `Entrega: a combinar\n`;

    // ✅ encoda a mensagem inteira
    const texto = encodeURIComponent(mensagem);

    // ✅ use /?text= (wa.me)
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

renderCarrinho();
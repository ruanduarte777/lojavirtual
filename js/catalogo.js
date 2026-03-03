const API_URL = window.location.hostname.includes("github.io")
  ? "https://lojavirtual-production.up.railway.app"
  : "http://localhost:3000";

// ✅ base correta para imagens no GitHub Pages
const SITE_BASE = window.location.hostname.includes("github.io")
  ? `https://${window.location.host}/lojavirtual`
  : "";

const grid = document.querySelector("#productGrid");

function formatarPreco(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function isUrlCompleta(s) {
  return typeof s === "string" && (s.startsWith("http://") || s.startsWith("https://"));
}

function resolverImagem(img) {
  if (!img) return "";
  if (isUrlCompleta(img)) return img; // Cloudinary etc.

  // se for /assets/... no GitHub Pages precisa do /lojavirtual
  if (window.location.hostname.includes("github.io")) {
    return `${SITE_BASE}${img}`;
  }

  // local (abrindo via Live Server) funciona direto
  return img;
}

async function carregarProdutos() {
  try {
    const response = await fetch(`${API_URL}/api/produtos`);
    const produtos = await response.json();

    grid.innerHTML = "";

    produtos.forEach((produto) => {
      const card = document.createElement("article");
      card.classList.add("produto-card");

      const imgUrl = resolverImagem(produto.imagem);

      card.innerHTML = `
        <img class="produto-img" src="${imgUrl}" alt="${produto.nome || "Produto"}" loading="lazy">

        <div class="produto-body">
          <div class="produto-top">
            <div>
              <div class="produto-nome">${produto.nome || ""}</div>
              <div class="produto-meta">${produto.marca || ""} • <span class="badge-volume">${produto.volume || ""}</span></div>
            </div>
            <div class="produto-preco">${formatarPreco(produto.preco)}</div>
          </div>

          <div class="produto-actions">
            <button class="produto-btn">Adicionar ao carrinho</button>
          </div>
        </div>
      `;

      const botao = card.querySelector("button");
      botao.addEventListener("click", () => {
  adicionarAoCarrinho(produto);
  animarBotaoAdicionado(botao);
});
      grid.appendChild(card);
    });
  } catch (erro) {
    console.error("Erro ao carregar produtos:", erro);
    grid.innerHTML = `<p class="muted">Erro ao carregar catálogo. Tente novamente.</p>`;
  }
}
function animarBotaoAdicionado(btn) {
  const txtOriginal = btn.textContent;
  btn.disabled = true;
  btn.style.opacity = "0.85";
  btn.textContent = "Adicionado ✓";

  setTimeout(() => {
    btn.textContent = txtOriginal;
    btn.disabled = false;
    btn.style.opacity = "1";
  }, 900);
}

carregarProdutos();

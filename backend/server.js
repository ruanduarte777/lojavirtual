require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { PrismaClient } = require("@prisma/client");
const path = require("path");

const app = express();
const prisma = new PrismaClient();

function exigirAdmin(req, res, next) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";

  if (!token || token !== process.env.ADMIN_TOKEN) {
    return res.status(401).json({ error: "Não autorizado" });
  }

  next();
}

app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));
app.options("*", cors());
app.use(express.json());

// Serve imagens do seu projeto (pasta assets na raiz)
app.use("/assets", express.static(path.join(__dirname, "..", "assets")));

app.get("/api/health", (req, res) => {
  res.json({ ok: true, message: "API rodando!" });
});

// 🔹 LISTAR produtos (agora vem do BANCO)
app.get("/api/produtos", async (req, res) => {
  try {
    const produtos = await prisma.produto.findMany({
      where: { ativo: true },
      orderBy: { id: "asc" },
    });

    res.json(produtos);
  } catch (erro) {
    console.error("Erro /api/produtos:", erro);
    res.status(500).json({ error: "Erro ao buscar produtos" });
  }
});

// 🔹 Buscar 1 produto por ID (pra futura página produto)
app.get("/api/produtos/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    const produto = await prisma.produto.findUnique({
      where: { id },
    });

    if (!produto) return res.status(404).json({ error: "Produto não encontrado" });

    res.json(produto);
  } catch (erro) {
    console.error("Erro /api/produtos/:id:", erro);
    res.status(500).json({ error: "Erro ao buscar produto" });
  }
});
app.get("/api/pedidos", exigirAdmin, async (req, res) => {
  try {
    const { status } = req.query;

    const where = {};
    if (status && status !== "TODOS") {
      where.status = status;
    }

    const pedidos = await prisma.pedido.findMany({
      where,
      orderBy: { criadoEm: "desc" },
      include: { itens: true },
    });

    res.json(pedidos);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erro ao buscar pedidos" });
  }
});
// ✅ RESUMO (DASHBOARD) - métricas do admin
app.get("/api/admin/resumo", exigirAdmin, async (req, res) => {
  try {
    // início e fim do dia (hoje)
    const inicioHoje = new Date();
    inicioHoje.setHours(0, 0, 0, 0);

    const fimHoje = new Date();
    fimHoje.setHours(23, 59, 59, 999);

    // Pedidos NOVOS (geral)
    const pedidosNovos = await prisma.pedido.count({
      where: { status: "NOVO" },
    });

    // Pedidos de hoje
    const pedidosHoje = await prisma.pedido.count({
      where: {
        criadoEm: {
          gte: inicioHoje,
          lte: fimHoje,
        },
      },
    });

    // Total vendido hoje (soma)
    const totalHojeAgg = await prisma.pedido.aggregate({
      _sum: { total: true },
      where: {
        criadoEm: {
          gte: inicioHoje,
          lte: fimHoje,
        },
      },
    });

    // Total geral (soma)
    const totalGeralAgg = await prisma.pedido.aggregate({
      _sum: { total: true },
    });

    res.json({
      pedidosNovos,
      pedidosHoje,
      totalHoje: totalHojeAgg._sum.total || 0,
      totalGeral: totalGeralAgg._sum.total || 0,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erro ao gerar resumo" });
  }
});
const PORT = process.env.PORT || 3000;
app.post("/api/pedidos", async (req, res) => {
  try {
    const { pagamento, itens, total, nomeCliente, telefone } = req.body;

    if (!pagamento) return res.status(400).json({ error: "Pagamento é obrigatório" });
    if (!Array.isArray(itens) || itens.length === 0) {
      return res.status(400).json({ error: "Carrinho vazio" });
    }

    // (opcional) valida total no servidor:
    const totalCalculado = itens.reduce((acc, i) => acc + (Number(i.preco) * Number(i.quantidade)), 0);
    const totalFinal = Number.isFinite(Number(total)) ? Number(total) : totalCalculado;

    const pedido = await prisma.pedido.create({
      data: {
        pagamento,
        total: totalFinal,
        nomeCliente: nomeCliente || null,
        telefone: telefone || null,
        itens: {
          create: itens.map((i) => ({
            produtoId: Number(i.id),
            nome: String(i.nome),
            preco: Number(i.preco),
            quantidade: Number(i.quantidade),
            subtotal: Number(i.preco) * Number(i.quantidade),
          })),
        },
      },
      include: { itens: true },
    });

    res.status(201).json(pedido);
  } catch (e) {
    console.error("Erro ao criar pedido:", e);
    res.status(500).json({ error: "Erro ao criar pedido" });
  }
});

app.patch("/api/pedidos/:id/status", exigirAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { status } = req.body;

    const statusValidos = ["NOVO", "PAGO", "ENVIADO", "CANCELADO"];
    if (!statusValidos.includes(status)) {
      return res.status(400).json({ error: "Status inválido" });
    }

    const pedido = await prisma.pedido.update({
      where: { id },
      data: { status },
    });

    res.json(pedido);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erro ao atualizar status" });
  }
});
app.post("/api/admin/login", (req, res) => {
  const { senha } = req.body;

  if (!senha) return res.status(400).json({ error: "Senha obrigatória" });

  if (senha !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Senha incorreta" });
  }

  // token simples (MVP)
  res.json({ token: process.env.ADMIN_TOKEN });
});
app.listen(PORT, () => {
  console.log(`✅ API rodando na porta ${PORT}`);
});
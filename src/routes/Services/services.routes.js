const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../../middleware/auth");

const {
  createService,
  getClientServices,
//   getEmployeeServices,
  updateServiceStatus,
} = require("./repository/Service");

// 🔐 Todas protegidas

// Criar serviço (cliente cria)
router.post("/", authMiddleware, createService);

// Listar serviços do cliente logado
router.get("/client", authMiddleware, getClientServices);

// // Listar serviços do funcionário logado
// router.get("/employee", authMiddleware, getEmployeeServices);

// Atualizar status
router.patch("/:id/status", authMiddleware, updateServiceStatus);

module.exports = router;
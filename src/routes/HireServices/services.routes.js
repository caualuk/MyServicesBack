const express = require("express");
const router = express.Router();

const {
    createService,
    startService,
    finishService,
    updateServiceStatus
} = require("./repository/Services");

const { authMiddleware } = require("../../middleware/auth");

router.use(authMiddleware);

// Criar serviço (cliente)
router.post("/",createService);

router.get("/", listServices);

// Iniciar serviço (funcionário)
router.patch("/:serviceId/start", startService);

// Finalizar serviço (funcionário)
router.patch("/:serviceId/finish", finishService);

router.patch("/:id/status", updateServiceStatus);

module.exports = router;

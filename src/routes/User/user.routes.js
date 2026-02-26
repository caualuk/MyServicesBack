const express = require("express");
const {
  createUser,
  getUsers,
  login,
  getNearbyEmployees,
  radius,
  updateProfile,
  getProfessions,
  searchProfessions,
  searchEmployees
} = require("./repository/User");
const router = express.Router();
const { authMiddleware } = require("../../middleware/auth");
const { verifyToken } = require("../../auth/auth.js");
const pool = require("../../database/db.js");

//ROUTER COMO USER PARA MELHORAR IDENTIFICAÇÃO
const user = router;

user.get("/get", async (req, res) => {
  getUsers(req, res);
});

user.post("/", (req, res) => {
  createUser(req, res);
});

router.get("/me", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({ message: "Token não fornecido" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = verifyToken(token);

    if (!decoded) {
      return res.status(401).json({ message: "Token inválido" });
    }

    // QUERY NO POSTGRES - ADICIONEI profile_color
    const result = await pool.query(
      "SELECT id, name, email, role, radius, has_set_radius, profile_color FROM users WHERE id = $1",
      [decoded.id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Usuário não encontrado" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("ERRO NO /me:", error);
    res.status(500).json({ message: "Erro interno" });
  }
});

router.get("/nearby-employees", authMiddleware, getNearbyEmployees);

user.put("/profile", authMiddleware, updateProfile);

user.put("/radius", authMiddleware, radius);

user.post("/login", login);

router.get("/professions", getProfessions);

router.get("/professions/search", searchProfessions);

router.get("/employees/search", searchEmployees);

module.exports = user;

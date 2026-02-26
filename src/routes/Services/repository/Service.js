const pool = require("../../../database/db");

//CRIAR SERVIÇO
async function createService(req, res) {
  const clientId = req.user.id;
  const { employee_id, profession_id, value } = req.body;

  if (!employee_id || !value) {
    return res.status(400).json({
      error: "Employee_id e value são obrigatórios",
    });
  }

  try {
    const insertResult = await pool.query(
      `
      INSERT INTO services 
      (client_id, employee_id, profession_id, value)
      VALUES ($1, $2, $3, $4)
      RETURNING id;
      `,
      [clientId, employee_id, profession_id || null, value],
    );

    const serviceId = insertResult.rows[0].id;

    // BUSCAR COM JOIN
    const fullService = await pool.query(
      `
      SELECT 
        s.id,
        u.name AS employee_name,
        p.name AS profession_name,
        s.status,
        s.value,
        s.created_at
      FROM services s
      JOIN users u ON s.employee_id = u.id
      LEFT JOIN professions p ON s.profession_id = p.id
      WHERE s.id = $1
      `,
      [serviceId],
    );

    res.status(201).json(fullService.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Erro ao criar serviço",
    });
  }
}

async function getClientServices(req, res) {
  const clientId = req.user.id;

  try {
    const result = await pool.query(
      `
      SELECT 
  s.id,
  s.status,
  s.value,
  s.created_at,
  u.name AS employee_name,
  p.name AS profession_name
FROM services s
JOIN users u ON s.employee_id = u.id
LEFT JOIN professions p ON u.profession_id = p.id
WHERE s.client_id = $1
ORDER BY s.created_at DESC;
      `,
      [clientId],
    );

    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Erro ao buscar serviços do cliente",
    });
  }
}

async function updateServiceStatus(req, res) {
  const serviceId = req.params.id;
  const userId = req.user.id;

  try {
    // 1️⃣ Buscar serviço
    const serviceResult = await pool.query(
      `SELECT * FROM services WHERE id = $1`,
      [serviceId],
    );

    if (serviceResult.rows.length === 0) {
      return res.status(404).json({ error: "Serviço não encontrado" });
    }

    const service = serviceResult.rows[0];

    // 🔐 Segurança: só pode alterar se for client ou employee do serviço
    if (service.client_id !== userId && service.employee_id !== userId) {
      return res.status(403).json({ error: "Sem permissão" });
    }

    // 2️⃣ Definir próximo status
    let newStatus;

    if (service.status === "PENDING") {
      newStatus = "PAID";
    } else if (service.status === "PAID") {
      newStatus = "OVERDUE";
    } else {
      newStatus = "PENDING";
    }

    // 3️⃣ Atualizar no banco
    await pool.query(`UPDATE services SET status = $1 WHERE id = $2`, [
      newStatus,
      serviceId,
    ]);

    res.json({
      message: "Status atualizado com sucesso",
      new_status: newStatus,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao atualizar status" });
  }
}

module.exports = {
  createService,
  getClientServices,
  updateServiceStatus,
};

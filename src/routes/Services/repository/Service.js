const pool = require("../../../database/db");

//CRIAR SERVIÇO
async function createService(req, res) {
  const clientId = req.user.id;
  const userRole = req.user.role;
  const { employee_id, profession_id, value, added_as } = req.body;

  // default to CLIENT if not provided or invalid
  const mode = added_as === "EMPLOYEE" ? "EMPLOYEE" : "CLIENT";

  // se for modo "EMPLOYEE" e usuário não for funcionário, bloqueia
  if (mode === "EMPLOYEE" && userRole !== "EMPLOYEE") {
    return res.status(403).json({
      error: "Apenas funcionários podem adicionar serviços como funcionário",
    });
  }

  // se modo CLIENT, é necessário escolher um funcionário
  if (mode === "CLIENT" && (!employee_id || !value)) {
    return res.status(400).json({
      error: "Employee_id e value são obrigatórios",
    });
  }

  try {
    // caso esteja add como funcionário, garantimos que o próprio usuário seja o prestador
    const finalEmployeeId = mode === "EMPLOYEE" ? clientId : employee_id;

    const insertResult = await pool.query(
      `
      INSERT INTO services 
      (client_id, employee_id, profession_id, value, added_as)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id;
      `,
      [clientId, finalEmployeeId, profession_id || null, value, mode],
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
        s.added_as,
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
  s.added_as,
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

// list services where the user is the provider
async function getEmployeeServices(req, res) {
  const employeeId = req.user.id;

  try {
    const result = await pool.query(
      `
      SELECT 
  s.id,
  s.status,
  s.value,
  s.added_as,
  s.created_at,
  u2.name AS client_name,
  p.name AS profession_name
FROM services s
JOIN users u2 ON s.client_id = u2.id
LEFT JOIN professions p ON s.profession_id = p.id
WHERE s.employee_id = $1
ORDER BY s.created_at DESC;
      `,
      [employeeId],
    );

    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Erro ao buscar serviços do funcionário",
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

// MÉTRICAS DE PAGAMENTO
async function getMetrics(req, res) {
  const userId = req.user.id;
  const role = req.user.role;

  try {
    if (role === "CLIENT") {
      const result = await pool.query(
        `
        SELECT COUNT(*) AS services_count,
               COALESCE(SUM(value),0) AS total_spent
        FROM services
        WHERE client_id = $1
          AND status = 'PAID'
          AND added_as = 'CLIENT'
        `,
        [userId],
      );

      const row = result.rows[0];
      return res.json({
        role,
        services_count: parseInt(row.services_count, 10),
        total_spent: parseFloat(row.total_spent),
      });
    }

    if (role === "EMPLOYEE") {
      // valores que o funcionário efetivamente ganhou (serviços realizados por ele)
      const earnedRes = await pool.query(
        `
        SELECT COALESCE(SUM(value),0) AS total_earned,
               COUNT(*) AS services_done
        FROM services
        WHERE employee_id = $1
          AND status = 'PAID'
        `,
        [userId],
      );

      // gastos que o funcionário teve quando agiu como cliente
      const spentRes = await pool.query(
        `
        SELECT COALESCE(SUM(value),0) AS total_spent
        FROM services
        WHERE client_id = $1
          AND status = 'PAID'
          AND added_as = 'CLIENT'
        `,
        [userId],
      );

      const totalEarned = parseFloat(earnedRes.rows[0].total_earned);
      const servicesDone = parseInt(earnedRes.rows[0].services_done, 10);
      const totalSpent = parseFloat(spentRes.rows[0].total_spent);
      const saldo = totalEarned - totalSpent;

      return res.json({
        role,
        total_earned: totalEarned,
        services_done: servicesDone,
        total_spent: totalSpent,
        saldo_liquido: saldo,
      });
    }

    // caso role desconhecido
    res.status(400).json({ error: "Role inválida" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao calcular métricas" });
  }
}

// DADOS PARA GRÁFICO DE LINHA (GASTOS/GANHOS POR DATA)
async function getChartLineData(req, res) {
  const userId = req.user.id;
  const role = req.user.role;

  try {
    if (role === "CLIENT") {
      // Gastos por data (serviços como cliente que foram pagos)
      const result = await pool.query(
        `
        SELECT 
          DATE(s.created_at) AS date,
          SUM(s.value) AS amount
        FROM services s
        WHERE s.client_id = $1
          AND s.status = 'PAID'
          AND s.added_as = 'CLIENT'
        GROUP BY DATE(s.created_at)
        ORDER BY DATE(s.created_at)
        LIMIT 30
        `,
        [userId],
      );

      const chartData = result.rows.map((row) => ({
        date: new Date(row.date).toLocaleDateString("pt-BR", {
          day: "numeric",
          month: "short",
        }),
        gastos: parseFloat(row.amount),
      }));

      return res.json({ role, data: chartData });
    }

    if (role === "EMPLOYEE") {
      // Ganhos por data: serviços realizados pelo funcionário
      const ganhoRes = await pool.query(
        `
        SELECT 
          DATE(s.created_at) AS date,
          SUM(s.value) AS amount
        FROM services s
        WHERE s.employee_id = $1
          AND s.status = 'PAID'
        GROUP BY DATE(s.created_at)
        ORDER BY DATE(s.created_at)
        LIMIT 30
        `,
        [userId],
      );

      // Gastos por data: quando o funcionário agiu como cliente
      const gastoRes = await pool.query(
        `
        SELECT 
          DATE(s.created_at) AS date,
          SUM(s.value) AS amount
        FROM services s
        WHERE s.client_id = $1
          AND s.status = 'PAID'
        GROUP BY DATE(s.created_at)
        ORDER BY DATE(s.created_at)
        LIMIT 30
        `,
        [userId],
      );

      // Combinar dados
      const allDates = new Set();
      ganhoRes.rows.forEach((r) => allDates.add(r.date.toString()));
      gastoRes.rows.forEach((r) => allDates.add(r.date.toString()));

      const charData = Array.from(allDates)
        .sort()
        .map((date) => {
          const ganho = ganhoRes.rows.find((r) => r.date.toString() === date);
          const gasto = gastoRes.rows.find((r) => r.date.toString() === date);

          return {
            date: new Date(date).toLocaleDateString("pt-BR", {
              day: "numeric",
              month: "short",
            }),
            ganhos: ganho ? parseFloat(ganho.amount) : 0,
            gastos: gasto ? parseFloat(gasto.amount) : 0,
          };
        });

      return res.json({ role, data: charData });
    }

    return res.status(400).json({ error: "Role inválida" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao gerar dados do gráfico" });
  }
}

// DISTRIBUIÇÃO DE SERVIÇOS POR PROFISSÃO
async function getServicesByProfession(req, res) {
  const userId = req.user.id;

  try {
    const result = await pool.query(
      `
      SELECT 
        COALESCE(p.name, 'Sem Profissão') AS profession,
        COUNT(*) AS count,
        SUM(s.value) AS total_value
      FROM services s
      LEFT JOIN users u ON s.employee_id = u.id
      LEFT JOIN professions p ON u.profession_id = p.id
      WHERE s.client_id = $1
        AND s.status = 'PAID'
        AND s.added_as = 'CLIENT'
      GROUP BY profession
      ORDER BY count DESC
      `,
      [userId],
    );

    const colors = [
      "#3B82F6",
      "#10B981",
      "#F59E0B",
      "#EF4444",
      "#8B5CF6",
      "#EC4899",
      "#14B8A6",
      "#F97316",
    ];

    const chartData = result.rows.map((row, idx) => ({
      name: row.profession,
      value: parseInt(row.count, 10),
      amount: parseFloat(row.total_value),
      color: colors[idx % colors.length],
    }));

    return res.json(chartData);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao buscar dados de profissões" });
  }
}

module.exports = {
  createService,
  getClientServices,
  getEmployeeServices,
  updateServiceStatus,
  getMetrics,
  getChartLineData,
  getServicesByProfession,
};

const express = require("express");
const app = express();
const PORT = 8000;
const cors = require("cors");

require("dotenv").config();

const userRoutes = require("./routes/User/user.routes")
const cityRoutes = require("./routes/City/city.routes");
const serviceRoutes = require("./routes/Services/services.routes");

const pool = require("./database/db");

app.use(express.json());
app.use(cors(
  { origin : "http://localhost:3000" }
));

// ROTAS PRINCIPAL

//Usuários
app.use("/users", userRoutes);

//Cidades 
app.use("/cities", cityRoutes);

app.use("/api/user", userRoutes);

app.use("/services", serviceRoutes);


app.get("/", (req, res) => {
  res.send("API RODANDO AMIGO");
});

app.get("/db", async (req, res) => {
  const result = await pool.query("SELECT NOW()");
  res.json(result.rows);
})

app.listen(PORT, () => {
  console.log("servidor rodando na porta " + PORT);
});

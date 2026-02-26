const { Pool } = require("pg");

const pool = new Pool({
  user: "postgres",
  host: "localhost",
  database: "msbackend",
  password: "1412",
  port: 5433,
});

//TABELA CIDADES
async function citiesTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS cities (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) UNIQUE NOT NULL,
        state VARCHAR(100) NOT NULL,
        country VARCHAR(100) NOT NULL,
        latitude FLOAT,
        longitude FLOAT
  );
`);
}

//TABELA USUÁRIOS
async function usersTable() {
  await pool.query(
    `
  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE,
    password VARCHAR(100),
    phone VARCHAR(20),
    role VARCHAR(20) CHECK (role IN ('CLIENT', 'EMPLOYEE')),
    city_id INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT fk_city
      FOREIGN KEY(city_id)
      REFERENCES cities(id)
      ON DELETE CASCADE
    );
;
`,
  );
}

//INICIALIZAÇÃO DAS TABELAS -> VERIFICAR MELHOR OPÇÃO PARA DEPOIS
async function createTables() {
  try {
    await citiesTable();
    await usersTable();
  } catch (error) {
    console.log("Erro na inicialização das tabelas /db" + error);
  }
}

createTables();

module.exports = pool;

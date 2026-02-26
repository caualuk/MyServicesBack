const { Client } = require("pg");

const client = new Client({
  user: "postgres",
  host: "localhost",
  database: "msbackend",
  password: "1412",
  port: 5433,
});

const professions = [
  "Eletricista",
  "Encanador",
  "Pedreiro",
  "Pintor",
  "Mecânico",
  "Marceneiro",
  "Carpinteiro",
  "Jardineiro",
  "Diarista",
  "Faxineira",
  "Babá",
  "Cuidador de Idosos",
  "Técnico em Informática",
  "Desenvolvedor",
  "Designer Gráfico",
  "Fotógrafo",
  "Cabeleireiro",
  "Manicure",
  "Barbeiro",
  "Professor",
  "Personal Trainer",
  "Nutricionista",
  "Psicólogo",
  "Advogado",
  "Contador",
  "Arquiteto",
  "Engenheiro Civil",
  "Técnico de Ar Condicionado",
  "Instalador de Câmeras",
  "Chaveiro",
  "Soldador",
  "Vidraceiro",
  "Serralheiro",
  "Montador de Móveis",
  "Motorista Particular",
  "Freelancer",
  "Social Media",
  "Consultor",
  "Médico",
  "Enfermeiro",
  "Fisioterapeuta",
  "Massoterapeuta"
];

async function seedProfessions() {
  try {
    await client.connect();

    for (const profession of professions) {
      await client.query(
        `INSERT INTO professions (name)
         VALUES ($1)
         ON CONFLICT (name) DO NOTHING`,
        [profession]
      );
    }

    console.log("✅ Profissões inseridas com sucesso!");
  } catch (error) {
    console.error("❌ Erro ao inserir profissões:", error);
  } finally {
    await client.end();
  }
}

seedProfessions();
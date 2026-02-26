const pool = require("../../../database/db");

async function getCitiesDb(req, res) {
  try {
    const result = await pool.query("SELECT * FROM cities");
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({
      error: "Erro ao buscar cidades no banco de dados: " + error.message,
    });
  }
}

async function getCityByName(req, res) {
  try {
    //NOME NA URL
    const cidade = req.query.name;

    //VALIDAÇÃO NOME NA URL
    if (!cidade) {
      return res.status(400).json({ error: "informar nome da cidade na url" });
    }

    //PEGANDO DADOS DA API
    const api = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(cidade)},BR&format=json&addressdetails=1&limit=10`;
    const response = await fetch(api, {
      headers: { "User-Agent": "msbackend-app" },
    }); // ESPERA RESPOSTA DA API
    const data = await response.json(); // TRANSFORMA RESPOSTA DA API EM JSON

    // Filtrar: apenas Brasil e tipos relevantes (city | town | municipality)
    const cidadesFiltradas = data.filter(
      (c) =>
        c.address?.country_code === "br" &&
        (c.type === "city" ||
          c.type === "town" ||
          c.addresstype === "municipality"),
    );

    // Remover duplicados por `name-state`
    const unicas = [];
    const set = new Set();

    for (const c of cidadesFiltradas) {
      const key = `${c.name}-${c.address?.state || ""}`;
      if (!set.has(key)) {
        set.add(key);
        unicas.push(c);
      }
    }

    // Mapear resultado para o formato público
    const result = unicas.map((item) => ({
      cidade: item.name,
      estado: item.address?.state,
      pais: item.address?.country,
      lat: item.lat,
      lon: item.lon,
    }));

    // VERIFICA SE RESULTADO TA VAZIO
    if (result.length === 0) {
      return res.status(404).json({ error: "Cidade não encontrada" });
    }

    res.status(200).json(result); // RESPOSTA MANIPULADA COM INFORMAÇÕES RELEVANTES
  } catch (error) {
    res
      .status(500)
      .json({ error: "Erro ao buscar cidade na api: " + error.message });
  }
}

// async function searchCities(req, res) {
//   const { name } = req.query;

//   const api = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(name)}&countrycodes=br&format=json&addressdetails=1&limit=10`;

//   const response = await fetch(api, {
//     headers: { "User-Agent": "msbackend-app" },
//   });

//   const data = await response.json();

//   const cidades = data.map((c) => ({
//     name:
//       c.address.city ||
//       c.address.town ||
//       c.address.municipality ||
//       c.address.village ||
//       c.name,
//     state: c.address.state,
//     lat: c.lat,
//     lon: c.lon,
//   }));

//   res.json(cidades);
// }

async function searchCities(req, res) {
  const { q } = req.query;

  if (!q) {
    return res.status(400).json({ error: "Informar um termo para busca" });
  }

  try {
    const result = await pool.query(
      `
      SELECT id, name, state
      FROM cities
      WHERE name ILIKE $1
      ORDER BY name
      LIMIT 10
      `,
      [`${q}%`],
    );

    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao buscar cidades" });
  }
}

async function createCity(req, res) {
  try {
    // normalizar entrada: remover espaços extras e padronizar maiúsculas/minúsculas
    const rawName = req.query.name;
    const rawState = req.query.state;

    if (!rawName) {
      return res.status(400).json({ error: "Informar nome da cidade na URL" });
    }

    const normalizeWhitespace = (s) => String(s).replace(/\s+/g, " ").trim();

    const toTitleCase = (str) =>
      String(str)
        .toLowerCase()
        .split(" ")
        .filter(Boolean)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");

    const name = normalizeWhitespace(rawName);
    const state = rawState ? normalizeWhitespace(rawState) : undefined;

    if (!name) {
      return res.status(400).json({ error: "Nome inválido após normalização" });
    }

    // buscar na API usando valor normalizado (evita problemas com espaços extras)
    const api = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
      name,
    )}&countrycodes=br&format=json&addressdetails=1&limit=10`;

    const response = await fetch(api, {
      headers: {
        "User-Agent": "msbackend-app",
      },
    });

    const data = await response.json();

    if (!data || data.length === 0) {
      return res.status(404).json({ error: "Cidade não encontrada na API" });
    }

    let cidadesFiltradas = data.filter(
      (c) =>
        c.address?.country_code === "br" &&
        (c.addresstype === "municipality" ||
          c.type === "administrative" ||
          c.type === "city" ||
          c.type === "town"),
    );

    if (cidadesFiltradas.length === 0) {
      return res.json([]);
    }

    // remover duplicados (considerando nome e estado originais do retorno da API)
    const cidadesUnicas = [];
    const set = new Set();

    for (const c of cidadesFiltradas) {
      const key = `${c.name}-${c.address.state}`;
      if (!set.has(key)) {
        set.add(key);
        cidadesUnicas.push(c);
      }
    }

    // se houver ambiguidade e o estado não foi informado, pedir ao cliente
    if (cidadesUnicas.length > 1 && !state) {
      return res.status(400).json({
        message: "Mais de uma cidade encontrada. Informe o estado.",
        cidades: cidadesUnicas.map((c) => ({
          name: normalizeWhitespace(c.name),
          state: c.address.state ? normalizeWhitespace(c.address.state) : null,
        })),
      });
    }

    // escolher a cidade correta (considerando estado quando fornecido)
    let cityApi;

    if (state) {
      cityApi = cidadesUnicas.find(
        (c) =>
          c.address.state &&
          c.address.state
            .trim()
            .toLowerCase()
            .includes(state.trim().toLowerCase()),
      );

      if (!cityApi) {
        return res
          .status(404)
          .json({ error: "Município não encontrado com esse estado" });
      }
    } else {
      cityApi = cidadesUnicas[0];
    }

    // padronizar nome/estado antes de verificar/inserir no banco
    const standardizedName = toTitleCase(normalizeWhitespace(cityApi.name));
    const standardizedState = cityApi.address.state
      ? toTitleCase(normalizeWhitespace(cityApi.address.state))
      : null;

    // Verificar se já existe no banco (comparação case-insensitive)
    const existing = await pool.query(
      `
            SELECT * FROM cities 
            WHERE LOWER(name) = LOWER($1)
            AND LOWER(state) = LOWER($2)
            `,
      [standardizedName, standardizedState],
    );

    if (existing.rows.length > 0) {
      return res.status(200).json({
        created: false,
        message: "Cidade já existe no banco",
        city: existing.rows[0],
      });
    }

    const cityData = {
      name: standardizedName,
      state: standardizedState,
      country: cityApi.address.country,
      lat: Number(cityApi.lat),
      lon: Number(cityApi.lon),
    };

    await pool.query(
      `
            INSERT INTO cities (name, state, country, lat, lon) 
            VALUES ($1, $2, $3, $4, $5)
            `,
      [
        cityData.name,
        cityData.state,
        cityData.country,
        cityData.lat,
        cityData.lon,
      ],
    );

    res.status(201).json({
      created: true,
      message: "Cidade adicionada com sucesso",
      city: cityData,
    });
  } catch (error) {
    res.status(500).json({ error: "Erro ao criar cidade: " + error.message });
  }
}

async function getNearbyCities(req, res) {
  try {
    const { name, state, raio } = req.query;

    if (!name || !raio) {
      return res.status(400).json({
        error: "Informar nome e raio na URL",
      });
    }

    let cidadeBaseQuery; // BUSCAR CIDADE BASE NO BANCO

    if (state) {
      cidadeBaseQuery = await pool.query(
        `SELECT * FROM cities
                WHERE LOWER(name) = LOWER($1)
                AND LOWER(state) = LOWER($2)`,
        [name, state],
      );
    } else {
      cidadeBaseQuery = await pool.query(
        `SELECT * FROM cities
                WHERE LOWER(name) = LOWER($1)`,
        [name],
      );
    }

    const cidadeBase = cidadeBaseQuery.rows[0];

    const todasCidades = await pool.query("SELECT * FROM cities");

    const raioKm = parseFloat(raio);

    const cidadesNoRaio = todasCidades.rows
      .map((cidade) => {
        const distance = calculateDistance(
          parseFloat(cidadeBase.lat),
          parseFloat(cidadeBase.lon),
          parseFloat(cidade.lat),
          parseFloat(cidade.lon),
        );

        return {
          id: cidade.id,
          name: cidade.name,
          state: cidade.state,
          lat: cidade.lat,
          lon: cidade.lon,
          distancia: Number(distance.toFixed(2)),
        };
      })
      .filter(
        (cidade) =>
          cidade.distancia <= raioKm &&
          cidade.name.toLowerCase() !== cidadeBase.name.toLowerCase() &&
          cidade.name.trim() !== cidadeBase.name.trim(),
      )
      .sort((a, b) => a.distancia - b.distancia);

    res.json({
      cidade_base: {
        name: cidadeBase.name,
        state: cidadeBase.state,
      },
      raio_km: raioKm,
      total_encontradas: cidadesNoRaio.length,
      cidades: cidadesNoRaio,
    });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Erro ao buscar cidades próximas: " + error.message });
  }
}

function calculateDistance(lat1, log1, lat2, lon2) {
  const R = 6371; // Raio da Terra em km
  const toRoad = (value) => (value * Math.PI) / 180; // Converter graus para radianos

  const dLat = toRoad(lat2 - lat1);
  const dLon = toRoad(lon2 - log1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRoad(lat1)) * Math.cos(toRoad(lat2)) * Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

module.exports = {
  getCitiesDb,
  getCityByName,
  createCity,
  getNearbyCities,
  searchCities,
  calculateDistance
};

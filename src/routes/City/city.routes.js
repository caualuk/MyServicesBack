const express = require("express");
const router = express.Router();

const {
  getCitiesDb,
  getCityByName,
  createCity,
  getNearbyCities,
  searchCities
} = require("./repository/City");

// BUSCAR CIDADE (autocomplete)
router.get("/search", searchCities);

// 💾 SALVAR CIDADE
router.post("/post", createCity);

//CIDADES PROXIMAS
router.get("/cidades-proximas", getNearbyCities);

module.exports = router;

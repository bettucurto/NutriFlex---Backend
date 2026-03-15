const axios = require('axios');
const { getCache, setCache } = require('../utils/cacheService');
require('dotenv').config(); // Garante que as tuas variáveis de ambiente estão a carregar!

// NOVA BASE URL: Tem de ser a da RapidAPI!
const API_BASE = 'https://edb-with-videos-and-images-by-ascendapi.p.rapidapi.com/api/v1/exercises';
const API_KEY = process.env.EXERCISEDB_KEY;

async function dbRequest(options) {
  try {
    return await axios.request(options);
  } catch (err) {
    const msg = err.response?.data?.message || err.message;
    const status = err.response?.status;
    const e = new Error(`ExerciseDB request failed${status ? ` (status ${status})` : ''}: ${msg}`);
    e.status = status;
    throw e;
  }
}

/**
 * Obter exercícios (Pesquisa, Filtro e Paginação V2)
 */
exports.getExercisesV2 = async (queryParams) => {
  const queryString = new URLSearchParams(queryParams).toString();
  const cacheKey = `v2_exercises_${queryString || 'all'}`;
  
  const cached = getCache(cacheKey);
  if (cached) {
    console.log('Resultado obtido do cache (V2)');
    return cached;
  }

  const options = {
    method: 'GET',
    url: API_BASE, 
    params: queryParams,
    headers: {
      'x-rapidapi-key': API_KEY,
      'x-rapidapi-host': 'edb-with-videos-and-images-by-ascendapi.p.rapidapi.com'
    }
  };

  const { data } = await dbRequest(options);
  
  if (!data || data.success !== true) {
    return { meta: {}, data: [] };
  }

  const result = {
    meta: data.meta || {}, 
    data: Array.isArray(data.data) ? data.data : [],
  };

  setCache(cacheKey, result, 3600);
  return result;
};

/**
 * Get exercise by ID.
 */
exports.getExerciseById = async (exerciseId) => {
  if (!exerciseId) throw new Error('Missing exercise ID');

  const cacheKey = `exercise_${exerciseId}`;
  const cached = getCache(cacheKey);
  if (cached) {
    console.log('Exercise obtained from cache');
    return cached;
  }

  const options = {
    method: 'GET',
    url: `${API_BASE}/${exerciseId}`,
    headers: {
      'x-rapidapi-key': API_KEY,
      'x-rapidapi-host': 'edb-with-videos-and-images-by-ascendapi.p.rapidapi.com'
    }
  };

  const { data } = await dbRequest(options);
  
  if (!data || data.success !== true) throw new Error('Exercise not found');

  const exercise = data.data || {};

  setCache(cacheKey, exercise, 3600);
  return exercise;
};
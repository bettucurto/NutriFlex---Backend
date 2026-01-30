const axios = require('axios');
const { getCache, setCache } = require('../utils/cacheService');
require('dotenv').config();

const API_HOST = 'exercisedb-api1.p.rapidapi.com';
const API_BASE = `https://${API_HOST}/api/v1/exercises`;
const API_KEY = process.env.EXERCISEDB_KEY;

if (!API_KEY) console.warn(' EXERCISEDB_KEY não encontrada no .env');

async function rapidRequest(options) {
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


exports.searchExercises = async (searchTerm) => {
  if (!searchTerm) throw new Error('Falta termo de pesquisa');

  const cacheKey = `search_${searchTerm.toLowerCase()}`;
  const cached = getCache(cacheKey);
  if (cached) {
    console.log(' Resultado obtido do cache');
    return cached;
  }

  const options = {
    method: 'GET',
    url: `${API_BASE}/search`,
    params: { search: searchTerm },
    headers: {
      'x-rapidapi-key': API_KEY,
      'x-rapidapi-host': API_HOST,
    },
  };

  const { data } = await rapidRequest(options);
  if (!data || data.success !== true) return [];

  const exercises = Array.isArray(data.data) ? data.data : [];

  setCache(cacheKey, exercises, 3600);
  return exercises;
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
        'x-rapidapi-host': API_HOST,
      },
    };


    const { data } = await rapidRequest(options);
    if (!data || data.success !== true) throw new Error('Exercise not found');


    const exercise = data.data || {};


    setCache(cacheKey, exercise, 3600);
    return exercise;
  };

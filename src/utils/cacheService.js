// src/utils/cacheService.js
const NodeCache = require('node-cache');

// TTL (time-to-live) em segundos — 1 hora = 3600
const cache = new NodeCache({ stdTTL: 3600, checkperiod: 600 });

// Guardar no cache
exports.setCache = (key, value, ttl = 3600) => {
  cache.set(key, value, ttl);
};

// Ler do cache
exports.getCache = (key) => {
  return cache.get(key);
};

// Apagar do cache (opcional)
exports.delCache = (key) => {
  cache.del(key);
};

// Limpar tudo (opcional)
exports.flushCache = () => {
  cache.flushAll();
};
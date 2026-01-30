const express = require('express');
const router = express.Router();
const authenticateToken = require('../utils/authMiddleware');
const {
  // Refeições
  getRefeicoesByUser,
  getRefeicaoById,
  addRefeicaoFavorita,
  updateRefeicaoFavorita,
  deleteRefeicaoFavorita,

  // Ingredientes
  getIngredientesByRefeicao,
  getIngredienteById,
  addIngrediente,
  updateIngrediente,
  deleteIngrediente,

  //Receitas
  searchReceitasFatSecret,
  getReceitasFavoritasByUser,
  addReceitaFavorita,
  deleteReceitaFavorita,
  getReceitaById,

  buscarAlimentosFatSecret,
  buscarAlimentoFatSecretPorId,
  buscarAutocomplete,
  recognizeFoodFromImage,
  uploadImagem,
} = require('../controllers/refeicaoController');


// --- Clarifai / FatSecret ---
router.get('/search', authenticateToken, buscarAlimentosFatSecret);
router.get('/search/:id', authenticateToken, buscarAlimentoFatSecretPorId);
router.get('/autocomplete', authenticateToken, buscarAutocomplete);

// aqui usamos o middleware do multer antes da função principal
router.post('/image', authenticateToken, uploadImagem, recognizeFoodFromImage);


// --- Refeições ---
router.get('/user/:id_user', authenticateToken, getRefeicoesByUser);
router.post('/', authenticateToken, addRefeicaoFavorita);
router.put('/:id', authenticateToken, updateRefeicaoFavorita);
router.delete('/:id', authenticateToken, deleteRefeicaoFavorita);
router.get('/:id', authenticateToken, getRefeicaoById);

// --- Receitas ---
router.get('/receitas/search', authenticateToken, searchReceitasFatSecret);
router.get('/receitas/favoritas/:userId', authenticateToken, getReceitasFavoritasByUser);
router.post('/receitas/favoritas', authenticateToken, addReceitaFavorita);
router.delete('/receitas/favoritas/:id', authenticateToken, deleteReceitaFavorita);
router.get('/receitas/:id', authenticateToken, getReceitaById);


// --- Ingredientes ---
router.get('/ingredientes/:id_refeicao', authenticateToken, getIngredientesByRefeicao);
router.get('/ingredientes/item/:id', authenticateToken, getIngredienteById);
router.post('/ingredientes', authenticateToken, addIngrediente);
router.put('/ingredientes/:id', authenticateToken, updateIngrediente);
router.delete('/ingredientes/:id', authenticateToken, deleteIngrediente);


module.exports = router;

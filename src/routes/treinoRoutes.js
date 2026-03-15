const express = require('express');
const router = express.Router();
const {
  createPasta,
  getPastas,
  getPastasByGlobal,
  deletePasta,
  duplicatePastaGlobal,
  updatePasta,
  createSessao,
  getSessoes,
  deleteSessao,
  updateSessao,
  addExercicio,
  getExercicios,
  deleteExercicio,
  updateExercicio,
  addExercicioSet,
  getExercicioSets,
  updateExercicioSet,
  deleteExercicioSet,
  getExercisesController,
  getExerciseByIdController,
  getExerciseDbBodyParts,
  getExerciseDbEquipments,
  getExerciseDbMuscles,
  getExerciseDbTypes,
} = require('../controllers/treinoController');
const authenticateToken = require('../utils/authMiddleware');

// Pastas de treino
router.post('/pastas', authenticateToken, createPasta);
router.get('/pastas/:id_user', authenticateToken, getPastas);
router.get('/pastas/global', authenticateToken, getPastasByGlobal);
router.delete('/pastas/:id', authenticateToken, deletePasta);
router.post('/duplicar-pasta', authenticateToken, duplicatePastaGlobal);
router.put('/pastas/:id', authenticateToken, updatePasta);

// Sessões
router.post('/sessao', authenticateToken, createSessao);
router.get('/sessoes/:id_pasta', authenticateToken, getSessoes);
router.delete('/sessao/:id', authenticateToken, deleteSessao);
router.put('/sessao/:id', authenticateToken, updateSessao);

// Exercícios de uma sessão
router.post('/exercicio', authenticateToken, addExercicio);
router.get('/exercicios/:id_sessao', authenticateToken, getExercicios);
router.delete('/exercicio/:id', authenticateToken, deleteExercicio);
router.put('/exercicio/:id', authenticateToken, updateExercicio);

// Sets de exercícios
router.post('/set', authenticateToken, addExercicioSet);
router.get('/sets/:id_exercicio', authenticateToken, getExercicioSets);
router.put('/set/:id', authenticateToken, updateExercicioSet);
router.delete('/set/:id', authenticateToken, deleteExercicioSet);

//ExerciseDB
router.get('/exercises', authenticateToken, getExercisesController);
router.get('/exercise/:id', authenticateToken, getExerciseByIdController);

// Filtros ExerciseDB (Tabelas Locais)
router.get('/exercisedb/bodyparts', authenticateToken, getExerciseDbBodyParts);
router.get('/exercisedb/equipments', authenticateToken, getExerciseDbEquipments);
router.get('/exercisedb/muscles', authenticateToken, getExerciseDbMuscles);
router.get('/exercisedb/types', authenticateToken, getExerciseDbTypes);

module.exports = router;
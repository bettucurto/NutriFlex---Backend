const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const userProgressController = require('../controllers/userProgressController');
const authenticateToken = require('../utils/authMiddleware');


router.get('/:id',authenticateToken, userController.getUserById);
router.put('/:id', authenticateToken, userController.updateUser);
router.delete('/:id', authenticateToken, userController.deleteUser);

// Progresso do utilizador
router.post('/:id_user/progress', authenticateToken, userProgressController.createProgress);
router.get('/:id_user/progress', authenticateToken, userProgressController.getProgressByUser);
router.delete('/progress/:id', authenticateToken, userProgressController.deleteProgress);
router.delete('/:id_user/progress', authenticateToken, userProgressController.deleteAllProgressByUser);

module.exports = router;

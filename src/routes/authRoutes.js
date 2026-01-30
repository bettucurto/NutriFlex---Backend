const express = require('express');
const router = express.Router();
const { registerUser, loginUser , getUserByEmail} = require('../controllers/authController');

// Registo
router.post('/register', registerUser);

// Login
router.post('/login', loginUser);

// Dados do utilizador por email
router.get('/user/:email', getUserByEmail);

module.exports = router;

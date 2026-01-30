// Carrega variáveis de ambiente
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();

// Middleware global
app.use(cors());
app.use(bodyParser.json());

// Importa rotas
const authRoutes = require('./src/routes/authRoutes');
const userRoutes = require('./src/routes/userRoutes');
const treinoRoutes = require('./src/routes/treinoRoutes');
const refeicaoRoutes = require('./src/routes/refeicaoRoutes');

// Monta rotas
app.use('/auth', authRoutes);           // Registo e login
app.use('/user', userRoutes);           // Info e update do utilizador
app.use('/treinos', treinoRoutes);      // Pastas, sessões e exercícios
app.use('/refeicoes', refeicaoRoutes);  // Refeições e ingredientes

// Start do servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor a correr na porta ${PORT}`);
});


//ESTE CODIGO ESTA ASSOMBRADO!!!!!!!!!!!!!
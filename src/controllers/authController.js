const db = require('../config/db');
const { hashPassword } = require('../utils/hashPassword');
const { generateToken } = require('../utils/jwtUtils');
const bcrypt = require('bcrypt');

// Registo de utilizador
exports.registerUser = async (req, res) => {
  const {
    nome,
    email,
    password,
    altura,
    data_nascenca,
    genero,
    peso_atual,
    peso_inicial,
    peso_meta,
    calorias_diarias,
    dificuldades_anteriores,
    objetivo,
    nivel_atividade
  } = req.body;

  if (!nome || !email || !password || !altura || !data_nascenca || !genero) {
    return res.status(400).json({ error: 'Campos obrigatórios em falta' });
  }

  try {
    // Verifica se o email já existe
    const [exists] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (exists.length > 0) {
      return res.status(400).json({ error: 'Email já registado' });
    }

    // Gera hash da password
    const hashedPassword = await hashPassword(password);

    // Insere utilizador na tabela users
    const [result] = await db.query(
      `INSERT INTO users (nome, data_nascenca, altura, email, genero, nivel_atividade, password)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [nome, data_nascenca, altura, email, genero, nivel_atividade, hashedPassword]
    );

    const userId = result.insertId;

    // Cria registo inicial em user_progress (opcional)
    if (peso_atual && peso_inicial && peso_meta) {
      await db.query(
        `INSERT INTO user_progress 
         (data, peso_atual, peso_inicial, peso_meta, calorias_diarias, dificuldades_anteriores, objetivo, id_user)
         VALUES (CURDATE(), ?, ?, ?, ?, ?, ?, ?)`,
        [
          peso_atual,
          peso_inicial,
          peso_meta,
          calorias_diarias || null,
          dificuldades_anteriores ?? null,
          objetivo ?? null,
          userId
        ]
      );
    }
    // Vai buscar o utilizador recém-criado
    const [users] = await db.query('SELECT * FROM users WHERE id = ?', [userId]);
    const newUser = users[0];

    // Gera token JWT para o novo utilizador
    const token = generateToken(newUser);

    res.status(201).json({ token});
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro no registo' });
  }
};

// Login de utilizador
exports.loginUser = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Campos obrigatórios em falta' });
  }

  try {
    const [user] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (user.length === 0) {
      return res.status(400).json({ error: 'Email não encontrado' });
    }

    const currentUser = user[0];
    const isValid = await bcrypt.compare(password, currentUser.password);

    if (!isValid) {
      return res.status(401).json({ error: 'Password incorreta' });
    }

    const token = generateToken(currentUser);
    res.json({ token, user: currentUser });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro no login' });
  }
};


// Get user + último progresso por email
exports.getUserByEmail = async (req, res) => {
  const { email } = req.params;

  if (!email) {
    return res.status(400).json({ error: 'Email é obrigatório' });
  }

  try {
    // 1) Buscar utilizador
    const [users] = await db.query(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: 'Utilizador não encontrado' });
    }

    const user = users[0];

    // 2) Buscar último registo de user_progress desse user
    const [progressRows] = await db.query(
      `SELECT *
         FROM user_progress
        WHERE id_user = ?
        ORDER BY data DESC, created_at DESC
        LIMIT 1`,
      [user.id]
    );

    const lastProgress = progressRows[0] || null;

    // 3) Montar resposta com o que o Android precisa
    return res.json({
      id: user.id,
      nome: user.nome,
      email: user.email,
      altura: user.altura,
      genero: user.genero,
      nivel_atividade: user.nivel_atividade,
      data_nascenca: user.data_nascenca,
      progress: lastProgress && {
        data: lastProgress.data,
        peso_atual: lastProgress.peso_atual,
        peso_meta: lastProgress.peso_meta,
        calorias_diarias: lastProgress.calorias_diarias,
        dificuldades_anteriores: lastProgress.dificuldades_anteriores,
        objetivo: lastProgress.objetivo
      }
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao obter utilizador' });
  }
};

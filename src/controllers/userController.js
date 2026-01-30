const db = require('../config/db');
const bcrypt = require('bcrypt');
const { hashPassword } = require('../utils/hashPassword');

// Atualizar utilizador com validação da password atual
exports.updateUser = async (req, res) => {
  const { id } = req.params;
  const {
    currentPassword, // password atual (obrigatória)
    nome,
    altura,
    genero,
    data_nascenca,
    password,        // nova password (opcional)
    nivel_atividade
  } = req.body;

  if (!currentPassword) {
    return res.status(400).json({ error: 'Password atual é obrigatória' });
  }

  try {
    // 1) Buscar utilizador atual
    const [rows] = await db.query('SELECT * FROM users WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Utilizador não encontrado' });
    }
    const current = rows[0];

    // 2) Validar password atual
    const isMatch = await bcrypt.compare(currentPassword, current.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Password atual incorreta' });
    }

    // 3) Determinar novos valores (ou manter atuais)
    const updatedNome = nome ?? current.nome;
    const updatedAltura = altura ?? current.altura;
    const updatedGenero = genero ?? current.genero;
    const updatedDataNascenca = data_nascenca ?? current.data_nascenca;
    const updatedNivel_atividade = nivel_atividade ?? current.nivel_atividade

    let updatedPassword = current.password;
    if (password && password.trim() !== '') {
      updatedPassword = await hashPassword(password);
    }

    await db.query(
      'UPDATE users SET nome = ?, altura = ?, genero = ?, data_nascenca = ?, password = ?, nivel_atividade = ? WHERE id = ?',
      [updatedNome, updatedAltura, updatedGenero, updatedDataNascenca, updatedPassword, updatedNivel_atividade, id]
    );

    res.json({ message: 'Utilizador atualizado com sucesso' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao atualizar utilizador' });
  }
};
// Obter utilizador
exports.getUserById = async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await db.query('SELECT * FROM users WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Utilizador não encontrado' });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao obter utilizador' });
  }
};

// Apagar utilizador
exports.deleteUser = async (req, res) => {
  const { id } = req.params;
  try {
    await db.query('DELETE FROM users WHERE id = ?', [id]);
    res.json({ message: 'Utilizador apagado com sucesso' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao apagar utilizador' });
  }
};

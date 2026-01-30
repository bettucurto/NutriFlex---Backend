const db = require('../config/db');

// Criar registo de progresso
exports.createProgress = async (req, res) => {
  const { id_user, peso_atual, peso_inicial, peso_meta, calorias_diarias, dificuldades_anteriores, objetivo } = req.body;

  if (!id_user || !peso_atual) {
    return res.status(400).json({ error: 'Campos obrigatórios em falta' });
  }

  try {
    await db.query(
      `INSERT INTO user_progress 
       (data, peso_atual, peso_inicial, peso_meta, calorias_diarias, dificuldades_anteriores, objetivo, id_user)
       VALUES (CURDATE(), ?, ?, ?, ?, ?, ?, ?)`,
      [peso_atual, peso_inicial, peso_meta, calorias_diarias, dificuldades_anteriores, objetivo, id_user]
    );
    res.status(201).json({ message: 'Progresso registado com sucesso' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao registar progresso' });
  }
};

// Obter progresso de um utilizador
exports.getProgressByUser = async (req, res) => {
  const { id_user } = req.params;
  try {
    const [rows] = await db.query('SELECT * FROM user_progress WHERE id_user = ? ORDER BY created_at DESC', [id_user]);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao obter progresso' });
  }
};

// Apagar registo específico
exports.deleteProgress = async (req, res) => {
  const { id } = req.params;
  try {
    await db.query('DELETE FROM user_progress WHERE id = ?', [id]);
    res.json({ message: 'Registo de progresso apagado' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao apagar progresso' });
  }
};

// userProgressController.js

exports.deleteAllProgressByUser = async (req, res) => {
  const { id_user } = req.params;
  try {
    await db.query('DELETE FROM user_progress WHERE id_user = ?', [id_user]);
    res.json({ message: 'All progress records deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error deleting progress records' });
  }
};

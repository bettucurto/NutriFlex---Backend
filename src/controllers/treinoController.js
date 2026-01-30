const db = require('../config/db');
const { searchExercises, getExerciseById } = require('../services/exerciseDbService');

//Pastas
exports.createPasta = async (req, res) => {
  const { nome, id_user, global } = req.body;
  if (!nome || id_user === undefined || global === undefined) {
    return res.status(400).json({ error: 'Campos obrigatórios em falta' });
  }

  try {
    const [result] = await db.query(
      'INSERT INTO pastas_treinos (nome, id_user, global) VALUES (?, ?, ?)',
      [nome, id_user, global]
    );
    res.status(201).json({ 
      message: 'Pasta criada com sucesso', 
      pasta: { id: result.insertId, nome, id_user, global } 
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao criar pasta' });
  }
};

exports.getPastas = async (req, res) => {
  const { id_user } = req.params;
  try {
    const [rows] = await db.query('SELECT * FROM pastas_treinos WHERE id_user = ?', [id_user]);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao obter pastas' });
  }
};

exports.getPastasByGlobal = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM pastas_treinos WHERE global = 1');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao obter pastas' });
  }
};

exports.deletePasta = async (req, res) => {
  const { id } = req.params;
  try {
    await db.query('DELETE FROM pastas_treinos WHERE id = ?', [id]);
    res.json({ message: 'Pasta apagada com sucesso' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao apagar pasta' });
  }
};

// Duplicar pasta global para um utilizador
exports.duplicatePastaGlobal = async (req, res) => {
  const { id_pasta_global, id_user } = req.body;

  if (!id_pasta_global || !id_user) {
    return res.status(400).json({ error: 'Campos obrigatórios em falta' });
  }

  try {
    // Obter a pasta global
    const [pastas] = await db.query(
      'SELECT * FROM pastas_treinos WHERE id = ? AND global = 1',
      [id_pasta_global]
    );

    if (pastas.length === 0) {
      return res.status(404).json({ error: 'Pasta global não encontrada' });
    }

    const pastaGlobal = pastas[0];

    //Inserir nova pasta para o utilizador
    const [resultPasta] = await db.query(
      'INSERT INTO pastas_treinos (nome, id_user, global) VALUES (?, ?, 0)',
      [pastaGlobal.nome, id_user]
    );

    const novaPastaId = resultPasta.insertId;

    //Obter todas as sessões da pasta global
    const [sessoes] = await db.query(
      'SELECT * FROM sessoes WHERE id_pasta = ?',
      [id_pasta_global]
    );

    //Duplicar sessões e respetivos exercícios
    for (const sessao of sessoes) {
      const [resultSessao] = await db.query(
        'INSERT INTO sessoes (nome, id_pasta) VALUES (?, ?)',
        [sessao.nome, novaPastaId]
      );
      const novaSessaoId = resultSessao.insertId;

      // Obter exercícios da sessão original
      const [exercicios] = await db.query(
        'SELECT * FROM sessao_exercicios WHERE id_sessao = ?',
        [sessao.id]
      );

      // Duplicar exercícios
      for (const ex of exercicios) {
        await db.query(
          'INSERT INTO sessao_exercicios (exercicio_api_id, notas, id_sessao) VALUES (?, ?, ?)',
          [ex.exercicio_api_id, ex.notas, novaSessaoId]
        );
      }
    }

    res.status(201).json({ message: 'Pasta global duplicada com sucesso', novaPastaId });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao duplicar pasta global' });
  }
};

exports.updatePasta = async (req, res) => {
  const { id } = req.params;
  const { nome } = req.body;

  if (!nome) return res.status(400).json({ error: 'Nome da pasta é obrigatório' });

  try {
    await db.query('UPDATE pastas_treinos SET nome = ? WHERE id = ?', [nome, id]);
    res.json({ message: 'Pasta atualizada com sucesso' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao atualizar pasta' });
  }
};


//Sessões
exports.createSessao = async (req, res) => {
  const { nome, id_pasta } = req.body;
  if (!nome || !id_pasta) {
    return res.status(400).json({ error: 'Campos obrigatórios em falta' });
  }
  try {
    const [result] = await db.query(
      'INSERT INTO sessoes (nome, id_pasta) VALUES (?, ?)',
      [nome, id_pasta]
    );
    res.status(201).json({ 
      message: 'Sessão criada com sucesso', 
      sessao: { id: result.insertId, nome, id_pasta } 
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao criar sessão' });
  }
};

exports.getSessoes = async (req, res) => {
  const { id_pasta } = req.params;
  try {
    const [rows] = await db.query('SELECT * FROM sessoes WHERE id_pasta = ?', [id_pasta]);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao obter sessões' });
  }
};

exports.deleteSessao = async (req, res) => {
  const { id } = req.params;
  try {
    await db.query('DELETE FROM sessoes WHERE id = ?', [id]);
    res.json({ message: 'Sessão apagada com sucesso' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao apagar sessão' });
  }
};

exports.updateSessao = async (req, res) => {
  const { id } = req.params;
  const { nome } = req.body;

  if (!nome) return res.status(400).json({ error: 'Nome da sessão é obrigatório' });

  try {
    await db.query('UPDATE sessoes SET nome = ? WHERE id = ?', [nome, id]);
    res.json({ message: 'Sessão atualizada com sucesso' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao atualizar sessão' });
  }
};

//Exercicos
exports.addExercicio = async (req, res) => {
  const { exercicio_api_id, notas, id_sessao } = req.body;

  if (!exercicio_api_id || !id_sessao) {
    return res.status(400).json({ error: 'Campos obrigatórios em falta' });
  }

  try {
    const [result] = await db.query(
      'INSERT INTO sessao_exercicios (exercicio_api_id, notas, id_sessao) VALUES (?, ?, ?)',
      [exercicio_api_id, notas || '', id_sessao]
    );

    res.status(201).json({
      message: 'Exercício adicionado com sucesso',
      exercicio: { id: result.insertId, exercicio_api_id, notas, id_sessao }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao adicionar exercício' });
  }
};

exports.getExercicios = async (req, res) => {
  const { id_sessao } = req.params;

  try {
    const [rows] = await db.query(
      'SELECT * FROM sessao_exercicios WHERE id_sessao = ?',
      [id_sessao]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao obter exercícios' });
  }
};

exports.deleteExercicio = async (req, res) => {
  const { id } = req.params;

  try {
    await db.query('DELETE FROM sessao_exercicios WHERE id = ?', [id]);
    res.json({ message: 'Exercício apagado com sucesso' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao apagar exercício' });
  }
};

exports.updateExercicio = async (req, res) => {
  const { id } = req.params;
  const { exercicio_api_id, notas } = req.body;

  if (!exercicio_api_id) return res.status(400).json({ error: 'ID do exercício é obrigatório' });

  try {
    await db.query(
      'UPDATE sessao_exercicios SET exercicio_api_id = ?, notas = ? WHERE id = ?',
      [exercicio_api_id, notas || '', id]
    );
    res.json({ message: 'Exercício atualizado com sucesso' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao atualizar exercício' });
  }
};

//Sets
exports.addExercicioSet = async (req, res) => {
  const { tipo_set, peso, repeticoes_min, repeticoes_max, peso_ultima_vez, repeticoes_ultima_vez, id_exercicio, ordem } = req.body;

  if (!tipo_set || !peso || !repeticoes_min || !repeticoes_max || !id_exercicio || !ordem) {
    return res.status(400).json({ error: 'Campos obrigatórios em falta' });
  }

  try {
    const [result] = await db.query(
      `INSERT INTO exercicio_sets 
       (tipo_set, peso, repeticoes_min, repeticoes_max, peso_ultima_vez, repeticoes_ultima_vez, ordem, id_exercicio)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [tipo_set, peso, repeticoes_min, repeticoes_max, peso_ultima_vez || 0, repeticoes_ultima_vez || 0, ordem, id_exercicio]
    );

    res.status(201).json({ message: 'Set criado com sucesso', setId: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao criar set' });
  }
};


exports.getExercicioSets = async (req, res) => {
  const { id_exercicio } = req.params;

  try {
    const [rows] = await db.query(
      'SELECT * FROM exercico_sets WHERE id_exercicio = ?',
      [id_exercicio]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao obter sets' });
  }
};

exports.updateExercicioSet = async (req, res) => {
  const { id } = req.params;
  const { tipo_set, peso, repeticoes_min, repeticoes_max, peso_ultima_vez, repeticoes_ultima_vez, ordem} = req.body;

  try {
    await db.query(
      `UPDATE exercico_sets 
       SET tipo_set = ?, peso = ?, repeticoes_min = ?, repeticoes_max = ?, peso_ultima_vez = ?, repeticoes_ultima_vez = ?, ordem = ? 
       WHERE id = ?`,
      [tipo_set, peso, repeticoes_min, repeticoes_max, peso_ultima_vez, repeticoes_ultima_vez, ordem, id]
    );
    res.json({ message: 'Set atualizado com sucesso' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao atualizar set' });
  }
};

exports.deleteExercicioSet = async (req, res) => {
  const { id } = req.params;

  try {
    await db.query('DELETE FROM exercico_sets WHERE id = ?', [id]);
    res.json({ message: 'Set apagado com sucesso' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao apagar set' });
  }
};

//ExerciseDB
//Pesquisar exercícios
exports.searchExercisesController = async (req, res) => {
  const { q } = req.query; // Ex: /treinos/exercises?q=peito
  if (!q) return res.status(400).json({ error: 'Falta o parâmetro de pesquisa (q)' });

  try {
    const results = await searchExercises(q);
    res.json({ success: true, count: results.length, data: results });
  } catch (err) {
    console.error('Erro na pesquisa de exercícios:', err);
    res.status(500).json({ error: err.message });
  }
};

//Obter exercício específico por ID
exports.getExerciseByIdController = async (req, res) => {
  const { id } = req.params;
  if (!id) return res.status(400).json({ error: 'ID do exercício em falta' });

  try {
    const exercise = await getExerciseById(id);
    res.json({ success: true, data: exercise });
  } catch (err) {
    console.error('Erro ao obter exercício por ID:', err);
    res.status(500).json({ error: err.message });
  }
};
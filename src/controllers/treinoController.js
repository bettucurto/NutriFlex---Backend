const db = require('../config/db');
const { getExercisesV2, getExerciseById, filterExercises } = require('../services/exerciseDbService');

//Pastas
exports.createPasta = async (req, res) => {
  const { nome, id_user, visibilidade, is_deletable, frequency, experience } = req.body;
  if (!nome || id_user === undefined || !visibilidade) {
    return res.status(400).json({ error: 'Campos obrigatórios em falta' });
  }

  try {
    const [result] = await db.query(
      'INSERT INTO pastas_treinos (nome, id_user, visibilidade, is_deletable, frequency, experience) VALUES (?, ?, ?, ?, ?, ?)',
      [nome, id_user, visibilidade, is_deletable !== undefined ? is_deletable : 1, frequency || null, experience || null]
    );
    res.status(201).json({
      message: 'Pasta criada com sucesso',
      pasta: { id: result.insertId, nome, id_user, visibilidade, is_deletable: is_deletable !== undefined ? is_deletable : 1, frequency, experience }
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
    // Usamos visibilidade='publica' como equivalente a global
    const [rows] = await db.query("SELECT * FROM pastas_treinos WHERE visibilidade = 'publica'");
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao obter pastas públicas' });
  }
};

exports.getPublicWorkouts = async (req, res) => {
  const { frequency, experience } = req.query;
  try {
    let sql = "SELECT * FROM pastas_treinos WHERE visibilidade = 'publica'";
    const params = [];
    if (frequency) {
      sql += " AND frequency = ?";
      params.push(frequency);
    }
    if (experience) {
      sql += " AND experience = ?";
      params.push(experience);
    }
    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao obter treinos públicos" });
  }
};

exports.deletePasta = async (req, res) => {
  const { id } = req.params;
  try {
    // Verificar se a pasta pode ser apagada
    const [rows] = await db.query('SELECT is_deletable FROM pastas_treinos WHERE id = ?', [id]);

    if (rows.length > 0 && rows[0].is_deletable === 0) {
      return res.status(403).json({ error: 'Esta pasta é de sistema e não pode ser apagada.' });
    }

    await db.query('DELETE FROM pastas_treinos WHERE id = ?', [id]);
    res.json({ message: 'Pasta apagada com sucesso' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao apagar pasta' });
  }
};

// Duplicar pasta pública para um utilizador
exports.duplicatePastaGlobal = async (req, res) => {
  const { id_pasta_global, id_user } = req.body;

  if (!id_pasta_global || !id_user) {
    return res.status(400).json({ error: 'Campos obrigatórios em falta' });
  }

  try {
    // Obter a pasta pública
    const [pastas] = await db.query(
      "SELECT * FROM pastas_treinos WHERE id = ? AND visibilidade = 'publica'",
      [id_pasta_global]
    );

    if (pastas.length === 0) {
      return res.status(404).json({ error: 'Pasta pública não encontrada' });
    }

    const pastaGlobal = pastas[0];

    // Inserir nova pasta para o utilizador (privada e deletável)
    const [resultPasta] = await db.query(
      "INSERT INTO pastas_treinos (nome, id_user, visibilidade, is_deletable, frequency, experience) VALUES (?, ?, 'privada', 1, ?, ?)",
      [pastaGlobal.nome, id_user, pastaGlobal.frequency, pastaGlobal.experience]
    );

    const novaPastaId = resultPasta.insertId;

    //Obter todas as sessões da pasta global
    const [sessoes] = await db.query(
      'SELECT * FROM sessoes WHERE id_pasta = ?',
      [id_pasta_global]
    );

    const mappingSessoes = {}; // oldSessaoId -> novaSessaoId

    // 1º Passo: Duplicar sessões e respetivos exercícios/sets
    for (const sessao of sessoes) {
      const [resultSessao] = await db.query(
        'INSERT INTO sessoes (nome, id_pasta, id_Proxim_sessao) VALUES (?, ?, NULL)',
        [sessao.nome, novaPastaId]
      );
      const novaSessaoId = resultSessao.insertId;
      mappingSessoes[sessao.id] = novaSessaoId;

      // Obter exercícios da sessão original
      const [exercicios] = await db.query(
        'SELECT * FROM sessao_exercicios WHERE id_sessao = ?',
        [sessao.id]
      );

      // Duplicar exercícios e seus sets
      for (const ex of exercicios) {
        const [resultEx] = await db.query(
          'INSERT INTO sessao_exercicios (exercicio_api_id, nome, notas, id_sessao, imagem, bodypart) VALUES (?, ?, ?, ?, ?, ?)',
          [ex.exercicio_api_id, ex.nome, ex.notas, novaSessaoId, ex.imagem, ex.bodypart]
        );
        const novoExId = resultEx.insertId;

        // Obter sets do exercício original
        const [sets] = await db.query(
            'SELECT * FROM exercicio_sets WHERE id_exercicio = ?',
            [ex.id]
        );

        // Duplicar sets
        for (const set of sets) {
            await db.query(
                'INSERT INTO exercicio_sets (tipo_set, peso, repeticoes_min, repeticoes_max, peso_ultima_vez, repeticoes_ultima_vez, id_exercicio, ordem) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [set.tipo_set, set.peso, set.repeticoes_min, set.repeticoes_max, set.peso_ultima_vez, set.repeticoes_ultima_vez, novoExId, set.ordem]
            );
        }
      }
    }

    // 2º Passo: Atualizar os id_Proxim_sessao circularmente
    for (const sessao of sessoes) {
      const novaSessaoId = mappingSessoes[sessao.id];
      const oldNextId = sessao.id_Proxim_sessao;
      const newNextId = mappingSessoes[oldNextId];

      if (newNextId) {
        await db.query('UPDATE sessoes SET id_Proxim_sessao = ? WHERE id = ?', [newNextId, novaSessaoId]);
      } else {
        // Fallback: se o id_Proxim_sessao original não apontar para nada no mapping (ex: pasta original mal formada)
        await db.query('UPDATE sessoes SET id_Proxim_sessao = ? WHERE id = ?', [novaSessaoId, novaSessaoId]);
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
  const { nome, frequency, experience } = req.body;

  if (!nome) return res.status(400).json({ error: 'Nome da pasta é obrigatório' });

  try {
    await db.query('UPDATE pastas_treinos SET nome = ?, frequency = ?, experience = ? WHERE id = ?', [nome, frequency, experience, id]);
    res.json({ message: 'Pasta atualizada com sucesso' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao atualizar pasta' });
  }
};

//Sessões
exports.createSessao = async (req, res) => {
  const { nome, id_pasta, exercicios } = req.body;
  if (!nome || !id_pasta) {
    return res.status(400).json({ error: 'Campos obrigatórios em falta' });
  }

  try {
    // Lógica de Encadeamento Circular (Passo A e B)
    const [firstSessions] = await db.query(
      'SELECT id FROM sessoes WHERE id_pasta = ? ORDER BY id ASC LIMIT 1',
      [id_pasta]
    );
    const [lastSessions] = await db.query(
      'SELECT id FROM sessoes WHERE id_pasta = ? ORDER BY id DESC LIMIT 1',
      [id_pasta]
    );

    const firstSessionId = firstSessions.length > 0 ? firstSessions[0].id : null;
    const lastSessionId = lastSessions.length > 0 ? lastSessions[0].id : null;

    const [resultSessao] = await db.query(
      'INSERT INTO sessoes (nome, id_pasta, id_Proxim_sessao) VALUES (?, ?, NULL)',
      [nome, id_pasta]
    );
    const newSessionId = resultSessao.insertId;

    // Passo C: Fechar o Loop Circular
    if (!firstSessionId) {
      await db.query('UPDATE sessoes SET id_Proxim_sessao = ? WHERE id = ?', [newSessionId, newSessionId]);     
    } else {
      await db.query('UPDATE sessoes SET id_Proxim_sessao = ? WHERE id = ?', [firstSessionId, newSessionId]);   
      await db.query('UPDATE sessoes SET id_Proxim_sessao = ? WHERE id = ?', [newSessionId, lastSessionId]);    
    }

    // --- Inserção de Exercícios e Sets ---
    if (exercicios && Array.isArray(exercicios)) {
      for (const ex of exercicios) {
        const [resultEx] = await db.query(
          'INSERT INTO sessao_exercicios (id_sessao, exercicio_api_id, nome, notas, ordem, imagem, bodypart) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [newSessionId, ex.id_exercicio, ex.nome, ex.notas, ex.ordem, ex.imagem, ex.bodypart]
        );
        const newExId = resultEx.insertId;

        if (ex.sets && Array.isArray(ex.sets)) {
          for (const set of ex.sets) {
            const tipo_set = set.tipo_set || 'REGULAR';
            const peso = set.peso || 0;
            const repeticoes_min = set.repeticoes_min || 0;
            const repeticoes_max = set.repeticoes_max || 0;
            const ordem = set.ordem || 1;

            await db.query(
              'INSERT INTO exercicio_sets (tipo_set, peso, repeticoes_min, repeticoes_max, ordem, id_exercicio, repeticoes_ultima_vez) VALUES (?, ?, ?, ?, ?, ?, 0)',
              [tipo_set, peso, repeticoes_min, repeticoes_max, ordem, newExId]
            );
          }
        }
      }
    }

    res.status(201).json({
      message: 'Sessão e exercícios criados com sucesso',
      sessao: { id: newSessionId, nome, id_pasta, id_Proxim_sessao: firstSessionId || newSessionId }
    });
  } catch (err) {
    console.error('Erro ao criar sessão completa:', err);
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
    const [currentSession] = await db.query(
      'SELECT id_pasta, id_Proxim_sessao FROM sessoes WHERE id = ?',
      [id]
    );

    if (currentSession.length > 0) {
      const { id_pasta, id_Proxim_sessao: nextId } = currentSession[0];

      const [prevSessions] = await db.query(
        'SELECT id FROM sessoes WHERE id_pasta = ? AND id_Proxim_sessao = ?',
        [id_pasta, id]
      );

      if (prevSessions.length > 0) {
        const prevId = prevSessions[0].id;

        if (prevId != id) {
          await db.query(
            'UPDATE sessoes SET id_Proxim_sessao = ? WHERE id = ?',
            [nextId, prevId]
          );
        }
      }
    }

    await db.query('DELETE FROM sessoes WHERE id = ?', [id]);
    res.json({ message: 'Sessão apagada com sucesso (Corrente remendada)' });
  } catch (err) {
    console.error('Erro ao apagar sessão circular:', err);
    res.status(500).json({ error: 'Erro ao apagar sessão' });
  }
};

exports.getSessaoById = async (req, res) => {
  const { id } = req.params;
  try {
    const [sessoes] = await db.query('SELECT * FROM sessoes WHERE id = ?', [id]);
    if (sessoes.length === 0) return res.status(404).json({ error: 'Sessão não encontrada' });

    const sessao = sessoes[0];

    const [exercicios] = await db.query(
      'SELECT * FROM sessao_exercicios WHERE id_sessao = ? ORDER BY ordem ASC',
      [id]
    );

    for (const ex of exercicios) {
      const [sets] = await db.query('SELECT * FROM exercicio_sets WHERE id_exercicio = ? ORDER BY ordem ASC', [ex.id]);
      ex.sets = sets;
    }

    sessao.exercicios = exercicios;
    res.json(sessao);
  } catch (err) {
    console.error('Erro ao obter detalhes da sessão:', err);
    res.status(500).json({ error: 'Erro ao obter detalhes da sessão' });
  }
};

exports.updateSessao = async (req, res) => {
  const { id } = req.params;
  const { nome, exercicios } = req.body;

  if (!nome) return res.status(400).json({ error: 'Nome da sessão é obrigatório' });

  try {
    await db.query('UPDATE sessoes SET nome = ? WHERE id = ?', [nome, id]);

    const [currentExs] = await db.query('SELECT id FROM sessao_exercicios WHERE id_sessao = ?', [id]);
    const exIds = currentExs.map(ex => ex.id);

    if (exIds.length > 0) {
      await db.query('DELETE FROM exercicio_sets WHERE id_exercicio IN (?)', [exIds]);
    }
    await db.query('DELETE FROM sessao_exercicios WHERE id_sessao = ?', [id]);

    if (exercicios && Array.isArray(exercicios)) {
      for (const ex of exercicios) {
        const [resultEx] = await db.query(
          'INSERT INTO sessao_exercicios (id_sessao, exercicio_api_id, nome, notas, ordem, imagem, bodypart) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [id, ex.id_exercicio, ex.nome, ex.notas, ex.ordem, ex.imagem, ex.bodypart]
        );
        const newExId = resultEx.insertId;

        if (ex.sets && Array.isArray(ex.sets)) {
          for (const set of ex.sets) {
            const tipo_set = set.tipo_set || 'REGULAR';
            const peso = set.peso || 0;
            const repeticoes_min = set.repeticoes_min || 0;
            const repeticoes_max = set.repeticoes_max || 0;
            const ordem = set.ordem || 1;

            await db.query(
              'INSERT INTO exercicio_sets (tipo_set, peso, repeticoes_min, repeticoes_max, ordem, id_exercicio, repeticoes_ultima_vez) VALUES (?, ?, ?, ?, ?, ?, 0)',
              [tipo_set, peso, repeticoes_min, repeticoes_max, ordem, newExId]
            );
          }
        }
      }
    }

    res.json({ message: 'Sessão atualizada com sucesso' });
  } catch (err) {
    console.error('Erro ao atualizar sessão:', err);
    res.status(500).json({ error: 'Erro ao atualizar sessão' });
  }
};

//Exercicos
exports.addExercicio = async (req, res) => {
  const { exercicio_api_id, nome, notas, id_sessao, imagem, bodypart } = req.body;

  if (!exercicio_api_id || !id_sessao) {
    return res.status(400).json({ error: 'Campos obrigatórios em falta' });
  }

  try {
    const [result] = await db.query(
      'INSERT INTO sessao_exercicios (exercicio_api_id, nome, notas, id_sessao, imagem, bodypart) VALUES (?, ?, ?, ?, ?, ?)',
      [exercicio_api_id, nome || '', notas || '', id_sessao, imagem || null, bodypart || null]
    );

    res.status(201).json({
      message: 'Exercício adicionado com sucesso',
      exercicio: { id: result.insertId, exercicio_api_id, nome, notas, id_sessao, imagem, bodypart }
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
  const { exercicio_api_id, nome, notas, imagem, bodypart } = req.body;

  if (!exercicio_api_id) return res.status(400).json({ error: 'ID do exercício é obrigatório' });

  try {
    await db.query(
      'UPDATE sessao_exercicios SET exercicio_api_id = ?, nome = ?, notas = ?, imagem = ?, bodypart = ? WHERE id = ?',
      [exercicio_api_id, nome || '', notas || '', imagem || null, bodypart || null, id]
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
      'SELECT * FROM exercicio_sets WHERE id_exercicio = ?',
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
      `UPDATE exercicio_sets
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
    await db.query('DELETE FROM exercicio_sets WHERE id = ?', [id]);
    res.json({ message: 'Set apagado com sucesso' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao apagar set' });
  }
};

//ExerciseDB
exports.getExercisesController = async (req, res) => {
  try {
    const {
      name, keywords, targetMuscles, secondaryMuscles,
      exerciseType, bodyParts, equipments, limit, after, before
    } = req.query;

    const params = {};
    if (name) params.name = name;
    if (keywords) params.keywords = keywords;
    if (targetMuscles) params.targetMuscles = targetMuscles;
    if (secondaryMuscles) params.secondaryMuscles = secondaryMuscles;
    if (exerciseType) params.exerciseType = exerciseType;
    if (bodyParts) params.bodyParts = bodyParts;
    if (equipments) params.equipments = equipments;
    if (limit) params.limit = limit;
    if (after) params.after = after;
    if (before) params.before = before;

    const result = await getExercisesV2(params);

    res.json({
      success: true,
      meta: result.meta,
      data: result.data
    });
  } catch (err) {
    console.error('Erro ao obter exercícios (V2):', err);
    res.status(500).json({ error: err.message });
  }
};

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

// Filtros ExerciseDB (Tabelas Locais)
exports.getExerciseDbBodyParts = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM exercisedb_bodyparts ORDER BY name ASC');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao obter body parts' });
  }
};

exports.getExerciseDbEquipments = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM exercisedb_equipments ORDER BY name ASC');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao obter equipamentos' });
  }
};

exports.getExerciseDbMuscles = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM exercisedb_muscles ORDER BY name ASC');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao obter músculos' });
  }
};

exports.getExerciseDbTypes = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM exercisedb_types ORDER BY name ASC');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao obter tipos de exercício' });
  }
};

exports.updateSetHistory = async (req, res) => {
  const { id } = req.params;
  const { peso_ultima_vez, repeticoes_ultima_vez } = req.body;

  if (peso_ultima_vez === undefined || repeticoes_ultima_vez === undefined) {
    return res.status(400).json({ error: 'Campos de histórico (peso e reps) são obrigatórios' });
  }

  try {
    await db.query(
      'UPDATE exercicio_sets SET peso_ultima_vez = ?, repeticoes_ultima_vez = ? WHERE id = ?',
      [peso_ultima_vez, repeticoes_ultima_vez, id]
    );
    res.json({ message: 'Histórico de set atualizado com sucesso' });
  } catch (err) {
    console.error('Erro ao atualizar histórico do set:', err);
    res.status(500).json({ error: 'Erro ao atualizar histórico' });
  }
};

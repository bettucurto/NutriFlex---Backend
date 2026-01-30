const db = require('../config/db');
const { recognizeFoodImage } = require("../services/clarifaiService");
const { searchFood, searchAutocomplete, getFoodById, searchRecipes, getRecipeById } = require("../services/fatSecretService");
const multer = require('multer');
const sharp = require('sharp');
const { identifyFood } = require('../services/nutrifoodsService');


// Configuração do multer (armazenamento em memória)
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Middleware de upload exportado
exports.uploadImagem = upload.single("imagem");

// Refeições
exports.getRefeicoesByUser = async (req, res) => {
  const { userId } = req.params;
  try {
    const [rows] = await db.query('SELECT * FROM refeicoes_favoritas WHERE id_user = ?', [userId]);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao obter refeições' });
  }
};

exports.getRefeicaoById = async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await db.query('SELECT * FROM refeicoes_favoritas WHERE id = ?', [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Refeição não encontrada' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao obter refeição' });
  }
};

exports.addRefeicaoFavorita = async (req, res) => {
  const { nome, id_user } = req.body;
  try {
    await db.query('INSERT INTO refeicoes_favoritas (nome, id_user) VALUES (?, ?)', [nome, id_user]);
    res.json({ message: 'Refeição adicionada' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao adicionar refeição' });
  }
};

exports.updateRefeicaoFavorita = async (req, res) => {
  const { id } = req.params;
  const { nome } = req.body;

  try {
    const [result] = await db.query('UPDATE refeicoes_favoritas SET nome = ? WHERE id = ?', [nome, id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Refeição não encontrada' });
    }

    res.json({ message: 'Refeição atualizada com sucesso' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao atualizar refeição' });
  }
};

exports.deleteRefeicaoFavorita = async (req, res) => {
  const { id } = req.params;

  try {
    const [result] = await db.query('DELETE FROM refeicoes_favoritas WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Refeição não encontrada' });
    }

    res.json({ message: 'Refeição apagada com sucesso' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao apagar refeição' });
  }
};

// Ingredientes das refeições
exports.getIngredientesByRefeicao = async (req, res) => {
  const { id_refeicao } = req.params;
  try {
    const [rows] = await db.query('SELECT * FROM refeicao_ingredientes WHERE id_refeicao = ?', [id_refeicao]);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao obter ingredientes' });
  }
};

exports.getIngredienteById = async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await db.query('SELECT * FROM refeicao_ingredientes WHERE id = ?', [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Ingrediente não encontrado' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao obter ingrediente' });
  }
};

exports.addIngrediente = async (req, res) => {
  const { alimento_api_id, tipo_porcao, quantidade_porcoes, id_refeicao } = req.body;
  try {
    await db.query(
      'INSERT INTO refeicao_ingredientes (alimento_api_id, tipo_porcao, quantidade_porcoes, id_refeicao) VALUES (?, ?, ?, ?)',
      [alimento_api_id, tipo_porcao, quantidade_porcoes, id_refeicao]
    );
    res.json({ message: 'Ingrediente adicionado com sucesso' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao adicionar ingrediente' });
  }
};

exports.updateIngrediente = async (req, res) => {
  const { id } = req.params;
  const { alimento_api_id, tipo_porcao, quantidade_porcoes, id_refeicao } = req.body;
  try {
    const [result] = await db.query(
      'UPDATE refeicao_ingredientes SET alimento_api_id = ?, tipo_porcao = ?, quantidade_porcoes = ?, id_refeicao = ? WHERE id = ?',
      [alimento_api_id, tipo_porcao, quantidade_porcoes, id_refeicao, id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Ingrediente não encontrado' });
    res.json({ message: 'Ingrediente atualizado com sucesso' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao atualizar ingrediente' });
  }
};

exports.deleteIngrediente = async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await db.query('DELETE FROM refeicao_ingredientes WHERE id = ?', [id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Ingrediente não encontrado' });
    res.json({ message: 'Ingrediente apagado com sucesso' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao apagar ingrediente' });
  }
};

// FatSecret
exports.buscarAlimentosFatSecret = async (req, res) => {
  const { nome } = req.query;
  try {
    const alimentos = await searchFood(nome); // usa função exportada
    res.json(alimentos);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar alimentos' });
  }
};

exports.buscarAutocomplete = async (req, res) => {
  const { q } = req.query;
  if (!q || q.length < 2) return res.json([]);
  
  try {
    const sugestoes = await searchAutocomplete(q);
    res.json(sugestoes);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar sugestões' });
  }
};

exports.buscarAlimentoFatSecretPorId = async (req, res) => {
  const { id } = req.params;
  try {
    const alimento = await getFoodById(id); // usa função exportada
    res.json(alimento);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar alimento por ID' });
  }
};

exports.recognizeFoodFromImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Nenhuma imagem enviada" });
    }

    const imagemComprimida = await sharp(req.file.buffer)
      .resize({ width: 512 })
      .jpeg({ quality: 80 })
      .toBuffer();

    const imageBase64 = imagemComprimida.toString("base64");

    // apanha o JWT que veio do cliente
    const authHeader = req.headers["authorization"] || "";

    // AGORA sim passas o token explicitamente
    const reconhecidos = await identifyFood(imageBase64, authHeader);

    return res.json({
      sucesso: true,
      resultados: reconhecidos, 
    });
  } catch (error) {
    console.error("Erro em recognizeFoodFromImage:", error);
    return res.status(500).json({
      error: "Erro ao reconhecer alimento por imagem",
      detalhe: String(error),
    });
  }
};

//Receitas
exports.searchReceitasFatSecret = async (req, res) => {
  const q = req.query.q;
  if (!q) return res.status(400).json({ error: "O termo de busca 'q' é obrigatório." });

  const filters = {
    max_results: parseInt(req.query.max_results || "20"),
    page_number: parseInt(req.query.page || "0"),
    recipe_types: req.query.tipo || null,

    calorie_range: req.query.calorias || null,

    carbs_min: req.query.carbs_min ? Number(req.query.carbs_min) : null,
    carbs_max: req.query.carbs_max ? Number(req.query.carbs_max) : null,

    protein_min: req.query.protein_min ? Number(req.query.protein_min) : null,
    protein_max: req.query.protein_max ? Number(req.query.protein_max) : null,

    fat_min: req.query.fat_min ? Number(req.query.fat_min) : null,
    fat_max: req.query.fat_max ? Number(req.query.fat_max) : null,
  };

  try {
    const receitas = await searchRecipes(q, filters);
    res.json({ sucesso: true, encontrados: receitas.length, receitas });
  } catch (err) {
    console.error("Erro ao pesquisar receitas:", err);
    res.status(500).json({ error: "Erro ao pesquisar receitas" });
  }
};

// GET /receitas/favoritas/:userId
exports.getReceitasFavoritasByUser = async (req, res) => {
  const { userId } = req.params;
  try {
    const [rows] = await db.query('SELECT * FROM receitas_favoritas WHERE id_user = ?', [userId]);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao obter receitas favoritas' });
  }
};

// POST /receitas/favoritas  { id_user, id_receita_api }
exports.addReceitaFavorita = async (req, res) => {
  const { id_user, id_receita_api } = req.body;
  if (!id_user || !id_receita_api) return res.status(400).json({ error: 'Faltam campos id_user ou id_receita_api' });

  try {
    await db.query('INSERT INTO receitas_favoritas (id_user, id_receita_api) VALUES (?, ?)', [id_user, id_receita_api]);
    res.json({ message: 'Receita adicionada aos favoritos' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao adicionar receita aos favoritos' });
  }
};

// DELETE /receitas/favoritas/:id
exports.deleteReceitaFavorita = async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await db.query('DELETE FROM receitas_favoritas WHERE id = ?', [id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Receita favorita não encontrada' });
    res.json({ message: 'Receita favorita removida' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao apagar receita favorita' });
  }
};

// GET /receitas/:id
exports.getReceitaById = async (req, res) => {
  const { id } = req.params;
  if (!id) return res.status(400).json({ error: 'recipe id obrigatório' });

  try {
    const receita = await getRecipeById(id);
    if (!receita) return res.status(404).json({ error: 'Receita não encontrada' });
    return res.json({ sucesso: true, receita });
  } catch (err) {
    console.error('Erro ao obter receita por id:', err);
    return res.status(500).json({ error: 'Erro ao obter receita' });
  }
};

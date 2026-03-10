const db = require('../config/db');
const { recognizeFoodImage } = require("../services/clarifaiService");
const { searchFood, searchAutocomplete, getFoodById, searchRecipes, getRecipeById } = require("../services/fatSecretService");
const multer = require('multer');
const sharp = require('sharp');
const { identifyFood } = require('../services/nutrifoodsService');


// ConfiguraÃ§Ã£o do multer (armazenamento em memÃ³ria)
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Middleware de upload exportado
exports.uploadImagem = upload.single("imagem");

// RefeiÃ§Ãµes
exports.getRefeicoesByUser = async (req, res) => {
  const { userId } = req.params;
  try {
    let meals = [];
    try {
      // Tenta plural primeiro (conforme SQL)
      const [rows] = await db.query('SELECT * FROM refeicoes_favoritas WHERE id_user = ?', [userId]);
      meals = rows;
    } catch (e) {
      // Se falhar, tenta singular (caso o utilizador tenha renomeado no live)
      const [rows] = await db.query('SELECT * FROM refeicao_favorita WHERE id_user = ?', [userId]);
      meals = rows;
    }
    
    // Para cada refeição, buscar os seus ingredientes
    for (let meal of meals) {
      const [ingredients] = await db.query('SELECT * FROM refeicao_ingredientes WHERE id_refeicao = ?', [meal.id]);
      meal.ingredientes = ingredients;
    }

    res.json(meals);
  } catch (err) {
    console.error("Erro em getRefeicoesByUser:", err);
    res.status(500).json({ error: 'Erro ao obter refeições', detail: err.message });
  }
};

exports.getRefeicaoById = async (req, res) => {
  const { id } = req.params;
  try {
    let meal;
    try {
      const [rows] = await db.query('SELECT * FROM refeicoes_favoritas WHERE id = ?', [id]);
      meal = rows[0];
    } catch (e) {
      const [rows] = await db.query('SELECT * FROM refeicao_favorita WHERE id = ?', [id]);
      meal = rows[0];
    }

    if (!meal) return res.status(404).json({ error: 'Refeição não encontrada' });
    
    const [ingredients] = await db.query('SELECT * FROM refeicao_ingredientes WHERE id_refeicao = ?', [meal.id]);
    meal.ingredientes = ingredients;

    res.json(meal);
  } catch (err) {
    console.error("Erro em getRefeicaoById:", err);
    res.status(500).json({ error: 'Erro ao obter refeição', detail: err.message });
  }
};

exports.addRefeicaoFavorita = async (req, res) => {
  const { nome, id_user, image, calories, fat_pct, carbs_pct, protein_pct, description } = req.body;
  try {
    const final_nome = nome || 'Meal';
    const final_image = image || null;
    const final_calories = calories || 0;
    const final_fat = fat_pct || 0;
    const final_carbs = carbs_pct || 0;
    const final_protein = protein_pct || 0;
    const final_description = description || '';

    const sql = `INSERT INTO refeicoes_favoritas 
      (nome, id_user, image, calories, fat_pct, carbs_pct, protein_pct, description) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;

    const [result] = await db.query(sql, [
      final_nome, 
      id_user, 
      final_image, 
      final_calories, 
      final_fat, 
      final_carbs, 
      final_protein, 
      final_description
    ]);

    res.json({ message: 'Refeicao adicionada', id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao adicionar refeicao' });
  }
};

exports.updateRefeicaoFavorita = async (req, res) => {
  const { id } = req.params;
  const { nome, image, calories, fat_pct, carbs_pct, protein_pct, description } = req.body;

  try {
    const sql = `UPDATE refeicoes_favoritas SET 
      nome = ?, image = ?, calories = ?, fat_pct = ?, carbs_pct = ?, protein_pct = ?, description = ? 
      WHERE id = ?`;

    const [result] = await db.query(sql, [
      nome, image, calories, fat_pct, carbs_pct, protein_pct, description, id
    ]);  

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Refeicao nao encontrada' });
    }

    res.json({ message: 'Refeicao atualizada com sucesso' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao atualizar refeicao' });
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
  const { alimento_api_id, tipo_porcao, quantidade_porcoes, id_refeicao, nome_alimento } = req.body;
  try {
    await db.query(
      'INSERT INTO refeicao_ingredientes (alimento_api_id, tipo_porcao, quantidade_porcoes, id_refeicao, nome_alimento) VALUES (?, ?, ?, ?, ?)',
      [alimento_api_id, tipo_porcao, quantidade_porcoes, id_refeicao, nome_alimento]
    );
    res.json({ message: 'Ingrediente adicionado com sucesso' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao adicionar ingrediente' });
  }
};

exports.updateIngrediente = async (req, res) => {
  const { id } = req.params;
  const { alimento_api_id, tipo_porcao, quantidade_porcoes, id_refeicao, nome_alimento } = req.body;      
  try {
    const [result] = await db.query(
      'UPDATE refeicao_ingredientes SET alimento_api_id = ?, tipo_porcao = ?, quantidade_porcoes = ?, id_refeicao = ?, nome_alimento = ? WHERE id = ?',
      [alimento_api_id, tipo_porcao, quantidade_porcoes, id_refeicao, nome_alimento, id]
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
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Ingrediente nÃ£o encontrado' }); 
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
    const alimentos = await searchFood(nome); // usa funÃ§Ã£o exportada
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
    res.status(500).json({ error: 'Erro ao buscar sugestÃµes' });
  }
};

exports.buscarAlimentoFatSecretPorId = async (req, res) => {
  const { id } = req.params;
  try {
    const alimento = await getFoodById(id); // usa funÃ§Ã£o exportada
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
  if (!q) return res.status(400).json({ error: "O termo de busca 'q' Ã© obrigatÃ³rio." });

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

// POST /receitas/favoritas
exports.addReceitaFavorita = async (req, res) => {
  // Desestruturamos do body enviado pelo Android
  const { id_user, id_receita_api, nome, image, calories, carbs_pct, protein_pct, fat_pct, description } = req.body;
  
  if (!id_user || !id_receita_api) {
    return res.status(400).json({ error: 'Faltam campos id_user ou id_receita_api' });
  }

  try {
    // Como na tua DB as colunas são NOT NULL, garantimos valores padrão se vierem undefined do Android
    const final_nome = nome || 'Recipe';
    const final_image = image || '';
    const final_calories = calories || 0;
    const final_carbs = carbs_pct || 0;
    const final_protein = protein_pct || 0;
    const final_fat = fat_pct || 0;
    const final_description = description || '';

    const sql = `INSERT INTO receitas_favoritas 
      (id_user, id_receita_api, nome, image, calories, carbs_pct, protein_pct, fat_pct, description) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    
    const [result] = await db.query(sql, [
      id_user, 
      id_receita_api, 
      final_nome, 
      final_image, 
      final_calories, 
      final_carbs, 
      final_protein, 
      final_fat, 
      final_description
    ]);

    res.json({ message: 'Receita adicionada aos favoritos', id: result.insertId });
  } catch (err) {
    console.error("ERRO MYSQL DETALHADO:", err);
    res.status(500).json({ error: 'Erro ao adicionar receita aos favoritos', detail: err.message });
  }
};

// DELETE /receitas/favoritas/:id
exports.deleteReceitaFavorita = async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await db.query('DELETE FROM receitas_favoritas WHERE id = ?', [id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Receita favorita nÃ£o encontrada' });
    res.json({ message: 'Receita favorita removida' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao apagar receita favorita' });
  }
};
// GET /receitas/:id
exports.getReceitaById = async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ error: 'ID da receita obrigatório' });
  }

  try {
    const receita = await getRecipeById(id);
    
    if (!receita) {
      return res.status(404).json({ error: 'Receita não encontrada' });
    }
    
    return res.json({ sucesso: true, receita });
  } catch (err) {
    console.error('Erro ao obter receita por id:', err);
    return res.status(500).json({ error: 'Erro ao obter receita' });
  }
};

// DELETE /refeicao/:id_refeicao/ingredientes (Exemplo de rota)
exports.deleteIngredientesByRefeicao = async (req, res) => { 
  const { id_refeicao } = req.params; 
  
  try { 
    await db.query("DELETE FROM refeicao_ingredientes WHERE id_refeicao = ?", [id_refeicao]); 
    return res.json({ message: "Ingredientes da refeição apagados com sucesso" }); 
  } catch (err) { 
    console.error('Erro ao apagar ingredientes da refeição:', err); 
    return res.status(500).json({ error: "Erro ao apagar ingredientes da refeição" }); 
  } 
};
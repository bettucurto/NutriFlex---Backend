const axios = require("axios");
const qs = require("qs");

const { getCache, setCache } = require("../utils/cacheService");

const FATSECRET_BASE_URL = "https://platform.fatsecret.com/rest/server.api";

// Configurações OAuth 2.0
const FATSECRET_CLIENT_ID = process.env.FATSECRET_KEY;
const FATSECRET_CLIENT_SECRET = process.env.FATSECRET_SECRET;

let accessToken = null;
let tokenExpiresAt = null;

async function getAccessToken() {
  if (accessToken && tokenExpiresAt && Date.now() < tokenExpiresAt) {
    return accessToken;
  }

  const credentials = Buffer.from(
    `${FATSECRET_CLIENT_ID}:${FATSECRET_CLIENT_SECRET}`
  ).toString("base64");

  try {
    const response = await axios.post(
      "https://oauth.fatsecret.com/connect/token",
      qs.stringify({ grant_type: "client_credentials", scope: "premier" }),
      {
        headers: {
          Authorization: `Basic ${credentials}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    accessToken = response.data.access_token;
    tokenExpiresAt = Date.now() + response.data.expires_in * 1000;

    console.log(" Token FatSecret obtido com sucesso!");
    return accessToken;
  } catch (error) {
    console.error(" Erro ao obter token do FatSecret:", error.message);
    throw new Error("Falha na autenticação com FatSecret");
  }
}

exports.searchFood = async (query, limit = 50) => {
  if (!query) return [];

  try {
    const token = await getAccessToken();

    const response = await axios.get(FATSECRET_BASE_URL, {
      params: {
        method: "foods.search.v4",
        search_expression: query,
        format: "json",
        max_results: limit,
        include_food_images: true, // imagens ativas
      },
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.data.error) {
      console.error("FatSecret ERROR:", response.data.error);
      return [];
    }

    let foods = response.data.foods_search?.results?.food || [];
    if (!Array.isArray(foods)) foods = [foods];

    // 1) ordenar: primeiro com imagens, depois sem
    foods.sort((a, b) => {
      const hasImgA = !!a.food_images?.food_image;
      const hasImgB = !!b.food_images?.food_image;
      return (hasImgB.compareTo?.(hasImgA) ?? (hasImgB === hasImgA ? 0 : hasImgB ? 1 : -1));
      // mais simples:
      // if (hasImgA === hasImgB) return 0;
      // return hasImgA ? -1 : 1;
    });

    const foodsLimited = foods.slice(0, limit);

    return foodsLimited.map((food) => {
      const firstServing = Array.isArray(food.servings?.serving)
        ? food.servings.serving[0]
        : food.servings?.serving || {};

      const cals = firstServing.calories || "0";
      const carbsG = firstServing.carbohydrate || "0";
      const protG = firstServing.protein || "0";
      const fatG = firstServing.fat || "0";

      const descricaoFormatada =
        `Calories: ${cals} | Protein: ${protG}g | Carbs: ${carbsG}g | Fats: ${fatG}g`;

      const imageUrl = (() => {
        try {
          const images = food.food_images?.food_image;
          if (Array.isArray(images) && images.length > 0) {
            const thumb = images.find(img =>
              img.image_url?.includes("72x72") || img.image_url?.includes("70x70")
            );
            return thumb?.image_url || images[0].image_url;
          }
          if (images?.image_url) return images.image_url;
        } catch {}

        // fallback opcional (podes deixar só return null)
        const nomeLower = (food.food_name || "").toLowerCase();
        if (nomeLower.contains?.("chicken") || nomeLower.includes("chicken")) {
          return "https://m.ftscrt.com/static/recipe/01840016-e78b-4b90-a52c-c7d901f8b7fa.jpg";
        }
        return null;
      })();

      return {
        id: food.food_id,
        nome_en: food.food_name,
        descricao_en: descricaoFormatada,
        tipo: food.food_type || "Generic",
        url: food.food_url,
        calories: firstServing.calories,
        carbs_grams: firstServing.carbohydrate,
        protein_grams: firstServing.protein,
        fat_grams: firstServing.fat,
        macro_split: (() => {
          const cNum = Number(firstServing.calories) || 0;
          const carbsNum = Number(firstServing.carbohydrate) || 0;
          const protNum = Number(firstServing.protein) || 0;
          const fatNum = Number(firstServing.fat) || 0;
          const kcalCarbs = carbsNum * 4;
          const kcalProt = protNum * 4;
          const kcalFat = fatNum * 9;
          const total = kcalCarbs + kcalProt + kcalFat;
          if (total > 0) {
            return {
              carbs: Math.round((kcalCarbs / total) * 100),
              protein: Math.round((kcalProt / total) * 100),
              fat: Math.round((kcalFat / total) * 100),
            };
          }
          return null;
        })(),
        image: imageUrl,
      };
    });
  } catch (error) {
    console.error("Erro searchFood v4:", error.message);
    return [];
  }
};

exports.searchAutocomplete = async (query) => {
  if (!query || query.length < 2) return [];

  try {
    const token = await getAccessToken();

    const response = await axios.get(FATSECRET_BASE_URL, {
      params: {
        method: "foods.autocomplete.v2",
        expression: query,        // ← CORRETO segundo docs
        format: "json",
        max_results: 3,           // exatamente 3 como na imagem
      },
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.data.error) {
      console.error("Autocomplete ERROR:", response.data.error);
      return [];
    }

    // Estrutura EXATA da doc: suggestions.suggestion[]
    const suggestions = response.data.suggestions?.suggestion || [];
    if (!Array.isArray(suggestions)) return [];

    // Retorna TOP 3 como strings simples
    return suggestions.slice(0, 3).map(suggestion => ({
      nome: typeof suggestion === 'string' ? suggestion : suggestion.food_name || suggestion,
    }));
  } catch (error) {
    console.error("Erro autocomplete v2:", error.response?.data || error.message);
    return [];
  }
};


// ALTERA esta função
exports.getFoodById = async (foodId) => {
  if (!foodId) return null;

  try {
    const token = await getAccessToken();

    const response = await axios.get(FATSECRET_BASE_URL, {
      params: {
        method: 'food.get.v5',
        food_id: foodId,
        format: 'json',
        include_food_images: true,   
        include_food_attributes: true
      },
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    const food = response.data.food;
    if (!food) return null;

    // servings (igual ao que já tinhas)
    const servings = Array.isArray(food.servings?.serving)
      ? food.servings.serving
      : [food.servings?.serving].filter(Boolean);

    const firstServing = servings[0];

    // imagens → food_images.food_image.image_url
    const image = getFoodImage(food.food_images?.food_image);

    // atributos (allergens/preferences)
    const allergens =
      food.food_attributes?.allergens?.allergen
        ? food.food_attributes.allergens.allergen
        : [];

    const preferences =
      food.food_attributes?.preferences?.preference
        ? food.food_attributes.preferences.preference
        : [];

    return {
      id: food.food_id,
      nomeen: food.food_name,
      descricaoen: food.food_description || '',
      porcao: firstServing?.serving_description || '',
      calorias: firstServing?.calories?.toString() || '0',
      proteina: firstServing?.protein?.toString() || '0',
      gordura: firstServing?.fat?.toString() || '0',
      carboidratos: firstServing?.carbohydrate?.toString() || '0',

      servings: servings.map((serving) => ({
        servingid: serving.serving_id,
        servingdescription: serving.serving_description,
        metricservingamount: parseFloat(serving.metric_serving_amount || '0'),
        metricservingunit: serving.metric_serving_unit,
        numberofunits: parseFloat(serving.number_of_units || '1'),
        measurementdescription: serving.measurement_description,
        calories: parseFloat(serving.calories || '0'),
        carbohydrate: parseFloat(serving.carbohydrate || '0'),
        protein: parseFloat(serving.protein || '0'),
        fat: parseFloat(serving.fat || '0'),
        saturatedfat: parseFloat(serving.saturated_fat || '0'),
        cholesterol: parseFloat(serving.cholesterol || '0'),
        sodium: parseFloat(serving.sodium || '0'),
        fiber: parseFloat(serving.fiber || '0'),
        sugar: parseFloat(serving.sugar || '0'),
      })),

      image: image,

      // agora vens mesmo da doc v5
      allergens: allergens,
      preferences: preferences,

      foodtype: food.food_type,      // "Generic" ou "Brand"
      brandname: food.brand_name || null,
    };
  } catch (error) {
    console.error(
      'Erro ao obter detalhes do alimento v5:',
      error.response?.data || error.message
    );
    return null;
  }
};

// CORREÇÃO: nomes das imagens na doc v5
function getFoodImage(images) {
  if (!images) return null;
  const imgs = Array.isArray(images) ? images : [images];

  // Doc v5: image_url
  const thumb = imgs.find(
    (img) =>
      img.image_url?.includes('72x72') ||
      img.image_url?.includes('400x400') ||
      img.image_url?.includes('1024x1024')
  );

  return (
    thumb?.image_url ||
    imgs[0]?.image_url ||
    null
  );
}



//Receitas
exports.searchRecipes = async (query, filters = {}) => {
  if (!query) return [];

  const {
    max_results = 20,
    page_number = 0,
    recipe_types,
    calorie_range,
    carbs_min,
    carbs_max,
    protein_min,
    protein_max,
    fat_min,
    fat_max,
  } = filters;

  try {
    const token = await getAccessToken();

    const params = {
      method: "recipes.search.v3",
      search_expression: query,
      max_results,
      page_number,
      format: "json",
    };

    if (recipe_types) params.recipe_types = recipe_types;

    const response = await axios.get(FATSECRET_BASE_URL, {
      params,
      headers: { Authorization: `Bearer ${token}` },
    });

    let recipes = response.data.recipes?.recipe || [];
    if (!Array.isArray(recipes)) recipes = [recipes];

    let formatted = recipes.map((r) => ({
      id: r.recipe_id,
      nome_en: r.recipe_name,
      descricao_en: r.recipe_description,
      image: r.recipe_image,
      nutrition: r.recipe_nutrition || null,
      macro_split: r.recipe_nutrition?.macro_split || null,
      calories: r.recipe_nutrition?.calories || null,
      types: r.recipe_types
        ? Array.isArray(r.recipe_types.recipe_type)
          ? r.recipe_types.recipe_type
          : [r.recipe_types.recipe_type]
        : [],
    }));

    // --- Filtros ---
    if (calorie_range) {
      formatted = formatted.filter((r) => {
        const c = Number(r.calories || 0);
        switch (calorie_range) {
          case "under_100": return c < 100;
          case "100_250": return c >= 100 && c <= 250;
          case "250_500": return c >= 250 && c <= 500;
          case "over_500": return c > 500;
        }
      });
    }

    formatted = formatted.filter((r) => {
      const m = r.macro_split;
      if (!m) return true;

      const carbs = Number(m.carbs);
      const protein = Number(m.protein);
      const fat = Number(m.fat);

      if (carbs_min && carbs < carbs_min) return false;
      if (carbs_max && carbs > carbs_max) return false;
      if (protein_min && protein < protein_min) return false;
      if (protein_max && protein > protein_max) return false;
      if (fat_min && fat < fat_min) return false;
      if (fat_max && fat > fat_max) return false;

      return true;
    });

    return formatted;
  } catch (error) {
    console.error("Erro ao pesquisar receitas:", error.message);
    return [];
  }
};

// ---------------------------------------------------------
// GET RECIPE BY ID (com cache)
// ---------------------------------------------------------
exports.getRecipeById = async (recipeId) => {
  if (!recipeId) return null;

  const cacheKey = `recipe_${recipeId}`;
  const cached = getCache(cacheKey);

  if (cached) {
    console.log(` Cache HIT → receita ${recipeId}`);
    return cached;
  }

  console.log(` Cache MISS → receita ${recipeId}`);

  try {
    const token = await getAccessToken();

    const response = await axios.get(FATSECRET_BASE_URL, {
      params: {
        method: "recipe.get.v2",
        recipe_id: recipeId,
        format: "json",
      },
      headers: { Authorization: `Bearer ${token}` },
    });

    const r = response.data.recipe;
    if (!r) return null;

    const toArray = (v) => (Array.isArray(v) ? v : v ? [v] : []);

    const recipe = {
      id: r.recipe_id,
      name: r.recipe_name,
      url: r.recipe_url,
      description: r.recipe_description,
      number_of_servings: Number(r.number_of_servings || 0),
      grams_per_portion: Number(r.grams_per_portion || 0),
      preparation_time_min: Number(r.preparation_time_min || 0),
      cooking_time_min: Number(r.cooking_time_min || 0),
      rating: Number(r.rating || 0),
      images: toArray(r.recipe_images?.recipe_image),
      types: toArray(r.recipe_types?.recipe_type),
      categories: toArray(r.recipe_categories?.recipe_category).map((c) => ({
        name: c.recipe_category_name,
        url: c.recipe_category_url,
      })),
      servings: toArray(r.serving_sizes?.serving),
      ingredients: toArray(r.ingredients?.ingredient),
      directions: toArray(r.directions?.direction),
    };

    // Guardar em cache por 24h
    setCache(cacheKey, recipe, 24 * 60 * 60);

    return recipe;
  } catch (error) {
    console.error(" Erro ao obter receita:", error.message);
    return null;
  }
};

const axios = require("axios");

const CLARIFAI_USER_ID = process.env.CLARIFAI_USER_ID;
const CLARIFAI_APP_ID = process.env.CLARIFAI_APP_ID;
const CLARIFAI_PAT = process.env.CLARIFAI_PAT;
const MODEL_ID = "food-item-recognition"; // Modelo público de alimentos

/**
 * Analisa uma imagem e devolve os alimentos reconhecidos
 * @param {string} imageBase64 - imagem codificada em base64
 */
exports.recognizeFoodImage = async (imageBase64) => {
  try {
    if (!imageBase64) throw new Error("Imagem em Base64 é obrigatória");

    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, "");

    
    const response = await axios.post(
      `https://api.clarifai.com/v2/models/${MODEL_ID}/outputs`,
      {
        user_app_id: {
          user_id: CLARIFAI_USER_ID,
          app_id: CLARIFAI_APP_ID,
        },
        inputs: [
          {
            data: { image: { base64: cleanBase64 } },
          },
        ],
      },
      {
        headers: {
          Authorization: `Key ${CLARIFAI_PAT}`,
        },
      }
    );
    console.log(JSON.stringify(response.data, null, 2));

    // 🔍 Extrai e formata os resultados
    const concepts = response.data.outputs?.[0]?.data?.concepts || [];

    if (concepts.length === 0) {
      console.warn("⚠️ Nenhum alimento reconhecido pela Clarifai");
    }

    const reconhecidos = concepts.map((c) => ({
      nome: c.name,
      confianca: c.value,
    }));

    return reconhecidos;
  } catch (error) {
    console.error("Erro Clarifai:", error.response?.data || error.message);
    throw new Error("Falha ao analisar imagem com Clarifai");
  }
};


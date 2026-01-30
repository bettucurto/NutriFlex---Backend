// função de serviço, NÃO é (req, res)
const axios = require("axios");

const NUTRIFOODS_BASE_URL = "https://api.nutriflex.pt/";


exports.identifyFood = async (imageBase64, authHeader = "") => {
  if (!imageBase64) {
    throw new Error("imageBase64 is required");
  }

  const response = await axios.post(
    NUTRIFOODS_BASE_URL + "/predict",
    { imageBase64 },
    {
      headers: {
        Authorization: authHeader, // reencaminha tal e qual
      },
    }
  );

  // response.data é o array [{ class, confident, index, probability }, ...]
  return response.data;
};
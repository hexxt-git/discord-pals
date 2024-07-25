const axios = require("axios").default;

const options = {
  method: "POST",
  url: "https://api.edenai.run/v2/text/chat",
  headers: {
    authorization: process.env.edenai,
  },
  data: {
    providers: "openai/gpt-4o",
    text: "Hello i need your help ! write a random sentence",
    chatbot_global_action: "Act as an assistant",
    previous_history: [],
    temperature: 0.0,
    max_tokens: 150,
  },
};

for (let i = 0; i < 1; i++) {
  axios
    .request(options)
    .then((response) => {
      console.log(response.data["openai/gpt-4o"].generated_text);
    })
    .catch((error) => {
      console.error(error);
    });
}

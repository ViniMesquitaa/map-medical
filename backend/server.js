const express = require("express");
const mysql = require("mysql2");
const bodyParser = require("body-parser");
const { Expo } = require("expo-server-sdk");
const axios = require("axios");

const app = express();
const port = 3000;

app.use(bodyParser.json());

const pool = mysql.createPool({
  host: "localhost",
  user: "root",
  password: "v712091311",
  database: "emergency_app",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

pool.getConnection((err, connection) => {
  if (err) {
    console.error("Erro ao conectar ao banco de dados:", err);
    return;
  }
  console.log("Conexão com o banco de dados estabelecida com sucesso.");
  connection.release();
});

const expo = new Expo();

const GOOGLE_MAPS_API_KEY = "CHAVE_DA_API_DO_GOOGLE_MAPS"; 

app.post("/requestEmergency", async (req, res) => {
  const { emergencyType, location } = req.body;

  if (!emergencyType || !location || !location.latitude || !location.longitude) {
    console.error("Dados inválidos recebidos:", { emergencyType, location });
    return res.status(400).json({ error: "Dados inválidos. Certifique-se de fornecer o tipo de emergência e a localização." });
  }

  try {
    console.log("Recebida nova solicitação de emergência:", { emergencyType, location });

    const address = await getAddressFromCoordinates(location.latitude, location.longitude);
    console.log("Endereço obtido:", address);

    pool.query(
      "INSERT INTO requests (emergency_type, latitude, longitude, address, status) VALUES (?, ?, ?, ?, ?)",
      [emergencyType, location.latitude, location.longitude, address, "pending"], 
      (err, result) => {
        if (err) {
          console.error("Erro ao salvar a solicitação no banco de dados:", err);
          return res.status(500).json({ error: "Erro ao salvar a solicitação no banco de dados." });
        }

        console.log("Solicitação salva no banco de dados com ID:", result.insertId);

        sendPushNotification(location, address, result.insertId)
          .then(() => {
            console.log("Notificação push enviada com sucesso.");
            res.status(200).json({ message: "Solicitação de emergência recebida e notificação enviada." });
          })
          .catch((error) => {
            console.error("Erro ao enviar notificação push:", error);
            res.status(500).json({ error: "Erro ao enviar notificação push." });
          });
      }
    );
  } catch (error) {
    console.error("Erro ao processar a solicitação:", error);
    res.status(500).json({ error: "Erro ao processar a solicitação." });
  }
});

app.post("/respondToRequest", (req, res) => {
  const { requestId, response } = req.body; 

  if (!requestId || !response) {
    console.error("Dados inválidos recebidos:", { requestId, response });
    return res.status(400).json({ error: "Dados inválidos. Certifique-se de fornecer o ID da solicitação e a resposta." });
  }

  pool.query(
    "UPDATE requests SET status = ? WHERE id = ?",
    [response, requestId],
    (err, result) => {
      if (err) {
        console.error("Erro ao atualizar o status da solicitação:", err);
        return res.status(500).json({ error: "Erro ao atualizar o status da solicitação." });
      }

      if (result.affectedRows === 0) {
        console.error("Solicitação não encontrada com ID:", requestId);
        return res.status(404).json({ error: "Solicitação não encontrada." });
      }

      console.log("Status da solicitação atualizado:", { requestId, response });
      res.status(200).json({ message: `Solicitação ${response} com sucesso.` });
    }
  );
});

const getAddressFromCoordinates = async (latitude, longitude) => {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${GOOGLE_MAPS_API_KEY}`;

  try {
    const response = await axios.get(url);

    if (response.data.status === "OK" && response.data.results.length > 0) {
      return response.data.results[0].formatted_address;
    } else {
      console.error("Resposta da API do Google Maps:", response.data);
      throw new Error(`Erro na API do Google Maps: ${response.data.status}`);
    }
  } catch (error) {
    console.error("Erro ao buscar endereço:", error);
    throw new Error("Erro ao conectar à API do Google Maps.");
  }
};

const sendPushNotification = async (location, address, requestId) => {
  const doctorPushToken = "TOKEN_EXPO_DO_MEDICO"; 

  if (!Expo.isExpoPushToken(doctorPushToken)) {
    console.error("Token de push inválido:", doctorPushToken);
    throw new Error("Token de push inválido.");
  }

  const messages = [{
    to: doctorPushToken,
    sound: "default",
    title: "Nova Emergência!",
    body: `Solicitação de emergência recebida. Endereço: ${address}`,
    data: { location, address, requestId }, 
  }];

  try {
    const chunks = expo.chunkPushNotifications(messages);
    const tickets = [];
    for (const chunk of chunks) {
      const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
      tickets.push(...ticketChunk);
    }
    console.log("Notificação push enviada com sucesso.");
  } catch (error) {
    console.error("Erro ao enviar notificação push:", error);
    throw new Error("Erro ao enviar notificação push.");
  }
};

app.use((err, res) => {
  console.error("Erro global:", err);
  res.status(500).json({ error: "Ocorreu um erro interno no servidor." });
});

app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});
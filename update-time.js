// update-time.js
import fs from "fs";
import fetch from "node-fetch";

// URL de l'horloge atomique Ambrea
const API_URL = "https://timeapi.io/api/Time/current/zone?timeZone=Europe/Paris";

// Fonction principale pour récupérer l'heure et mettre à jour le JSON
async function updateTime() {
    try {
        // Récupère l'heure actuelle
        const response = await fetch(API_URL);
        const data = await response.json();

        // Prépare les données à écrire dans le JSON
        const jsonData = {
            server: "Ambrea Time API",
            timezone: "Europe/Paris",
            timestamp: new Date(data.dateTime).getTime(),
            datetime: data.dateTime
        };

        // Écrit les nouvelles données dans time.json
        fs.writeFileSync("time.json", JSON.stringify(jsonData, null, 4));
        console.log("✅ time.json mis à jour :", jsonData.datetime);
    } catch (error) {
        console.error("❌ Erreur lors de la mise à jour :", error);
    }
}

// Met à jour immédiatement, puis toutes les 10 secondes
updateTime();
setInterval(updateTime, 10000);

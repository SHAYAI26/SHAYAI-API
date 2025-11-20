import express from 'express';
import cors from 'cors';
import { MongoClient } from 'mongodb';

const app = express();
app.use(cors());
app.use(express.json());

// === CONFIG ===
const MONGO_URI = process.env.MONGO_URI; // יוגדר ב-Render
let db;

// === Connect to Mongo ===
async function initDb() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  db = client.db("shayai");
  console.log("MongoDB connected");
}
initDb();

// === API: Lead from Google ===
app.post('/api/leads', async (req, res) => {
  try {
    const lead = {
      name: req.body.name,
      phone: req.body.phone,
      area: req.body.area,
      dealType: req.body.dealType,
      lang: req.body.lang,
      isBroker: req.body.isBroker,
      source: "LandingPage",
      createdAt: new Date(),
      stage: "New",
      heat: 0,
      pool: "Cold"
    };

    // חישוב חום
    if (lead.dealType === "buy") lead.heat += 20;
    if (lead.dealType === "sell") lead.heat += 40;
    if (lead.area) lead.heat += 10;

    // חום → בריכה
    lead.pool = lead.heat >= 50 ? "Hot" : lead.heat >= 20 ? "Warm" : "Cold";

    await db.collection("leads").insertOne(lead);
    res.json({ status: "ok", lead });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: "error", message: err.toString() });
  }
});

// === Root ===
app.get('/', (req, res) => {
  res.send("SHAYAI API is running.");
});

// === Start ===
app.listen(3000, () => console.log("Server running on port 3000"));

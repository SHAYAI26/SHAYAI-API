import express from 'express';
import cors from 'cors';
import { MongoClient, ServerApiVersion } from 'mongodb';

const app = express();
app.use(cors());
app.use(express.json());

// === CONFIG ===
const MONGO_URI = process.env.MONGO_URI; // מוגדר ב-Render

if (!MONGO_URI) {
  console.error('MONGO_URI is not defined! Check Render environment variables.');
}

let db;
let client;

// === Connect to Mongo ===
async function initDb() {
  try {
    client = new MongoClient(MONGO_URI, {
      serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
      },
      // mongodb+srv כבר עובד עם TLS, אבל נוסיף לו הגדרה מפורשת:
      tls: true,
    });

    await client.connect();
    db = client.db('shayai');
    console.log('MongoDB connected');
  } catch (err) {
    console.error('Error connecting to MongoDB:', err);
  }
}

initDb();

// === Middleware לוודא שיש DB לפני בקשות ===
function ensureDb(req, res, next) {
  if (!db) {
    return res.status(503).json({
      status: 'error',
      message: 'Database not connected yet. Please try again in a moment.',
    });
  }
  next();
}

// === API: Lead from Google / Landing page ===
app.post('/api/leads', ensureDb, async (req, res) => {
  try {
    const lead = {
      name: req.body.name || '',
      phone: req.body.phone || '',
      area: req.body.area || '',
      dealType: req.body.dealType || '',
      lang: req.body.lang || '',
      isBroker: req.body.isBroker ?? false,
      source: 'LandingPage',
      createdAt: new Date(),
      stage: 'New',
      heat: 0,
      pool: 'Cold',
    };

    // חישוב חום
    if (lead.dealType === 'buy') lead.heat += 20;
    if (lead.dealType === 'sell') lead.heat += 40;
    if (lead.area) lead.heat += 10;

    // חום → בריכה
    lead.pool = lead.heat >= 50 ? 'Hot' : lead.heat >= 20 ? 'Warm' : 'Cold';

    const result = await db.collection('leads').insertOne(lead);

    res.json({ status: 'ok', id: result.insertedId, lead });
  } catch (err) {
    console.error('Error inserting lead:', err);
    res.status(500).json({ status: 'error', message: err.toString() });
  }
});

// === Root ===
app.get('/', (req, res) => {
  res.send('SHAYAI API is running.');
});

// === Start ===
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

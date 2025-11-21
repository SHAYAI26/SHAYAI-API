import express from 'express';
import cors from 'cors';
import { MongoClient, ServerApiVersion } from 'mongodb';

const app = express();

// ===== Middleware בסיסי =====
app.use(cors()); // אפשר בהמשך להגביל דומיינים
app.use(express.json()); // JSON
app.use(express.urlencoded({ extended: true })); // טפסים / x-www-form-urlencoded

// ===== CONFIG =====
const MONGO_URI = process.env.MONGO_URI; // מוגדר ב-Render

if (!MONGO_URI) {
  console.error('MONGO_URI is not defined! Check Render environment variables.');
}

let db;
let client;

// ===== חיבור ל-MongoDB =====
async function initDb() {
  try {
    client = new MongoClient(MONGO_URI, {
      serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
      },
      tls: true, // חיבור מאובטח ל-Atlas
    });

    await client.connect();
    db = client.db('shayai');
    console.log('MongoDB connected');
  } catch (err) {
    console.error('Error connecting to MongoDB:', err);
  }
}

initDb();

// ===== Middleware לוודא חיבור DB =====
function ensureDb(req, res, next) {
  if (!db) {
    return res.status(503).json({
      status: 'error',
      message: 'Database not connected yet. Please try again in a moment.',
    });
  }
  next();
}

// ===== Health Check =====
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    dbConnected: !!db,
    time: new Date(),
  });
});

// ===== API: קבלת ליד מדף נחיתה / גוגל / כל מקור =====
app.post('/api/leads', ensureDb, async (req, res) => {
  try {
    const lead = {
      name: req.body.name || '',
      phone: req.body.phone || '',
      area: req.body.area || '',
      dealType: req.body.dealType || '',
      lang: req.body.lang || '',
      isBroker: req.body.isBroker === 'true' || req.body.isBroker === true,
      source: req.body.source || 'LandingPage',
      createdAt: new Date(),
      stage: 'New',
      heat: 0,
      pool: 'Cold',
    };

    // ===== חישוב חום בסיסי =====
    if (lead.dealType === 'buy') lead.heat += 20;
    if (lead.dealType === 'sell') lead.heat += 40;
    if (lead.area) lead.heat += 10;

    // אפשר להרחיב לפי סוג עסקה, שפה, קמפיין, וכו'

    // ===== חום → בריכה =====
    if (lead.heat >= 50) {
      lead.pool = 'Hot';
    } else if (lead.heat >= 20) {
      lead.pool = 'Warm';
    } else {
      lead.pool = 'Cold';
    }

    const result = await db.collection('leads').insertOne(lead);

    res.json({
      status: 'ok',
      id: result.insertedId,
      lead,
    });
  } catch (err) {
    console.error('Error inserting lead:', err);
    res.status(500).json({
      status: 'error',
      message: err.toString(),
    });
  }
});

// ===== דיבוג בלבד: לראות לידים אחרונים =====
// (מומלץ להשאיר רק בסביבת פיתוח)
app.get('/api/leads', ensureDb, async (req, res) => {
  try {
    const items = await db
      .collection('leads')
      .find({})
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();

    res.json({
      status: 'ok',
      count: items.length,
      leads: items,
    });
  } catch (err) {
    console.error('Error fetching leads:', err);
    res.status(500).json({
      status: 'error',
      message: err.toString(),
    });
  }
});

// ===== Root =====
app.get('/', (req, res) => {
  res.send('SHAYAI API is running.');
});

// ===== Start =====
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

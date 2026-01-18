import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import fs from "fs";
import { parse } from "csv-parse/sync";
import JSON5 from "json5";

import Song from "../models/song.js";

const app = express();

app.use(express.json());

// CORS: allow your website + local dev
const allowed = [
  "https://lenasun.me",
  "http://localhost:3001",
  "http://localhost:3000",
];
app.use(
  cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true); // allows server-to-server + curl
      if (allowed.includes(origin)) return cb(null, true);
      return cb(null, false);
    },
  })
);

// ---- DB + cache helpers (serverless-safe) ----
let genresCache = null;
let seeded = false;

const mongoUri = process.env.MONGO_URI; // MUST be set in Vercel env vars
const dbName = process.env.DB_NAME || "kebabDB";

async function connectToDb() {
  if (!mongoUri) throw new Error("MONGO_URI env var is missing");

  // Reuse connection if already connected (important on serverless)
  if (mongoose.connection.readyState === 1) return;

  await mongoose.connect(mongoUri, { dbName });
}

async function loadGenresCache() {
  const genres = await Song.distinct("artist_genre", {
    artist_genre: { $ne: "none" },
  });
  genresCache = genres.sort();
}

async function seedIfEmpty() {
  if (seeded) return; // don't seed multiple times per warm instance

  const songCount = await Song.countDocuments();
  if (songCount > 0) {
    seeded = true;
    return;
  }

  const csvPath = "track_data_final.csv";
  if (!fs.existsSync(csvPath)) {
    seeded = true;
    return;
  }

  const raw = fs.readFileSync(csvPath, "utf8");
  const records = parse(raw, { columns: true, skip_empty_lines: true, trim: true });

  const buildEmbed = (track_id) => {
    if (!track_id) return "";
    const id = String(track_id).trim();
    return `<iframe src="https://open.spotify.com/embed/track/${encodeURIComponent(
      id
    )}" width="300" height="380" frameborder="0" allowtransparency="true" allow="encrypted-media"></iframe>`;
  };

  const getArtistGenre = (val) => {
    if (!val && val !== 0) return "none";
    if (Array.isArray(val)) return val.length ? String(val[0]).trim() : "none";

    const s = String(val).trim();
    if (!s || s === "[]") return "none";

    try {
      const parsed = JSON5.parse(s);
      if (Array.isArray(parsed) && parsed.length) return String(parsed[0]).trim();
    } catch (_) {}

    return "none";
  };

  const songsToInsert = records
    .map((r) => ({
      track_name: r.track_name,
      artist_name: r.artist_name,
      track_duration_ms: r.track_duration_ms,
      track_id: r.track_id,
      embed: buildEmbed(r.track_id),
      artist_genre: getArtistGenre(r.artist_genres),
    }))
    .filter((s) => s.track_name && s.artist_name && s.artist_genre !== "none");

  if (songsToInsert.length > 0) {
    await Song.insertMany(songsToInsert);
  }

  seeded = true;
}

// ---- Middleware: ensure DB + cache before routes ----
app.use(async (req, res, next) => {
  try {
    await connectToDb();
    await seedIfEmpty();

    if (!genresCache) await loadGenresCache();
    next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "Server init failed" });
  }
});


app.get("/get-random-song-by-genre", async (req, res) => {
  try {
    const { genre } = req.query;
    if (!genre) return res.status(400).json({ error: "genre query param required" });

    const [song] = await Song.aggregate([
      { $match: { artist_genre: genre } },
      { $sample: { size: 1 } },
    ]);

    if (!song) return res.status(404).json({ error: `No songs found for genre: ${genre}` });
    res.json(song);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/get-genres", async (req, res) => {
  res.json({ genres: genresCache || [], count: (genresCache || []).length });
});

// IMPORTANT: export default app (NO app.listen)
export default app;

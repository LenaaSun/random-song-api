import express from 'express';
import mongoose from 'mongoose';
import Kebab from './models/kebab.js';
import Song from './models/song.js';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import JSON5 from 'json5';

let genresCache = null;


const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
// Allow your frontend origin (or use '*' for dev)
const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:3001';
app.use(cors({ origin: corsOrigin }));
 


//mongoDb tlas connection string

const mongoUri = process.env.MONGO_URI || "mongodb+srv://lenaelifsun_db_user:Re4uO2aZC79HjFEb@cluster0.wylurtt.mongodb.net/"

//db name 
const dbName = "kebabDB"


const loadGenresCache = async () => {
    try {
        const genres = await Song.distinct('artist_genre', { artist_genre: { $ne: 'none' } });
        genresCache = genres.sort();
        console.log(`Genres cache loaded: ${genresCache.length} unique genres`);
    } catch (err) {
        console.error('Failed to load genres cache:', err);
        genresCache = [];
    }
};

async function seedIfEmpty() {
    const songCount = await Song.countDocuments();
    if (songCount === 0) {
        const csvPath = "track_data_final.csv";
        let songsToInsert = [];
        
        console.log(fs.existsSync(csvPath) ? `Found songs CSV at ${csvPath}` : `Songs CSV not found at ${csvPath}`);

        if (fs.existsSync(csvPath)) {
            try {
                const raw = fs.readFileSync(csvPath, 'utf8');
                const records = parse(raw, { columns: true, skip_empty_lines: true, trim: true });

                
                const buildEmbed = (track_id) => {
                    if (!track_id) return '';
                    const id = String(track_id).trim();
                    return `<iframe src="https://open.spotify.com/embed/track/${encodeURIComponent(id)}" width="300" height="380" frameborder="0" allowtransparency="true" allow="encrypted-media"></iframe>`;
                };

                const getArtistGenre = (val) => {
                    if (!val && val !== 0) return 'none';
                    if (Array.isArray(val)) return val.length ? String(val[0]).trim() : 'none';

                    const s = String(val).trim();
                    if (!s || s === '[]') return 'none';

                    try {
                        const parsed = JSON5.parse(s);
                        if (Array.isArray(parsed) && parsed.length) return String(parsed[0]).trim();
                    } catch (_) {}

                    return 'none';
                };  


                songsToInsert = records.map(r => ({
                    track_name: r.track_name,
                    artist_name: r.artist_name,
                    track_duration_ms: r.track_duration_ms,
                    track_id: r.track_id,
                    embed: buildEmbed(r.track_id),
                    artist_genre: getArtistGenre(r.artist_genres)
                })).filter(s => s.track_name && s.artist_name && s.artist_genre !== 'none');

                if (songsToInsert.length > 0) {
                    await Song.insertMany(songsToInsert);
                    console.log(`Inserted ${songsToInsert.length} songs from CSV (${csvPath})`);
                } else {
                    console.log('No valid song rows found in CSV, inserting sample songs instead.');
                }
            } catch (err) {
                console.error('Failed to parse songs CSV:', err);
            }
        }

    }
}


async function main() {
    try {
        await mongoose.connect(mongoUri, {dbName: dbName});
        console.log('Connected to MongoDB');

        await seedIfEmpty();
        await loadGenresCache();  // Load cache once on startup

        app.get('/get-kebabs', async (req, res) => {
            const kebabs  = await Kebab.find();
            res.json(kebabs);
        });

        app.post('/add-kebab', async (req, res) => {
            try {
                const { name, ingredients, price, isVegetarian } = req.body;
                const newKebab = new Kebab({ name, ingredients, price, isVegetarian });
                await newKebab.save();
                res.status(201).json(newKebab);
            } catch (error) {
                res.status(400).json({ error: error.message || 'Invalid kebab data' });
            }
        });

        app.get('/get-random-song-by-genre', async (req, res) => {
            try {
                const { genre } = req.query;
                if (!genre) {
                    return res.status(400).json({ error: 'genre query param required' });
                }

                const pipeline = [
                    { $match: { artist_genre: genre } },
                    { $sample: { size: 1 } }
                ];

                const [song] = await Song.aggregate(pipeline);
                if (!song) {
                    return res.status(404).json({ error: `No songs found for genre: ${genre}` });
                }

                res.json(song);
            } catch (err) {
                res.status(500).json({ error: err.message });
            }
        });

        app.get('/get-genres', async (req, res) => {
            res.json({ genres: genresCache, count: genresCache.length });
        });



        app.listen(port, () => {
            console.log(`Server is running on http://localhost:${port}`);
        });

    }
    catch (error) {
        console.error('Error connecting to MongoDB:', error);
    }

}

main();



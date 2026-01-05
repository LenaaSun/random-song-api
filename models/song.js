import mongoose from 'mongoose';

const songSchema = new mongoose.Schema({
    track_name: { type: String, required: true },
    artist_name: { type: String, required: true },
    track_duration_ms: { type: Number, min: 0 }, // length in seconds
    track_id: { type: String }, // embed code or URL
    embed: { type: String }, // embed code or URL
    artist_genre: { type: String }
}, { timestamps: true });

songSchema.index({ artist_genre: 1 });

export default mongoose.model('Song', songSchema);
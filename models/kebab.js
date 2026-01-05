import mongoose from 'mongoose';

const kebabSchema = new mongoose.Schema({
  name: { type: String, required: true },
  ingredients: { type: [String], required: true },
  price: { type: Number, required: true },
  isVegetarian: { type: Boolean, default: false },
});

export default mongoose.model('Kebab', kebabSchema);
import 'dotenv/config';
import mongoose from 'mongoose';
import { Category, Page, Product, Settings } from './models.js';

const categories = [
  { name: 'Wool', slug: 'wool', note: 'Softness, naturally', description: 'Soft, warm and wonderfully tactile.', sortOrder: 1 },
  { name: 'Jute', slug: 'jute', note: 'Earthy & effortless', description: 'Natural texture for everyday living.', sortOrder: 2 },
  { name: 'Hand-knotted', slug: 'hand-knotted', note: 'An art worth keeping', description: 'Patient artistry in every knot.', sortOrder: 3 }
];
const products = [
  { name: 'The Sandstone', slug: 'the-sandstone', type: 'Handwoven wool', price: 12900, palette: ['#cabaa1', '#e3ddcf', '#958773'], design: 'sandstone', category: 'Wool', tag: 'BESTSELLER', featured: true, active: true },
  { name: 'Terra Lines', slug: 'terra-lines', type: 'Hand-tufted wool', price: 16900, palette: ['#b46b50', '#dbbea2', '#e1d4bd'], design: 'terra', category: 'Wool', active: true },
  { name: 'The Olive Grove', slug: 'the-olive-grove', type: 'Hand-knotted wool', price: 24500, palette: ['#777d61', '#d0c7b1', '#ac9980'], design: 'olive', category: 'Hand-knotted', tag: 'NEW', active: true },
  { name: 'Natural Rhythm', slug: 'natural-rhythm', type: 'Braided natural jute', price: 8900, palette: ['#b29265', '#d3b78a', '#eee1cb'], design: 'jute', category: 'Jute', active: true }
];
const pages = [
  { key: 'home', title: 'A little texture. A lot of home.', subtitle: 'Rooted in craft. Made for home.', body: 'Beautiful rugs. Honest materials. A softer place to land.', active: true },
  { key: 'story', title: 'More than a rug. A story woven in.', subtitle: 'Human hands. Beautiful things.', body: 'Traditional Indian craftsmanship and a contemporary point of view.', active: true }
];
const settings = {
  key: 'storefront', brand: { logoText: 'aara', logoImage: '', logoCaption: 'THE ART OF LIVING, WOVEN.', currency: 'INR', currencySymbol: '₹' },
  homepage: { heroTitle: 'A little texture. A lot of home.', heroSubtitle: 'Rooted in craft. Made for home.', heroDescription: 'Beautiful rugs. Honest materials. A softer place to land.', heroImage: '', livingImage: '', bedroomImage: '', diningImage: '', storyImage: '' },
  contact: { email: '', phone: '', address: '' }, navigation: [], footer: { tagline: 'Woven for the way you live.', copyright: 'Aara Rugs & Living' }
};

try {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/aara_rugs');
  for (const row of categories) await Category.updateOne({ slug: row.slug }, { $setOnInsert: row }, { upsert: true });
  for (const row of products) await Product.updateOne({ slug: row.slug }, { $setOnInsert: row }, { upsert: true });
  for (const row of pages) await Page.updateOne({ key: row.key }, { $setOnInsert: row }, { upsert: true });
  await Settings.updateOne({ key: 'storefront' }, { $setOnInsert: settings }, { upsert: true });
  console.log('Default Aara content is ready. Existing records were preserved.');
} finally { await mongoose.disconnect(); }

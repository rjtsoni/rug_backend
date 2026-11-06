import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const { Schema, model } = mongoose;
const accountSchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
  password: { type: String, required: true, select: false },
  mobile: { type: String, required: true, trim: true, maxlength: 25 }
}, { timestamps: true });
accountSchema.pre('save', async function hashPassword() {
  if (this.isModified('password')) this.password = await bcrypt.hash(this.password, 12);
});
export const Admin = model('Admin', accountSchema);

const customerSchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
  password: { type: String, required: true, select: false },
  mobile: { type: String, required: true, trim: true, maxlength: 25 },
  address: { type: String, default: '', trim: true, maxlength: 500 },
  city: { type: String, default: '', trim: true, maxlength: 100 },
  state: { type: String, default: '', trim: true, maxlength: 100 },
  postalCode: { type: String, default: '', trim: true, maxlength: 20 },
  favorites: [{ type: Schema.Types.ObjectId, ref: 'Product' }]
}, { timestamps: true });
customerSchema.pre('save', async function hashPassword() {
  if (this.isModified('password')) this.password = await bcrypt.hash(this.password, 12);
});
export const Customer = model('Customer', customerSchema);
const categorySchema = new Schema({
  name: { type: String, required: true, trim: true, unique: true },
  slug: { type: String, required: true, trim: true, unique: true, lowercase: true },
  description: { type: String, default: '' },
  image: { type: String, default: '' },
  note: { type: String, default: '' },
  parentCategory: { type: Schema.Types.ObjectId, ref: 'Category', default: null, index: true },
  active: { type: Boolean, default: true },
  sortOrder: { type: Number, default: 0 }
}, { timestamps: true });

const productSchema = new Schema({
  name: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
  type: { type: String, default: '' },
  description: { type: String, default: '' },
  price: { type: Number, required: true, min: 0 },
  discountPercentage: { type: Number, min: 0, max: 100, default: 0 },
  compareAtPrice: { type: Number, min: 0, default: null },
  image: { type: String, default: '' },
  images: { type: [String], default: [] },
  sizes: { type: [{ label: { type: String, required: true, trim: true }, price: { type: Number, required: true, min: 0 }, discountPercentage: { type: Number, min: 0, max: 100, default: 0 }, images: { type: [String], default: [] } }], default: [] },
  details: { type: { sku: { type: String, default: '' }, material: { type: String, default: '' }, texture: { type: String, default: '' }, pileThickness: { type: String, default: '' }, origin: { type: String, default: '' }, highlights: { type: String, default: '' }, care: { type: String, default: '' }, delivery: { type: String, default: '' }, returns: { type: String, default: '' }, freeDelivery: { type: Boolean, default: true }, deliveryCharge: { type: Number, min: 0, default: 0 }, craftImage: { type: String, default: '' }, craftEyebrow: { type: String, default: '' }, craftTitle: { type: String, default: '' }, craftDescription: { type: String, default: '' }, craftSecondParagraph: { type: String, default: '' }, craftPoint1Title: { type: String, default: '' }, craftPoint1Caption: { type: String, default: '' }, craftPoint2Title: { type: String, default: '' }, craftPoint2Caption: { type: String, default: '' }, craftPoint3Title: { type: String, default: '' }, craftPoint3Caption: { type: String, default: '' }, craftStep1Title: { type: String, default: '' }, craftStep1Body: { type: String, default: '' }, craftStep2Title: { type: String, default: '' }, craftStep2Body: { type: String, default: '' }, craftStep3Title: { type: String, default: '' }, craftStep3Body: { type: String, default: '' }, craftExpectTitle: { type: String, default: '' }, craftExpect1: { type: String, default: '' }, craftExpect2: { type: String, default: '' }, craftExpect3: { type: String, default: '' } }, default: {} },
  palette: { type: [String], default: [] },
  design: { type: String, default: 'sandstone' },
  category: { type: String, required: true, index: true },
  tag: { type: String, default: '' },
  featured: { type: Boolean, default: false },
  active: { type: Boolean, default: true },
  stock: { type: Number, default: 0, min: 0 },
  sortOrder: { type: Number, default: 0 }
}, { timestamps: true });

const offerSchema = new Schema({
  message: { type: String, required: true, trim: true, maxlength: 160 },
  active: { type: Boolean, default: true, index: true },
  sortOrder: { type: Number, default: 0 }
}, { timestamps: true });
const orderSchema = new Schema({
  orderNumber: { type: String, required: true, unique: true, index: true },
  customer: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
  customerDetails: { name: { type: String, required: true }, email: { type: String, required: true }, mobile: { type: String, required: true }, address: { type: String, required: true }, city: { type: String, required: true }, state: { type: String, default: '' }, postalCode: { type: String, required: true } },
  items: [{ product: { type: Schema.Types.ObjectId, ref: 'Product' }, name: { type: String, required: true }, sku: { type: String, default: '' }, image: { type: String, default: '' }, size: { type: String, default: '' }, unitPrice: { type: Number, required: true, min: 0 }, quantity: { type: Number, required: true, min: 1 }, lineTotal: { type: Number, required: true, min: 0 } }],
  subtotal: { type: Number, required: true, min: 0 },
  shippingCharge: { type: Number, default: 0, min: 0 },
  total: { type: Number, required: true, min: 0 },
  status: { type: String, enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'], default: 'pending', index: true },
  paymentStatus: { type: String, enum: ['unpaid', 'paid', 'refunded'], default: 'unpaid' }
}, { timestamps: true });
const pageSchema = new Schema({
  key: { type: String, unique: true, required: true, lowercase: true, trim: true },
  title: { type: String, default: '' },
  subtitle: { type: String, default: '' },
  body: { type: String, default: '' },
  image: { type: String, default: '' },
  active: { type: Boolean, default: true }
}, { timestamps: true });

const settingsSchema = new Schema({
  key: { type: String, unique: true, default: 'storefront' },
  brand: { type: Schema.Types.Mixed, default: {} },
  homepage: { type: Schema.Types.Mixed, default: {} },
  pages: { type: Schema.Types.Mixed, default: {} },
  contact: { type: Schema.Types.Mixed, default: {} },
  navigation: { type: [Schema.Types.Mixed], default: [] },
  footer: { type: Schema.Types.Mixed, default: {} }
}, { timestamps: true });

export const Category = model('Category', categorySchema);
export const Product = model('Product', productSchema);
export const Page = model('Page', pageSchema);
export const Settings = model('Settings', settingsSchema);
export const Order = model('Order', orderSchema);
export const Offer = model('Offer', offerSchema);const newsletterSubscriberSchema = new Schema({ email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 } }, { timestamps: true });
export const NewsletterSubscriber = model('NewsletterSubscriber', newsletterSubscriberSchema);


import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { Admin, Category, Customer, NewsletterSubscriber, Offer, Order, Page, Product, Settings } from './models.js';

const app = express();
const port = Number(process.env.PORT || 4000);
const origins = (process.env.FRONTEND_ORIGIN || 'http://localhost:5173,http://localhost:5174').split(',').map(x => x.trim());
app.use(helmet());
app.use(cors({ origin: (origin, done) => !origin || origins.includes(origin) ? done(null, true) : done(new Error('Origin not allowed')), credentials: true }));
app.use(express.json({ limit: '12mb' }));
app.use(['/api/auth/login', '/api/auth/register', '/api/customer/login', '/api/customer/register'], rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false }));
app.use('/api/storefront/newsletter', rateLimit({ windowMs: 15 * 60 * 1000, limit: 8, standardHeaders: 'draft-7', legacyHeaders: false }));

const fail = (res, error, status = 400) => res.status(status).json({ error });
const COOKIE_AGE_MS = 8 * 60 * 60 * 1000;
const readCookie = (req, name) => {
  const item = req.headers.cookie?.split(';').map(part => part.trim()).find(part => part.startsWith(`${name}=`));
  return item ? decodeURIComponent(item.slice(name.length + 1)) : '';
};
const setSession = (res, cookieName, claims) => {
  const token = jwt.sign(claims, process.env.JWT_SECRET, { expiresIn: '8h', issuer: 'aara-rugs-api' });
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${cookieName}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${COOKIE_AGE_MS / 1000}${secure}`);
};
const clearSession = (res, cookieName) => {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${cookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`);
};
const accountInput = z.object({ name: z.string().trim().min(2).max(100), email: z.string().trim().email().max(254), password: z.string().min(8).max(128), mobile: z.string().trim().min(7).max(25) }).strict();
const adminRegisterInput = accountInput.extend({ confirmPassword: z.string().min(8).max(128) }).strict().refine(value => value.password === value.confirmPassword, { message: 'Passwords do not match.', path: ['confirmPassword'] });
const loginInput = z.object({ email: z.string().trim().email().max(254), password: z.string().min(1).max(128) }).strict();
const auth = (req, res, next) => {
  try {
    const token = readCookie(req, 'aara_admin_token') || req.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (!token) return fail(res, 'Sign in to continue.', 401);
    req.admin = jwt.verify(token, process.env.JWT_SECRET);
    if (req.admin.role !== 'admin' || !req.admin.adminId) return fail(res, 'Admin access is required.', 403);
    return next();
  } catch { return fail(res, 'Your session has expired. Sign in again.', 401); }
};
const customerAuth = (req, res, next) => {
  try {
    const token = readCookie(req, 'rugs_customer_token');
    if (!token) return fail(res, 'Sign in to continue.', 401);
    req.customer = jwt.verify(token, process.env.JWT_SECRET);
    if (req.customer.role !== 'customer' || !req.customer.customerId) return fail(res, 'Customer sign-in is required.', 403);
    return next();
  } catch { return fail(res, 'Your session has expired. Sign in again.', 401); }
};
const asyncRoute = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const objectBody = schema => (req, res, next) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return fail(res, parsed.error.issues.map(x => `${x.path.join('.')}: ${x.message}`).join('; '));
  req.body = parsed.data; return next();
};
const categoryInput = z.object({ name: z.string().trim().min(1), slug: z.string().trim().min(1), description: z.string().optional(), image: z.string().optional(), note: z.string().optional(), parentCategory: z.string().regex(/^[a-f\d]{24}$/i).nullable().optional(), active: z.boolean().optional(), sortOrder: z.number().optional() }).strict();
const productInput = z.object({ name: z.string().trim().min(1), slug: z.string().trim().min(1), type: z.string().optional(), description: z.string().optional(), price: z.number().nonnegative(), discountPercentage: z.number().int().min(0).max(100).optional(), compareAtPrice: z.number().nonnegative().nullable().optional(), image: z.string().optional(), images: z.array(z.string()).optional(), sizes: z.array(z.object({ label: z.string().trim().min(1), price: z.number().nonnegative(), discountPercentage: z.number().int().min(0).max(100).default(0), images: z.array(z.string()).min(1).max(4) }).strict()).optional(), details: z.object({ sku: z.string().optional(), material: z.string().optional(), texture: z.string().optional(), pileThickness: z.string().optional(), origin: z.string().optional(), highlights: z.string().optional(), care: z.string().optional(), delivery: z.string().optional(), returns: z.string().optional(), freeDelivery: z.boolean().optional(), deliveryCharge: z.number().nonnegative().optional(), craftImage: z.string().optional(), craftEyebrow: z.string().optional(), craftTitle: z.string().optional(), craftDescription: z.string().optional(), craftSecondParagraph: z.string().optional(), craftPoint1Title: z.string().optional(), craftPoint1Caption: z.string().optional(), craftPoint2Title: z.string().optional(), craftPoint2Caption: z.string().optional(), craftPoint3Title: z.string().optional(), craftPoint3Caption: z.string().optional(), craftStep1Title: z.string().optional(), craftStep1Body: z.string().optional(), craftStep2Title: z.string().optional(), craftStep2Body: z.string().optional(), craftStep3Title: z.string().optional(), craftStep3Body: z.string().optional(), craftExpectTitle: z.string().optional(), craftExpect1: z.string().optional(), craftExpect2: z.string().optional(), craftExpect3: z.string().optional() }).strict().optional(), palette: z.array(z.string()).optional(), design: z.string().optional(), category: z.string().min(1), tag: z.string().optional(), featured: z.boolean().optional(), active: z.boolean().optional(), stock: z.number().int().nonnegative().optional(), sortOrder: z.number().optional() }).strict();
const pageInput = z.object({ key: z.string().trim().min(1), title: z.string().optional(), subtitle: z.string().optional(), body: z.string().optional(), image: z.string().optional(), active: z.boolean().optional() }).strict();
const offerInput = z.object({ message: z.string().trim().min(1).max(160), active: z.boolean().default(true), sortOrder: z.number().int().min(0).default(0) }).strict();
const hash = await bcrypt.hash('x1XeBw5wJOaP87HRQAsSuurC8Jx4P6DEbXjJpiUPmWIF3dGlzpx32', 12);
console.log(hash, "======");


app.get('/api/health', (_req, res) => res.json({ status: 'ok', database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' }));
app.get('/api/auth/setup-status', (_req, res) => res.json({ registrationOpen: true }));
app.post('/api/auth/register', objectBody(adminRegisterInput), asyncRoute(async (req, res) => {
  if (!process.env.JWT_SECRET) return fail(res, 'JWT_SECRET is not configured on the server.', 503);
  const { confirmPassword, ...account } = req.body;
  const admin = await Admin.create({ ...account, email: account.email.toLowerCase() });
  setSession(res, 'aara_admin_token', { role: 'admin', adminId: String(admin._id), email: admin.email });
  return res.status(201).json({ admin: { id: admin._id, name: admin.name, email: admin.email, mobile: admin.mobile } });
}));
app.post('/api/auth/login', objectBody(loginInput), asyncRoute(async (req, res) => {
  if (!process.env.JWT_SECRET) return fail(res, 'JWT_SECRET is not configured on the server.', 503);
  const admin = await Admin.findOne({ email: req.body.email.toLowerCase() }).select('+password');
  if (!admin || !(await bcrypt.compare(req.body.password, admin.password))) return fail(res, 'Email or password is incorrect.', 401);
  setSession(res, 'aara_admin_token', { role: 'admin', adminId: String(admin._id), email: admin.email });
  return res.json({ admin: { id: admin._id, name: admin.name, email: admin.email, mobile: admin.mobile } });
}));
app.get('/api/auth/me', auth, asyncRoute(async (req, res) => {
  const admin = await Admin.findById(req.admin.adminId).select('name email mobile').lean();
  return admin ? res.json({ admin }) : fail(res, 'Admin account not found.', 401);
}));
app.post('/api/auth/logout', (_req, res) => { clearSession(res, 'aara_admin_token'); return res.json({ loggedOut: true }); });

app.post('/api/customer/register', objectBody(accountInput), asyncRoute(async (req, res) => {
  if (!process.env.JWT_SECRET) return fail(res, 'JWT_SECRET is not configured on the server.', 503);
  const customer = await Customer.create({ ...req.body, email: req.body.email.toLowerCase() });
  setSession(res, 'rugs_customer_token', { role: 'customer', customerId: String(customer._id), email: customer.email });
  return res.status(201).json({ customer: { id: customer._id, name: customer.name, email: customer.email, mobile: customer.mobile } });
}));
app.post('/api/customer/login', objectBody(loginInput), asyncRoute(async (req, res) => {
  const customer = await Customer.findOne({ email: req.body.email.toLowerCase() }).select('+password');
  if (!customer || !(await bcrypt.compare(req.body.password, customer.password))) return fail(res, 'Email or password is incorrect.', 401);
  setSession(res, 'rugs_customer_token', { role: 'customer', customerId: String(customer._id), email: customer.email });
  return res.json({ customer: { id: customer._id, name: customer.name, email: customer.email, mobile: customer.mobile } });
}));
app.get('/api/customer/me', customerAuth, asyncRoute(async (req, res) => {
  const customer = await Customer.findById(req.customer.customerId).select('name email mobile address city state postalCode').lean();
  return customer ? res.json({ customer }) : fail(res, 'Customer account not found.', 401);
}));
const customerProfileInput = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(254),
  mobile: z.string().trim().min(7).max(25),
  address: z.string().trim().max(500).optional().default(''),
  city: z.string().trim().max(100).optional().default(''),
  state: z.string().trim().max(100).optional().default(''),
  postalCode: z.string().trim().max(20).optional().default('')
}).strict();
app.put('/api/customer/profile', customerAuth, objectBody(customerProfileInput), asyncRoute(async (req, res) => {
  const customer = await Customer.findByIdAndUpdate(req.customer.customerId, { $set: { ...req.body, email: req.body.email.toLowerCase() } }, { new: true, runValidators: true }).select('name email mobile address city state postalCode').lean();
  if (!customer) return fail(res, 'Customer account not found.', 401);
  return res.json({ customer });
}));
app.post('/api/customer/logout', (_req, res) => { clearSession(res, 'rugs_customer_token'); return res.json({ loggedOut: true }); });
const customerOrderInput = z.object({
  shipping: z.object({ name: z.string().trim().min(2).max(100), email: z.string().trim().email().max(254), mobile: z.string().trim().min(7).max(25), address: z.string().trim().min(5).max(500), city: z.string().trim().min(2).max(100), state: z.string().trim().max(100).optional().default(''), postalCode: z.string().trim().min(3).max(20) }).strict(),
  items: z.array(z.object({ productId: z.string().regex(/^[a-f\d]{24}$/i), size: z.string().trim().max(80).optional().default(''), quantity: z.number().int().min(1).max(20) }).strict()).min(1).max(50)
}).strict();
app.post('/api/customer/orders', customerAuth, objectBody(customerOrderInput), asyncRoute(async (req, res) => {
  const customer = await Customer.findById(req.customer.customerId).select('name email mobile address city state postalCode');
  if (!customer) return fail(res, 'Customer account not found.', 401);
  const products = await Product.find({ _id: { $in: req.body.items.map(item => item.productId) }, active: true }).lean();
  const productMap = new Map(products.map(item => [String(item._id), item]));
  const orderItems = [];
  for (const line of req.body.items) {
    const product = productMap.get(line.productId);
    if (!product) return fail(res, 'A product in your cart is no longer available.', 404);
    const variant = (product.sizes || []).find(item => item.label === line.size);
    if ((product.sizes || []).length && !variant) return fail(res, `Choose a valid size for ${product.name}.`);
    const regularPrice = Number(variant?.price ?? product.price) || 0;
    const discount = Math.min(100, Math.max(0, Number(variant?.discountPercentage ?? product.discountPercentage) || 0));
    const unitPrice = Math.round(regularPrice * (1 - discount / 100));
    orderItems.push({ product: product._id, name: product.name, sku: product.details?.sku || '', image: variant?.images?.[0] || product.image || product.images?.[0] || '', size: line.size, unitPrice, quantity: line.quantity, lineTotal: unitPrice * line.quantity });
  }
  const shipping = { ...req.body.shipping, email: req.body.shipping.email.toLowerCase() };
  await Customer.findByIdAndUpdate(customer._id, { $set: shipping });
  const subtotal = orderItems.reduce((sum, item) => sum + item.lineTotal, 0);
  const order = await Order.create({ orderNumber: `AARA-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`, customer: customer._id, customerDetails: shipping, items: orderItems, subtotal, shippingCharge: 0, total: subtotal, status: 'pending', paymentStatus: 'unpaid' });
  return res.status(201).json({ order });
}));
app.get('/api/customer/favorites', customerAuth, asyncRoute(async (req, res) => {
  const customer = await Customer.findById(req.customer.customerId).populate({ path: 'favorites', match: { active: true } }).lean();
  return customer ? res.json({ products: customer.favorites || [] }) : fail(res, 'Customer account not found.', 401);
}));
app.put('/api/customer/favorites/:productId', customerAuth, asyncRoute(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.productId)) return fail(res, 'Invalid product id.');
  const product = await Product.findOne({ _id: req.params.productId, active: true }).select('_id');
  if (!product) return fail(res, 'Product not found.', 404);
  const customer = await Customer.findByIdAndUpdate(req.customer.customerId, { $addToSet: { favorites: product._id } }, { new: true }).populate({ path: 'favorites', match: { active: true } }).lean();
  return customer ? res.json({ products: customer.favorites || [] }) : fail(res, 'Customer account not found.', 401);
}));
app.delete('/api/customer/favorites/:productId', customerAuth, asyncRoute(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.productId)) return fail(res, 'Invalid product id.');
  const customer = await Customer.findByIdAndUpdate(req.customer.customerId, { $pull: { favorites: req.params.productId } }, { new: true }).populate({ path: 'favorites', match: { active: true } }).lean();
  return customer ? res.json({ products: customer.favorites || [] }) : fail(res, 'Customer account not found.', 401);
}));

app.get('/api/storefront/products', asyncRoute(async (req, res) => {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(48, Math.max(1, Number.parseInt(req.query.limit, 10) || 9));
  const keyword = String(req.query.keyword || '').trim().slice(0, 100);
  const categoryName = String(req.query.category || '').trim().slice(0, 120);
  const filter = { active: true };
  if (keyword) {
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const matcher = new RegExp(escaped, 'i');
    filter.$or = [{ name: matcher }, { type: matcher }, { description: matcher }, { category: matcher }, { 'details.material': matcher }];
  }
  if (categoryName.toLowerCase() === 'new arrivals') {
    filter.tag = 'NEW';
  } else if (categoryName && categoryName.toLowerCase() !== 'all rugs' && categoryName.toLowerCase() !== 'all') {
    const category = await Category.findOne({ name: categoryName }).select('_id').lean();
    let names = [categoryName];
    if (category?._id) {
      const children = await Category.find({ parentCategory: category._id, active: true }).select('name').lean();
      names = [...names, ...children.map(item => item.name)];
    }
    filter.category = { $in: names };
  }
  const [total, products] = await Promise.all([
    Product.countDocuments(filter),
    Product.find(filter).sort({ sortOrder: 1, createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean()
  ]);
  res.set('Cache-Control', 'no-store');
  return res.json({ products, page, limit, total, pages: Math.max(1, Math.ceil(total / limit)), keyword, category: categoryName || 'All rugs' });
}));const newsletterInput = z.object({ email: z.string().trim().email().max(254) }).strict();
app.post('/api/storefront/newsletter', objectBody(newsletterInput), asyncRoute(async (req, res) => {
  const email = req.body.email.toLowerCase();
  const subscriber = await NewsletterSubscriber.findOneAndUpdate({ email }, { $setOnInsert: { email } }, { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true });
  return res.status(200).json({ subscribed: true, alreadySubscribed: subscriber.createdAt?.getTime() !== subscriber.updatedAt?.getTime() });
}));app.get('/api/storefront', asyncRoute(async (_req, res) => {
  const [settings, categories, products, pages, offers] = await Promise.all([
    Settings.findOne({ key: 'storefront' }).lean(), Category.find({ active: true }).sort({ sortOrder: 1, name: 1 }).lean(),
    Product.find({ active: true }).sort({ sortOrder: 1, createdAt: -1 }).lean(), Page.find({ active: true }).lean(), Offer.find({ active: true }).sort({ sortOrder: 1, createdAt: 1 }).select('message sortOrder').lean()
  ]);
  res.set('Cache-Control', 'no-store');
  res.json({ settings: settings || {}, categories, products, pages, offers });
}));
app.use('/api/admin', auth);
app.get('/api/admin/orders', asyncRoute(async (_req, res) => res.json(await Order.find().sort({ createdAt: -1 }).lean())));
app.get('/api/admin/newsletter-subscribers', asyncRoute(async (_req, res) => res.json(await NewsletterSubscriber.find().sort({ createdAt: -1 }).lean())));
const orderStatusInput = z.object({ status: z.enum(['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled']) }).strict();
app.put('/api/admin/orders/:id/status', objectBody(orderStatusInput), asyncRoute(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return fail(res, 'Invalid order id.');
  const order = await Order.findByIdAndUpdate(req.params.id, { $set: { status: req.body.status } }, { new: true, runValidators: true }).lean();
  return order ? res.json({ order }) : fail(res, 'Order not found.', 404);
}));
app.get('/api/admin/summary', asyncRoute(async (_req, res) => res.json({ products: await Product.countDocuments(), activeProducts: await Product.countDocuments({ active: true }), categories: await Category.countDocuments(), pages: await Page.countDocuments() })));
app.get('/api/admin/settings', asyncRoute(async (_req, res) => res.json(await Settings.findOne({ key: 'storefront' }).lean() || {})));
app.put('/api/admin/settings', asyncRoute(async (req, res) => {
  const allowed = ['brand', 'homepage', 'pages', 'contact', 'navigation', 'footer'];
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body) || Object.keys(req.body).some(k => !allowed.includes(k))) return fail(res, 'Send only brand, homepage, pages, contact, navigation or footer settings.');
  const updates = {};
  for (const [section, value] of Object.entries(req.body)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const entries = Object.entries(value);
      if (entries.length) for (const [field, fieldValue] of entries) updates[`${section}.${field}`] = fieldValue;
      // Empty partial groups mean "no fields from this section", so preserve stored values.
    } else updates[section] = value;
  }
  if (!Object.keys(updates).length) return res.json(await Settings.findOne({ key: 'storefront' }).lean() || {});
  const saved = await Settings.findOneAndUpdate({ key: 'storefront' }, { $set: updates, $setOnInsert: { key: 'storefront' } }, { upsert: true, new: true, runValidators: true });
  res.json(saved);
}));
app.get('/api/admin/products', asyncRoute(async (_req, res) => res.json(await Product.find().sort({ sortOrder: 1, createdAt: -1 }).lean())));
app.post('/api/admin/products', objectBody(productInput), asyncRoute(async (req, res) => res.status(201).json(await Product.create(req.body))));
app.put('/api/admin/products/:id', objectBody(productInput), asyncRoute(async (req, res) => { const item = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true }); return item ? res.json(item) : fail(res, 'Product not found.', 404); }));
app.delete('/api/admin/products/:id', asyncRoute(async (req, res) => { const item = await Product.findByIdAndDelete(req.params.id); return item ? res.json({ deleted: true }) : fail(res, 'Product not found.', 404); }));
app.get('/api/admin/categories', asyncRoute(async (_req, res) => res.json(await Category.find().sort({ sortOrder: 1, name: 1 }).lean())));
const categoryParentError = async (parentId, selfId) => {
  if (!parentId) return '';
  if (!mongoose.isValidObjectId(parentId) || String(parentId) === String(selfId || '')) return 'Choose a valid parent category.';
  if (selfId && await Category.exists({ parentCategory: selfId })) return 'Move or delete this category’s subcategories before changing its parent.';
  const parent = await Category.findById(parentId).select('parentCategory').lean();
  if (!parent) return 'Parent category not found.';
  if (parent.parentCategory) return 'Subcategories can only be one level deep.';
  return '';
};
app.post('/api/admin/categories', objectBody(categoryInput), asyncRoute(async (req, res) => {
  const parentError = await categoryParentError(req.body.parentCategory);
  if (parentError) return fail(res, parentError);
  return res.status(201).json(await Category.create(req.body));
}));
app.put('/api/admin/categories/:id', objectBody(categoryInput), asyncRoute(async (req, res) => {
  const parentError = await categoryParentError(req.body.parentCategory, req.params.id);
  if (parentError) return fail(res, parentError);
  const previous = await Category.findById(req.params.id).select('name').lean();
  const item = await Category.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (item && previous && previous.name !== item.name) await Product.updateMany({ category: previous.name }, { $set: { category: item.name } });
  return item ? res.json(item) : fail(res, 'Category not found.', 404);
}));
app.delete('/api/admin/categories/:id', asyncRoute(async (req, res) => {
  if (await Category.exists({ parentCategory: req.params.id })) return fail(res, 'Move or delete this category’s subcategories first.', 409);
  const existing = await Category.findById(req.params.id).select('name');
  if (existing && await Product.exists({ category: existing.name })) return fail(res, 'Reassign or delete this category’s products first.', 409);
  const item = await Category.findByIdAndDelete(req.params.id);
  return item ? res.json({ deleted: true }) : fail(res, 'Category not found.', 404);
}));
app.get('/api/admin/offers', asyncRoute(async (_req, res) => res.json(await Offer.find().sort({ sortOrder: 1, createdAt: 1 }).lean())));
app.post('/api/admin/offers', objectBody(offerInput), asyncRoute(async (req, res) => res.status(201).json(await Offer.create(req.body))));
app.put('/api/admin/offers/:id', objectBody(offerInput), asyncRoute(async (req, res) => { const item = await Offer.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true }); return item ? res.json(item) : fail(res, 'Offer not found.', 404); }));
app.delete('/api/admin/offers/:id', asyncRoute(async (req, res) => { const item = await Offer.findByIdAndDelete(req.params.id); return item ? res.json({ deleted: true }) : fail(res, 'Offer not found.', 404); }));app.get('/api/admin/pages', asyncRoute(async (_req, res) => res.json(await Page.find().sort({ key: 1 }).lean())));
app.post('/api/admin/pages', objectBody(pageInput), asyncRoute(async (req, res) => res.status(201).json(await Page.create(req.body))));
app.put('/api/admin/pages/:id', objectBody(pageInput), asyncRoute(async (req, res) => { const item = await Page.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true }); return item ? res.json(item) : fail(res, 'Page not found.', 404); }));
app.delete('/api/admin/pages/:id', asyncRoute(async (req, res) => { const item = await Page.findByIdAndDelete(req.params.id); return item ? res.json({ deleted: true }) : fail(res, 'Page not found.', 404); }));
app.use((err, _req, res, _next) => {
  if (err?.code === 11000) return fail(res, `That ${Object.keys(err.keyPattern || {})[0] || 'value'} is already in use.`, 409);
  if (err?.name === 'CastError') return fail(res, 'The requested record was not found.', 404);
  if (err?.name === 'ValidationError') return fail(res, err.message);
  console.error(err); return fail(res, 'Something went wrong on the server.', 500);
});

mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/aara_rugs')
  .then(() => app.listen(port, () => console.log(`Aara API ready on http://localhost:${port}`)))
  .catch(error => { console.error('MongoDB connection failed:', error.message); process.exit(1); });


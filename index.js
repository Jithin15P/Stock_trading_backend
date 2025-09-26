 // backend/index.js

// --- Step 1: Load Environment Variables and Add Debug Logs ---
require("dotenv").config();

console.log("Serverless function initializing...");
console.log("Is MONGO_URL present:", !!process.env.MONGO_URL);
console.log("Is JWT_SECRET present:", !!process.env.JWT_SECRET);


// --- Step 2: Import all necessary packages ---
const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const cors = require("cors");
const passport = require("passport");
const jwt = require("jsonwebtoken");
const JwtStrategy = require("passport-jwt").Strategy;
const ExtractJwt = require("passport-jwt").ExtractJwt;


// --- Step 3: Import all your Models ---
const { PositionsModel } = require("./model/PositionsModel");
const { HoldingsModel } = require("./model/HoldingsModel");
const { OrdersModel } = require("./model/OrdersModel");
const { UserModel } = require("./model/UserModel");


// --- Step 4: Initialize Express App and define constants ---
const app = express();
const uri = process.env.MONGO_URL;


// --- Step 5: Configure Middleware (CORS must come before routes) ---
const allowedOrigins = [
  'https://stock-trading-frontend-phi.vercel.app',
  'http://localhost:3000'
];

const corsOptions = {
  origin: function (origin, callback) {
    console.log("CORS CHECK: Request Origin:", origin);
    if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
};
app.use(cors(corsOptions));
app.use(bodyParser.json());
app.use(passport.initialize());


// --- Step 6: Configure Passport.js Strategies ---
passport.use(UserModel.createStrategy());

const jwtOptions = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: process.env.JWT_SECRET,
};

passport.use(
  new JwtStrategy(jwtOptions, async (jwt_payload, done) => {
    try {
      const user = await UserModel.findById(jwt_payload.id);
      if (user) { return done(null, user); } 
      else { return done(null, false); }
    } catch (error) {
      return done(error, false);
    }
  })
);


// --- Step 7: Define API Routes ---
// IMPORTANT: For Vercel, all routes must be handled by the single `app` instance.
// Vercel automatically maps requests like `/api/auth/signup` to this function.
app.post("/api/auth/signup", async (req, res) => {
  try {
    const { email, password } = req.body;
    const newUser = new UserModel({ email: email });
    const registeredUser = await UserModel.register(newUser, password);
    res.status(201).json({ message: "User registered successfully!", userId: registeredUser._id });
  } catch (error) {
    res.status(500).json({ message: "Error registering user", error: error.message });
  }
});

// ... (Your other routes: login, verify, allHoldings, etc. remain the same)
app.post("/api/auth/login", (req, res, next) => {
  passport.authenticate('local', { session: false }, (err, user, info) => {
    if (err) { return next(err); }
    if (!user) { return res.status(401).json({ message: info.message || "Login failed" }); }
    const payload = { id: user._id, email: user.email };
    const token = jwt.sign(payload, jwtOptions.secretOrKey, { expiresIn: '1d' });
    res.json({ message: "Login successful", token: token });
  })(req, res, next);
});

app.get("/api/auth/verify", passport.authenticate('jwt', { session: false }), (req, res) => {
    res.json({ id: req.user._id, email: req.user.email });
});

app.get("/allHoldings", passport.authenticate('jwt', { session: false }), async (req, res) => {
  let allHoldings = await HoldingsModel.find({});
  res.json(allHoldings);
});

app.get("/allPositions", passport.authenticate('jwt', { session: false }), async (req, res) => {
  let allPositions = await PositionsModel.find({});
  res.json(allPositions);
});

app.post("/newOrder", passport.authenticate('jwt', { session: false }), async (req, res) => {
  let newOrder = new OrdersModel({
    name: req.body.name,
    qty: req.body.qty,
    price: req.body.price,
    mode: req.body.mode,
  });
  await newOrder.save();
  res.send("Order Saved!");
});


// --- Step 8: Connect to the Database and Export the App for Vercel ---
// We connect to the DB once.
mongoose.connect(uri).then(() => console.log("Database connection established."));

// THIS IS THE CRITICAL CHANGE FOR VERCEL
// We do NOT call `app.listen()`. Instead, we export the configured `app` object.
// Vercel will take this `app` and run it in its serverless environment.
module.exports = app;
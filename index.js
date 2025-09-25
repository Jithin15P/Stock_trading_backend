 require("dotenv").config();
const express = require("express");
const app = express();
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const cors = require("cors");
const passport = require("passport");
// LocalStrategy is not directly used here anymore, but it's good to keep for reference
const LocalStrategy = require("passport-local");
const jwt = require("jsonwebtoken");
const JwtStrategy = require("passport-jwt").Strategy;
const ExtractJwt = require("passport-jwt").ExtractJwt;

// --- Your Models ---
const { PositionsModel } = require("./model/PositionsModel");
const { HoldingsModel } = require("./model/HoldingsModel");
const { OrdersModel } = require("./model/OrdersModel");
const { UserModel } = require("./model/UserModel");

const PORT = process.env.PORT || 3002;
const uri = process.env.MONGO_URL;

// --- Middleware ---
app.use(cors()); // Allow requests from frontend and dashboard
app.use(bodyParser.json());
app.use(passport.initialize());

// --- Passport Configuration ---

// The .createStrategy() method from passport-local-mongoose does all the configuration for us.
// It automatically reads the { usernameField: 'email' } option from your UserSchema.
passport.use(UserModel.createStrategy());

// 2. JWT Strategy (for verifying tokens on protected routes)
const jwtOptions = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(), // Extracts token from "Bearer <token>"
  secretOrKey: process.env.JWT_SECRET || "#$abcdTT", // Use a strong secret from .env
};

passport.use(
  new JwtStrategy(jwtOptions, async (jwt_payload, done) => {
    try {
      const user = await UserModel.findById(jwt_payload.id);
      if (user) {
        return done(null, user); // User found, token is valid
      } else {
        return done(null, false); // User not found
      }
    } catch (error) {
      return done(error, false);
    }
  })
);


// =========================================================================
// --- AUTHENTICATION ROUTES ---
// =========================================================================

// Route: /api/auth/signup
// Desc: Register a new user
app.post("/api/auth/signup", async (req, res) => {
  console.log("SIGNUP REQUEST RECEIVED. Body:", req.body);
  try {
    const { email, password } = req.body;
    const newUser = new UserModel({ email: email });
    // The .register method from passport-local-mongoose hashes the password
    const registeredUser = await UserModel.register(newUser, password);
    res.status(201).json({ message: "User registered successfully!", userId: registeredUser._id });
  } catch (error) {
    res.status(500).json({ message: "Error registering user", error: error.message });
  }
});

// Route: /api/auth/login
// Desc: Authenticate user and return a JWT
// THIS ROUTE HAS BEEN UPDATED WITH DETAILED LOGGING
app.post("/api/auth/login", (req, res, next) => {
  // Log 1: Show what the frontend is sending
  console.log("--- LOGIN ATTEMPT ---");
  console.log("Request Body:", req.body);

  passport.authenticate('local', { session: false }, (err, user, info) => {
    // Log 2: Show exactly what Passport decided
    console.log("--- PASSPORT RESULT ---");
    console.log("Error object (err):", err);
    console.log("User object (user):", user); // This should be the user object if successful, otherwise false
    console.log("Info object (info):", info); // This will contain the error message from passport-local-mongoose

    if (err) {
      console.log("Login failed: An error occurred.");
      return next(err);
    }
    if (!user) {
      console.log("Login failed: Passport did not find a user or password was incorrect.");
      return res.status(401).json({ message: info.message || "Login failed" });
    }
    
    // If we reach here, it means login was successful
    console.log("Login successful! Creating JWT.");
    const payload = { id: user._id, email: user.email };
    const token = jwt.sign(payload, jwtOptions.secretOrKey, { expiresIn: '1d' });
    res.json({ message: "Login successful", token: token });

  })(req, res, next);
});


// Route: /api/auth/verify
// Desc: A protected route for the dashboard to verify a token
app.get("/api/auth/verify", passport.authenticate('jwt', { session: false }), (req, res) => {
    // If passport.authenticate succeeds, the user's data is in req.user
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
    // You should associate the order with the user
    // userId: req.user._id
  });
  await newOrder.save();
  res.send("Order Saved!");
});


// --- Database Connection and Server Start ---
mongoose
  .connect(uri)
  .then(() => {
    console.log("Connected to DB");
    app.listen(PORT, () => console.log("App Started on port", PORT));
  })
  .catch((err) => console.error("Error connecting to DB:", err));
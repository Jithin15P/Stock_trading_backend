require("dotenv").config();

console.log("Serverless function initializing...");
console.log("Is MONGO_URL present:", !!process.env.MONGO_URL);
console.log("Is JWT_SECRET present:", !!process.env.JWT_SECRET);

require("dotenv").config();
const express = require("express");
// ... rest of your code
const express = require("express");
const app = express();
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const cors = require("cors");
const passport = require("passport");
const jwt = require("jsonwebtoken");
const JwtStrategy = require("passport-jwt").Strategy;
const ExtractJwt = require("passport-jwt").ExtractJwt;

const { PositionsModel } = require("./model/PositionsModel");
const { HoldingsModel } = require("./model/HoldingsModel");
const { OrdersModel } = require("./model/OrdersModel");
const { UserModel } = require("./model/UserModel");

const PORT = process.env.PORT || 3002;
const uri = process.env.MONGO_URL;
 
 const allowedOrigins = [
  'https://stock-trading-frontend-phi.vercel.app', 
  'http://localhost:3000' 
];
// --- END OF FIX ---

const corsOptions = {
  origin: function (origin, callback) {
    // This log will show you what the browser is sending as the origin
    console.log("Request Origin:", origin); 

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

mongoose
  .connect(uri)
  .then(() => {
    console.log("Connected to DB");
    app.listen(PORT, () => console.log("App Started on port", PORT));
  })
  .catch((err) => console.error("Error connecting to DB:", err));
const path = require('path'); // Only declare this once at the top
require('dotenv').config({ path: path.join(__dirname, '.env') });

// Debugging check (you can remove this once you see it working)
console.log("DEBUG: BREVO_USER is", process.env.BREVO_USER);

var createError = require('http-errors');
var express = require('express');
const bodyParser = require("body-parser");
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var cors = require('cors');
const fs = require("fs");
const http = require("http");

// ================== ROUTES ==================
var usersRouter = require('./routes/userRouter');
var kycRouter = require('./routes/kycRouter');
var adminRouter = require('./routes/adminRouter');
var paymentsRoute = require('./routes/paymentRouter');
var uploadRoute = require('./routes/uploads');
var exampleRouter = require('./routes/exampleRouter');

const PORT = process.env.PORT || 8002;
var app = express();

// ================== VIEW ENGINE ==================
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

// ================== CORS ==================
app.use(cors({
  origin: ["http://localhost:3000", "https://admin.moneymining.co.in"],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// ================== BODY PARSERS ==================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(logger('dev'));

const { log: showLog } = console;

// ================== ROUTES ==================
app.use('/users', usersRouter);
app.use('/kyc', kycRouter);
app.use('/admin', adminRouter);
app.use("/upload", uploadRoute);
app.use('/payments', paymentsRoute);
app.use('/example', exampleRouter);

const LOG_FILE = "./logs/pm2/combined.outerr.log";

app.get("/logs", (req, res) => {
  fs.readFile(LOG_FILE, "utf8", (err, data) => {
    if (err) return res.status(500).json({ error: "Unable to read log file" });
    res.set("Content-Type", "text/plain");
    res.send(data);
  });
});

app.get("/clearlogs", (req, res) => {
  fs.truncate(LOG_FILE, 0, (err) => {
    if (err) return res.status(500).json({ error: "Unable to clear log file" });
    res.json({ message: "Logs cleared successfully" });
  });
});

app.use('/', function (req, res) {
  res.json({ status: 1, message: "Welcome to Money Mining API", version: "1.8" });
});

app.use(function (req, res, next) {
  next(createError(404));
});

let server = http.createServer(app);
server.listen(PORT, () => showLog(`Server listening on port! ${PORT}`));

module.exports = app;

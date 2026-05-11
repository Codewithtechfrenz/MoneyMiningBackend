const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

// Debugging check
// console.log("DEBUG: BREVO_USER is", process.env.BREVO_USER);

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
  origin: [
    "http://localhost:3000",
    "https://admin.moneymining.co.in"
  ],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// ================== MIDDLEWARE ==================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(logger('dev'));

const { log: showLog } = console;

// ================== API ROUTES ==================
app.use('/users', usersRouter);
app.use('/kyc', kycRouter);
app.use('/admin', adminRouter);
app.use('/upload', uploadRoute);
app.use('/payments', paymentsRoute);
app.use('/example', exampleRouter);

// ================== LOG APIs ==================
const LOG_FILE = "./logs/pm2/combined.outerr.log";

app.get("/logs", (req, res) => {
  fs.readFile(LOG_FILE, "utf8", (err, data) => {
    if (err) {
      return res.status(500).json({
        status: 0,
        error: "Unable to read log file"
      });
    }

    res.set("Content-Type", "text/plain");
    res.send(data);
  });
});

app.get("/clearlogs", (req, res) => {
  fs.truncate(LOG_FILE, 0, (err) => {
    if (err) {
      return res.status(500).json({
        status: 0,
        error: "Unable to clear log file"
      });
    }

    res.json({
      status: 1,
      message: "Logs cleared successfully"
    });
  });
});

// ================== ROOT API ==================
app.get('/', function (req, res) {
  res.json({
    status: 1,
    message: "Welcome to Money Mining API",
    version: "2.2"
  });
});

// ================== 404 HANDLER ==================
app.use(function (req, res, next) {
  res.status(404).json({
    status: 0,
    message: "API Not Found"
  });
});

// ================== ERROR HANDLER ==================
app.use(function (err, req, res, next) {

  // Set locals
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // Render error
  res.status(err.status || 500);

  res.json({
    status: 0,
    message: err.message || "Internal Server Error"
  });
});

// ================== SERVER ==================
let server = http.createServer(app);

server.listen(PORT, () => {
  showLog(`Server listening on port ${PORT}`);
});

module.exports = app;
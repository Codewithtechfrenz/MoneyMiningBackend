var createError = require('http-errors');
var express = require('express');
const bodyParser = require("body-parser");
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var cors = require('cors');

const http = require("http");
require('dotenv').config({ debug: false, silent: true, quiet: true });

// ================== ROUTES ==================
var usersRouter = require('./routes/userRouter');       // now includes ticket routes
var kycRouter = require('./routes/kycRouter');
var adminRouter = require('./routes/adminRouter');      // now includes ticket routes
var paymentsRoute = require('./routes/paymentRouter');
var uploadRoute = require('./routes/uploads');
var exampleRouter = require('./routes/exampleRouter');

const PORT = process.env.PORT;

var app = express();

// ================== VIEW ENGINE ==================
app.set('views', path.join(__dirname, 'views'));
// app.set('view engine', 'jade');
app.set('view engine', 'pug');

// ================== CORS ==================
app.use(cors({
  origin: ["http://localhost:3000",
    "https://admin.moneymining.co.in"
  ], 
  
  methods: ['GET','POST','OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'] // ⚠ crucial
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
app.use('/users', usersRouter);       // users + ticket routes
app.use('/kyc', kycRouter);
app.use('/admin', adminRouter);       // admin + ticket routes
app.use("/upload", uploadRoute);
app.use('/payments', paymentsRoute);
app.use('/example', exampleRouter);

// ================== 404 HANDLER ==================
app.use(function (req, res, next) {
  next(createError(404));
});

let server;
if (process.env.NODE_ENV == "prod_new") {
  server = http.createServer(app);
} else {
  server = http.createServer(app);
}

server.listen(PORT, () => showLog(`Server listening on port! ${PORT}`));

// var io = require('./helpers/socket').listen(server);

module.exports = app;
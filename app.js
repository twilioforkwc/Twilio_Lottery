var express = require('express');
var mongoose = require('mongoose'); 
var morgan = require('morgan');
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var session = require('express-session');
var ECT = require('ect');

var app = express();

// Cookie
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());

// Session
app.use(session({
  secret: process.env.SESSION_SECRET || 'what do you plan to do?',
  resave: false,
  saveUninitialized: false
}));

// Views
app.engine('ect', ECT({ watch: true, root: __dirname + '/views', ext: '.ect' }).render);
app.set('view engine', 'ect');
app.use(express['static'](__dirname + '/public'));

// Logs
if (app.get('env') == 'production') {
  app.use(morgan("dev", {}));
} else {
  app.use(morgan("dev", { format: 'dev', immediate: true }));
}

// MongoDB
var connectionString = process.env.CUSTOMCONNSTR_MONGOLAB_URI;
mongoose.connect(connectionString);

// Application
app.get('/', function (req, res) {
  res.render('index', { title: 'Twilio抽選アプリ' });
});

app.get('/start', function(req, res){
  res.render('start', {title: 'Twilio抽選アプリ'}); 
});

app.get('/l/:token', function(req, res){
  res.render('lottery', {title: 'Twilio抽選アプリ' + req.params.token});  
});

// Here we go!
app.listen(process.env.PORT || 3000);

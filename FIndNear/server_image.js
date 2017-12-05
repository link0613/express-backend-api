
/**
 * Module dependencies.
 */

var express = require('express')
  , routes = require('./routes/image')
  , http = require('http')
  , path = require('path')
  , favicon = require('serve-favicon')
  , cookieParser = require('cookie-parser')
  , methodOverride = require('method-override')
  , config = require('./config');
  
var app = express();

// all environments
app.set('port', config.server.imageServerPort || 3001);
app.set('view engine', 'ejs');
app.use(favicon('./public/favicon-32.png'));
app.use(methodOverride());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use(function(req, res, next) {
	res.set('X-Powered-By', 'FindNear');
	next();
});

// Routes
app.get('/', routes.index);

router = express.Router();
routes.setupImage(router);
app.use('/image', router);

//Catch 404 and forwarding to error handler
app.use(function(req, res, next) {
	var err = new Error('Endpoint Not Found');
	err.status = 404;
	next(err);
});

//Error handlers
app.use(function(err, req, res, next) {
	if (!err) return next();
	if (err.findnear) {
		res.json({success:false, error: err.error, message: err.message, showToUser: err.showToUser});
		return;
	}
	else {
		if (req.user) {
			console.error(new Date() + " : " + req.user.id + " : " + req.method + " : " + req.originalUrl + " ERROR : " + err);
		}
		else {
			console.error(new Date() + " : " + req.method + " " + req.originalUrl + " ERROR : " + err);
		}
		res.json({success:false, message:("" + err) || 'Something went wrong. Please try again later.'});
	}
});

http.createServer(app).listen(app.get('port'));
// app.listen(app.get('port'));
console.log('Express server listening on port ' + app.get('port'));

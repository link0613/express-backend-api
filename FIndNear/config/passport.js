// config/passport.js

// load all the things we need
var LocalStrategy   = require('passport-local').Strategy;
var BearerStrategy = require('passport-http-bearer').Strategy;
var FacebookStrategy = require('./passport-facebook').Strategy;
var TwitterStrategy = require('./passport-twitter').Strategy;

// load up the user model
var User = require('../app/models/user');
var Token = require('../app/models/token');
var Reserve = require('../app/models/reserve');
var jwt = require('jwt-simple');
var secret = 'com.findnear';
var async = require('async');
var path = require('path');
var fs = require('fs');
var mongoose = require('mongoose');
var fieldValidator = require('../app/controllers/fieldValidator');
var config = require('./');
var mv = require('mv');

// expose this function to our app using module.exports
module.exports.initialize = function(passport) {

    // =========================================================================
    // passport session setup ==================================================
    // =========================================================================
    // required for persistent login sessions
    // passport needs ability to serialize and unserialize users out of session

    // used to serialize the user for the session
    passport.serializeUser(function(user, done) {
        done(null, user.id);
    });

    // used to deserialize the user
    passport.deserializeUser(function(id, done) {
        User.findById(id, function(err, user) {
            done(err, user);
        });
    });

 	// =========================================================================
    // LOCAL SIGNUP ============================================================
    // =========================================================================
    // we are using named strategies since we have one for login and one for signup
	// by default, if there was no name, it would just be called 'local'

    passport.use('local-signup', new LocalStrategy({
        // by default, local strategy uses username and password, we will override with uesrname
        usernameField : 'username',
        passwordField : 'password',
        passReqToCallback : true // allows us to pass back the entire request to the callback
    },
    function(req, username, password, done) {

        // asynchronous
        // User.findOne wont fire unless data is sent back
        process.nextTick(function() {

		// find a user whose username is the same as the forms username
		// we are checking to see if the user trying to login already exists
            var email = req.body.email;
            username = username.toLowerCase();
        	async.waterfall([
          	    function validateFields(callback) {
          	        var validation = fieldValidator.validateUsername(username);
          	        if (!validation.valid) {
          	        	return callback({findnear: true, error: 414, message: validation.message});
          	        }
                    if (email) {
            	        validation = fieldValidator.validateEmail(email);
            	        if (!validation.valid) {
            	        	return callback({findnear: true, error: 415, message: validation.message});
            	        }
                    }
          	        callback();
          	   	},
          	    function checkEmail(callback) {
                  if (!email) return callback();
          	        User.findOne({ 'email': email }, function(err, user) {
          	            // if there are any errors, return the error
          	            if (err)
          	                return callback(err);

          	            // check to see if there's already a user with that email
          	            if (user)
          	                return callback({findnear: true, error: 412, message: "There's another account registered with that email address."});
          	            
          	            callback();
          	        });
          	   	},
          	    function checkUsername(callback) {
          	        User.findOne({ 'username' :  username }, function(err, user) {
          	            // if there are any errors, return the error
          	            if (err)
          	                return callback(err);

          	            // check to see if there's already a user with that username
          	            if (user)
          	                return callback({findnear: true, error: 411, message: "That username is already taken."});
          	            
          	            callback();
          	        });
          	   	},
          	   	function checkReservedUsers(callback) {
          	   		Reserve.findOne({username: username}, function (err, reserve) {
          	   			if (err)
          	   				return callback(err);
          	   			if (reserve) {
                      if (req.body.twitter) {
                        if (req.body.twitter.id != reserve.twitterId) {
                          return callback({findnear: true, error: 423, message: "That username is reserved for another twitter user. If it's your account please sign up with Twitter. Otherwise you should unlink current Twitter account."});
                        }
                      }
                      else {
          	   				  return callback({findnear: true, error: 419, message: "That username is reserved for a twitter user. If it's your account please sign up with Twitter."});
                      }
                    }
          	   			callback();
          	   		});
          	   	},
          	    function createUser(finished) {
                    // create the user
                    var newUser = new User();
                    var series = [];
                    
                    if (req.files.profile) {
                    	newUser.hasProfile = true;
                    	var tmpPath = path.join(__dirname, '../', req.files.profile.path);
                    	var targetPath = path.join(config.resourceDir, '/user_profiles/', newUser.id, req.files.profile.originalname);
                    	series.push(function uploadProfile(callback) {
                    		fs.mkdir(path.dirname(targetPath), 0777, function (err) {
                    			if (err) return callback(err);
    	    	       	   	 	mv(tmpPath, targetPath, function (err) {
    	    	       	   			if (err) return callback(err);
        	       		   			callback();
    	    	       	   		});
                    		});
        	       	    });
                    }
                    if (req.files.cover) {
                    	newUser.hasCover = true;
                    	var tmpPath = path.join(__dirname, '../', req.files.cover.path);
                    	var targetPath = path.join(config.resourceDir, '/user_covers/', newUser.id, req.files.cover.originalname);
                    	series.push(function uploadCover(callback) {
                    		fs.mkdir(path.dirname(targetPath), 0777, function (err) {
                    			if (err) return callback(err);
            	       	   	 	mv(tmpPath, targetPath, function (err) {
            	       	   			if (err) return callback(err);
           	       		   			return callback();
            	       	   		});
                    		});
        	       	    });
                    }
                    else if (req.body.coverUrl) {
                    	newUser.coverUrl = req.body.coverUrl;
                    	newuser.hasCover = true;
                    }
                    
                    series.push(function addUser(callback) {
    	                // set the user's local credentials
    	                newUser.username = username;
    		              newUser.password = newUser.generateHash(password);
    	                newUser.phoneNumber = req.body.phoneNumber;
    	                newUser.email = req.body.email;
    	                newUser.displayName = req.body.displayName;
    	                newUser.description = req.body.description;
    	                newUser.firstName = req.body.firstName;
    	                newUser.lastName = req.body.lastName;
    	                if (req.body.lat && req.body.lng)
    	                	newUser.location = [req.body.lng, req.body.lat];

                      if (req.body.twitter) {
                        var twitterDict = req.body.twitter;
                        var twitter = {};
                        twitter.id = twitterDict.id;
                        twitter.screenName = twitterDict.screenName;
                        twitter.authToken = twitterDict.token;
                        twitter.authSecret = twitterDict.secret;
                        newUser.twitter = twitter;
                      }

    					// save the user
    	                newUser.save(function(err) {
    	                    if (err) return callback(err);
    	                    callback();
    	                });
                	});
                    series.push(function addToken(callback) {
                      generateToken(newUser, function(err, token) {
                        if (err) return callback(err);
                        req.token = token.token;
                        callback();
                      });
                    });
                    async.series(series, function (err) {
        	       		if (err) {
        	       			return finished(err);
        	       		}
        	       		else {
        	       			console.log("Added user: " + newUser.id);
    	                    return finished(null, newUser);
                    	}
        	       	});                
          	   	}
          	], function(err, user) {
          		if (err) {
          			if (err.findnear)
          				done(null, false, err);
          			else
          				done(err);
          			
          			return;
          		}
          		done(null, user);
          	});
        });
    }));

    // =========================================================================
    // LOCAL LOGIN =============================================================
    // =========================================================================
	// we are using named strategies since we have one for login and one for signup
	// by default, if there was no name, it would just be called 'local'

    passport.use('local-login', new LocalStrategy({
        // by default, local strategy uses username and password, we will override with username
        usernameField : 'username',
        passwordField : 'password',
        passReqToCallback : true // allows us to pass back the entire request to the callback
    },
    function(req, username, password, done) { // callback with username and password from our form

		// find a user whose username is the same as the forms username
		// we are checking to see if the user trying to login already exists
        User.findOne({ 'username' :  username }, function(err, user) {
            // if there are any errors, return the error before anything else
            if (err)
                return done(err);

            // if no user is found, return the message
            if (!user)
                return done(null, false, req);

			// if the user is found but the password is wrong
            if (!user.validPassword(password))
                return done(null, false, req);

            // all is well, generate token and return successful user
            generateToken(user, function(err, token) {
              if (err) return done(err);
              req.token = token.token;
              done(null, user);
            });
        });

    }));


    passport.use('bearer-validate', new BearerStrategy({
    	passReqToCallback : true
    },
    function(req, token, done) {
        process.nextTick(function () {
			// find a user whose token is the same as the forms token
			// we are checking to see if the user trying to call apis with token
        	Token.findOne({'token': token})
    		.populate('user')
    		.exec(function (err, object, stats) {
	            if (err) { return done(err); }
	            if (!object) { return done(null, false); }
	            
	            var decoded = jwt.decode(token, secret);
	            if (decoded.expireAt <= Date.now()) {
	            	object.remove(function (err, removed) {
	    	            if (err) { return done(err); }
		            	return done(null, false);
	            	});
	            }
	            req.token = token;
	            return done(null, object.user);
	        });
        });
    }));

    passport.use('facebook', new FacebookStrategy({
        passReqToCallback : true // allows us to pass back the entire request to the callback
    },
    function(req, facebookId, facebookToken, expireDate, done) {
	    var hasCompleted = false;
    	async.waterfall([
     	    function findOrCreateUser(callback) {
    	 	   	User.findOne({'facebook.id': facebookId}, function (err, user) {
    	 			if (err) return callback(err);
    	 			
    	 	    	if (user) {
    	 	    		if (user.email && user.username) {
    	 	    			hasCompleted = true;
    	 	    		}
    	 	    	}
    	 	    	else {
    	                user = new User();
    	 	    	}
    	 	    	user.facebook = {id: facebookId, accessToken: facebookToken, expiration: new Date(expireDate * 1000)};
     		        user.save(function(err) {
     		            if (err) return callback(err);
     		       		callback(null, user);
     		        });
    	 	    });
     	    },
          function generateToken(user, callback) {
            generateToken(user, function(err, token) {
              if (err) return callback(err);
              req.token = token.token;
              callback(null, user);
            });
          }
     	], function(err, user) {
            if (err) return done(err);
            done(null, user, hasCompleted);
     	});

    }));

    passport.use('twitter', new TwitterStrategy({
        passReqToCallback : true // allows us to pass back the entire request to the callback
    },
    function(req, twitterId, screenName, authToken, authTokenSecret, done) {
	    var hasCompleted = false;
    	async.waterfall([
     	    function findOrCreateUser(callback) {
    	 	   	User.findOne({'twitter.id': twitterId}, function (err, user) {
    	 			if (err) return callback(err);
    	 			
    	 	    	if (user) {
    	 	    		if (user.email && user.username) {
    	 	    			hasCompleted = true;
    	 	    		}
    	 	    	}
    	 	    	else {
    	                user = new User();
    	 	    	}
    	 	    	user.twitter = {id: twitterId, screenName: screenName, authToken: authToken, authSecret: authTokenSecret};
     		        user.save(function(err) {
     		            if (err) return callback(err);
     		       		callback(null, user);
     		        });
    	 	    });
     	    },
     	    function generateToken(user, callback) {
     	    	generateToken(user, function(err, token) {
              if (err) return callback(err);
              req.token = token.token;
              callback(null, user);
            });
     	    }
     	], function(err, user) {
            if (err) return done(err);
            done(null, user, hasCompleted);
     	});

    }));
};

module.exports.generateToken = function(user, callback) {
  generateToken(user, callback);
};

generateToken = function(user, callback) {
  var newToken = new Token();
  var expTime = new Date();
  expTime.setDate(expTime.getDate() + 100);
  var tokenString = jwt.encode({userId: user.id, expire:expTime.getTime()}, secret);
  newToken.token = tokenString;
  newToken.user = user;
  newToken.expire = expTime;
  newToken.save(function(err) {
    if (err) return callback(err);
    callback(null, newToken);
  });
}

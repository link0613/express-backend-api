/**
 * User Controller
 */

var passport = require('passport');
var User = require('../models/user');
var Reserve = require('../models/reserve');
var Token = require('../models/token');
var async = require('async');
var path = require('path');
var fs = require('fs');
var mkdirp = require('mkdirp');
var fieldValidator = require('./fieldValidator');
var config = require('../../config');
var crypto = require('crypto');
var Invitation = require('../models/invitation').model;
var installationManager = require('./installationManager');
var mv = require('mv');
var twilio = require('twilio');
var twilioClient = new twilio.RestClient(config.twilioAccountSid, config.twilioAuthToken);

exports.loadAdmins = function() {
	async.parallel([
		function loadAdministrators(callback) {
			User.find({role: 'admin'}, function (err, users) {
				if (err) return callback(err);
				if (users) {
					for (var i=0; i<users.length; i++) {
						config.administrators.push(users[i].id);
					}
				}
				callback();
			});
		},
		function loadAutoFollowers(callback) {
			User.find({role: 'autofollow'}, function (err, users) {
				if (err) return callback(err);
				if (users) {
					for (var i=0; i<users.length; i++) {
						config.autoFollowers.push(users[i].id);
					}
				}
				callback();
			});
		}
	], function(err) {
		if (err) {
			console.log("Failed to load administrators");
		}
		else {
			console.log("Loaded administrators");
		}
	});
};

exports.login = function (req, res, next) {
	passport.authenticate('local-login', function(err, user, info) {
		if (err) {
			return next(err);
		}
		if (!user) {
			return res.json({success: false, error: 410, message: 'Username or password invalid.', showToUser:true});
		}
		
		var phoneNumber = req.body.phone;
		var numberChanged = false;
		if (phoneNumber && user.phoneNumber != phoneNumber) {
			numberChanged = true;
			async.waterfall([
	     	    function eraseOldUser(callback) {
					User.update(
						{phoneNumber: phoneNumber},
						{$unset: {phoneNumber: ''}},
	    				{multi: true},
						function (err) {
						  callback(err);
					});
	     	    },
	    	    function updateUser(callback) {
		    		user.phoneNumber = phoneNumber;
		    		
		    		user.save(function (err) {
		    			callback(err);
		    		});
	    	    },
	     	], function (err) {
				if (err)
					console.error(new Date() + " Failed to update phone number: " + err);
				else
					console.log("Updated phone number: " + user.phoneNumber);
	     	});
		}
		return res.json({success: true, token: req.token, user: userJson(user), onboard: numberChanged});
	})(req, res, next);
};

exports.register = function (req, res, next) {
	passport.authenticate('local-signup', function(err, user, info) {
		if (err) {
			return next(err);
		}
		
		if (!user) {
			var message = 'That username is already taken.';
			if (info && info.message) {
				message = info.message;
			}
			var code = 411;
			if (info && info.code) {
				code = info.code;
			}
			return res.json({success: false, error: code, message: message, showToUser:true});
		}

		// SMS password
		if (user.phoneNumber) {
			async.waterfall([
				function checkAndUpdateInvitation(callback) {
					Invitation.update(
						{phoneNumber: user.phoneNumber, clicked: true},
						{$set: {convertedUser: user._id, convertedAt: Date.now()}},
						{multi: true},
						function(err) {
							callback(err);
					});
				},
	     	    function eraseOldUser(callback) {
					User.update(
						{phoneNumber: user.phoneNumber, _id: {$ne: user}},
						{$unset: {phoneNumber: ''}},
	    				{multi: true},
						function (err) {
						  callback(err);
					});
	     	    },
		  	    function sendPassword(callback) {
		  	    	twilioClient.sms.messages.create({
		  	    		to: user.phoneNumber,
		  	    		from: config.twilioPhoneNumber,
		  	    		body: "Your temporary FindNear password is " + req.body.password + ".  Please choose a new password in the profile menu in the app."
		  	    	}, function(err, message) {
		  	    		callback(err, message);
		  	    	});
		  	    }
	     	], function (err) {
				if (err)
					console.error(new Date() + " Failed to send password: " + err.message);
				else
					console.log("Sent password: " + user.phoneNumber);
	     	});
		}
		// Email verification
		if (user.email) {
			async.waterfall([
	     	    function generateToken(callback) {
	     	    	crypto.randomBytes(20, function (err, buf) {
	     	    		var token = buf.toString('hex');
	     	    		callback(err, token);
	     	    	});
	     	    },
	    	    function registerToken(token, callback) {
		    		user.verificationToken = token;
		    		
		    		user.save(function (err) {
		    			callback(err, token);
		    		});
	    	    },
	     	    function sendEmail(token, callback) {
	     	    	var mailOptions = {
	     	    		to: user.displayName ? user.displayName + '<' + user.email + '>' : user.email,
	     	    		from: 'FindNear <donotreply@findnear.com>',
	     	    		subject: 'Welcome to FindNear',
	     	    		text: 'Hi ' + user.username + ',\n\n' + 
	     	    			'You are now in FindNear, next generation of event/photo sharing.\n\n' +
	     	    			'Please click on the following link, or paste this into your browser to confirm your email address:\n\n' +
	     	    			'https://' + config.server.domainName + '/confirm_email/' + token + '\n\n'
	     	    	};
	     	    	var smtpTransport = require('../../config/mailer').doNotReply;
	     	    	smtpTransport.sendMail(mailOptions, function (err) {
	     	    		callback(err);
	     	    	});
	     	    }
	     	], function (err) {
				if (err)
					console.error(new Date() + " Failed to send verification email: " + err);
				else
					console.log("Sent verification email: " + user.email);
	     	});
		}
		
		// Auto follow
        async.waterfall([
            function updateAutoFollowers(callback) {
            	User.update(
            		{_id: {$in: config.autoFollowers}},
    				{
    					$push: {following: {$each: [user.id], $position: 0}},
    					$inc: {followingCount: 1}
    				},
    				{multi: true},
    				function (err, count) {
    		            if (err) return callback(err);
    		            callback();
    				}
            	);
            },
			function updateDstUser(callback) {
				user.followers = config.autoFollowers;
				user.followersCount = config.autoFollowers.length;
        		user.badgeNumber = config.autoFollowers.length;
				user.save(function(err) {
					callback();
				});
			},
        	function addActivities(callback) {
				async.each(user.followers, function followUser(follower, callback) {
			    	var newActivity = new Activity();
			    	newActivity.issuer = follower;
			    	newActivity.receiver = user;
			    	newActivity.type = ActivityType.FollowUser;
			    	newActivity.save(function (err) {
			    		callback(err, newActivity);
			        });
				}, function(err) {
					callback(err);
				});
        	}
        ], function (err) {
        	if (user.phoneNumber)
	    		return res.json({success: true, token: req.token, user: userJson(user), onboard: true});
        	else
	    		return res.json({success: true, token: req.token, user: userJson(user)});
       	});
        
	})(req, res, next);
};

exports.validateToken = function (req, res, next) {
	passport.authenticate('bearer-validate', { session: false }, function(err, user, info) {
		if (err) {
			return next(err);
		}
		
		if (!user) {
			console.error(new Date() + " Invalid token");
			return res.json({success: false, error: 413, message: 'Token is expired and you should login again.', showToUser:true});
		}
		else {
			req.user = user;
			next();
		}
	})(req, res, next);
};

exports.logout = function(req, res, next) {
   	var deviceId = req.body.deviceId;
    process.nextTick(function () {
    	async.waterfall([
    	    function removeToken(callback) {
    	    	Token.findOneAndRemove({token: req.token}, function(err) {
    	    		callback(err);
    	    	});
    	    },
    	    function unregisterDevice(callback) {
    	    	if (deviceId) {
        	    	installationManager.unregisterDevice(req.user, deviceId, callback);
    	    	}
    	    	else {
    	    		callback();
    	    	}
    	    },
    	], function (err) {
    		if (err) return next(err);
        	req.logout();
        	res.json({success: true});
    	});    	    
    });
};

exports.forgotPassword = function (req, res, next) {
	async.waterfall([
	    function generateToken(callback) {
	    	crypto.randomBytes(20, function (err, buf) {
	    		var token = buf.toString('hex');
	    		callback(err, token);
	    	});
	    },
	    function checkUser(token, callback) {
	    	if (req.body.phone) {
		    	User.findOne({phoneNumber: req.body.phone}, function (err, user) {
		    		if (err) return callback(err);
		    		if (!user) {
		    			return callback({findnear: true, error: 424, message: "There's no account with that phone number.", showToUser: true});
		    		}
		    		
		    		user.resetToken = token;
		    		user.resetExpires = Date.now() + 3600000; // 1 hour
		    		
		    		user.save(function (err) {
		    			callback(err, token, user);
		    		});
		    	});
	    	}
	    	else {
		    	User.findOne({email: req.body.email}, function (err, user) {
		    		if (err) return callback(err);
		    		if (!user) {
		    			return callback({findnear: true, error: 420, message: "There's no account with that email address.", showToUser: true});
		    		}
		    		
		    		user.resetToken = token;
		    		user.resetExpires = Date.now() + 3600000; // 1 hour
		    		
		    		user.save(function (err) {
		    			callback(err, token, user);
		    		});
		    	});
	    	}
	    },
	    function sendEmail(token, user, callback) {
	    	if (user.phoneNumber) {
				twilioClient.sms.messages.create({
					to: user.phoneNumber,
					from: config.twilioPhoneNumber,
					body: 'If you requested to change your FindNear password tap here to proceed.' + 'https://' + config.server.domainName + '/reset/' + token + '.'
				}, function(err, message) {
					callback(err);
				});
	    	}
	    	else if (user.email) {
		    	var mailOptions = {
		    		to: user.displayName ? user.displayName + '<' + user.email + '>' : user.email,
		    		from: 'FindNear <donotreply@findnear.com>',
		    		subject: 'Reset Password',
		    		text: 'Hi ' + user.username + ',\n\n' + 
		    			'You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\n' +
		    			'Please click on the following link, or paste this into your browser to complete the process:\n\n' +
		    			'https://' + config.server.domainName + '/reset/' + token + '\n\n' +
		    			'If you did not request this, please ignore this email and your password will remain unchanged.\n'
		    	};
		    	var smtpTransport = require('../../config/mailer').doNotReply;
		    	smtpTransport.sendMail(mailOptions, function (err) {
		    		callback(err);
		    	});
	    	}
	    }
	], function (err) {
   		if (err) return next(err);
   		res.json({success: true});
	});
};

exports.resetPassword = function (req, res, next) {
	User.findOne({resetToken: req.params.token, resetExpires: {$gt: Date.now()}}, function (err, user) {
		var message = {};
		if (!user) {
			message.error = 'Reset token is invalid or has expired.';
		}
		res.render('reset', {
			message: message
		});
	});
};

exports.updatePassword = function (req, res, next) {
	var message = {};
	async.waterfall([
	    function validatePassword(callback) {
	    	var validation = fieldValidator.validatePassword(req.body.password, req.body.confirm);
	    	if (!validation.valid) {
	    		message.warning = validation.message;
	    		return callback(true);
	    	}
	    	callback();
	    },
	    function checkToken(callback) {
	    	User.findOne({resetToken: req.params.token, resetExpires: {$gt: Date.now()}}, function (err, user) {
	    		if (!user) {
	    			message.error = 'Reset token is invalid or has expired.';
	    			return callback(true);
	    		}
	    		
	    		user.password = user.generateHash(req.body.password);
	    		user.resetToken = undefined;
	    		user.resetExpires = undefined;
	    		
	    		user.save(function (err) {
	    			callback(err, user);
	    		});
	    	});
	    },
	    function sendEmail(user, callback) {
	    	if (!user.email) return callback();

	    	var smtpTransport = require('../../config/mailer').doNotReply;
 	    	var mailOptions = {
     	    		to: user.displayName ? user.displayName + '<' + user.email + '>' : user.email,
     	    		from: 'FindNear <donotreply@findnear.com>',
     	    		subject: 'Reset Password',
    	    		text: 'Hi ' + user.username + ',\n\n' + 
	    			'This is a confirmation that password for your account has been changed.\n'
     	    	};
	    	smtpTransport.sendMail(mailOptions, function (err) {
    			message.success = 'Success! Your password has been changed.';
	    		callback(err);
	    	});
	    }
	], function (err) {
		res.render('reset', {
			message: message
		});
	});
};

exports.confirmEmail = function (req, res, next) {
	User.findOne({verificationToken: req.params.token}, function (err, user) {
		var message = {};
		if (!user) {
			message.error = 'Token is invalid.';
			return res.render('confirmEmail', {
				message: message
			});
		}
		
		user.verificationToken = undefined;
		user.emailVerified = true;
		
		user.save(function (err) {
			if (err) return next(err);
			
			message.success = 'Congratulations! Your email address has been verified. Thanks for your registration';
			res.render('confirmEmail', {
				message: message
			});
		});
	});
};

exports.userDetails = function(req, res, next) {
	var userId = req.params.id;
	if (!fieldValidator.validateObjectId(userId).valid) {
		return next({findnear: true, error: 421, message: "Invalid identifier", showToUser:true})
	}

	async.waterfall([
   	    function checkAccessToken(callback) {
   	    	if (req.query.access_token) {
   	    		exports.validateToken(req, res, function(err) {
   	    			callback(err);
   	    		});
   	    	}
   	    	else {
   	    		callback();
   	    	}
   	    },
   	    function userDetails(callback) {
  	    	if (req.user && req.user.blockers.indexOf(userId) > -1) {
  	    		return callback(null, null);
  	    	}
			User
			.findById(userId, "-followers -following -blockers -blocking", function(err, user) {
				callback(err, user);
			});
   	    }
   	], function(err, user) {
		if (err) return next(err);
		
		if (!user) {
	    	res.json({success: false, error: 404, message: 'User not found', showToUser:true});
		}
		else {
    		res.json({success: true, user: userJson(user, req)});
		}
   	});
};

exports.userDetailsByName = function(req, res, next) {
	var username = req.params.username;

	async.waterfall([
   	    function checkAccessToken(callback) {
   	    	if (req.query.access_token) {
   	    		exports.validateToken(req, res, function(err) {
   	    			callback(err);
   	    		});
   	    	}
   	    	else {
   	    		callback();
   	    	}
   	    },
   	    function userDetails(callback) {
			User
			.findOne({username: username}, '-followers -following -blockers -blocking', function(err, user) {
	  	    	if (req.user && req.user.blockers.indexOf(user._id) > -1) {
	  	    		return callback(null, null);
	  	    	}
				callback(err, user);
			});
   	    }
   	], function(err, user) {
		if (err) return next(err);
		
		if (!user) {
	    	res.json({success: false, error: 404, message: 'User not found', showToUser:true});
		}
		else {
    		res.json({success: true, user: userJson(user, req)});
		}
   	});
};

exports.updateProfile = function(req, res, next) {
	var userId = req.params.id;
	if (!fieldValidator.validateObjectId(userId).valid) {
		return next({findnear: true, error: 421, message: "Invalid identifier", showToUser:true})
	}
	if (userId != req.user._id) {
		res.json({success: false, error: 405, message: 'Not allowed', showToUser: true});
		return;
	}
	
    var series = [];
	var updateDict = {};
	var username = req.body.username;
	var isNew = false;
	var changedEmail = false;
	
	if (username) {
		username = username.toLowerCase();
        var validation = fieldValidator.validateUsername(username);
        if (!validation.valid) {
        	res.json({success:false, error: 414, message: validation.message, showToUser:true});
        	return;
        }
        if (!req.user.username) isNew = true;
        
		updateDict.username = username;
    	series.push(function chekUsername(callback) {
    		User.findOne({ 'username':  username, '_id': {$ne: userId} }, function(err, user) {
                if (err)
                    return callback(err);

                if (user)
                    return callback({findnear: true, error: 411, message: "That username is already taken.", showToUser:true});
                
                callback();
    		});
    	});
    	series.push(function checkReservedUsers(callback) {
    		if (username == req.user.username) return callback();
  	   		Reserve.findOne({username: username}, function (err, reserve) {
  	   			if (err)
  	   				return callback(err);
  	   			if (reserve) {
  	   				if (reserve.twitterId == req.user.twitter.id) {
  	   					updateDict.reserved = true;
  	   					callback();
  	   				}
  	   				else
  	   					callback({findnear: true, error: 419, message: "That username is reserved. If you think it's reserved for you contact us at @findnear on Twitter.", showToUser: true});
  	   			}
  	   			else 
  	   				callback();
  	   		});
  	   	});
	}
	var email = req.body.email;
	if (email) {
        var validation = fieldValidator.validateEmail(email);
        if (!validation.valid) {
        	res.json({success:false, error: 415, message: validation.message, showToUser:true});
        	return;
        }
        if (req.user.email != email) {
        	changedEmail = true;
        	updateDict.emailVerified = false;
        }
        
		updateDict.email = email;
    	series.push(function checkEmail(callback) {
    		User.findOne({ 'email':  email, '_id': {$ne: userId} }, function(err, user) {
                if (err)
                    return callback(err);

                if (user)
                    return callback({findnear: true, error: 412, message: "There's another account registered with that email address.", showToUser:true});
                
                callback();
    		});
    	});
	}
	var firstName = req.body.firstName;
	if (firstName !== undefined) {
		updateDict.firstName = firstName.trim();
	}
	var lastName = req.body.lastName;
	if (lastName !== undefined) {
		updateDict.lastName = lastName.trim();
	}
	var displayName = req.body.displayName;
	if (displayName !== undefined) {
		updateDict.displayName = displayName.trim();
	}
	var description = req.body.desc;
	if (description !== undefined) {
		updateDict.description = description.trim();
	}
	var password = req.body.password;
	if (password !== undefined) {
		updateDict.password = req.user.generateHash(password);
	}
	
    if (req.files.profile) {
    	updateDict.hasProfile = true;
    	var tmpPath = path.join(__dirname, '../../', req.files.profile.path);
    	var targetPath = path.join(config.resourceDir, '/user_profiles/', req.user.id, req.files.profile.originalname);
    	series.push(function uploadProfile(callback) {
    		
    		mkdirp(path.dirname(targetPath), 0777, function (err) {
    			if (err) return callback(err);
	   	   	 	mv(tmpPath, targetPath, function (err) {
	   	   			if (err) return callback(err);
		   			callback();
	   	   		});
    		});
   	    });
    }
    else if (req.body.deleteProfile) {
    	updateDict.hasProfile = false;

    	series.push(function deleteProfile(callback) {
	    	var dir = path.join(config.resourceDir, '/user_profiles/', req.user.id);
	    	fs.readdir(dir, function (err, files) {
   	   			if (err) return callback(err);
	    		files = files.filter(junk.not);
	    		if (files.length < 1) {
	  		   		return callback();
	    		}
	    		
	    		var file = path.join(dir, files[0]);
	    		fs.unlinkSync(file);
	    		callback();
	    	});
    	});
    }
    if (req.files.cover) {
    	updateDict.hasCover = true;
    	var tmpPath = path.join(__dirname, '../../', req.files.cover.path);
    	var targetPath = path.join(config.resourceDir, '/user_covers/', req.user.id, req.files.cover.originalname);
    	series.push(function uploadCover(callback) {
    		mkdirp(path.dirname(targetPath), 0777, function (err) {
    			if (err) return callback(err);
       	   	 	mv(tmpPath, targetPath, function (err) {
       	   			if (err) return callback(err);
      		   		return callback();
       	   		});
    		});
   	    });
    }
    else if (req.body.coverUrl) {
    	updateDict.coverUrl = req.body.coverUrl;
    	updateDict.hasCover = true;
    }
    else if (req.body.deleteCover) {
    	updateDict.hasCover = false;

    	series.push(function deleteProfile(callback) {
	    	var dir = path.join(config.resourceDir, '/user_covers/', req.user.id);
	    	fs.readdir(dir, function (err, files) {
   	   			if (err) return callback(err);
	    		files = files.filter(junk.not);
	    		if (files.length < 1) {
	  		   		return callback();
	    		}
	    		
	    		var file = path.join(dir, files[0]);
	    		fs.unlinkSync(file);
	    		callback();
	    	});
    	});
    }
    if (isNew) {
        series.push(function autoFollow(callback) {
            async.waterfall([
                 function updateAutoFollowers(callback) {
                 	User.update(
                 		{_id: {$in: config.autoFollowers}},
         				{
         					$push: {following: {$each: [req.user._id], $position: 0}},
         					$inc: {followingCount: 1}
         				},
        				{multi: true},
         				function (err, user) {
         		            if (err) return callback(err);
         		            callback();
         				}
                 	);
                },
     			function updateDstUser(callback) {
 					updateDict.followers = config.autoFollowers;
					updateDict.followersCount = config.autoFollowers.length;
					callback();
     			},
	        	function addActivities(callback) {
					async.each(updateDict.followers, function followUser(user, callback) {
				    	var newActivity = new Activity();
				    	newActivity.issuer = user;
				    	newActivity.receiver = req.user;
				    	newActivity.type = ActivityType.FollowUser;
				    	newActivity.save(function (err) {
				    		callback(err, newActivity);
				        });
					}, function(err) {
						callback(err);
					});
	        	},
	        	function addBadgeNumber(callback) {
	        		updateDict.badgeNumber = 2;
	        		callback();
	        	}
            ], function (err) {
            	callback();
           	});
        });
    }
    
    series.push(function updateProfile(callback) {
		User.findByIdAndUpdate(
				req.user._id,
				updateDict,
				function(err, user) {
		   			if (err) return callback(err);
		   			req.user = user;
			   		return callback();
		});
    });
    
    
    async.series(series, function (err) {
   		if (err) return next(err);
   		var user = req.user;
   		res.json({success: true, user: userJson(user)});

		// Email verification
   		if (isNew || changedEmail) {
		async.waterfall([
     	    function generateToken(callback) {
     	    	crypto.randomBytes(20, function (err, buf) {
     	    		var token = buf.toString('hex');
     	    		callback(err, token);
     	    	});
     	    },
    	    function registerToken(token, callback) {
	    		user.verificationToken = token;
	    		
	    		user.save(function (err) {
	    			callback(err, token);
	    		});
    	    },
     	    function sendEmail(token, callback) {
     	    	if (!user.email) return callback();
     	    	
     	    	var mailOptions = {
     	    		to: user.displayName ? user.displayName + '<' + user.email + '>' : user.email,
     	    		from: 'FindNear <donotreply@findnear.com>',
     	    	};

     	    	if (isNew) {
     	    		mailOptions.subject = 'Welcome to FindNear';
     	    		mailOptions.text = 'Hi ' + user.username + ',\n\n' + 
     	    			'You are now in FindNear, next generation of event/photo sharing.\n\n' +
     	    			'Please click on the following link, or paste this into your browser to confirm your email address:\n\n' +
     	    			'https://' + config.server.domainName + '/confirm_email/' + token + '\n\n';
     	    	}
     	    	else if (changedEmail) {
     	    		mailOptions.subject = 'Confirm Email Address';
     	    		mailOptions.text = 'Hi ' + user.username + ',\n\n' + 
     	    			'You have changed the email address recently.\n\n' +
     	    			'Please click on the following link, or paste this into your browser to confirm your email address:\n\n' +
     	    			'https://' + config.server.domainName + '/confirm_email/' + token + '\n\n';
     	    	}
     	    	var smtpTransport = require('../../config/mailer').doNotReply;
     	    	smtpTransport.sendMail(mailOptions, function (err) {
     	    		callback(err);
     	    	});
     	    }
     	], function (err) {
			if (err)
				console.error(new Date() + " Failed to send verification email: " + err);
			else
				console.log("Sent verification email: " + user.email);
     	});
   		}
    });
};

exports.linkTwitter = function(req, res, next) {
	var twitterId = req.body.id;
	var screenName = req.body.screenName;
	var authToken = req.body.authToken;
	var authSecret = req.body.authSecret;
	
	async.series([
   	    function checkUser(callback) {
   	    	User.findOne({'twitter.id': twitterId, '_id': {$ne: req.user._id}}, function (err, user) {
  	 	   		if (err) return callback(err);
  	 	   		
  	 	       	if (user) {
  	 	       		if (user.username) {
  	 	       			return callback({findnear: true, error: 418, message: "There's another account linked to that Twitter user.", showToUser:true});
  	 	       		}
  	 	       		user.remove(function(err) {
  	 		 	   		if (err) return callback(err);
  		 	       		callback();
  	 	       		});
  	 	       	}
  	 	       	else {
  	 	       		callback();
  	 	       	}
   	      	});
   	    },
   	    function addFacebookInfo(callback) {
    		var twitter = {};
    		twitter.id = twitterId;
    		twitter.screenName = screenName;
    		twitter.authToken = authToken;
    		twitter.authSecret = authSecret;
    		req.user.twitter = twitter;
    		req.user.save(function(err) {
  		 	   	if (err) return callback(err);
  		 	   	callback();
            });
   	    }
   	], function(err) {
   		if (err) return next(err);
 		res.json({success: true});
   	});
};

exports.linkFacebook = function(req, res, next) {
    
	var facebookId = req.body.id;
	var accessToken = req.body.accessToken;
	var expiration = new Date(req.body.expiration * 1000);
	var name = req.body.name;

	async.series([
 	    function checkUser(callback) {
 	      	User.findOne({'facebook.id': facebookId, '_id': {$ne: req.user.id}}, function (err, user) {
	 	   		if (err) return callback(err);
	 	   		
	 	       	if (user) {
	 	       		if (user.username) {
	 	       			return callback({findnear: true, error: 417, message: "There's another account linked to that Facebook user.", showToUser:true});
	 	       		}
	 	       		user.remove(function(err) {
	 		 	   		if (err) return callback(err);
		 	       		callback();
	 	       		});
	 	       	}
	 	       	else {
	 	       		callback();
	 	       	}
 	      	});
 	    },
 	    function addFacebookInfo(callback) {
       		var facebook = {};
       		facebook.id = facebookId;
       		facebook.accessToken = accessToken;
       		facebook.expiration = expiration;
       		facebook.name = name;
       		req.user.facebook = facebook;
       		req.user.save(function(err) {
		 	   	if (err) return callback(err);
		 	   	callback();
            });
 	    }
 	], function(err) {
   		if (err) return next(err);
   		res.json({success: true});
 	});
};

exports.unlinkFacebook = function(req, res, next) {
	req.user.facebook = undefined;
	req.user.save(function(err) {
 	   	if (err) return next(err);
   		res.json({success: true});
    });
};

exports.unlinkTwitter = function(req, res, next) {
	req.user.twitter = undefined;
	req.user.save(function(err) {
 	   	if (err) return next(err);
   		res.json({success: true});
    });
};

exports.changePassword = function(req, res, next) {
	var tempPassword = req.body.tempPwd;
	var oldPassword = req.body.oldPwd;
	var newPassword = req.body.newPwd;
	
	if (tempPassword) {
		var validation = fieldValidator.validatePassword(newPassword, newPassword);
		if (!validation.valid) {
			res.json({success: false, error: 416, message: validation.message, showToUser:validation.showToUser});
			return;
		}
	    req.user.password = req.user.generateHash(newPassword);
	    req.user.save(function(err) {
            if (err) {
   				return next(err);
            }
       		res.json({success: true});
        });
	}
	else {
		if (!req.user.validPassword(oldPassword)) {
			res.json({success: false, error: 416, message: 'Old password is incorrect. Please enter it again.', showToUser:true});
			return;
		}
		
		var validation = fieldValidator.validatePassword(newPassword, newPassword);
		if (!validation.valid) {
			res.json({success: false, error: 416, message: validation.message, showToUser:validation.showToUser});
			return;
		}
		
	    req.user.password = req.user.generateHash(newPassword);
	    req.user.save(function(err) {
            if (err) {
   				return next(err);
            }
       		res.json({success: true});
        });
	}
};

exports.loginFacebook = function(req, res, next) {
	passport.authenticate('facebook', function(err, user, hasCompleted) {
		if (err) {
			return next(err);
		}
		
		return res.json({success: true, token: req.token, user: userJson(user), completed: hasCompleted});
	})(req, res, next);

};

exports.loginTwitter = function(req, res, next) {
	passport.authenticate('twitter', function(err, user, hasCompleted) {
		if (err) {
			return next(err);
		}
		
		return res.json({success: true, token: req.token, user: userJson(user), completed: hasCompleted});
	})(req, res, next);

};

exports.followUser = function(req, res, next) {
	var userId = req.params.id;
    var series = [];
    var dstUser;
	if (!fieldValidator.validateObjectId(userId).valid) {
		return next({findnear: true, error: 421, message: "Invalid identifier", showToUser:true})
	}

	if (req.user.following.indexOf(userId) > -1) {
		return res.json({success: true});
	}

	series.push(function checkPermission(callback) {
	  	if (req.user && req.user.blockers.indexOf(userId) > -1) {
	    	return callback({findnear: true, error: 406, message: "Permission denied.", showToUser:true});
	  	}
	  	callback();
	});
	series.push(function updateDstUser(callback) {
		var updateDict = { $push: {followers: {$each: [req.user._id], $position: 0}},
							$inc: {followersCount: 1}};
		if (req.user.blocking.indexOf(userId) > -1) {
			updateDict.$pull = {blockers: req.user._id};
			updateDict.$inc.blockersCount = -1;
		}
		User.findByIdAndUpdate(
				userId,
				updateDict,
				function (err, user) {
		            if (err) return callback(err);
		            dstUser = user;
		            callback();
				}
			);
	});
	series.push(function updateSrcUser(callback) {
		var updateDict = { $push: {following: {$each: [dstUser.id], $position: 0}},
							$inc: {followingCount: 1}};
		if (req.user.blocking.indexOf(userId) > -1) {
			updateDict.$pull = {blocking: userId};
			updateDict.$inc.blockingCount = -1;
		}
		User.findByIdAndUpdate(
				req.user._id,
				updateDict,
				function (err, user) {
		            if (err) return callback(err);
		            req.user = user;
		            callback();
				}
			);
	});
	series.push(function addActivity(callback) {
		activityController.didFollowUser(dstUser, req, function(err, activity) {
            if (err) return callback(err);
            callback();
		});
	});
	
    async.series(series, function (err) {
   		if (err) return next(err);

   		res.json({success: true, user: userJson(dstUser, req), profile: {followingCount: req.user.following.length}});
   	});
};

exports.unfollowUser = function(req, res, next) {
	var userId = req.params.id;
    var series = [];
    var dstUser;
	if (!fieldValidator.validateObjectId(userId).valid) {
		return next({findnear: true, error: 421, message: "Invalid identifier", showToUser:true})
	}

	if (req.user.following.indexOf(userId) < 0) {
		return res.json({success: true});
	}

	series.push(function updateDstUser(callback) {
		User.findByIdAndUpdate(
				userId,
				{
					$pull: {followers: req.user._id},
					$inc: {followersCount: -1}
				},
				function (err, user) {
		            if (err) return callback(err);
		            dstUser = user;
		            callback();
				}
			);
	});
	series.push(function updateSrcUser(callback) {
		User.findByIdAndUpdate(
				req.user._id,
				{
					$pull: {following: dstUser.id},
					$inc: {followingCount: -1}
				},
				function (err, user) {
		            if (err) return callback(err);
		            req.user = user;
		            callback();
				}
			);
	});
	
    async.series(series, function (err) {
   		if (err) return next(err);

   		res.json({success: true, user: userJson(dstUser, req), profile: {followingCount: req.user.following.length}});
   	});
};

exports.followersOfUser = function(req, res, next) {
	var userId = req.params.id;
	if (!fieldValidator.validateObjectId(userId).valid) {
		return next({findnear: true, error: 421, message: "Invalid identifier", showToUser:true})
	}
	var limit = 20;
	var skip = 0;
	if (req.query.limit)
		limit = parseInt(req.query.limit);
	if (req.query.skip)
		skip = parseInt(req.query.skip);
	
	async.waterfall([
	    function checkAccessToken(callback) {
	    	if (req.query.access_token) {
	    		exports.validateToken(req, res, function(err) {
	    			callback(err);
	    		});
	    	}
	    	else {
	    		callback();
	    	}
	    },
	    function followers(callback) {
		  	if (req.user && req.user.blockers.indexOf(userId) > -1) {
		    	return callback({findnear: true, error: 406, message: "Permission denied.", showToUser:true});
		  	}

			User
			.findById(userId, 'followers')
			.exec(function (err, user, stats) {
				var hasMore = false;
				if (user.followers.length > skip + limit) {
					hasMore = true;
				}
				user.followers = user.followers.slice(skip, skip + limit);
				User.populate(user, {path: 'followers', select: 'username displayName hasProfile description'}, function(err, user) {
					callback(err, user, hasMore);
				});
			});
	    }
	], function(err, user, hasMore) {
   		if (err) return next(err);
		var results = [];
		if (user && user.followers) {
			for (var i=0; i<user.followers.length; i++) {
				results.push(userJson(user.followers[i], req));
			}
		}

		res.json({success:true, results:results, hasMore:hasMore});
	});
};

exports.followingOfUser = function(req, res, next) {
	var userId = req.params.id;
	if (!fieldValidator.validateObjectId(userId).valid) {
		return next({findnear: true, error: 421, message: "Invalid identifier", showToUser:true})
	}
	var limit = 20;
	var skip = 0;
	if (req.query.limit)
		limit = parseInt(req.query.limit);
	if (req.query.skip)
		skip = parseInt(req.query.skip);
	
	async.waterfall([
 	    function checkAccessToken(callback) {
 	    	if (req.query.access_token) {
 	    		exports.validateToken(req, res, function(err) {
 	    			callback(err);
 	    		});
 	    	}
 	    	else {
 	    		callback();
 	    	}
 	    },
 	    function following(callback) {
 		  	if (req.user && req.user.blockers.indexOf(userId) > -1) {
 		    	return callback({findnear: true, error: 406, message: "Permission denied.", showToUser:true});
 		  	}
			User
			.findById(userId, 'following')
			.exec(function (err, user, stats) {
				var hasMore = false;
				if (user.following.length > skip + limit) {
					hasMore = true;
				}
				user.following = user.following.slice(skip, skip + limit);
				User.populate(user, {path: 'following', select: 'username displayName hasProfile description'}, function(err, user) {
					callback(err, user, hasMore);
				});
			});
 	    }
 	], function(err, user, hasMore) {
   		if (err) return next(err);
		var results = [];
		if (user && user.following) {
			for (var i=0; i<user.following.length; i++) {
				results.push(userJson(user.following[i], req));
			}
		}

		res.json({success:true, results:results, hasMore:hasMore});
 	});
};

exports.blockUser = function(req, res, next) {
	var userId = req.params.id;
	if (!fieldValidator.validateObjectId(userId).valid) {
		return next({findnear: true, error: 421, message: "Invalid identifier", showToUser:true})
	}

	if (req.user.blocking.indexOf(userId) > -1) {
		return res.json({success: true});
	}

    var series = [];
    var dstUser;
	series.push(function updateDstUser(callback) {
		var updateDict = { $push: {blockers: {$each: [req.user._id], $position: 0}},
							$inc: {blockersCount: 1}};
		if (req.user.followers.indexOf(userId) > -1) {
			updateDict.$pull = {following: req.user._id};
			updateDict.$inc.followingCount = -1;
		}
		if (req.user.following.indexOf(userId) > -1) {
			if (!updateDict.$pull) updateDict.$pull = {};
			updateDict.$pull.followers = req.user._id;
			updateDict.$inc.followersCount = -1;
		}
		User.findByIdAndUpdate(
				userId,
				updateDict,
				function (err, user) {
		            if (err) return callback(err);
		            dstUser = user;
		            callback();
				}
			);
	});
	series.push(function updateSrcUser(callback) {
		var updateDict = { $push: {blocking: {$each: [dstUser.id], $position: 0}},
							$inc: {blockingCount: 1}};
		if (req.user.followers.indexOf(userId) > -1) {
			updateDict.$pull = {followers: userId};
			updateDict.$inc.followersCount = -1;
		}
		if (req.user.following.indexOf(userId) > -1) {
			if (!updateDict.$pull) updateDict.$pull = {};
			updateDict.$pull.following = userId;
			updateDict.$inc.followingCount = -1;
		}
		User.findByIdAndUpdate(
				req.user._id,
				updateDict,
				function (err, user) {
		            if (err) return callback(err);
		            req.user = user;
		            callback();
				}
			);
	});
	
    async.series(series, function (err) {
   		if (err) return next(err);

   		res.json({success: true, user: userJson(dstUser, req), profile: {followingCount: req.user.following.length, followersCount: req.user.followers.length}});
   	});
};

exports.unblockUser = function(req, res, next) {
	var userId = req.params.id;
	if (!fieldValidator.validateObjectId(userId).valid) {
		return next({findnear: true, error: 421, message: "Invalid identifier", showToUser:true})
	}

	if (req.user.blocking.indexOf(userId) < 0) {
		return res.json({success: true});
	}

    var series = [];
    var dstUser;
	series.push(function updateDstUser(callback) {
		User.findByIdAndUpdate(
				userId,
				{
					$pull: {blockers: req.user._id},
					$inc: {blockersCount: -1}
				},
				function (err, user) {
		            if (err) return callback(err);
		            dstUser = user;
		            console.log(user);
		            callback();
				}
			);
	});
	series.push(function updateSrcUser(callback) {
		User.findByIdAndUpdate(
				req.user._id,
				{
					$pull: {blocking: dstUser.id},
					$inc: {blockingCount: -1}
				},
				function (err, user) {
		            if (err) return callback(err);
		            req.user = user;
		            callback();
				}
			);
	});
	
    async.series(series, function (err) {
   		if (err) return next(err);

   		res.json({success: true, user: userJson(dstUser, req), profile: {followingCount: req.user.following.length, followersCount: req.user.followers.length}});
   	});
};

exports.searchUsers = function(req, res, next) {
	var query = req.query.query;
	var requestDate = new Date(req.query.requestAt * 1000);
	var limit = 20;
	var skip = 0;
	if (req.query.limit)
		limit = parseInt(req.query.limit);
	if (req.query.skip)
		skip = parseInt(req.query.skip);
	
	async.waterfall([
  	    function checkAccessToken(callback) {
  	    	if (req.query.access_token) {
  	    		exports.validateToken(req, res, function(err) {
  	    			callback(err);
  	    		});
  	    	}
  	    	else {
  	    		callback();
  	    	}
  	    },
  	    function search(callback) {
  	    	query = query.replace(/[^\w\s]/gi, '');
 	    	User
 	    	.find({$or: [{$text: {$search: query}}, {username: new RegExp(query, 'i')}], createdAt: {$lte: requestDate}}, {score: {$meta: 'textScore'}})
			.sort({score: {$meta: 'textScore'}})
			.select('username displayName hasProfile blockers')
			.limit(limit + 1)
			.skip(skip)
			.exec(function (err, users, stats) {
				callback(err, users);
			});
		}
  	], function(err, users) {
		if (err) return next(err);
		
		var results = [];
		var hasMore = false;
		if (users) {
			if (users.length > limit) {
				hasMore = true;
				users.pop();
			}
			for (var i=0; i<users.length; i++) {
				results.push(userJson(users[i], req));
			}
		}
		res.json({success:true, results:results, hasMore:hasMore});
  	});
};

exports.findFriends = function(req, res, next) {
	var query = {};
	
	if (req.body.emails) {
		query = {email: {$in: req.body.emails}, username: {$exists: true}, _id: {$ne: req.user.id, $nin: req.user.blockers}};
	}
	else if (req.body.phones) {
		query = {phoneNumber: {$in: req.body.phones}, username: {$exists: true}, _id: {$ne: req.user.id, $nin: req.user.blockers}};
	}
	else if (req.body.fbids) {
		query = {'facebook.id': {$in: req.body.fbids}, username: {$exists: true}, _id: {$ne: req.user.id, $nin: req.user.blockers}};
	}
	else if (req.body.twids) {
		query = {'twitter.id': {$in: req.body.twids}, username: {$exists: true}, _id: {$ne: req.user.id, $nin: req.user.blockers}};
	}
	
	User.find(query, function (err, users) {
		if (err) return next(err);
		
		var results = [];
		if (users) {
			for (var i=0; i<users.length; i++) {
				results.push(userJsonCompact(users[i], req));
			}
		}
		res.json({success:true, results:results});
	});
};

exports.getFriends = function(req, res, next) {
	var query = {};
	
	// To-do: it takes much time when there're many following in an user
	User.populate(req.user, {path: 'following', select: 'username displayName hasProfile'}, function(err, user) {
		if (err) return next(err);

		var results = [];
		if (user.following) {
			for (var i=0; i<user.following.length; i++) {
				results.push(userJsonCompact(user.following[i], req));
			}
		}
		res.json({success:true, results:results});
	});
};

userJson = function (user, req) {
	var ret = {};
	ret.id = user.id;
	ret.username = user.username;
	ret.email = user.email;
	ret.phone = user.phoneNumber;
	ret.verified = user.emailVerified;
	ret.displayName = user.displayName;
	ret.desc = user.description;
	ret.firstName = user.firstName;
	ret.lastName = user.lastName;
	ret.followersCount = user.followersCount;
	ret.followingCount = user.followingCount;
	
	var lastLogin = user.lastLogin;
	if (lastLogin)
		ret.lastLogin = lastLogin.getTime() / 1000;
	
	var location = user.location;
	if (location) {
		ret.lat = location[1];
		ret.lng = location[0];
	}
	
	ret.userNo = user.userNo;
	ret.eventsCount = user.eventsCount;
	ret.hasProfile = user.hasProfile;
	ret.hasCover = user.hasCover;
	ret.profileUrl = user.profilePic;
	ret.coverUrl = user.coverPic;
	ret.credit = user.credit;
	
	var badgeNumber = user.badgeNumber;
	if (badgeNumber > 999)
		badgeNumber = 999;
	ret.badge = badgeNumber;
	if (user.isAdmin)
		ret.admin = true;
	
	ret.facebook = {};
	if (user.facebook && user.facebook.id) {
		ret.facebook.id = user.facebook.id;
		ret.facebook.accessToken = user.facebook.accessToken;
		ret.facebook.expiration = user.facebook.expiration.getTime() / 1000;
		ret.facebook.name = user.facebook.name;
	}
	ret.twitter = user.twitter;

	if (req && req.user) {
		if (req.user.following.indexOf(user.id) > -1) {
			ret.following = true;
		}
		else {
			ret.following = false;
		}
		if (req.user.blocking.indexOf(user.id) > -1) {
			ret.blocking = true;
		}
		else {
			ret.blocking = false;
		}
		if (req.user._id.equals(user.id)) {
			ret.stripe = user.stripe;
			ret.shipping = user.shipping;
		}
	}
	if (user.createdAt)
		ret.created = user.createdAt.getTime() / 1000;
	if (user.updatedAt)
		ret.updated = user.updatedAt.getTime() / 1000;
	ret.hasDetails = true;
	
	return ret;
};

userJsonCompact = function (user, req) {
	var ret = {};
	ret.id = user.id;
	ret.username = user.username;
	ret.email = user.email;
	ret.phone = user.phoneNumber;
	ret.displayName = user.displayName;
	ret.desc = user.description;
	ret.followersCount = user.followersCount;
	ret.followingCount = user.followingCount;
	ret.eventsCount = user.eventsCount;
	ret.hasProfile = user.hasProfile;
	ret.profileUrl = user.profilePic;
	
	ret.facebook = {};
	if (user.facebook && user.facebook.id) {
		ret.facebook.id = user.facebook.id;
	}
	ret.twitter = {};
	if (user.twitter && user.twitter.id) {
		ret.twitter.id = user.twitter.id;
	}

	if (req && req.user) {
		if (req.user.following.indexOf(user.id) > -1) {
			ret.following = true;
		}
		else {
			ret.following = false;
		}
		if (req.user.blocking.indexOf(user.id) > -1) {
			ret.blocking = true;
		}
		else {
			ret.blocking = false;
		}
	}
	ret.hasDetails = false;
	
	return ret;
};

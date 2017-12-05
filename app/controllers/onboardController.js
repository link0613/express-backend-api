/**
 * Onboard Controller
 */

var config = require('../../config');
var PhoneNumber = require('../models/phoneNumber');
var User = require('../models/user');
var async = require('async');
var twilio = require('twilio');
var client = new twilio.RestClient(config.twilioAccountSid, config.twilioAuthToken);
var passport = require('../../config/passport');
var Invitation = require('../models/invitation').model;
var InvitationStatus = require('../models/invitation').status;
var fieldValidator = require('./fieldValidator');

exports.registerPhoneNumber = function (req, res, next) {
	var deviceId = req.body.deviceId;
	var number = req.body.number;
	var countryCode = req.body.countryCode;

	async.waterfall([
  	    function checkPhoneNumber(callback) {
  	    	PhoneNumber.findOne({number: number})
  	    	.exec(function (err, phoneNumber) {
  	    		if (err) return callback(err);
  	    		if (!phoneNumber) {
  	    			phoneNumber = new PhoneNumber();
  	    			phoneNumber.number = number;
  	    			phoneNumber.refersCount = 0;
  	    		}
  	    		callback(null, phoneNumber);
  	    	});
  	    },
  	    function updatePhoneNumber(phoneNumber, callback) {
  	    	phoneNumber.verificationCode = generateVerificationCode();
  	    	phoneNumber.deviceId = deviceId;
  	    	phoneNumber.countryCode = countryCode;
  	    	phoneNumber.refersCount ++;

  	    	phoneNumber.save(function(err) {
  	    		if (err) return callback(err);
  	    		callback(null, phoneNumber);
  	    	});
  	    },
  	    function sendVerificationCode(phoneNumber, callback) {
  	    	client.sms.messages.create({
  	    		to: phoneNumber.number,
  	    		from: config.twilioPhoneNumber,
  	    		body: "Your FindNear verification code is " + phoneNumber.verificationCode + "."
  	    	}, function(err, message) {
            if (err) {
              return callback({findnear: true, error: err.code, message: err.message, showToUser: true});
            }
  	    		callback(null, message);
  	    	});
  	    }
  	], function(err, message) {
		  if (err) return next(err);
      res.json({success: true, sid: message.sid});
  	});
};

exports.verifyPhoneNumber = function (req, res, next) {
	var number = req.body.number;
	var code = req.body.code;

	async.waterfall([
  	    function checkPhoneNumber(callback) {
  	    	PhoneNumber.findOne({number: number, verificationCode: code})
  	    	.exec(function (err, phoneNumber) {
  	    		if (err) return callback(err);

  	    		if (!phoneNumber) {
  	    			return callback({findnear: true, error: 422, message: "Invalid code", showToUser: true});
  	    		}
  	    		callback(null, phoneNumber);
  	    	});
  	    },
  	    function updatePhoneNumber(phoneNumber, callback) {
  	    	phoneNumber.verified = true;
  	    	phoneNumber.updatedAt = Date.now();

  	    	phoneNumber.save(function(err) {
  	    		callback(err);
  	    	});
  	    },
  	    function checkUser(callback) {
  	    	User.findOne({phoneNumber: number})
  	    	.exec(function(err, user) {
  	    		if (user) {
  				    var hasCompleted = false;
  				    if (user.username) {
  				    	hasCompleted = true;
  				    }
  				    return callback(null, user, hasCompleted);
  	    		}
  	    		callback(null, null, null);
  	    	});
  	    },
   	    function generateToken(user, hasCompleted, callback) {
          if (!user) return callback(null, user, hasCompleted);

          passport.generateToken(user, function(err, token) {
            if (err) return callback(err);
            req.token = token.token;
            callback(null, user, hasCompleted);
          });
   	    }
  	], function(err, user, hasCompleted) {
		    if (err) return next(err);
        if (user)
          res.json({success: true, token: req.token, user: userJson(user), completed: hasCompleted});
        else
          res.json({success: true});
  	});
};

exports.deletePhoneNumber = function (req, res, next) {
  var number = req.query.number;
  if (number.lastIndexOf('+', 0) !== 0) {
    number = '+' + number;
  }
  async.waterfall([
        function deletePhoneNumber(callback) {
          PhoneNumber.findOne({number: number})
          .exec(function (err, phoneNumber) {
            if (err) return callback(err);
            if (!phoneNumber) {
              callback({message: "Couldn't find phone number."});
            }
            else {
              phoneNumber.remove(function(err) {
                callback();
              });
            }
          });
        },
        function deleteInvitation(callback) {
          Invitation.remove({phoneNumber: number}, function(err) {
            callback(err);
          });
        },
        function updateUser(callback) {
          User.update(
            {phoneNumber: number},
            {$unset: {phoneNumber: ''}},
            function (err) {
              callback(err);
            });
        }
    ], function(err) {
      if (err) {
        return res.send(err.message);
      }
      res.send("Success!");
    });
};

exports.tagDetails = function (req, res, next) {
  var invitationId = req.params.id;
  if (!fieldValidator.validateObjectId(invitationId).valid) {
    var message = {error: "Invalid Identifier"};
    return res.render('tag', {
      message: message,
      tagId: invitationId,
      eventId: '',
    });
  }

  Invitation.findByIdAndUpdate(invitationId, {clicked: true}, function (err, invitation) {
    var message = {};
    var eventId = '';
    if (!invitation) {
      message.error = "Couldn't find record.";
    }
    else {
      eventId = invitation.event;
    }
    res.render('tag', {
      message: message,
      tagId: invitationId,
      eventId: eventId,
    });
  });
};

exports.getOnboardMatch = function (req, res, next) {
  if (!req.user.phoneNumber) {
    return res.json({success: true});
  }

  Invitation
  .findOne({phoneNumber: req.user.phoneNumber, status: InvitationStatus.Invited})
  .populate('event')
  .populate('srcUser', 'username displayName hasProfile')
  .exec(function (err, invitation) {
    if (err) return next(err);
    if (invitation)
      User.populate(invitation, {path: 'event.author event.attendees', select: 'username displayName hasProfile'}, function(err, invitation) {
        if (err) return next(err);
        res.json({success: true, match: invitationJson(invitation, req)});
      });
    else
      res.json({success: true});
  });
};

exports.getOnboardDetails = function (req, res, next) {
  var invitationId = req.params.id;
  if (!fieldValidator.validateObjectId(invitationId).valid) {
    return next({findnear: true, error: 421, message: "Invalid identifier", showToUser:true})
  }

  Invitation
  .findById(invitationId)
  .populate('event')
  .populate('srcUser', 'username displayName hasProfile')
  .exec(function (err, invitation) {
    if (err) return next(err);
    if (!invitation) return next({findnear: true, error: 404, message: "Not found.", showToUser:true});

    User.populate(invitation, {path: 'event.author event.attendees', select: 'username displayName hasProfile'}, function(err, invitation) {
      if (err) return next(err);
      res.json({success: true, result: invitationJson(invitation, req)});
    });
  });
};

generateVerificationCode = function() {
	var n = Math.floor(Math.random() * 9000 + 1000);
	return n + '';
};

invitationJson = function(invitation, req) {
  var dict = {
      id: invitation.id,
      userId: invitation.srcUser.id,
      username: invitation.srcUser.username,
      displayName: invitation.srcUser.displayName,
      hasProfile: invitation.srcUser.hasProfile,
      event: eventController.eventJson(invitation.event, req),
    };
  dict.attendees = [];
  invitation.event.attendees.forEach(function(user) {
    dict.attendees.push({
      userId: user.id,
      username: user.username,
      displayName: user.displayName,
      hasProfile: user.hasProfile,
    });
  });
  return dict;
};

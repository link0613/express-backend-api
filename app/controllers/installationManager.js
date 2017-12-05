/**
 * Installation Manager
 */

var User = require('../models/user');
var async = require('async');
var userController = require('./userController');
var Installation = require('../models/installation');

exports.install = function (req, res, next) {
	var deviceId = req.body.deviceId;
	
	async.waterfall([
	    function checkAccessToken(callback) {
	    	if (req.body.access_token) {
	    		userController.validateToken(req, res, function(err) {
	    			callback();
	    		});
	    	}
	    	else {
	    		callback();
	    	}
	    },
	    function updateInstallation(callback) {
	 	   	Installation.findOne({'deviceId': deviceId}, function (err, installation) {
	 			if (err) return callback(err);
	 			
	 	    	if (!installation) {
	 	    		installation = new Installation();
		 	    	installation.deviceId = deviceId;
	 	    	}
	 	    	installation.user = req.user;
	 	    	if (req.body.appVersion)
	 	    		installation.appVersion = req.body.appVersion;
	 	    	if (req.body.osVersion)
	 	    		installation.osVersion = req.body.osVersion;
	 	    	if (req.body.deviceType)
	 	    		installation.deviceType = req.body.deviceType;
	 	    	if (req.body.timeZone)
	 	    		installation.timeZone = req.body.timeZone;
	 	    	installation.updatedAt = new Date();

	 	    	installation.save(function(err, installation) {
 		       		callback(err, installation);
 		        });
	 	    });
	    },
	    function updateUserLogin(installation, callback) {
	    	if (req.user) {
	    		req.user.lastLogin = new Date();
	 	    	req.user.save(function(err, user) {
 		       		callback(null, installation);
 		        });
	    	}
	    }
	], function(err, installation) {
		if (err) return next(err);
		res.json({success: true, badge: installation.badge});
	});
};

exports.registerToken = function (req, res, next) {
	var deviceId = req.body.deviceId;
	var deviceToken = req.body.deviceToken;
	
   	Installation.findOne({'deviceId': deviceId}, function (err, installation) {
		if (err) return callback(err);
		
    	if (!installation) {
    		installation = new Installation();
    		installation.deviceId = deviceId;
    	}
		installation.deviceToken = deviceToken;
    	installation.updatedAt = new Date();
    	installation.save(function(err, installation) {
    		if (err) return next(err);
    		res.json({success: true, badge: installation.badge});
	    });
   	});
};

exports.unregisterDevice = function (user, deviceId, next) {
   	Installation.update({user: user, deviceId: deviceId}, {$unset: {user: ''}}, function (err) {
   		next(err);
   	});
};

exports.setActive = function (req, res, next) {
	var deviceId = req.body.deviceId;
	var active = req.body.active;
	
   	Installation.findOne({'deviceId': deviceId}, function (err, installation) {
		if (err) return callback(err);
		
    	if (!installation) {
    		installation = new Installation();
    		installation.deviceId = deviceId;
    	}
		installation.active = active;
    	installation.updatedAt = new Date();
    	installation.save(function(err, installation) {
    		if (err) return next(err);
    		res.json({success: true, badge: installation.badge});
	    });
   	});
};

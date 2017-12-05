
/**
 * Module dependencies.
 */

var config = require('./config')
var database = require('./config/database');
var Installation = require('./app/models/installation');
var apn = require('apn');
var apnConnection = require('./config/apnConnection'); 
var async = require('async');

var message = "Launch 2015 - Powerball has won $224, your account has been credited";

	Installation
	.distinct('deviceToken', {deviceToken: {$exists: true}, active: true})
	.exec(function(err, tokens) {
		if (!tokens || tokens.length < 1) {
			console.log("There's no active device to send push");
			return;
		}
		var push = new apn.Notification();
		push.expiry = Math.floor(Date.now() / 1000) + 3600; // Expires in 1 hour from now
		push.alert = message;
		push.contentAvailable = true;
		apnConnection.pushNotification(push, tokens);
		console.log("Sent push to " + tokens.length + " devices");
	});

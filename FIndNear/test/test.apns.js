/**
 * Test for Push Notification
 */

var config = require('../config');
var apn = require('apn');
var apnConnection = require('../config/apnConnection');
var Installation = require('../app/models/installation');

describe('Push Notification', function() {

 it('send a push notification to Pei', function(done) {
	 var deviceToken = "";
	 if (config.env == 'development') {
		 deviceToken = "dc9991e3045231111f08eb9c446aa1b7af18853424d8c7a532b96c3802c96881";
	 }
	 else if (config.env == 'test') {
		 deviceToken = "592db7410b9b4f0fe04fae7b763587b9f87ebb29586f298e91629ee681186fef";
	 }
	 else if (config.env == 'production') {
		 deviceToken = "10b8d8069d4308c9552c6e00a778fbcabb671c3b8ab50eb6dc49545233b45eca";
	 }
	 var device = new apn.Device(deviceToken);
	 var push = new apn.Notification();
	 push.expiry = Math.floor(Date.now() / 1000) + 3600; // Expires in 1 hour from now
	 push.badge = 1;
	 push.sound = "Default";
	 push.alert = "Push is working.Push is working.Push is working.Push is working.Push is working.Push is working.Push is working.Push is working.Push is working.Push is working.Push is working.Push is working.Push is working.Push is working.Push is working.Push is working.Push is working.Push is working.Push is working.Push is working.";
	 apnConnection.pushNotification(push, device);
	 done();
 });
});

/*
 * GET home page.
 */

var database = require('../config/database');

exports.index = function(req, res) {
	var payload = {};
	if (database.readyState) {
		payload.database = 'connected';
	}
	else {
		payload.database = 'not connected';
	}
	res.status(200);
	res.json(payload);
};

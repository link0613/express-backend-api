
/**
 * Module dependencies.
 */

var config = require('./config')
  , database = require('./config/database')
  , fs = require('fs')
  , async = require('async')
  , moment = require('moment-timezone')
  , Draw = require('./app/models/draw')
  , Ticket = require('./app/models/ticket')
  , CronJob = require('cron').CronJob;

if (!fs.existsSync("./tickets")) {
	console.log("Creating directory for tickets");
	fs.mkdirSync("./tickets");
}
var count = 0;
var now = moment(new Date());
var filename = "tickets/tickets_" + now.tz("America/New_York").format("M_D_YY");
var writeStream = fs.createWriteStream(filename);
writeStream.write('user,group,chargedAt,number1,number2,number3,number4,number5,special,powerPlay,chargeId\n');

async.waterfall([
	function findActiveDraws(callback) {
    	Draw.find({active: true}, function (err, draws) {
			if (err) return callback(err);
			var drawIds = [];
			draws.forEach(function(draw) {
				drawIds.push(draw.id);
			});
			callback(null, drawIds);
		});
	},
	function getTickets(drawIds, callback) {
		Ticket.find({draw: {$in: drawIds}})
		.sort('-createdAt')
		.stream()
		.on('data', function(ticket) {
			console.log(count++);
			var userId = ticket.user;
			var groupId = '';
			if (ticket.group)
				groupId = ticket.group;
			var chargeId = '';
			if (ticket.chargeId)
				chargeId = ticket.chargeId;
			var chargedAt = ticket.createdAt;
			var chargeDate = chargedAt.getFullYear() + '-' + (chargedAt.getMonth() + 1) + '-' + chargedAt.getDate() + ' ' + chargedAt.getHours() + ':' + chargedAt.getMinutes() + ':' + chargedAt.getSeconds();

			writeStream.write(userId + ',' +
				groupId + ',' +
				chargeDate + ',' +
				ticket.number1 + ',' +
				ticket.number2 + ',' +
				ticket.number3 + ',' +
				ticket.number4 + ',' +
				ticket.number5 + ',' +
				ticket.special + ',' +
				ticket.powerPlay + ',' +
				chargeId + '\n'
				);
		}).on('error', function(err) {
			console.log('Stream error: ' + err)
			writeStream.end();
		}).on('close', function() {
			console.log('Stream closed');
			writeStream.end();
		});
	},
], function(err) {

});

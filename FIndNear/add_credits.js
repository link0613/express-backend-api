
/**
 * Add credits.
 */

var config = require('./config')
  , database = require('./config/database')
  , async = require('async')
  , Draw = require('./app/models/draw')
  , Ticket = require('./app/models/ticket')
  , User = require('./app/models/user');

var poolPrize = 19;
var poolTickets = 125;
var prizePerTicket = poolPrize / poolTickets;

var poolWinnings = [
{user: '5505d33844f53437437ee74f', tickets: 5},
{user: '5505cd7d44f53437437ee74b', tickets: 5},
{user: '54feb50a09ba639a01fd0dc7', tickets: 5},
{user: '54fcf1b1b0092fcb6e7b84e3', tickets: 20},
{user: '54fb6d295ba9ba862b34add3', tickets: 10},
{user: '54faf2a55ba9ba862b34adb3', tickets: 5},
{user: '54fac5d45ba9ba862b34ada9', tickets: 5},
{user: '54fa99605ba9ba862b34ad73', tickets: 5},
{user: '54fa92955ba9ba862b34ad67', tickets: 5},
{user: '54fa73e4f06dabf42791815c', tickets: 10},
{user: '54f87177846c03db7c2e2c86', tickets: 50},

];

var individualWinnings = [
];

console.log('Winning per ticket: ' + prizePerTicket);

async.eachLimit(poolWinnings, 10, function(winning, callback) {
	User.update({_id: winning.user}, {$inc: {credit: prizePerTicket * winning.tickets}}, function(err) {
		callback(err);
	});
}, function(err) {
	console.log("Added all pool winnings to users : " + err);
});

async.eachLimit(individualWinnings, 10, function(winning, callback) {
	User.update({_id: winning.user}, {$inc: {credit: winning.winning}}, function(err) {
		callback(err);
	});
}, function(err) {
	console.log("Added all individual winnings to users : " + err);
});


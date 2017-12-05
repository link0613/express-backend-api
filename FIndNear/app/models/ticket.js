/**
 * Ticket
 */

var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var timestamps = require('mongoose-timestamp');

var Ticket = new Schema({
	draw: {type: mongoose.Schema.Types.ObjectId, ref:'draw', index: true, required: true},
	user: {type: mongoose.Schema.Types.ObjectId, ref:'user', index: true},
	group: {type: mongoose.Schema.Types.ObjectId, ref:'group', index: true},
	number1: {type: Number, required: true, index: true},
	number2: {type: Number, required: true, index: true},
	number3: {type: Number, required: true, index: true},
	number4: {type: Number, required: true, index: true},
	number5: {type: Number, required: true, index: true},
	special: {type: Number, required: true, index: true},
	lottery: {type: Number, required: true, index: true},
	powerPlay: Boolean,
	expire: Date,
	winning: Number,

	chargeId: {type: String, index: true},
	credit: Number,
});

Ticket.plugin(timestamps);

module.exports = mongoose.model('ticket', Ticket);

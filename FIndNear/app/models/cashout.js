/**
 * Cashout
 */

var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var timestamps = require('mongoose-timestamp');

var Cashout = new Schema({
	user: {type: Schema.Types.ObjectId, ref:'user', index: true, required: true},
	amount: Number,
	remaining: Number,
	firstName: String,
	lastName: String,
	address: String,
	city: String,
	zipCode: Number,
	paid: {type: Boolean, 'default': false},
});

Cashout.plugin(timestamps);

module.exports = mongoose.model('cashout', Cashout);

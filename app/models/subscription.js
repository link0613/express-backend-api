/**
 * Subscription
 */

var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var timestamps = require('mongoose-timestamp');

var Subscription = new Schema({
	user: {type: mongoose.Schema.Types.ObjectId, ref:'user', index: true},
	group: {type: mongoose.Schema.Types.ObjectId, ref:'group', index: true},
	lottery: {type: Number, required: true, index: true},

	jackpot: Number,
	tickets: Number,
	enabled: {type: Boolean, default: true, index: true},
});

Subscription.plugin(timestamps);

module.exports = mongoose.model('subscription', Subscription);

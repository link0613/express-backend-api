/**
 * Activity
 */

var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var timestamps = require('mongoose-timestamp');

var ActivityType = Object.freeze({
	BuyTickets: 0,
	JoinGroup: 1,
	WinPrize: 2,
	WinJackpot: 3,
	WithdrawCash: 4,
});

var Activity = new Schema({
	issuer: {type: Schema.Types.ObjectId, ref:'user', required: true, index: true},
//	receivers: {type: [{type: Schema.Types.ObjectId, ref:'user'}], required: true, index: true},
	receiver: {type: Schema.Types.ObjectId, ref:'user', required: true, index: true},
	type: {type: Number, required: true},
	readAt: Date,
	group: {type: Schema.Types.ObjectId, ref:'group'},
	draw: {type: Schema.Types.ObjectId, ref:'group'},
	count: Number,
	deviceId: {type: String, index: true},
});

Activity.plugin(timestamps);

module.exports.model = mongoose.model('activity', Activity);
module.exports.type = ActivityType;

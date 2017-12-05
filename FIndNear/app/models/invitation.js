/**
 * Invitation
 */

var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var timestamps = require('mongoose-timestamp');

var InvitationStatus = Object.freeze({
	Invited: 0,
	Accepted: 1,
	Denied: 2,
});

var Invitation = new Schema({
	srcUser: {type: Schema.Types.ObjectId, ref:'user', required: true, index: true},
	group: {type: Schema.Types.ObjectId, ref:'group', index: true},
	dstUser: {type: Schema.Types.ObjectId, ref:'user', index: true},
	phoneNumber: {type: String, index: true},
	status: {type: Number, default: InvitationStatus.Invited},
	clicked: Boolean,
	convertedUser: {type: Schema.Types.ObjectId, ref:'user', index: true},
	convertedAt: Date,
});

Invitation.plugin(timestamps);

module.exports.model = mongoose.model('invitation', Invitation);
module.exports.status = InvitationStatus;

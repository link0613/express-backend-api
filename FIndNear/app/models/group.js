/**
 * Group
 */

var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var timestamps = require('mongoose-timestamp');

var Group = new Schema({
	membersCount: Number,
	members: [{type: Schema.Types.ObjectId, ref:'user', index: true}],
	ticketsCount: Number,
	drawsCount: Number,
	winningCount: Number,
	privacy: Number,
	lottery: Number,
	name: String,
	closed: Boolean,
});

Group.plugin(timestamps);

module.exports = mongoose.model('group', Group);

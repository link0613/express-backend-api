/**
 * Draw
 */

var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var timestamps = require('mongoose-timestamp');

var Draw = new Schema({
	winNumber1: Number,
	winNumber2: Number,
	winNumber3: Number,
	winNumber4: Number,
	winNumber5: Number,
	winSpecial: Number,
	lottery: {type: Number, index: true},
	jackpot: Number,
	winner: {type: mongoose.Schema.Types.ObjectId, ref:'user', index: true},
	date: {type: Date, index: true},
	active: Boolean,
	closed: Boolean,
	closeAt: Date,
	powerPlay: Number,
	ticketsCount: Number,
});

Draw.plugin(timestamps);

Draw.virtual('winNumbers').get(function() {
	var num = this.numbers;
	var array = [];
	while (num > 0) {
		array.push(num % 100);
		num = (num / 100 >> 0);
	}
	return array.reverse();
})
.set(function() {
	var result = 0;
	for (var i = arguments.length - 1; i >= 0; i--) {
		result = result * 100 + arguments[i];
	};

	this.number = result;
});

module.exports = mongoose.model('draw', Draw);

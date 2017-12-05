/**
 * User
 */

var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var bcrypt = require('bcrypt-nodejs');
var config = require('../../config');
var timestamps = require('mongoose-timestamp');

var User = new Schema({
	username : {type: String, lowercase:true},
	password : {type: String, 'default': ''},
	facebook: {
		id: String,
		accessToken: String,
		expiration: Date,
		name: String
	},
	twitter: {
		id: String,
		authToken: String,
		authSecret: String,
		screenName: String
	},
	stripe: {
		customerId: String,
		cardId: String,
		last4: String,
	},
	shippinp: {
		firstName: String,
		lastName: String,
		address: String,
		city: String,
		zipCode: Number,
	},
	phoneNumber: {type: String},
	email: String,
	emailVerified: Boolean,
	displayName: {type: String},
	description: {type: String},
	firstName: String,
	lastName: String,
	followersCount: Number,
	followers: [{type: Schema.Types.ObjectId, ref:'user'}],
	followingCount: Number,
	following: [{type: Schema.Types.ObjectId, ref:'user'}],
	lastLogin: {type: Date, 'default': Date.now},
	userNo: Number,
	ticketsCount: Number,
	drawsCount: Number,
	winningCount: Number,
	winningCredit: Number,
	credit: {type: Number, 'default': 0},
	hasProfile: Boolean,
	hasCover: Boolean,
	coverUrl: String,
	badgeNumber: Number,
	reserved: Boolean,
	resetToken: String,
	resetExpires: Date,
	verificationToken: String,
	role: [String],

	blockersCount: Number,
	blockers: [{type: Schema.Types.ObjectId, ref:'user'}],
	blockingCount: Number,
	blocking: [{type: Schema.Types.ObjectId, ref:'user'}],
});

User.index({username: 'text', displayName: 'text', phoneNumber: true});

// generating a hash
User.methods.generateHash = function(password) {
	return bcrypt.hashSync(password, bcrypt.genSaltSync(8), null);
};

// checking if password is valid
User.methods.validPassword = function(password) {
	return bcrypt.compareSync(password, this.password);
};

// Get profile url
User.virtual('profilePic').get(function () {
	if (this.hasProfile) {
		return config.server.imageServer + '/image/user/profile/' + this.id;
	}
	return undefined;
});

User.virtual('thumbnailPic').get(function () {
	if (this.hasProfile) {
		return config.server.imageServer + '/image/user/profile/' + this.id + '?size=80';
	}
	return undefined;
});

User.virtual('coverPic').get(function () {
	if (this.hasCover) {
		if (this.coverUrl) return this.coverUrl;
		return config.server.imageServer + '/image/user/cover/' + this.id;
	}
	return undefined;
});

User.virtual('isAdmin').get(function () {
	if (this.role && this.role.indexOf("admin") > -1)
		return true;
	return false;
});

User.plugin(timestamps);

// create the model for users and expose it to our app
module.exports = mongoose.model('user', User);

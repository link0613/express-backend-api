/**
 * Validator for fields
 */

var mongoose = require('mongoose');

exports.validateUsername = function(username) {
	if (username.length < 3) {
		return {valid: false, message: "Username should be more than 2 characters.", showToUser: true};
	}
	if (username.length > 15) {
		return {valid: false, message: "Username can't be more than 15 characters.", showToUser: true};
	}
	if (username.indexOf("findnear") != -1 || username.indexOf("admin") != -1) {
		return {valid: false, message: "Your username can't contain 'findnear' or 'admin'.", showToUser: true};
	}
	if (!(/^[a-z0-9_-]+$/.test(username))) {
		return {valid: false, message: "Username can contain only lowercase letters, numbers and underscores.", showToUser: true};
	}
	
	return {valid: true};
};

exports.validateEmail = function(email) {
	var pattern = /^([a-z0-9_\.-]+)@([\da-z\.-]+)\.([a-z\.]{2,6})$/;
	var valid = pattern.test(email);
	if (valid) {
		return {valid: true};
	}
	else {
		return {valid: false, message: "Invalid email address", showToUser: true};
	}
};

exports.validatePassword = function(password, confirm) {
	if (password !== confirm) {
		return {valid: false, message: "Passwords do not match.", showToUser: true};
	}
	if (password.length < 6) {
		return {valid: false, message: "Passwords must be at least 6 characters.", showToUser: true};
	}
	return {valid: true};
};

exports.validateObjectId = function(objectId) {
	if (!mongoose.Types.ObjectId.isValid(objectId)) {
		return {valid: false, message: "Invalid Identifier", showToUser: true};
	}
	return {valid: true};
};
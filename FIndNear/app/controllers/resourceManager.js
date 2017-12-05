/**
 * Resources
 */

var gm = require('gm');
var mime = require('mime');
var path = require('path');
var fs = require('fs');
var junk = require('junk');
var config = require('../../config');
var async = require('async');

exports.userProfile = function (req, res, next) {
	var userId = req.params.id;
	var size = req.query.size;
	
	sendImageInDir(res, next, path.join(config.resourceDir, '/user_profiles/', userId), size);
};

exports.userCover= function (req, res, next) {
	var userId = req.params.id;
	var size = req.query.size;
	
	sendImageInDir(res, next, path.join(config.resourceDir, '/user_covers/', userId), size);
};


sendImageInDir = function (res, next, dir, size) {
	fs.exists(dir, function(exists) {
		if (!exists) {
			res.status(404).send('Resource Not found');
			return;
		}
		fs.readdir(dir, function (err, files) {
			if (err) return next(err);
			files = files.filter(junk.not);
			if (files.length < 1) {
				res.status(404).send('Resource Not found');
				return;
			}
			
			var file = path.join(dir, files[0]);
			if (size) {
				res.set('Content-Type', mime.lookup(file));
				gm(file)
				.resize(size, size)
				.stream(function (err, stdout, stderr) {
					if (err) return res.status(404).send('Image Error');
					stdout.pipe(res);
					stdout.on('error', next);
				});
			}
			else {
				res.set('Content-Type', mime.lookup(file));
	//			var stream = fs.createReadStream(file);
	//			stream.pipe(res);
				res.sendFile(file);
			}
		});
	});
};


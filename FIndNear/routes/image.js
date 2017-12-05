
/*
 * GET home page.
 */

var resourceManager = require('../app/controllers/resourceManager'); 
var config = require('../config');

exports.index = function(req, res){
  res.render('index', { title: 'FindNear' });
};

exports.setupImage = function (router) {
	router.get('/user/profile/:id', resourceManager.userProfile);
	router.get('/user/cover/:id', resourceManager.userCover);
};

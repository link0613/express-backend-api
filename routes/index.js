
/*
 * GET home page.
 */

var appController = require('../app');
var userController = require('../app/controllers/userController');
var resourceManager = require('../app/controllers/resourceManager'); 
var installationManager = require('../app/controllers/installationManager');
var onboardController = require('../app/controllers/onboardController');
var drawController = require('../app/controllers/drawController');
var cashController = require('../app/controllers/cashController');
var groupController = require('../app/controllers/groupController');
var config = require('../config');

exports.index = function(req, res){
  res.render('index', { title: 'FindNear' });
};

exports.setupAPI = function(router) {
	router.get('/', appController.index);

	router.post('/login', userController.login);
	router.post('/register', userController.register);
	router.post('/forgot', userController.forgotPassword);
	router.post('/loginfb', userController.loginFacebook);
	router.post('/logintw', userController.loginTwitter);
	router.post('/install/token', installationManager.registerToken);
	router.post('/install/active', installationManager.setActive);
	router.post('/install', installationManager.install);
	
	router.post('/phone/register', onboardController.registerPhoneNumber);
	router.post('/phone/verify', onboardController.verifyPhoneNumber);

	if (config.env != 'production') {
		router.get('/phone/delete', onboardController.deletePhoneNumber);
	}

	router.get('/draw', drawController.allDraws);
// 	router.get('/event/onfire', eventController.eventsOnFire);
// 	router.get('/event/latest', eventController.eventsLatest);
// 	router.get('/event/search', eventController.searchEvents);
// 	router.get('/event/:id/photo', photoController.photosOfEvent);

// 	router.get('/photo/:id/like', photoController.likesOfPhoto);
// 	router.get('/photo/:id/comment', photoController.commentsOfPhoto);
// 	router.get('/event/:id/comment', eventController.commentsOfEvent);
	
// 	router.get('/user/search', userController.searchUsers);
// 	router.get('/user/name/:username', userController.userDetailsByName);
	router.get('/user/:id', userController.userDetails);
// 	router.get('/user/:id/event', eventController.eventsOfUser);
// 	router.get('/user/:id/followers', userController.followersOfUser);
// 	router.get('/user/:id/following', userController.followingOfUser);
// 	router.get('/event/:id', eventController.eventDetails);
// 	router.get('/photo/:id', photoController.photoDetails);
	
// 	router.get('/clusters', clusterController.getClusters);
// 	router.post('/clusters', clusterController.updateClusters);

// 	// Should have valid access token from here
	router.all('/*', userController.validateToken);
// 	router.post('/linkfb', userController.linkFacebook);
// 	router.post('/linktw', userController.linkTwitter);
// 	router.post('/unlinkfb', userController.unlinkFacebook);
// 	router.post('/unlinktw', userController.unlinkTwitter);
	router.post('/logout', userController.logout);
	router.get('/draw/:id/ticket', drawController.ticketsOfDraw);
	router.post('/draw/:id/buy', drawController.buyTickets);
	router.post('/group/:id/buy', groupController.buyTickets);
	router.post('/group/:id/join', groupController.joinGroup);
	router.get('/group/:id/ticket', groupController.ticketsOfGroup);
	router.get('/group/:id/member', groupController.membersOfGroup);
// 	router.get('/event/friends', eventController.eventsFriends);
// 	router.post('/event/matches', eventController.eventsMatched);
// //	router.get('/event/:id', eventController.eventDetail);
// 	router.post('/event', eventController.addEvent);
// 	router.post('/event/:id/contribute', eventController.contributeToEvent);
// 	router.post('/event/:id/comment', eventController.commentEvent);
// 	// router.post('/event/:id/tagfriends', onboardController.tagFriends);
// 	router.delete('/event/:id/comment', eventController.uncommentEvent);
// 	router.delete('/event/:id', eventController.deleteEvent);
// 	router.post('/photo', photoController.addPhoto);
// 	router.post('/photo/:id/like', photoController.likePhoto);
// 	router.post('/photo/:id/comment', photoController.commentPhoto);
// 	router.post('/photo/:id/flag', photoController.flagPhoto);
// 	router.delete('/photo/:id/like', photoController.unlikePhoto);
// 	router.delete('/photo/:id/comment', photoController.uncommentPhoto);
// 	router.delete('/photo/:id', photoController.deletePhoto);
// //	router.post('/photo/:id/unlike', photoController.unlikePhoto);
// //	router.post('/photo/:id/uncomment', photoController.uncommentPhoto);
	
	router.post('/user/findfriends', userController.findFriends);
	router.post('/user/friends', userController.getFriends);
	router.post('/user/cash', cashController.cashCredit);
// 	router.post('/user/:id/block', userController.blockUser);
// 	router.delete('/user/:id/block', userController.unblockUser);
	router.post('/user/:id', userController.updateProfile);
	router.post('/changepwd', userController.changePassword);
// 	router.post('/user/:id/follow', userController.followUser);
// 	router.delete('/user/:id/follow', userController.unfollowUser);
	
// 	router.get('/activity/mine', activityController.activitiesOfMine);
// 	router.get('/activity/:id', activityController.activityDetails);
// 	router.post('/activity/read', activityController.readActivities);

// 	router.get('/upm/:id/', upmController.getMatchDetails)
// 	router.get('/upm', upmController.getMatches)
// 	router.get('/onboard/:id', onboardController.getOnboardDetails);
// 	router.get('/onboard', onboardController.getOnboardMatch);
};

exports.setupImage = function (router) {
	router.get('/user/profile/:id', resourceManager.userProfile);
	router.get('/user/cover/:id', resourceManager.userCover);
};

exports.setupOthers = function (router) {
	router.get('/reset/:token', userController.resetPassword);
	router.post('/reset/:token', userController.updatePassword);
	router.get('/confirm_email/:token', userController.confirmEmail);
	// router.get('/t/:id', onboardController.tagDetails);
	
	// router.post('/sendlink', appController.sendLink);
};

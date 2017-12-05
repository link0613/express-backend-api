/**
 * Unit test for User
 */

var should = require('should');
var mongoose = require('mongoose');
var User = require('../app/models/user.js');
var db;

describe('User', function() {

before(function(done) {
	db = require('../config/database');
	done();
 });

 after(function(done) {
   mongoose.connection.close();
   done();
 });

 beforeEach(function(done) {
  var account = new User({
    username: '@test!',
    password: 'testy'
  });

  account.save(function(error) {
    if (error) console.log('error' + error.message);
    else console.log('no error');
    done();
   });
 });

 it('find a user by username', function(done) {
    User.findOne({ username: '@test!' }, function(err, account) {
      account.username.should.eql('@test!');
      console.log("   username: ", account.username)
      done();
    });
 });

 afterEach(function(done) {
    User.remove({username: '@test!'}, function() {
      done();
    });
 });

});
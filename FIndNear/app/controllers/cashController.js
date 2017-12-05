/**
 * Onboard Controller
 */

var config = require('../../config');
var User = require('../models/user');
var Cashout = require('../models/cashout');
var async = require('async');
var fieldValidator = require('./fieldValidator');
var mongoose = require('mongoose');

exports.cashCredit = function (req, res, next) {
    var amount = req.body.amount;
    var firstName = req.body.firstName;
    var lastName = req.body.lastName;
    var address = req.body.address;
    var city = req.body.city;
    var zipCode = req.body.zip;
    async.waterfall([
        function checkAmount(callback) {
          if (!req.user.credit) {
            return next({findnear: true, error: 426, message: "There's no credit available.", showToUser:true})
          }
          else if (amount < 1) {
            return next({findnear: true, error: 427, message: "Amount should be $1 at least.", showToUser:true})
          }
          else if (amount > req.user.credit) {
            return next({findnear: true, error: 428, message: "You don't have enough credit.", showToUser:true})
          }
          callback();
        },
        function addCashout(callback) {
          var cashout = new Cashout();
          cashout.user = req.user;
          cashout.amount = amount;
          cashout.remaining = req.user.credit - amount;
          cashout.firstName = firstName;
          cashout.lastName = lastName;
          cashout.address = address;
          cashout.city = city;
          cashout.zipCode = zipCode;
          cashout.paid = false;
          cashout.save(function(err, cashout) {
            callback(err);
          });
        },
        function updateUser(callback) {
          req.user.credit -= amount;
          req.user.shipping = {
            firstName: firstName,
            lastName: lastName,
            address: address,
            city: city,
            zipCode: zipCode
          },
          req.user.save(function(err) {
            callback(err, req.user.credit);
          });
        },
    ], function(err, remainingAmount) {
        if (err) return next(err);
        res.json({success: true, credit: remainingAmount});
    });
};

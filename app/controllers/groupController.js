/**
 * Onboard Controller
 */

var config = require('../../config');
var User = require('../models/user');
var Draw = require('../models/draw');
var Group = require('../models/group');
var Ticket = require('../models/ticket');
var async = require('async');
var fieldValidator = require('./fieldValidator');
var userController = require('./userController');
var mongoose = require('mongoose');
var stripe = require('stripe')(config.stripeSecretKey);

exports.ticketsOfGroup = function (req, res, next) {
    var groupId = req.params.id;
    var limit = 100;
    var skip = 0;
    if (req.query.limit)
      limit = parseInt(req.query.limit);
    if (req.query.skip)
      skip = parseInt(req.query.skip);

    if (!fieldValidator.validateObjectId(groupId).valid) {
      return next({findnear: true, error: 421, message: "Invalid identifier", showToUser:true})
    }

    async.waterfall([
        function findGroup(callback) {
          Group.findById(groupId, function(err, group) {
            callback(err, group);
          });
        },
        function findDraw(group, callback) {
          Draw.findOne({active: true, lottery: group.lottery}, function(err, draw) {
            callback(err, group, draw);
          });
        },
        function getTickets(group, draw, callback) {
          Ticket
          .find({group: groupId, draw: draw.id})
          .sort('-createdAt')
          .limit(limit + 1)
          .skip(skip)
          // .populate('user', 'username displayName hasProfile')
          .exec(function (err, tickets, stats) {
            if (err) return callback(err);
            
            var hasMore = false;
            if (tickets && tickets.length > limit) {
              hasMore = true;
              tickets.pop();
            }
            callback(null, tickets, hasMore);
          });
        },
    ], function(err, tickets, hasMore) {
        if (err) return next(err);
        var results = [];
        tickets.forEach(function(ticket) {
          results.push(ticketJson(ticket));
        });
        res.json({success:true, results:results, hasMore:hasMore});
    });
};

exports.membersOfGroup = function (req, res, next) {
    var groupId = req.params.id;
    var limit = 100;
    var skip = 0;
    if (req.query.limit)
      limit = parseInt(req.query.limit);
    if (req.query.skip)
      skip = parseInt(req.query.skip);

    if (!fieldValidator.validateObjectId(groupId).valid) {
      return next({findnear: true, error: 421, message: "Invalid identifier", showToUser:true})
    }

    async.waterfall([
        function findGroup(callback) {
          Group.findById(groupId, function(err, group) {
            callback(err, group);
          });
        },
        function findDraw(group, callback) {
          Draw.findOne({active: true, lottery: group.lottery}, function(err, draw) {
            callback(err, group, draw);
          });
        },
        function getMembers(group, draw, callback) {
          var hasMore = false;
          var members;
          if (group.membersCount > skip + limit - 1) {
            members = group.members.slice(skip, skip + limit);
            hasMore = true;
          }
          else {
            members = group.members.slice(skip, group.members.length);
          }
          group.members = members;
          User.populate(group, {path: "members", select: 'username displayName hasProfile'}, function(err, group) {
              if (err) return callback(err);
              callback(err, draw, group.members, hasMore);
          });       
        },
        function getTicketsCount(draw, members, hasMore, callback) {
          async.mapLimit(members, 5, function(member, callback) {
            Ticket
            .count({user: member, draw: draw.id, group: groupId})
            .exec(function (err, count) {
              callback(null, count);
            });
          }, function(err, counts) {
            callback(null, members, counts, hasMore);
          });
        },
    ], function(err, members, counts, hasMore) {
        if (err) return next(err);
        var results = [];
        for (var i=0; i<members.length; i++) {
          results.push(memberJson(members[i], counts[i]));
        }
        res.json({success:true, results:results, hasMore:hasMore});
    });
};

exports.buyTickets = function (req, res, next) {
    var groupId = req.params.id;
    var tickets = req.body.tickets;
    var stripeToken = req.body.stripeToken;
    var useCredit = req.body.useCredit;
    var amount = tickets.length * 2;
    var email = req.body.email;

    if (!fieldValidator.validateObjectId(groupId).valid) {
      return next({findnear: true, error: 421, message: "Invalid identifier", showToUser:true})
    }
    async.waterfall([
        function findGroup(callback) {
          Group.findById(groupId, function(err, group) {
            callback(err, group);
          });
        },
        function findDraw(group, callback) {
          Draw.findOne({active: true, lottery: group.lottery}, function(err, draw) {
            callback(err, group, draw);
          });
        },
        function checkAvailability(group, draw, callback) {
          var date = new Date(draw.date);
          date.setDate(date.getDate() - 1);
          if (date < new Date() || draw.closed) {
            return callback({findnear: true, error: 430, message: "This drawing is now closed. We’ll let you know the results of the drawing.", showToUser:true});
          }
          callback(null, group, draw);
        },
        function processPayment(group, draw, callback) {
          if (useCredit) {
            if (amount > req.user.credit) {
              return callback({findnear: true, error: 428, message: "You don't have enough credit.", showToUser:true})
            }
            callback(null, group, draw);
          }
          else if (!stripeToken) {
            callback(null, group, draw);
          }
          else if (req.user.stripe.customerId && req.user.stripe.cardId) {
            // Delete old card and create new one
            stripe.customers.deleteCard(req.user.stripe.customerId, req.user.stripe.cardId, function(err, confirm) {
              stripe.customers.createCard(req.user.stripe.customerId, {source: stripeToken}, function(err, card) {
                if (err) {
                  if (err.type == 'StripeCardError') {
                    return callback({findnear: true, error: 425, message: err.message, showToUser:true});
                  }
                  else {
                    return callback(err);
                  }
                }
                req.user.stripe.cardId = card.id;
                req.user.stripe.last4 = card.last4;
                callback(null, group, draw);
              });
            });
          }
          else {
            // Create customer and retrieve card
            stripe.customers.create({
              source: stripeToken,
              metadata: {userId: req.user.id}
            }, function(err, customer) {
              if (err) {
                if (err.type == 'StripeCardError') {
                  return callback({findnear: true, error: 425, message: err.message, showToUser:true});
                }
                else {
                  return callback(err);
                }
              }
              var card = customer.active_card;
              req.user.stripe.customerId = customer.id;
              req.user.stripe.cardId = card.id;
              req.user.stripe.last4 = card.last4;
              callback(null, group, draw);
            });
          }
        },
        function processCharge(group, draw, callback) {
          if (useCredit) {
            req.user.credit -= amount;
            return callback(null, group, draw, null);
          }
          if (!req.user.stripe.customerId) {
            return callback({findnear: true, error: 429, message: "There's no credit card available. Please add one.", showToUser:true});
          }
          var receiptEmail = email;
          if (receiptEmail)
            req.user.email = receiptEmail;
          else
            receiptEmail = req.user.email;
          stripe.charges.create({
            amount: amount * 100,
            currency: "usd",
            customer: req.user.stripe.customerId,
            receipt_email: receiptEmail,
            description: "Buy " + tickets.length + " tickets in FindNear",
            metadata: {userId: req.user.id}
          }, function(err, charge) {
            if (err) {
              if (err.type == 'StripeCardError') {
                return callback({findnear: true, error: 425, message: err.message, showToUser:true});
              }
              else {
                return callback(err);
              }
            }
            callback(null, group, draw, charge);
          });
        },
        function buyTickets(group, draw, charge, callback) {
          async.mapLimit(tickets, 10, function(payload, callback) {
            var ticket = new Ticket();
            ticket.draw = draw.id;
            ticket.user = req.user;
            ticket.group = group;
            ticket.lottery = draw.lottery;
            ticket.number1 = payload.num1;
            ticket.number2 = payload.num2;
            ticket.number3 = payload.num3;
            ticket.number4 = payload.num4;
            ticket.number5 = payload.num5;
            ticket.special = payload.special;
            ticket.powerPlay = payload.power;
            if (charge)
              ticket.chargeId = charge.id;
            else
              ticket.credit = amount;
            ticket.save(function(err, ticket) {
              callback(err, ticket);
            });
          }, function(err, tickets) {
            callback(null, group, tickets, draw);
          });
      },
      function updateDraw(group, tickets, draw, callback) {
        draw.update({$inc: {ticketsCount: tickets.length}}, function(err) {
          callback(null, group, tickets);
        });
      },
      function updateGroup(group, tickets, callback) {
        group.update({$inc: {ticketsCount: tickets.length}}, function(err) {
          callback(null, tickets);
        });
      },
      function updateUser(tickets, callback) {
        if (req.user.ticketsCount)
          req.user.ticketsCount += tickets.length;
        else
          req.user.ticketsCount = tickets.length;
        req.user.save(function(err) {
          callback(null, tickets);
        });
      },
  ], function(err, tickets) {
    if (err) return next(err);
    res.json({success: true, count: tickets.length, credit: req.user.credit});
  });
};

exports.joinGroup = function (req, res, next) {
    var groupId = req.params.id;
    var tickets = req.body.tickets;
    var stripeToken = req.body.stripeToken;

    if (!fieldValidator.validateObjectId(groupId).valid) {
      return next({findnear: true, error: 421, message: "Invalid identifier", showToUser:true})
    }
    async.waterfall([
        function findGroup(callback) {
          Group.findById(groupId, function(err, group) {
            callback(err, group);
          });
        },
        function updateGroup(group, callback) {
          if (group.members.indexOf(req.user._id) < 0) {
            group.members.unshift(req.user._id);
            if (group.membersCount)
              group.membersCount ++;
            else
              group.membersCount = 1;
            group.save(function(err) {
              callback(err, group);
            });
          }
          else {
            callback(null, group);
          }
        },
        function findDraw(group, callback) {
          Draw.findOne({lottery: group.lottery, active: true}, function(err, draw) {
            callback(err, group, draw);
          });
        }
  ], function(err, group, draw) {
    if (err) return next(err);
    res.json({success: true, group: groupJson(group, draw, undefined, req)});
  });
};

exports.tagFriends = function (req, res, next) {
  var series = [];
  var groupId = req.params.id;
  if (!groupId)
    groupId = req.body.groupId;
  if (!fieldValidator.validateObjectId(groupId).valid) {
    return next({findnear: true, error: 421, message: "Invalid identifier", showToUser:true})
  }

  if (req.body.friendsTagged) {
    series.push(function(callback) {
      async.mapLimit(req.body.friendsTagged, 5, function(friendId, callback) {
        var invitationObject = new Invitation();
        invitationObject.srcUser = req.user._id;
        invitationObject.dstUser = new mongoose.Types.ObjectId(friendId);
        invitationObject.event = eventId;
        invitationObject.save(function(err) {
          callback(err, invitationObject);
        });
      }, function(err, invitations) {
        if (!err) {
          activityController.didTagOnEvent(invitations, req.body.friendsTagged, req, function() {
          });
        }
        callback(err);
      });
    });
  }
  if (req.body.phonesTagged) {
    series.push(function(callback) {
      var fullName = req.user.displayName;
      if (!fullName)
        fullName = "@" + req.user.username;
      var message = fullName + " has invited you to join the beta http://findnear.io to sign up!";

      async.eachLimit(req.body.phonesTagged, 10, function(phoneNumber, callback) {
        var invitationObject = new Invitation();
        invitationObject.srcUser = req.user._id;
        invitationObject.phoneNumber = phoneNumber;
        invitationObject.group = groupId;
        invitationObject.save(function(err) {
            if (!err) {
                twilioClient.sms.messages.create({
                  to: phoneNumber,
                  from: config.twilioPhoneNumber,
                  body: message
                }, function(err, message) {
                });
            }
            callback(err);
        });
      }, function(err) {
        callback(err);
      });
    });
  }
  async.parallel(series, function(err) {
    if (err) {
      if (next) next(err);
      return;
    }

    if (res) {
      res.json({success: true});
    }
  })
}

groupJson = function(group, draw, ticketsCount, req) {
  var dict = {
      id: group.id,
      lottery: group.lottery,
      members: group.membersCount,
      tickets: ticketsCount,
      name: group.name,
    };
  if (draw) {
    dict.drawDate = draw.date.getTime() / 1000;
    if (draw.closeAt)
      dict.closeAt = draw.closeAt.getTime() / 1000;
  }
  if (group.createdAt)
    dict.created = group.createdAt.getTime() / 1000;
  if (group.updatedAt)
    dict.updated = group.updatedAt.getTime() / 1000;

  if (req && req.user) {
    if (group.members.indexOf(req.user._id) > -1) {
      dict.joined = true;
    }
  }
  if ('closed' in group) {
    dict.closed = group.closed;
  }
  else if (draw) {
    if (draw.closeAt)
      dict.closeAt = draw.closeAt.getTime() / 1000;
    else {
      var date = new Date(draw.date);
      date.setDate(date.getDate() - 1);
      if (date < new Date()) {
        dict.closed = true;
      }
    }
    if ('closed' in draw)
      dict.closed = draw.closed;
  }

  return dict;
};
exports.groupJson = groupJson;

ticketJson = function(ticket) {
  var dict = {
      id: ticket.id,
      draw: ticket.draw.id,
      num1: ticket.number1,
      num2: ticket.number2,
      num3: ticket.number3,
      num4: ticket.number4,
      num5: ticket.number5,
      special: ticket.special,
      lottery: ticket.lottery,
      power: ticket.powerPlay,
    };
  if (ticket.expire)
    dict.expire = ticket.expire.getTime() / 1000;
  if (ticket.user)
    dict.user = ticket.user.id;
  if (ticket.group)
    dict.group = ticket.group.id;

  if (ticket.createdAt)
    dict.created = ticket.createdAt.getTime() / 1000;
  if (ticket.updatedAt)
    dict.updated = ticket.updatedAt.getTime() / 1000;

  return dict;
}

memberJson = function (user, ticketsCount, req) {
  var ret = {};
  ret.id = user.id;
  ret.username = user.username;
  if (user.displayName) {
    var array = user.displayName.split(" ");
    if (array.length > 1) {
      array[array.length - 1] = array[array.length - 1].substring(0, 1) + ".";
      ret.displayName = array.join(" ");
    }
    else {
      ret.displayName = user.displayName;
    }
  }
  ret.desc = user.description;
  ret.followersCount = user.followersCount;
  ret.followingCount = user.followingCount;
  ret.hasProfile = user.hasProfile;
  ret.profileUrl = user.profilePic;
  ret.tickets = ticketsCount;
  
  ret.facebook = {};
  if (user.facebook && user.facebook.id) {
    ret.facebook.id = user.facebook.id;
  }
  ret.twitter = {};
  if (user.twitter && user.twitter.id) {
    ret.twitter.id = user.twitter.id;
  }

  if (req && req.user) {
    if (req.user.following.indexOf(user.id) > -1) {
      ret.following = true;
    }
    else {
      ret.following = false;
    }
    if (req.user.blocking.indexOf(user.id) > -1) {
      ret.blocking = true;
    }
    else {
      ret.blocking = false;
    }
  }
  ret.hasDetails = false;
  
  return ret;
};

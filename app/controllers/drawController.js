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
var groupController = require('./groupController');
var mongoose = require('mongoose');
var stripe = require('stripe')(config.stripeSecretKey);
var moment = require('moment-timezone');
var request = require('request');
var cheerio = require('cheerio');
var CronJob = require('cron').CronJob;
var Lottery = require('../models/lottery');

exports.allDraws = function (req, res, next) {
    var draws;
    var drawCounts;
    var groups;
    var groupCounts;

    async.series([
        function checkAccessToken(callback) {
          if (req.query.access_token) {
            userController.validateToken(req, res, function(err) {
              if (err) return callback(err);
              callback();
            });
          }
          else {
            callback();
          }
        },
        function getDraws(callback) {
          Draw.find({active: true})
          .sort('-createdAt')
          .exec(function (err, results) {
            if (err) return callback(err);
            draws = results;
            callback();
          });
        },
        function getTicketsCount(callback) {
          async.mapLimit(draws, 5, function(draw, callback) {
            Ticket
            .count({user: req.user._id, draw: draw.id, group: {$exists: false}})
            .exec(function (err, count) {
              callback(null, count);
            });
          }, function(err, results) {
            drawCounts = results;
            callback();
          });
        },
        function getGroups(callback) {
          Group.find({privacy: 0})
          .sort('-createdAt')
          .exec(function(err, results) {
            if (err) return callback(err);
            groups = results;
            callback();
          });
        },
        function getTicketsCount(callback) {
          async.mapLimit(groups, 5, function(group, callback) {
            var draw = drawForLottery(group.lottery, draws);
            if (!draw) return callback(null, 0);

            Ticket
            .count({draw: draw, group: group})
            .exec(function (err, count) {
              callback(null, count);
            });
          }, function(err, results) {
            groupCounts = results;
            callback();
          });
        },
    ], function(err) {
        if (err) return next(err);
        var drawsPayload = [];
        for (var i=0; i<draws.length; i++) {
          drawsPayload.push(drawJson(draws[i], drawCounts[i]));
        }
        var groupsPayload = [];
        for (var i=0; i<groups.length; i++) {
          var group = groups[i];
          var draw = drawForLottery(group.lottery, draws);
          groupsPayload.push(groupController.groupJson(group, draw, groupCounts[i], req));
        }

        res.json({success: true, draws: drawsPayload, groups: groupsPayload});
    });
};

drawForLottery = function (lottery, draws) {
    if (!draws) return null;
    for (var i=0; i<draws.length; i++) {
      var draw = draws[i];
      if (draw.lottery == lottery)
        return draw;
    }
    return null;
};

exports.ticketsOfDraw = function (req, res, next) {
    var drawId = req.params.id;
    var limit = 100;
    var skip = 0;
    if (req.query.limit)
      limit = parseInt(req.query.limit);
    if (req.query.skip)
      skip = parseInt(req.query.skip);

    if (!fieldValidator.validateObjectId(drawId).valid) {
      return next({findnear: true, error: 421, message: "Invalid identifier", showToUser:true})
    }

    async.waterfall([
        function getTickets(callback) {
          Ticket
          .find({draw: drawId, user: req.user.id, group: {$exists: false}})
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

exports.buyTickets = function (req, res, next) {
    var drawId = req.params.id;
    var tickets = req.body.tickets;
    var stripeToken = req.body.stripeToken;
    var useCredit = req.body.useCredit;
    var amount = tickets.length * 2;
    var email = req.body.email;

    if (!fieldValidator.validateObjectId(drawId).valid) {
      return next({findnear: true, error: 421, message: "Invalid identifier", showToUser:true});
    }
    async.waterfall([
        function findDraw(callback) {
          Draw.findById(drawId, function(err, draw) {
            callback(err, draw);
          });
        },
        function checkAvailability(draw, callback) {
          var date = new Date(draw.date);
          date.setDate(date.getDate() - 1);
          if (date < new Date() || draw.closed) {
            return callback({findnear: true, error: 430, message: "This drawing is now closed. We’ll let you know the results of the drawing.", showToUser:true});
          }
          callback(null, draw);
        },
        function processPayment(draw, callback) {
          if (useCredit) {
            if (amount > req.user.credit) {
              return callback({findnear: true, error: 428, message: "You don't have enough credit.", showToUser:true})
            }
            callback(null, draw);
          }
          else if (!stripeToken) {
            callback(null, draw);
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
                callback(null, draw);
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
              callback(null, draw);
            });
          }
        },
        function processCharge(draw, callback) {
          if (useCredit) {
            req.user.credit -= amount;
            return callback(null, draw, null);
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
            callback(null, draw, charge);
          });
        },
        function buyTickets(draw, charge, callback) {
          async.mapLimit(tickets, 10, function(payload, callback) {
            var ticket = new Ticket();
            ticket.draw = draw.id;
            ticket.user = req.user;
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
            callback(err, tickets, draw);
          });
      },
      function updateDraw(tickets, draw, callback) {
        draw.update({$inc: {ticketsCount: tickets.length}}, function(err) {
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

drawJson = function(draw, ticketsCount) {
  var dict = {
      id: draw.id,
      wn1: draw.winNumber1,
      wn2: draw.winNumber2,
      wn3: draw.winNumber3,
      wn4: draw.winNumber4,
      wn5: draw.winNumber5,
      ws: draw.winSpecial,
      lottery: draw.lottery,
      jackpot: draw.jackpot,
      date: draw.date.getTime() / 1000,
      active: draw.active,
      tickets: ticketsCount,
    };
  if (draw.winner)
    dict.winner = draw.winner.id;
  if (draw.createdAt)
    dict.created = draw.createdAt.getTime() / 1000;
  if (draw.updatedAt)
    dict.updated = draw.updatedAt.getTime() / 1000;
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

  return dict;
};

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

// Cron jobs for automatically closing old drawing and open new one
var jobClosePowerBall = new CronJob(
  '00 59 22 * * 2,5', // Tuesday and Friday midnight to close buying tickets
  // cronTime: '00 * * * * *',
  function() {
      Draw.update(
        {lottery: Lottery.PowerBall, active: true},
      {closed: true},
      {multi: true},
      function (err, count) {
        if (err) {
          console.err(new Date() + " : CRON : Failed to close current powerball : " + err);
        }
        else {
          console.log(new Date() + " : CRON : Closed current powerball.");
        }
      });
  },
  undefined,
  true,
  "America/New_York"
);

var jobNextPowerBall = new CronJob(
  '00 00 00 * * 4,0', // Thursday and Sunday midnight to open next powerball drawing
  // cronTime: '00 * * * * *',
  function() {
    async.series([
      function deactivatePowerballDraw(callback) {
          Draw.update(
            {lottery: Lottery.PowerBall, active: true},
          {active: false},
          {multi: true},
          function (err, count) {
              callback(err);
          });
      },
      function newPowerballDraw(callback) {
          var draw = new Draw();
          draw.lottery = Lottery.PowerBall;
          var date = new Date();
          if (date.getDay() == 0) { // Sunday
            date.setDate(date.getDate() + 3);
          }
          else { // Thursday
            date.setDate(date.getDate() + 2);
          }
        draw.date = moment.tz({year: date.getFullYear(), month: date.getMonth(), day: date.getDate(), hour: 22, minute: 59, second: 0}, "America/New_York").toDate();
          draw.active = true;
          draw.save(function(err, draw) {
              callback(err);
          });
      },
    ], function(err) {
      if (err) {
        console.err(new Date() + " : CRON : Failed to open new powerball : " + err);
      }
      else {
        console.log(new Date() + " : CRON : Opened new powerball.");
      }
    });
  },
  undefined,
  true,
  "America/New_York"
);

var jobScrapePowerBall = new CronJob(
  '00 00 09 * * 4,0', // Thursday and Sunday morning to scrape and set jackpot from the powerball.com
  // cronTime: '00 * * * * *',
  function() {
    scrapePowerBall(function(err) {
      if (err) { // Try in hours again if failed to scrape
        console.error(new Date() + " : CRON : " + err);
        setTimeout(function() {
          scrapePowerBall(function(err) {
            if (err) {
              console.err(new Date() + " : CRON : " + err);
            }
          });
        }, 1000 * 3600 * 2);
      }
    });
  },
  undefined,
  true,
  "America/New_York"
);

scrapePowerBall = function(callback) {
  var url = 'http://www.powerball.com/pb_home.asp';
  request(url, function(err, response, html) {
    if (!err) {
      var $ = cheerio.load(html);
      var table = $('div#mainContent div.content table').first();
      table.find('tr').first().next().children('td').each(function(i, elem) {
        if (i == 13) {
          var jackpot = $(this).find('font strong').first().text();
          jackpot = jackpot.split(' ')[0];
          jackpot = parseFloat(jackpot.substr(1));
          if (isNaN(jackpot) || jackpot < 1) {
            return callback("There's an error to scrape powerball html.");
          }
          else {
            console.log(new Date() + " : CRON : Current jackpot is " + jackpot);
          }
          Draw.findOne({lottery: Lottery.PowerBall, active: true}, function(err, draw) {
            if (draw) {
              draw.jackpot = jackpot * 1000000;
              draw.save(function(err, draw) {
                if (err) {
                  return callback("Failed to update jackpot in powerball : " + err);
                }
                else {
                  console.log(new Date() + " : CRON : Updated jackpot in powerball");
                  callback();
                }
              });
            }
          });
        }
      });
    }
    else {
      callback("Failed to scrape current jackpot : " + err);
    }
  });
}

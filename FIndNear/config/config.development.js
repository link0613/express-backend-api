/**
 * Development configuration
 */

var config = require('./config.global');
var path = require('path');
var mongoose = require('mongoose');

config.env = 'development';
config.resourceDir = path.join(__dirname, '../../FindNear/resources');
config.server.hostUrl = 'https://192.168.3.59:3000';
config.server.imageServer = 'http://192.168.3.59:3001'
config.server.domainName = '192.168.3.59:3000';
config.mongo.uri = process.env.MONGO_URI || 'mongodb://findnear:findnearDEV@184.72.37.192/findnear-dev';

config.apn.cert = __dirname + "/keys/apns-dev-cert.pem";
config.apn.key = __dirname + "/keys/apns-dev-key.pem";

config.stripeSecretKey = "sk_test_wkBdaxjmsQvl3TAN1BWcQyML";

module.exports = config;


config.env = 'production';
config.resourceDir = '/data/resources';

config.server = {};
config.server.hostUrl = 'https://findnear.com:3000';
config.server.port = 3000;
config.server.domainName = 'findnear.com';
config.server.imageServer = 'http://findnear.com:3001'
config.server.imageServerPort = 3001;
config.server.cert = __dirname + "/keys/server.crt";
config.server.key = __dirname + "/keys/server.key";

config.mongo = {};
config.mongo.uri = process.env.MONGO_URI || 'mongodb://localhost/findnear';

config.apn = {};
config.apn.cert = __dirname + "/keys/apn.crt";
config.apn.key = __dirname + "/keys/apn.key";

config.administrators = [];
config.autoFollowers = [];

config.twilioAccountSid = 'AC38fcb5d466089aeeb016d53bd65a8feb';
config.twilioAuthToken = '25f234605e7f47672f1e321293fcd393';
config.twilioPhoneNumber = '+14159929878';

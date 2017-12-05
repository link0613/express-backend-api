/**
 * Development configuration
 */

var config = require('./config.global');

config.env = 'test';
config.resourceDir = '/data/findnear/resources_test';
config.server.hostUrl = 'https://184.72.37.192:3210';
config.server.domainName = '184.72.37.192:3210';
config.server.port = 3210;
config.server.imageServer = 'http://184.72.37.192:3211'
config.server.imageServerPort = 3211;

config.mongo.uri = process.env.MONGO_URI || 'mongodb://findnear:findnearDEV@localhost/findnear-dev';

config.apn.cert = __dirname + "/keys/apns-dev-cert.pem";
config.apn.key = __dirname + "/keys/apns-dev-key.pem";

config.stripeSecretKey = "sk_test_wkBdaxjmsQvl3TAN1BWcQyML";

module.exports = config;
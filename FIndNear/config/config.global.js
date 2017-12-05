/**
 * Global configuration
 */

var config = module.exports = {};

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

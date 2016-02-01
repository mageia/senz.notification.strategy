var AV = require('leanengine');

var Strategy = AV.Object.extend('Strategy');

/**
 * 一个简单的云代码方法
 */
AV.Cloud.define('hello', function(request, response) {
  response.success('Hello world!');
});


AV.Cloud.define('strategy', function(req, rep){
  var devId = req.params.devId;
  var appId = req.params.appId;
  var strategy = req.params.strategy;

  var class_strategy = new Strategy();
  class_strategy.set("devId", devId);
  class_strategy.set("appId", appId);
  class_strategy.set("strategy", strategy);
});

module.exports = AV.Cloud;

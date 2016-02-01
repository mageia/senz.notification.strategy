var AV = require('leanengine');
var mongoose = require('mongoose');
var Schema = mongoose.Schema;

mongoose.connect('mongodb://senzhub:Senz2everyone@119.254.111.40/RefinedLog');
var SISchema = new Schema({'user_id': String, 'staticInfo': Object});
var SI = mongoose.model('UserStaticInfo', SISchema, 'UserStaticInfo');

var Strategy = AV.Object.extend('Strategy');
var Application = AV.Object.extend('Application');
var Installation = AV.Object.extend('Installation');
var User = AV.Object.extend('_User');

var moGetAll = function (query) {
  var limit = 100;
  var result = [];
  var _rec = function (query, skip) {
    return query.skip(skip).exec(function (e, d) {
      if (e) {
        console.log('get all fucked', e)
      } else {
        if (d.length == 0) {
          return result
        } else {
          result.push(d);
          return _rec(query, skip + limit)
        }
      }
    })
  };

  return _rec(query, 0)
};

var getMoUserStaticInfo = function (uid) {
  var where = {
    user_id: uid
  };

  var query = SI.find(where).sort({createdAt: -1});
  return moGetAll(query, 0, []);
};

var matchStaticInfo = function(condition, staticInfo){
  var result = false;
  if(staticInfo && condition.type == "label"){
    condition.data.forEach(function(cond){
      if(Object.keys(staticInfo).indexOf(cond.one) >= 0){
        if(typeof staticInfo[cond.one] === "object"){
          result += Object.keys(staticInfo[cond.one]).indexOf(cond.two) >= 0;
        }
        if(typeof staticInfo[cond.one] === "number"){
          switch(cond.one){
            case "gender":
              result += cond.two == "male" ? staticInfo[cond.one]>0 : staticInfo[cond.one]<0;
              break;
            case "marriage":
            case "pregnant":
            case "has_car":
            case "has_pet":
              result += cond.two == "yes" ? staticInfo[cond.one]>0 : staticInfo[cond.one]<0;
              break;
            default:
              break;
          }
        }
      }
    });
    return result > 0
  }
  return result;
};

var InstallationRepeatFilter = function(installations){
  var tmp = {};
  installations.forEach(function(item){
    var deviceType = item.get("deviceType");
    var token = item.get("token");

    if(token || deviceType === "android"){
      var uid = item.get("user").id;
      var time = item.createdAt;

      if(!tmp[uid] || tmp[uid].time < time){
        tmp[uid] = {time: time, installation: item};
      }
    }
  });
  var result = [];
  Object.keys(tmp).forEach(function(uid){
    result.push(tmp[uid].installation);
  });
  return result;
};

var getInstallationIds = function(devId, appId, condition){
  var app_query = new AV.Query(Application);
  app_query.equalTo("objectId", appId);
  return app_query.find().then(function(apps){
    if(apps.length > 0 && apps[0].get("user").id == devId){
      var installation_query = new AV.Query(Installation);
      installation_query.equalTo("application", apps[0]);
      installation_query.descending("updatedAt");
      return installation_query.find();
    }else{
      return AV.Promise.error("Invalid appId!");
    }
  }).then(function(installations){
    var user_promises = [];
    installations = InstallationRepeatFilter(installations);

    if(condition.type == "all"){
      installations.forEach(function(installation) {
        user_promises.push(installation.id);
      });
      return AV.Promise.all(user_promises);
    }
    if(condition.type == "id"){
      installations.forEach(function(installation) {
        if(condition.data.indexOf(installation.get("user").id) >= 0){
          user_promises.push(installation.id);
        }
      });
      return AV.Promise.all(user_promises);
    }
    if(condition.type == "label"){
      var static_promises = [];
      installations.forEach(function(installation) {
        var uid = installation.get("user").id;
        static_promises.push(getMoUserStaticInfo(uid))
      });
      return AV.Promise.all(static_promises).then(function(u_staticInfos){
        u_staticInfos.forEach(function(u_static, index){
          var static_info = u_static.length > 0 ? u_static[0].staticInfo : undefined;
          if(matchStaticInfo(condition, static_info)){
            user_promises.push(installations[index].id);
          }
        });
        return AV.Promise.all(user_promises);
      });
    }
    if(condition.type == "event"){}
    if(condition.type == "motion"){}

  }).catch(function(e){
    return AV.Promise.error(e);
  })
};

//getInstallationIds("563b260900b0848410ddd6c2", "564573f660b25b79f067aeef",
//    {"data":[{"two":"female","one":"gender"}],"type":"label"})
//    .then(function(d){
//      console.log(d);
//    });

var sendMessageDelay = function(installations, message, delay, timeout){

};

AV.Cloud.define('createStrategy', function(req, rep){
  var devId = req.params.devId;
  var appId = req.params.appId;
  var delay_type = req.params.type;
  var condition = req.params.condition;
  condition['platform'] = req.params.target;
  var now = new Date().getTime();
  var expire = req.params.valid||1;
  var timeout = now + expire*3600*1000;

  var message = {
    title: req.params.title,
    content: req.params.content,
    action: req.params.next || {}
  };

  console.log(JSON.stringify(req.params));


  getInstallationIds.then(function(installationIds){
    var delay = delay_type.type == "timing" ?
    new Date(delay_type.datetime||new Date()).getTime()-now : 0;

    sendMessageDelay(installationIds, message, delay, timeout);
  });

  var class_strategy = new Strategy();
  class_strategy.set("devId", devId);
  class_strategy.set("appId", appId);
  class_strategy.set("delay_type", delay_type);
  class_strategy.set("platform", platform);
  class_strategy.set("timeout", timeout);
  class_strategy.set("condition", condition);
  class_strategy.set("message", message);
  class_strategy.save().then(
    function(strategy){
      return rep.success(strategy.id);
    }).catch(
    function(e){
      return rep.error(e);
    });
});

module.exports = AV.Cloud;

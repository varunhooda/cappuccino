'use strict';

var _ = require('lodash');
var Order = require('./order.model');
var elasticsearch = require('elasticsearch');
var elasticSearchClient = new elasticsearch.Client({
  host: 'localhost:9200',
  log: 'error'
});


// Get list of matched orders
exports.matchedOrder = function(req, res) {
  Order.findById(req.params.id, function (err, order) {
    if(err) { return handleError(res, err); }
    if(!order) { return res.send(404); }

    if(order.orderType == 'Recruitment') {
        performRecruitingOrderMatch(order,function (err, matchedOrder) { 
           if(err) { return handleError(res, err); }
           console.log("recruiting order matched response");
           console.log(matchedOrder);
           return res.json(200, matchedOrder);
        });
    } else {
        performPlacementOrderMatch(order,function (err, matchedOrder) { 
           if(err) { return handleError(res, err); }
           console.log("placement order matched response");
           console.log(matchedOrder);
           return res.json(200, matchedOrder);
        });
    }
  });
};


// Get list of orders
exports.index = function(req, res) {
  Order
  .find({})
  .where('user').equals(req.user._id)
  .sort('-createdaAt')
  .exec(function(err, orders) {
      if(err) { return handleError(res, err); }
      return res.json(200, orders);
  });

};

// Get a single order
exports.show = function(req, res) {
  Order.findById(req.params.id, function (err, order) {
    if(err) { return handleError(res, err); }
    if(!order) { return res.send(404); }
    return res.json(order);
  });
};

// Creates a new order in the DB.
exports.create = function(req, res) {
  req.body.user = req.user._id;
  Order.create(req.body, function(err, order) {
    if(err) { return handleError(res, err); }

    createDocumentES(order,function (err, createdOrder) { 
        if(err) { return handleError(res, err); }
        console.log("document created");
        
        if(order.orderType == 'Recruitment') {
        performRecruitingOrderMatch(order,function (err, matchedOrder) { 
           if(err) { return handleError(res, err); }
           console.log("recruiting order matched response");
           console.log(matchedOrder);
           return res.json(200, matchedOrder);
        });
        } else {
            performPlacementOrderMatch(order,function (err, matchedOrder) { 
               if(err) { return handleError(res, err); }
               console.log("placement order matched response");
               console.log(matchedOrder);
               return res.json(200, matchedOrder);
            });
        }
    });

  });
};


// Updates an existing order in the DB.
exports.update = function(req, res) {
  if(req.body._id) { delete req.body._id; }
  Order.findById(req.params.id, function (err, order) {
    if (err) { return handleError(res, err); }
    if(!order) { return res.send(404); }
    var updated = _.merge(order, req.body);

    updated.save(function (err) {
      if (err) { return handleError(res, err); }
      //TODO: Perform update in elastic search as well
      //delete document from elasticsearch
      // then create document in elastic search
      deleteDocumentES(order,function (err, createdOrder) { 
        if(err) { return handleError(res, err); }
        console.log("document deleted");
        createDocumentES(order,function (err, createdOrder) { 
          if(err) { return handleError(res, err); }
          console.log("document created");
        });
      });



      if(order.orderType == 'Recruitment') {
        performRecruitingOrderMatch(order,function (err, matchedOrder) { 
           if(err) { return handleError(res, err); }
           console.log("recruiting order matched response");
           console.log(matchedOrder);
           return res.json(200, matchedOrder);
        });
      } else {
          performPlacementOrderMatch(order,function (err, matchedOrder) { 
            if(err) { return handleError(res, err); }
            console.log("placement order matched response");
            console.log(matchedOrder);
            return res.json(200, matchedOrder);
          });
      }

        //return performMatch(order, res);
    });
  });
};

// Deletes a order from the DB.
exports.destroy = function(req, res) {
  Order.findById(req.params.id, function (err, order) {
    if(err) { return handleError(res, err); }
    if(!order) { return res.send(404); }
    order.remove(function(err) {
      if(err) { return handleError(res, err); }
      return res.send(204);
    });
  });
};

function handleError(res, err) {
  return res.send(500, err);
}


function createDocumentES(order, callback) {
   console.log("In createDocumentES");
  
    if (order.playerDOBRange === undefined) {
      order.playerDOBRange = {Start: undefined, End: undefined};
      order.playerHeightRange = {Min: undefined, Max: undefined};
      order.playerWeightRange = {Min: undefined, Max: undefined};

      console.log(order.playerDOBRange);
    }
   
    elasticSearchClient.create({
        index: 'matchine',
        type: 'hockeyOrder',
        id: order._id.toString(),

        body: {
          id: order._id,
          name: order.name,
          orderType: order.orderType,
          actorType: order.actorType,
          status: order.status,

          leagueRecruitingFor: order.leagueRecruitingFor,
          leaguePlayingFor: JSON.stringify(order.leaguePlayingFor),

          playerPosition: order.playerPosition,
          playerDOB: order.playerDOB,

          playerHeight: order.playerHeight,
          playerWeight: order.playerWeight,

          playerDOBRangeMin: order.playerDOBRange.Start,
          playerDOBRangeMax: order.playerDOBRange.End,
          
          playerHeightRangeMin: order.playerHeightRange.min,
          playerHeightRangeMax: order.playerHeightRange.max,

          playerWeightRangeMin: order.playerWeightRange.min,
          playerWeightRangeMax: order.playerWeightRange.max,

          playerShootWith: order.playerShootWith,
          playerDefensiveScale: order.playerDefensiveScale,
          playerSystemBasedScale: order.playerSystemBasedScale,
          playerPhysicalScale: order.playerPhysicalScale,
          playerTeamFee: order.playerTeamFee,
          playerAccomodationCost: order.playerAccomodationCost,
          playerEquipmentFee: order.playerEquipmentFee,
          playerOwnTransport: order.playerOwnTransport,
          user: order.user,
          createdaAt: order.createdaAt
        }
    }, function (error, response) {
        if(error) { 
          console.log(error.message);
          callback(error, null);
        }
        return  callback(null, response);;
    });

    //eventEmitter.emit('doOutput', {message:'okay'});
}

function performPlacementOrderMatch(order, callback) {
  //var lookingOrderType = 'Recruitment';
  
  elasticSearchClient.search({
  index: 'matchine',
  body: {
    query: {
      "bool": {
            "must": [
                {
                  "range": {
                    playerAccomodationCost: {"gte": 0, "lte": parseInt(order.playerAccomodationCost)}
                  }
                },
                {
                  "range": {
                    playerTeamFee: {"gte": 0, "lte": parseInt(order.playerTeamFee)}
                  }
                },
                 {
                  "range": {
                    playerEquipmentFee: {"gte": 0, "lte": parseInt(order.playerEquipmentFee)}
                  }
                },
                {
                  "range": {
                    playerHeightRangeMin: {"lte": parseInt(order.playerHeight)}
                  }
                },
                {
                  "range": {
                    playerHeightRangeMax: {"gte": parseInt(order.playerHeight)}
                  }
                },
                /*{
                  "filtered": {
                   "query": {
                      "match_all": {}
                   },
                   "filter": {
                      "term": {
                         "league.id": order.league
                      }
                    }
                  }
                },*/
                {
                  "match" : {
                   orderType : 'Recruitment'
                  }
                },
              /*  {
                  "match" : {
                   leagueRecruitingFor : order.leagueRecruitingFor
                  }
                },*/
                {
                  "match" : {
                   status : 'Open'
                  }

                },
                {
                  "match" : {
                    playerShootWith : order.playerShootWith
                  }
                },
                {
                  "match" : {
                    playerOwnTransport : order.playerOwnTransport
                  }
                }
            ]
        }
    }
  }
}).then(function (body) {
  console.log("In performPlacementOrderMatch");
  console.log(body);
  callback(null, body);
}, function (error) {
  console.log(error.message);
  callback(error, null);
});

}

function performRecruitingOrderMatch(order, callback) {
  var lookingOrderType = 'Placement';

  elasticSearchClient.search({
  index: 'matchine',
  body: {
    query: {
      "bool": {
            "must": [
                {
                  "range": {
                    playerAccomodationCost: {"gte": 0, "lte": parseInt(order.playerAccomodationCost)}
                  }
                },
                {
                  "range": {
                    playerTeamFee: {"gte": 0, "lte": parseInt(order.playerTeamFee)}
                  }
                },
                {
                  "range": {
                    playerEquipmentFee: {"gte": 0, "lte": parseInt(order.playerEquipmentFee)}
                  }
                },
                {
                  "range": {
                    playerHeightRangeMin: {"gte": parseInt(order.playerHeight)}
                  }
                },
                {
                  "range": {
                    playerHeightRangeMax: {"lte": parseInt(order.playerHeight)}
                  }
                },
                /*{
                  "filtered": {
                   "query": {
                      "match_all": {}
                   },
                   "filter": {
                      "term": {
                         "league.id": order.league
                      }
                    }
                  }
                },*/
                {
                  "match" : {
                   orderType : lookingOrderType
                  }
                },
                /*{
                  "match" : {
                   leagueRecruitingFor : order.leagueRecruitingFor
                  }
                },*/
                {
                  "match" : {
                   status : 'Open'
                  }

                },
                {
                  "match" : {
                    playerShootWith : order.playerShootWith
                  }
                },
                {
                  "match" : {
                    playerOwnTransport : order.playerOwnTransport
                  }
                }
            ]
        }
    }
  }
}).then(function (body) {
  console.log("In performRecruitingOrderMatch");
  console.log(body);
  callback(null, body);
}, function (error) {
  console.log(error.message);
  callback(error, null);
});

}
  

function deleteDocumentES(order, callback) {
   console.log("In deleteDocumentES");
    elasticSearchClient.delete({
        index: 'matchine',
        type: 'hockeyOrder',
        id: order._id.toString(),
    }, function (error, response) {
        if(error) { 
          console.log(error.message);
          callback(error, null);
        }
        return  callback(null, response);;
    });
}




/**
 * @fileoverview Generic Model Object
 */
var Errors = require('./error')
var util = require('util')
var Promise = require('bluebird')
var Collection = require('./collection')

function Model(document, key) {
  if (typeof document !== 'object') {
    key = document
    document = null
  }

  this.document = document
  this.key = key
}

/**
 * Connection the model uses.
 *
 * @api public
 * @property db
 */
Model.prototype.db = null
Model.db = null

/**
 * Collection the model uses.
 *
 * @api public
 * @property collection
 */
Model.prototype.collection = null
Model.collection = null

Model.prototype.key = null
Model.prototype.document = null
Model.prototype.ref = null

/**
 * Schema Validator
 *
 * Called on write operations through the model. Users can optionally override
 * by providing a validate method in the constructor options.
 **/
Model.prototype.validate = Model.validate = function (obj) {
  return Promise.resolve(true)
}

/**
 * Parses the response from the Orchestrate client
 */
Model.prototype.parseResponse = Model.parseResponse = function(resp) {
  var body = resp.body;
  var headers = resp.headers;
  var links = resp.links || {};

  if (body.code) {
    switch (body.code) {
      case 'item_version_mismatch':
        throw new Errors.PreConditionError()
        break
      default:
        throw new Error(body.message)
    }
  }

  var parsed
  var next = links.next
  var prev = links.prev

  if (headers['content-location'] || headers.location) {
    // Single resources
    var loc = headers['content-location'] || headers.location
    var path = loc.split('/')
    parsed = {
      key: path[3],
      ref: path[5],
      value: body
    }
  } else if (body.results) {
    // Many resources
    parsed = []
    var result;

    for (var i = 0; i < body.results.length; i++) {
      result = body.results[i]
      parsed.push({
        key: result.path.key,
        ref: result.path.ref,
        value: result.value
      })
    }
  }

  return [parsed, next, prev]
}

/**
 * Takes the output of Model.parseResponse and creates a model object
 */
Model.prototype.makeObject = Model.makeObject = function(parsed, model, next, prev) {
  var result
  if (!parsed) {
    return null
  }

  if (model && !(model.prototype instanceof Model)) {
    next = model
    prev = next
    model = undefined
  }

  if (!model) {
    model = this
  }

  if (Array.isArray(parsed)) {
    result = new Collection(model, [], next, prev)
    for (var i = 0; i < parsed.length; i++) {
      result.addItem(this.makeObject(parsed[i], model))
    }
  } else {
    result = new model(parsed.value, parsed.key)
    result.ref = parsed.ref
  }

  return result
}

Model.findByKey = function(key) {
  return this.db.bind(this).then(function(client) {
    return client.get(this.collection, key)
  })
    .then(this.parseResponse)
    .then(this.makeObject)
}

/**
 * Finds a list of results for the query term
 *
 * options:
 * 	- offset: int
 * 	- limit: int
 * 	- sort: [[key, direction], [key, direction]]
 * 					ex: [['name.last', 'desc'], ['age', 'asc']]
 *
 * @param  {string} query     Lucene Syntax search term
 * @param  {object} [options] Search options
 * @return {Promise}
 */
Model.find = function(query, options) {
  options = options || {}
  offset = options.offset || 0
  limit = options.limit || 100
  sort = options.sort

  return this.db.bind(this).then(function(client) {
    var s = client.newSearchBuilder()
      .collection(this.collection)
      .limit(limit)
      .offset(offset)

    if (sort && sort.length) {
      var i
      var ln = sort.length
      for (i = 0; i < ln; i++) {
        s.sort(sort[i][0], sort[i][1])
      }
    }

    return s.query(query)
  })
    .then(this.parseResponse)
    .spread(this.makeObject)
}

Model.findOne = function(query, options) {
  options = options || {}
  offset = options.offset || 0
  limit = options.limit || 100
  sort = options.sort

  return this.db.bind(this).then(function(client) {
    var s = client.newSearchBuilder()
      .collection(this.collection)
      .limit(limit)
      .offset(offset)

    if (sort && sort.length) {
      var i
      var ln = sort.length
      for (i = 0; i < ln; i++) {
        s.sort(ln[i][0], sort[i][1])
      }
    }

    return s.query(query)
  })
    .then(this.parseResponse)
    .then(function(resp) {
      if (resp && resp.length) {
        return resp[0]
      }
    })
    .then(this.makeObject)
}

Model.create = function(document, key) {
  var request;

  return this.validate(document).bind(this)
  .then(function () {
    var collection = this.collection
    if (key) {
      request = this.db.then(function(client) {
        return client.put(collection, key, document)
      })
    } else {
      request = this.db.then(function(client) {
        return client.post(collection, document)
      })
    }

    return request
  })
  .then(this.parseResponse)
  .then(function(document) {
    return this.findByKey(document.key)
  })
}

Model.prototype.save = function(overwrite) {
  overwrite = overwrite || false;

  return this.validate(this.document).bind(this)
  .thenReturn(this.db)
  .then(function(client) {
    // Trying to save a new object will result in a create
    if (!this.ref) {
      return this.model.create(this.document, this.key)
    }

    var ref
    if (!overwrite) {
      ref = this.ref
    }

    return client.put(this.collection, this.key, this.document, ref)
      .bind(this)
      .then(this.parseResponse)
      .then(function(document) {
        return this.model.findByKey.call(this.model, document.key)
      })
  })
}

Model.prototype.relate = function (key, collection, relationship) {
  if (key instanceof Model) {
    relationship = collection
    collection = key.collection
    key = key.key
  }

  return this.db.bind(this)
  .then(function (client) {
    return client.newGraphBuilder()
      .create()
      .from(this.collection, this.key)
      .related(relationship)
      .to(collection, key)
  })
}

Model.prototype.getRelation = function (relationship, model) {
  return this.db.bind(this)
  .then(function (client) {
    return client.newGraphReader()
      .get()
      .from(this.collection, this.key)
      .related(relationship)
  })
  .then(this.parseResponse)
  .then(function (parsed) {
    return this.makeObject(parsed, model)
  })
}

Model.removeByKey = function(key, purge) {
  purge = purge || false
  return this.db.bind(this).then(function(client) {
    return client.remove(this.collection, key, purge)
  }).thenReturn(null)
}

Model.prototype.remove = function(purge) {
  purge = purge || false
  return this.db.bind(this).then(function(client) {
    return client.remove(this.collection, this.key, purge)
  }).thenReturn(null)
}

module.exports = Model

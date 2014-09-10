/**
 * @fileoverview Generic Model Object
 */
var Errors = require('./error');
var util = require('util');
var Promise = require('bluebird');

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
Model.prototype.document = null;
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

  if (body.code) {
    switch (body.code) {
      case 'item_version_mismatch':
        throw new Errors.PreConditionError()
        break
      default:
        throw new Error(body.message)
    }
  }

  var parsed;

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

  return parsed
}

/**
 * Takes the output of Model.parseResponse and creates a model object
 */
Model.prototype.makeObject = Model.makeObject = function(parsed) {
  var result
  if (!parsed) {
    return null
  }

  if (Array.isArray(parsed)) {
    result = []
    for (var i = 0; i < parsed.length; i++) {
      result.push(this.makeObject(parsed[i]))
    }
  } else {
    result = new this(parsed.value, parsed.key)
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


Model.find = function(query, offset, limit) {
  offset = offset || 0
  limit = limit || 100

  return this.db.bind(this).then(function(client) {
    return client.newSearchBuilder()
      .collection(this.collection)
      .limit(limit)
      .offset(offset)
      .query(query)
  })
    .then(this.parseResponse)
    .then(this.makeObject)
}

Model.findOne = function(query, offset, limit) {
  offset = offset || 0
  limit = limit || 1

  return this.db.bind(this).then(function(client) {
    return client.newSearchBuilder()
      .collection(this.collection)
      .limit(limit)
      .offset(offset)
      .query(query)
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
      return this.create(this.document, this.key)
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
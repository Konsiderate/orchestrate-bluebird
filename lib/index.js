/**
 * @fileoverview Root of the Orchestrate Object
 */

var assert = require('assert');
var Client = require('./client')
var Model = require('./model')
var util = require('util')
var Promise = require('bluebird')

var Orchestrate = module.exports = {}

Orchestrate.clients = {};

/**
 * Creates an instance of Client which can be used to access
 * the Orchestrate API.
 *
 * Stores connection in Orchestrate.clients
 *
 * @param {string} token
 */
Orchestrate.connect = function(token, clientName) {
  assert(token, 'API key required.')
  clientName = clientName || 'default'
  Orchestrate.clients[clientName] =  new Client(token)
  return Orchestrate.clients[clientName]
}

/**
 * getClient - Gets a client that has already been initialized
 *
 * @param  {string} clientName Name of initialized client to get
 * @return {Promise}           A Promise that resolves to an Orchestrate Client
 */
Orchestrate.getClient = function getClient (clientName) {
  clientName = clientName || 'default'
  return Orchestrate.clients[clientName]
}

/**
 * Creates an instance of Model
 *
 * @param {string} collection Name of collection
 * @param {Promise} object - Promise resolves with Orchestrate.client
 * @return {Model}
 */
Orchestrate.model = function(collection, db, options) {
  options = options || {}

  function model(document, key) {
    if (!(this instanceof model)) {
      return new model(document)
    }

    Model.call(this, document, key)
  }
  util.inherits(model, Model)

  var props = Object.getOwnPropertyNames(Model);
  props.forEach(function(name) {
    if (!(name in model)) {
      var destination = Object.getOwnPropertyDescriptor(Model, name)
      Object.defineProperty(model, name, destination)
    }
  })

  if (options.validate) {
    // Wrap Validate in a promise
    var validate = function (obj) {
      return new Promise(function (resolve, reject) {
        var errors = options.validate(obj)
        if (errors === true) {
          resolve(true)
        } else {
          reject(errors)
        }
      })
    }

    model.prototype.validate = model.validate = validate
  }

  model.prototype.db = model.db = db
  model.prototype.collection = model.collection = collection
  model.prototype.model = model

  return model
}

Orchestrate.Errors = require('./error')
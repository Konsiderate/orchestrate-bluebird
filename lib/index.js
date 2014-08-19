/**
 * @fileoverview Root of the Orchestrate Object
 */

var Client = require('./client')

var Orchestrate = module.exports = {}

/**
* Creates an instance of Client which can be used to access
* the Orchestrate API.
*
* @param {string} token
*/
Orchestrate.connect = function (token) {
  assert(token, 'API key required.')
  return new Client(token)
}

/**
* Creates an instance of Model
*
* @param {string} collection Name of collection
* @param {Promise} object - Promise resolves with Orchestrate.client
* @return {Model}
*/
Orchestrate.model = function (collection, db) {
  return {};
}
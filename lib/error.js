var util = require('util')

var Errors = module.exports = {}

/**
 * Pre-condition error
 */
Errors.PreConditionError = function(message) {
  Error.call(this, message)
  Error.captureStackTrace(this, this.constructor);
  this.message = message;
}

util.inherits(Errors.PreConditionError, Error)
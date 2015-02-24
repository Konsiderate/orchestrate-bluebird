'use strict';

/**
 * @fileoverview Manages collections of objects
 */
var Promise = require('bluebird')

function Collection(model, items, next, prev) {
  this.next = next
  this.prev = prev
  this.model = model
  this.items = items || []
  this.length = this.items.length
}

/**
 * Returns a new collection with a page of objects
 * @todo: this creates very tight coupling
 */
Collection.prototype.getPage = function getPage(query) {
  return query.get()
  .bind(this.model)
  .then(this.model.parseResponse)
  .spread(this.model.makeObject);
}

Collection.prototype.prevPage = function prevPage() {
  return this.getPage(this.prev);
}

Collection.prototype.nextPage = function nextPage() {
  return this.getPage(this.next);
}

Collection.prototype.addItem = function addItem(item) {
  this.items.push(item);
  this.length = this.items.length;
}

module.exports = Collection

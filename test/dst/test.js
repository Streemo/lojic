"use strict";

var _chai = require("chai");

var _observer = require("../../dst/observer.js");

var _observer2 = _interopRequireDefault(_observer);

var _reactiveVar = require("reactive-var");

var _reactiveVar2 = _interopRequireDefault(_reactiveVar);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

describe('observer class', function () {
  var newNode = { v: new _reactiveVar2.default(0), c: {}, p: null };
  var observer = new _observer2.default();
  describe('initial state', function () {
    var observer = new _observer2.default();
    it('should have an empty tree data cache', function () {
      _chai.assert.deepEqual(observer._collections, newNode);
    });
    it('should have an empty tree observer cache', function () {
      _chai.assert.deepEqual(observer._observers, newNode);
    });
    it('should have an empty observer cache', function () {
      _chai.assert.deepEqual(observer._observerCache, {});
    });
  });
  describe('vertex initializer', function () {
    it('should assign a new node at branch K to parent P and return the new node', function () {
      var node = observer._node('test-branch', observer._collections);
      _chai.assert.deepEqual(node, { v: new _reactiveVar2.default(0), c: {}, p: observer._collections });
      _chai.assert.deepEqual(observer._collections.c['test-branch'], node);
    });
    it('should return an existing node if it exists, and not make a new one.', function () {
      var existing = observer._collections.c['test-branch'];
      _chai.assert.isDefined(existing);
      var node = observer._node('test-branch', observer._collections);
      _chai.assert.equal(node, existing);
    });
  });
  describe('query canonicalization', function () {
    var observer = new _observer2.default();
    it('should accept queries only with a group field.', function () {
      var q1 = {
        group: "some-collection",
        query: {
          some: {
            query: 3456
          }
        }
      };
      var r1 = observer._canonicalize(q1);
      _chai.assert.notEqual(r1, null);
      var q2 = {
        group: "some-collection"
      };
      var r2 = observer._canonicalize(q2);
      _chai.assert.notEqual(r2, null);
      var q3 = {
        query: {
          some: {
            query: 4567
          }
        }
      };
      var r3 = observer._canonicalize(q3);
      _chai.assert.equal(r3, null);
    });
    var observer = new _observer2.default();
    it('should create a group branch on both roots if !E', function () {
      var branch = "testing-branch";
      var existing1 = observer._collections.c[branch];
      var existing2 = observer._observers.c[branch];
      _chai.assert.equal(existing1, undefined);
      _chai.assert.equal(existing2, undefined);
      var q = {
        group: branch,
        query: {
          some: {
            query: "bar"
          }
        }
      };
      observer._canonicalize(q);
      var new1 = observer._collections.c[branch];
      var new2 = observer._observers.c[branch];
      _chai.assert.deepEqual(new1, { v: new _reactiveVar2.default(0), c: {}, p: observer._collections });
      _chai.assert.deepEqual(new2, { v: new _reactiveVar2.default(0), c: { id: { v: new _reactiveVar2.default(0), c: {}, p: new2 } }, p: observer._observers });
    });
    it('should create an id branch on both roots if !E', function () {
      var id = "randomId";
      var branch = 'testing-branch';
      var existing1 = observer._collections.c[branch].c[id];
      var existing2 = observer._observers.c[branch].c['id'];
      _chai.assert.equal(existing1, undefined);
      _chai.assert.deepEqual(existing2, { v: new _reactiveVar2.default(0), c: {}, p: observer._observers.c[branch] });
      var q = {
        group: branch,
        id: id,
        query: {
          some: {
            query: "foo"
          }
        }
      };
      observer._canonicalize(q);
      var new1 = observer._collections.c[branch].c[id];
      var new2 = observer._observers.c[branch].c['id'];
      _chai.assert.deepEqual(new1, { v: new _reactiveVar2.default(0), c: {}, p: observer._collections.c[branch] });
      _chai.assert.deepEqual(new2, { v: new _reactiveVar2.default(0), c: {}, p: observer._observers.c[branch] });
    });
  });
  describe('merging', function () {
    var observer = new _observer2.default();
    it('should splice structured data into the tree', function () {
      var e1 = {
        name: "bob",
        job: {
          years: 45,
          name: "woodworker",
          salary: {
            monthly: 4670,
            yearly: 4670 * 12 + 8000
          }
        }
      };
      observer.merge({ group: "employees", id: "42", query: e1 });
      var e2 = {
        name: "rob",
        job: {
          years: 21,
          name: "technologist",
          salary: {
            monthly: 7069,
            yearly: 7069 * 12 + 16000
          }
        }
      };
      observer.merge({ group: "employees", id: "23", query: e2 });
      var c = observer._collections.c['employees'];
      var bob = c.c['42'];
      _chai.assert.equal(bob.c.name.c, 'bob');
      _chai.assert.equal(bob.c.job.c.years.c, 45);
      _chai.assert.equal(bob.c.job.c.name.c, 'woodworker');
      _chai.assert.equal(bob.c.job.c.salary.c.monthly.c, 4670);
      _chai.assert.equal(bob.c.job.c.salary.c.yearly.c, 4670 * 12 + 8000);
      var rob = c.c['23'];
      _chai.assert.equal(rob.c.name.c, 'rob');
      _chai.assert.equal(rob.c.job.c.years.c, 21);
      _chai.assert.equal(rob.c.job.c.name.c, 'technologist');
      _chai.assert.equal(rob.c.job.c.salary.c.monthly.c, 7069);
      _chai.assert.equal(rob.c.job.c.salary.c.yearly.c, 7069 * 12 + 16000);
    });
    it('should update the versions of all nodes upon being added.', function () {
      var c = observer._collections.c['employees'];
      var rob = c.c['23'];
      _chai.assert.equal(rob.v.v, 5);
      _chai.assert.equal(rob.c.name.v.v, 1);
      _chai.assert.equal(rob.c.job.v.v, 4);
      _chai.assert.equal(rob.c.job.c.years.v.v, 1);
      _chai.assert.equal(rob.c.job.c.name.v.v, 1);
      _chai.assert.equal(rob.c.job.c.salary.v.v, 2);
      _chai.assert.equal(rob.c.job.c.salary.c.monthly.v.v, 1);
      _chai.assert.equal(rob.c.job.c.salary.c.yearly.v.v, 1);
    });
    it('should collapse a tree node\'s contents into the data from which it was derived.', function () {
      var node = observer._collections.c['employees'];
      var employees = observer._collapse(node);
      var e1 = {
        name: "bob",
        job: {
          years: 45,
          name: "woodworker",
          salary: {
            monthly: 4670,
            yearly: 4670 * 12 + 8000
          }
        }
      };
      var e2 = {
        name: "rob",
        job: {
          years: 21,
          name: "technologist",
          salary: {
            monthly: 7069,
            yearly: 7069 * 12 + 16000
          }
        }
      };
      _chai.assert.deepEqual(employees['42'], e1);
      _chai.assert.deepEqual(employees['23'], e2);
    });
  });
});
import { expect, should, assert } from "chai";
import Observer from "../../dst/observer.js";
import ReactiveVar from "reactive-var";

describe('observer class', function(){
  const newNode = {v:new ReactiveVar(0), c:{}, p: null};
  var observer = new Observer();
  describe('initial state', function(){
    var observer = new Observer();
    it('should have an empty tree data cache', function(){
      assert.deepEqual(observer._collections, newNode)
    })
    it('should have an empty tree observer cache', function(){
      assert.deepEqual(observer._observers, newNode)
    })
    it('should have an empty observer cache', function(){
      assert.deepEqual(observer._observerCache, {})
    })
  })
  describe('vertex initializer', function(){
    it('should assign a new node at branch K to parent P and return the new node', function(){
      var node = observer._node('test-branch', observer._collections);
      assert.deepEqual(node,  {v:new ReactiveVar(0), c:{}, p: observer._collections});
      assert.deepEqual(observer._collections.c['test-branch'], node)
    })
    it('should return an existing node if it exists, and not make a new one.', function(){
      var existing = observer._collections.c['test-branch'];
      assert.isDefined(existing);
      var node = observer._node('test-branch', observer._collections);
      assert.equal(node, existing);
    })
  })
  describe('query canonicalization', function(){
    var observer = new Observer();
    it('should accept queries only with a group field.', function(){
      var q1 = {
        group: "some-collection",
        query: {
          some: {
            query: 3456
          }
        }
      };
      var r1 = observer._canonicalize(q1)
      assert.notEqual(r1, null);
      var q2 = {
        group: "some-collection"
      }
      var r2 = observer._canonicalize(q2)
      assert.notEqual(r2,null);
      var q3 = {
        query: {
          some: {
            query: 4567
          }
        }
      }
      var r3 = observer._canonicalize(q3)
      assert.equal(r3,null);
    })
    var observer = new Observer();
    it('should create a group branch on both roots if !E', function(){
      var branch = "testing-branch";
      var existing1 = observer._collections.c[branch];
      var existing2 = observer._observers.c[branch];
      assert.equal(existing1, undefined);
      assert.equal(existing2, undefined);
      var q = {
        group: branch,
        query: {
          some: {
            query: "bar"
          }
        }
      }
      observer._canonicalize(q);
      var new1 = observer._collections.c[branch];
      var new2 = observer._observers.c[branch];
      assert.deepEqual(new1, {v: new ReactiveVar(0), c: {}, p: observer._collections})
      assert.deepEqual(new2, {v: new ReactiveVar(0), c: {id: {v: new ReactiveVar(0), c:{}, p:new2}}, p: observer._observers})
    })
    it('should create an id branch on both roots if !E', function(){
      var id = "randomId";
      let branch = 'testing-branch'
      var existing1 = observer._collections.c[branch].c[id];
      var existing2 = observer._observers.c[branch].c['id'];
      assert.equal(existing1, undefined);
      assert.deepEqual(existing2, {v: new ReactiveVar(0), c:{}, p:observer._observers.c[branch]});
      var q = {
        group: branch,
        id: id,
        query: {
          some: {
            query: "foo"
          }
        }
      }
      observer._canonicalize(q);
      var new1 = observer._collections.c[branch].c[id];
      var new2 = observer._observers.c[branch].c['id'];
      assert.deepEqual(new1, {v: new ReactiveVar(0), c: {}, p: observer._collections.c[branch]})
      assert.deepEqual(new2, {v: new ReactiveVar(0), c: {}, p: observer._observers.c[branch]})
    })
  })
  describe('merging', function(){
    var observer = new Observer();
    it('should splice structured data into the tree', function(){
      var e1 = {
        name:"bob",
        job: {
          years: 45,
          name: "woodworker",
          salary: {
            monthly: 4670,
            yearly: 4670 * 12 + 8000
          }
        }
      }
      observer.merge({group: "employees", id: "42", query: e1});
      var e2 = {
        name:"rob",
        job: {
          years: 21,
          name: "technologist",
          salary: {
            monthly: 7069,
            yearly: 7069 * 12 + 16000
          }
        }
      }
      observer.merge({group: "employees", id: "23", query: e2});
      var c = observer._collections.c['employees'];
      var bob = c.c['42'];
      assert.equal(bob.c.name.c, 'bob');
      assert.equal(bob.c.job.c.years.c, 45);
      assert.equal(bob.c.job.c.name.c, 'woodworker');
      assert.equal(bob.c.job.c.salary.c.monthly.c, 4670);
      assert.equal(bob.c.job.c.salary.c.yearly.c, 4670 * 12 + 8000);
      var rob = c.c['23'];
      assert.equal(rob.c.name.c, 'rob');
      assert.equal(rob.c.job.c.years.c, 21);
      assert.equal(rob.c.job.c.name.c, 'technologist');
      assert.equal(rob.c.job.c.salary.c.monthly.c, 7069);
      assert.equal(rob.c.job.c.salary.c.yearly.c, 7069 * 12 + 16000);
    })
    it('should update the versions of all nodes upon being added.', function(){
      var c = observer._collections.c['employees'];
      var rob = c.c['23'];
      assert.equal(rob.v.v,5);
      assert.equal(rob.c.name.v.v,1);
      assert.equal(rob.c.job.v.v,4)
      assert.equal(rob.c.job.c.years.v.v, 1);
      assert.equal(rob.c.job.c.name.v.v,1);
      assert.equal(rob.c.job.c.salary.v.v, 2)
      assert.equal(rob.c.job.c.salary.c.monthly.v.v, 1);
      assert.equal(rob.c.job.c.salary.c.yearly.v.v, 1);
    })
    it('should collapse a tree node\'s contents into the data from which it was derived.', function(){
      var node = observer._collections.c['employees']
      var employees = observer._collapse(node);
      var e1 = {
        name:"bob",
        job: {
          years: 45,
          name: "woodworker",
          salary: {
            monthly: 4670,
            yearly: 4670 * 12 + 8000
          }
        }
      }
      var e2 = {
        name:"rob",
        job: {
          years: 21,
          name: "technologist",
          salary: {
            monthly: 7069,
            yearly: 7069 * 12 + 16000
          }
        }
      }
      assert.deepEqual(employees['42'], e1);
      assert.deepEqual(employees['23'], e2);
    })
  })
})

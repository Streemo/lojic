"use strict";

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj; };

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _trackr = require("trackr");

var _trackr2 = _interopRequireDefault(_trackr);

var _reactiveVar = require("reactive-var");

var _reactiveVar2 = _interopRequireDefault(_reactiveVar);

var _docsort = require("docsort");

var _typetastic = require("typetastic");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/*
This cache implements merge, resolve, and observe.

Merge is used to put new information in the tree.
Resolve is used to query information from the tree.
Observe is a reactive version resolve.
Observe and resolve should return the same results for any query.

Data storage, the collection formalism:
The sole tree root branches into N collections.
Collection n branches into M_n ids.
Id m branches into P_m fields.

Branches must be unique within their common root.
Thus, all Ids are unique (up to a collection). 
All fields are unique (up to an Id).
And so on.

The graphical query language should be used correctly.
Do not use too many functions. They are expensive. 
One can prevent _collapse from being called on function resolution.
This will improve performance?

No field should be stored as undefined or an empty object.
Each node contains a monotonically non-decreasing version number.
This can be abused in React (or anything) to prevent re-rendering :)
A helper function called reduce is no longer implemented.
This function should allow for aribtrary graph traversal/reduction.

// n => data node.
// v => data value/query value.
// k => data key.
// o => observer node.
// i => init config.
*/

var id = 0;
function newId() {
	return ++id;
}

var Observer = function () {
	function Observer() {
		_classCallCheck(this, Observer);

		this._collections = { v: new _reactiveVar2.default(0), c: {}, p: null };
		this._observers = { v: new _reactiveVar2.default(0), c: {}, p: null };
		this._observerCache = {};
		this._nextId = 0;
	}

	_createClass(Observer, [{
		key: "_node",
		value: function _node(k, p) {
			return p.c[k] = p.c[k] || { v: new _reactiveVar2.default(0), c: {}, p: p };
		}
	}, {
		key: "_canonicalize",
		value: function _canonicalize(q) {
			var _this = this;

			var _q = _extends({}, q);

			var sort = _q.sort;
			var id = _q.id;
			var group = _q.group;
			var query = _q.query;

			if (!group) return null;
			var o = this._observers;
			o = this._node(group, o);
			o = this._node('id', o);
			var n = this._collections;
			n = this._node(group, n);
			var ids = (0, _typetastic.toArray)(id) || Object.keys(n.c);
			if (!ids) return null;
			ids.forEach(function (i) {
				_this._node(i, n);
			});
			return { o: o, n: n, q: query, ids: ids, sort: sort };
		}
	}, {
		key: "_collapse",
		value: function _collapse(n) {
			if ((0, _typetastic.type)(n.c) === "object") {
				var contents = {};
				for (var k in n.c) {
					contents[k] = this._collapse(n.c[k]);
				}
				return contents;
			}
			return n.c;
		}
	}, {
		key: "_match",
		value: function _match(n, v) {
			var t = (0, _typetastic.type)(v);
			if (t === "array") {
				return v.indexOf(n.c) > -1;
			} else if (t === "function") {
				var col = this._collapse(n);
				return !!v(col);
				return true;
			} else if (t === "undefined") {
				return true;
			} else {
				return n.c === v;
			}
		}
	}, {
		key: "_track",
		value: function _track(k, v, n, obs, o) {
			var _this2 = this;

			obs.resolvers.push(_trackr2.default.autorun(function () {
				var res = _this2._resolve(k, v, n, obs, o);
				obs.changed(res, k);
			}));
		}
	}, {
		key: "_notify",
		value: function _notify(i, n, o) {
			var obs = this._observerCache;
			for (var oid in o.c) {
				var ob = o.c[oid];
				this._match(n, ob.v) && this._track(i.k, i.v, i.n, ob.obs, i.o);
			}
		}
	}, {
		key: "_merge",
		value: function _merge(i, k, v, n, o) {
			var t = (0, _typetastic.type)(v),
			    p = n.p;
			if (t === "object") {
				for (var sk in v) {
					var sn = this._node(sk, n);
					var so = this._node(sk, o);
					this._merge(i, sk, v[sk], sn, so);
				}
			} else {
				var ver = n.v.v;
				if (!ver || !(0, _typetastic.equals)(n.c, v)) {
					!ver && this._notify(i, n, o);
					n.v.set(ver + 1) && (n.c = v);
					while (p) {
						p.v.set(p.v.v + 1) && (p = p.p);
					}
				} else if (t === "undefined") {
					delete p.c[k];
					while (p) {
						p.v.set(p.v.v + 1) && (p = p.p);
					}
				}
			}
		}
	}, {
		key: "_resolve",
		value: function _resolve(k, v, n, obs, o) {
			var t = (0, _typetastic.type)(v),
			    u = void 0;
			if (t === "object") {
				var branch = { _v: 0, d: {} },
				    match = false;
				for (var sk in v) {
					match = true;
					var res = this._resolve(sk, v[sk], n.c[sk], obs, o && o.c[sk]);
					if (!res) {
						return;
					};
					branch.d[sk] = res.d;
					branch._v += res._v;
				}
				return match ? branch : u;
			} else {
				if (t === "array") {
					u = v.indexOf(n.c) > -1 ? n.c : u;
				} else if (t === "function") {
					var col = this._collapse(n);
					var _res = v(col);
					u = _res ? (typeof _res === "undefined" ? "undefined" : _typeof(_res)) === "object" ? _res : col : u;
				} else if (t === "undefined") {
					u = this._collapse(n);
				} else {
					u = v === n.c ? n.c : u;
				}
				if (typeof u !== "undefined") {
					o.c[obs.id] = { v: v, obs: obs };
					return { d: u, _v: n.v.get() };
				}
			}
		}
	}, {
		key: "_observe",
		value: function _observe(query, sort, cb) {
			var obs = {
				resolvers: [],
				changed: function changed(res, id) {
					var d = this.data;
					var s = this.set;
					var ex = d[id];
					ex && (0, _docsort.pull)(s, ex, sort);
					delete d[id];
					if (typeof res !== 'undefined') {
						var r = res.d;
						r.id = id;
						r._v = res._v;
						d[id] = r;
						sort ? (0, _docsort.push)(s, r, sort) : s.push(r);
					}
					this.didDump && cb(this.set);
				},
				get: function get() {
					return this.set;
				},
				query: query,
				set: [],
				data: {},
				id: newId(),
				didDump: false
			};
			this._observerCache[obs.id] = obs;
			return obs;
		}
	}, {
		key: "merge",
		value: function merge(query) {
			var _this3 = this;

			var _canonicalize2 = this._canonicalize(query);

			var o = _canonicalize2.o;
			var n = _canonicalize2.n;
			var q = _canonicalize2.q;
			var ids = _canonicalize2.ids;

			ids.forEach(function (id) {
				var init = {
					k: id,
					v: q,
					n: n.c[id],
					o: o
				};
				_this3._merge(init, id, q, n.c[id], o);
			});
		}
	}, {
		key: "resolve",
		value: function resolve(query) {
			var _this4 = this;

			var _canonicalize3 = this._canonicalize(query);

			var n = _canonicalize3.n;
			var q = _canonicalize3.q;
			var ids = _canonicalize3.ids;
			var sort = _canonicalize3.sort;

			var set = [];
			ids.forEach(function (id) {
				var res = _this4._resolve(null, q, n.c[id]);
				if (typeof res !== 'undefined') {
					var r = res.d;
					r.id = id;
					r._v = res._v;
					sort ? (0, _docsort.push)(set, r, sort) : set.push(r);
				}
			});
			return set.length ? ids.length === 1 ? set[0] : set : null;
		}
	}, {
		key: "observe",
		value: function observe(query, cb) {
			var _this5 = this;

			var _canonicalize4 = this._canonicalize(query);

			var o = _canonicalize4.o;
			var n = _canonicalize4.n;
			var q = _canonicalize4.q;
			var ids = _canonicalize4.ids;
			var sort = _canonicalize4.sort;

			var obs = this._observe(q, sort, cb);
			ids.forEach(function (id) {
				_this5._track(id, q, n.c[id], obs, o);
			});
			cb(obs.set);
			obs.didDump = true;
		}
	}]);

	return Observer;
}();
//when document is removed, does the query lose an element?
//only if satisfies query
//when document is added, does the query gain an element?
// only if statisfies the query.
//when document is added/removed, do the appropriate trackers destroy themselves?
//does the observer's set and data cache also update?
//when document is changed, does it enter/exit the result set
//depending on if it still satisfies the query.
//


exports.default = Observer;
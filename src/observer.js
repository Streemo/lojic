import Tracker from "trackr";
import ReactiveVar from "reactive-var";
import { push, pull, sortIndex } from "docsort";
import { type, toArray, equals as eq } from "typetastic";

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

let id = 0;
function newId(){
	return ++id;
}

export default class Observer {
	constructor(){
		this._collections = {v:new ReactiveVar(0),c:{},p:null};
		this._observers = {v: new ReactiveVar(0),c:{},p:null};
		this._observerCache = {};
		this._nextId = 0;
	}
	_node(k,p){
		return p.c[k] = p.c[k] || {v: new ReactiveVar(0),c:{},p:p};
	}
	_canonicalize(q){
		let {sort, id, group, query} = {...q};
		if (!group) return null;
		let o = this._observers;
			o = this._node(group,o);
			o = this._node('id',o);
		let n = this._collections;
			n = this._node(group,n);
		let ids = toArray(id) || Object.keys(n.c);
		if (!ids) return null;
		ids.forEach((i)=>{
			this._node(i,n);
		})
		return {o:o,n:n,q:query, ids:ids, sort: sort};
	}
	_collapse(n){
		if (type(n.c) === "object"){
			let contents = {};
			for (let k in n.c){
				contents[k] = this._collapse(n.c[k]);
			}
			return contents;
		}
		return n.c;
	}
	_match(n,v){
		let t = type(v);
		if (t==="array"){
			return v.indexOf(n.c) > -1
		} else if (t==="function"){
			let col = this._collapse(n);
			return !! v(col);
			return true;
		} else if (t==="undefined"){
			return true;
		} else {
			return n.c === v;
		}
	}
	_track(k,v,n,obs,o){
		obs.resolvers.push(Tracker.autorun(()=>{
			let res = this._resolve(k,v,n,obs,o);
			obs.changed(res,k);
		}))
	}
	_notify(i,n,o){
		let obs = this._observerCache;
		for (let oid in o.c){
			let ob = o.c[oid];
			this._match(n,ob.v) && this._track(i.k,i.v,i.n,ob.obs,i.o);
		}
	}
	_merge(i,k,v,n,o){
		let t = type(v), p = n.p;
		if (t==="object"){
			for (let sk in v){
				let sn = this._node(sk,n);
				let so = this._node(sk,o);
				this._merge(i,sk,v[sk],sn,so);
			}
		} else {
			let ver = n.v.v;
			if (!ver || !eq(n.c,v)){
				!ver && this._notify(i,n,o);
				n.v.set(ver+1) && (n.c = v);
				while(p) p.v.set(p.v.v+1) && (p = p.p);
			} else if (t==="undefined"){
				delete p.c[k];
				while(p) p.v.set(p.v.v+1) && (p = p.p);
			}
		}
	}
	_resolve(k,v,n,obs,o){
		let t = type(v), u;
		if (t==="object"){
			let branch = {_v:0,d:{}}, match = false;
			for (let sk in v){
				match = true;
				let res = this._resolve(sk,v[sk],n.c[sk],obs,o && o.c[sk]);
				if (!res){return};
				branch.d[sk] = res.d
				branch._v+=res._v
			}
			return match ? branch : u;
		} else {
			if (t==="array"){
				u = v.indexOf(n.c) > -1 ? n.c : u;
			} else if (t==="function"){
				let col = this._collapse(n);
				let res = v(col);
				u = res ? typeof res === "object" ? res : col : u;
			} else if(t==="undefined"){
				u = this._collapse(n);
			} else {
				u = v === n.c ? n.c : u;
			}
			if (typeof u !== "undefined"){
				o.c[obs.id] = {v: v, obs: obs};
				return {d: u, _v: n.v.get()}
			}
		}
	}
	_observe(query,sort,cb){
		let obs = {
			resolvers: [],
			changed: function(res,id){
				let d = this.data;
				let s = this.set;
				let ex = d[id];
				ex && pull(s,ex,sort);
				delete d[id];
				if (typeof res !== 'undefined'){
					let r = res.d;
					r.id = id;
					r._v = res._v;
					d[id] = r;
					sort ? push(s,r,sort) : s.push(r);
				}
				this.didDump && cb(this.set)
			},
			get: function(){
				return this.set;
			},
			query: query,
			set:[],
			data: {},
			id: newId(),
			didDump: false
		};
		this._observerCache[obs.id] = obs;
		return obs;
	}
	merge(query){
		let {o,n,q,ids} = this._canonicalize(query)
		ids.forEach((id)=>{
			let init = {
				k: id,
				v: q,
				n: n.c[id],
				o: o,
			}
			this._merge(init,id,q,n.c[id],o);
		})
	}
	resolve(query){
		let {n,q,ids,sort} = this._canonicalize(query)
		let set = [];
		ids.forEach((id)=>{
			let res = this._resolve(null,q,n.c[id]);
			if (typeof res !== 'undefined'){
				let r = res.d;
				r.id = id;
				r._v = res._v;
				sort ? push(set, r, sort) : set.push(r);
			}
		})
		return set.length ? ids.length === 1 ? set[0] : set : null;
	}
	observe(query, cb){
		let {o,n,q,ids,sort} = this._canonicalize(query)
		let obs = this._observe(q,sort,cb);
		ids.forEach((id)=>{
			this._track(id,q,n.c[id],obs,o)
		})
		cb(obs.set);
		obs.didDump = true;
	}
}
//when document is removed, does the query lose an element?
	//only if satisfies query
//when document is added, does the query gain an element?
	// only if statisfies the query.
//when document is added/removed, do the appropriate trackers destroy themselves?
	//does the observer's set and data cache also update?
//when document is changed, does it enter/exit the result set
	//depending on if it still satisfies the query.
//
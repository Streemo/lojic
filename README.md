# lojic

**Problem**: Where is real-time data stored on the client? Did the data change? Do I need to re-render? Where do I need to re-render?

**Solution**: Document versioning. Instead of comparing old data to new data N times, we should compare them once, and then store the result in a calculated version number. Every piece of data should have a unique monotonically non-decreasing integer associated with it. This way, a rendering engine could simply perform this check as it works down the tree, instead of comparing the data.

```
curInt > prevInt ? re-render : pass;
```

## Storing data in a tree.
Assume the data is (E)JSON. Store the data in a tree using the collection-document paradigm, as in MongoDB. The root node holds the groups (collections). The group nodes hold the documents, etc. Expose three methods: we should be able to `merge`, `resolve`, and `observe` arbitrary branches on the tree. For example, a tree holding two groups: "users", and "meals", may look like this:
```
let myTree = {
  "meals": {
    "docId1":{
      taste: ["sour","spicy"],
      score: 4.666667,
      title: "Lemon Fish Stew with Chili",
      servings: 6,
      description: "A sour, slightly spicy stew with tilapia, lemon, spinach, and pepper."
    },
    "docId2":{...}
  },
  "users":{...}
}
```

## Canonical queries should be intuitive and explicit.
Every query takes the shape of the document it's looking for. This shape is a "slice" of the main tree; a subsequence of connected nodes. A query is essentially a set of directions for some tree traverser: 

"Go along this path in the tree, and see if the values meet the conditions specified at the nodes. If they do, return the path with the values filled in, else return null." Here's what I mean:

```
let yourQuery = {
  groupName: {
    documentId: {
      documentField1: <condition1>,
      documentField2: <condition2>,
      ...
    }
  }
}
```
This is read by the traverser as follows:

1. Start at the root of the tree.
2. Travel to the group `groupName` ? continue : exit.
3. Travel to the document `documentId` ? continue : exit.
4. Travel to the field `documentField1` ? continue : exit.
5. Value at `documentField1` satisfies <condition1> ? store value in result : exit.
6. Value at `documentField2` satisfies <condition2> ? store value in result : exit.
7. Return the result.

## Query Rules for the <conditions>.
1. A value of `undefined` should tell the traverser that there is no condition, and we want that field.
2. A value of `function` should tell the traverser to evaluate the function with the data value.
  true ? return value : object ? return object : exit.
3. A value of `object` should tell the traverser to continue.
4. A `string`, `date`, `number`, or other primitive should tell the traverse to evaluate.
  same ? return value : exit.

The following query will search the "meals" group for the document "someDocId" whose `score` is less than `5`, `title` starts with `"Be"`, `servings` is exactly `4`, *and* we would like the `taste` field to be included in the result.
### Unmentioned fields.
If there are other stored fields, the traverser will, and should ignore these fields, because they were not specified in the query. 
### Adding more fields, more conditions, or transforms.
For example, if you want the `description` field, you must specify `description: undefined` as well. If you want only the first 20 characters of the description field, you may specify `description: (d) => {return {summary: d.slice(0,20)}}`, which will tell the traverser to transform the description field before returning it. If you want the document only if the `description` field has `yummy` in the description, you can specify `description: d => d.indexOf('yummy') > -1`, etc.
```
let query = {
  "meals": {
    "someDocId":{
      score: s => s < 5,
      title: t => t.slice(0,2) === "Be",
      taste: undefined,
      servings: 4
    }
  }
}
let result = Observer.resolve(query);
```
The result should look exactly like the query, but with the values "filled in", like so:
```
{
  "meals": {
    "someDocId":{
      score: 4.833333,
      title: "Beef Stew",
      taste: ["salt","umami"],
      servings: 4
    }
  }
}
```
Had the score of the meal document `"someDocId"` been larger than 5, say, 5.18333, then the result would have been `null`.

## Querying the entire collection, or a list of document `_id`s.
```
The above query only works if we know the id of the document *a priori*, and it should be fast since we know the starting key ahead of time. It's not clear how to generalize the query for cases where we don't know the document's `_id`, while keeping the same structure. One solution may be to specify something like this, and then canonicalize it into many structured queries:
```
let query = {
  group: "meals",
  id: ['someDocId1', 'someDocId2', ...] //optional or just a single id,
  query: {
    score: s => s < 5,
    title: t => t.slice(0,2) === "Be",
    taste: undefined,
    servings: 4
  }
}
let resultSet = Observer.resolve(query);
```
The above query should tell the traverser to perform a canonicalized query for each of the specified ids, and if no ids are specified, it should check the entire collection for possible matches.
```
//internals
let results = [];
query.id.forEach((key)=>{
  //canonical query mimics the tree structure, easy to traverse.
  let canonQuery = {
    [query.group]: {
      [key]: query.query
    }
  }
  let resultDoc = Observer.resolve(canonQuery);
  result && results.push(resultDoc);
})
```

## We should be able to merge tree paths onto the data tree:
Write this up later, then commit again.
```
let newPathToMerge = {
  meals: {
    "AjG543GGksLK02": {
      score: 4.66667,
      title: "Beef Stew (spicy)"
    }
  }
}
Observer.merge(newPathToMerge);
let ourNewDataInTheTree = Observer.resolve(newPathToMerge);
/*
  ourNewDataInTheTree === null or {
    meals: {
      "AjG543GGksLK02": {
        score: 4.66667,
        title: "Beef Stew (spicy)"
      }
    }
  }
*/
```
... WIP.
# lojic

Problem: Where is real-time data stored on the client? Did the data change? Do I need to re-render? Where do I need to re-render?

Solution: Document versioning. Instead of comparing old data to new data N times, we should compare them once, and then store the result in a calculated version number. Every piece of data should have a unique monotonically non-decreasing integer associated with it. This way, a rendering engine could simply perform this check as it works down the tree, instead of comparing the data.

```
curInt > prevInt ? re-render : pass;
```

Approach: Assume the data is (E)JSON. Store the data in a tree using the collection-document paradigm, as in MongoDB. The root node holds the groups (collections). The group nodes hold the documents, etc. Additional structure may be necessary for keeping track of versions. We should be able to merge, resolve, and observe arbitrary branches on the tree.

## We should be able to query tree paths, if the data exists:
```
let desiredPathToResolve = {
	meals: {
		"AjG543GGksLK02": {
			score: undefined //could be s => s > 4.3 if we want that condition,
			title: undefined //could be (t) => {return {onlyFirstLetter: t[0]}} 
							 //if we only want the first letter to be returned.
		}
	}
}
let result = Observer.resolve(desiredPathToResolve);
/*
	result === null or {
		meals: {
			"AjG543GGksLK02": {
				score: 4.5,
				title: "Beef Stew"
			}
		}
	}
*/
```
## We should be able to merge tree paths onto the data tree:
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
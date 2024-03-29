// Utility to generate treewalker for an ast based on a dictionary of function definitions
// Specifically, handles _iter nodes represented as arrays by concatenating return types from recursive calls to multiple nested arrays, which allows AST passes to insert statements in blocks.
// Specify the `_default` entry to determine behaviour of treewalker when a node not in the AST is found; if this is set to a function, it will be called, if it is set to a dictionary, the treewalker will attempt to make another call in that dictionary (useful for setting language-wide defaults for C vs. Jsides)
// Set an AST node entry to `null` to ignore the node and move on
module.exports = function(dict) {
    let tw = {dict: new Map(Object.entries(dict))};
    if (tw.dict.has("_default")) {
        let def = tw.dict.get("_default")
        if (def instanceof Map)
            tw.dict.set("_default", function(node, ...others) {
                if (def.has(node.type)) {
                    let fn = def.get(node.type);
                    return fn == null ? node : fn.bind(tw, node).apply(tw, others);
                } else if (def.has("_default")) {
                    let fn = def.get("_default");
                    return fn == null ? node : fn.bind(tw, node).apply(tw, others);
                }
                console.error("Cannot handle node type in default map" + node.type);
                throw "Cannot handle node type in default map" + node.type;
            });
    }
    tw.walk = function(node, ...others) {
        if (node instanceof Array) {
            let newIter = [];
            for (let i = 0; i < node.length; i++) {
                let change = tw.walk.bind(tw, node[i]).apply(tw, others);
                if (!(change instanceof Array)) {
                    if(change == undefined)
                        newIter.push(node[i])
                    else if(change)
                        newIter.push(change);
                } else
                    for (let cn of change)
                        newIter.push(cn);
            }
            return newIter;
        } else if (typeof node === "string") {
            return node;
        }
        if (node == null)
            return node;
        if (tw.dict.has(node.type)) {
            let fn = tw.dict.get(node.type);
            return fn == null ? node : fn.bind(tw, node).apply(tw, others);
        } else if (tw.dict.has("_default")) {
            let fn = tw.dict.get("_default");
            return fn == null ? node : fn.bind(tw, node).apply(tw, others);
        }
        console.trace();
        throw "Cannot handle node type " + node.type;
    };
    return tw;
};

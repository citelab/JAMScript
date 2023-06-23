module.exports = function(dict) {
    let tw = {dict: new Map(Object.entries(dict)), test: "hello "};
    tw.setup = tw.dict.get("Source");
    tw.hasSetup = tw.dict.delete("Source");
    tw.recurseNode = function(node) {
        if (node instanceof Array) {
            let newIter = [];
            for (let i = 0; i < node.length;) {
                let change = tw.recurseNode(node[i]);
                if (!(change instanceof Array)) {
                    if(change != undefined)
                        newIter.push(change);
                    i++;
                } else {
                    for (let cn in change)
                        newIter.push(cn);
                    i += change.length;
                }
            }
            return newIter;
        }
        if (tw.dict.has(node.type))
            return tw.dict.get(node.type).call(tw, node);
        if (tw.dict.has("_default"))
            return tw.dict.get("_default").call(tw, node);
        console.error("Cannot handle node type " + node.type);
        throw "Cannot handle node type " + node.type;
    };
    tw.walk = function(ast) {
        if (tw.hasSetup)
            return tw.setup.call(tw, ast);
        return tw.recurseNode(ast);
    }
    return tw;
};

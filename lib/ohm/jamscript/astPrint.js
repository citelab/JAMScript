var nodeCount;
var output;

function printNode(label) {
    output += "node_" + nodeCount + "[label=\"" + label + "\"];\n";
    return nodeCount++;
}

function printEdge(pn, cn) {
    output += "node_" + pn + " -> " + "node_" + cn + ";\n";
}

function printAll(node, children) {
    let pn = printNode(node.ctorName);
    children.forEach((c) => {
        printEdge(pn, c.astPrint());
    });
    return pn;
}

function sanitizeString(c) {
    switch(c) {
    case "\\":
        return "\\\\";
    case "\n":
        return "\\\\n";
    case "\0":
        return "\\\\0";
    case "\t":
        return "\\\\t";
    case "\"":
        return "\\\"";
    }
}

var astPrint = {
    Source: function(decls) {
        output = ""
        output += "digraph {\n";
        nodeCount = 0;
        printAll(this, decls.children);
        output += "}\n";
        return output;
    },
    id: function(ident) {
        return printNode("id: " + this.sourceString);
    },
    string: function(contents) {
        return printNode("string: " + this.sourceString.replaceAll(/["\n\0\t\\]/g, sanitizeString))
    },
    number: function(val) {
        return printNode("number: " + this.sourceString);
    },
    _nonterminal: function(...children) {
        return printAll(this, children);
    },
    _iter: function(...children) {
        return printAll(this, children);
    },
    _terminal: function() {
        return printNode(this.ctorName);
    }
};

module.exports = {
    astPrint: astPrint
};

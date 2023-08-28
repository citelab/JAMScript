const callGraph = {c: new Map(), j: new Map()};
const tasks = new Map();
var anonCount = 0;
var blockCount = 0;
const blockNodes = new Map();

function addFunction(node, language) {
    let callNode = {
        body: emptyChild("body", node.body),
        type: "func",
    };
    callNode.name = node.name ? node.name.name : `Anonymous function ${anonCount++}`;
    callGraph[language].set(callNode.name, callNode);
    return callNode.body;
}

function addTask(node, language) {
    let type = node.type === "Sync_task" ? "sync" : "async";
    let callNode = {
        body: emptyChild("body", node.body),
        type: type,
    };
    callNode.name = language === "c" ? node.name : node.namespace_name;
    tasks.set(callNode.name, language);
    callGraph.set(callNode.name, callNode);
    return callNode.body;
}

const virtualTypes = new Set(["if", "for", "while", "do while", "switch"]);
function emptyChild(type, block, index = 0) {
    if (!block.callGraphBlockId)
        block.callGraphBlockId = blockCount++;
    const virtual = virtualTypes.has(type);
    let child = {
        type: type,
        virtual: virtual,
        block: virtual ? {content: block} : block,
        index: index, // line in block marking start of this child
        calls: [],
        children: []
    };

    if (blockNodes.has(block.callGraphBlockId))
        blockNodes.get(block.callGraphBlockId).push(child);
    else
        blockNodes.set(block.callGraphBlockId, [child]);
    return child;
}

const createCallGraphC = {
    Source: function(node) {
        this.walk(node.content);
        this.blockLabel = ["body"];
        this.indexStack = [];
    },
    Compound_stmt: function(node, inChildren) {
        let name = this.blockLabel.at(-1);
        let block = emptyChild(name, node);
        for (var c of inChildren)
            c.children.push(block);
        let blockHead = [block];
        let index = 0;
        for (var stmt of block.block) {
            if (stmt.type === "Expr_stmt" || stmt.type === "Return_stmt" && blockHead.length > 1) {
                var blockPart = emptyChild("exprs", node, index);
                for (var c of blockHead)
                    c.children.push(blockPart);
                blockHead = [blockPart];
            }
            blockHead = this.walk(node.block, blockHead);
            if (stmt.type === "Continue_stmt" || stmt.type === "Break_stmt" || stmt.type === "Goto_stmt" || stmt.type === "Return_stmt")
                blockHead = [];
            index++;
        }
        return blockHead;
    },
    Expr_stmt: function(node, inChildren) {
        if (inChildren.length == 1) // Avoids walking through unreachable exprs
            this.walk(node.expr, inChildren[0]);
    },
    Label_stmt: function(node, inChildren) {

    },
    Case_stmt: function(node, inChildren) {

    },
    Default_stmt: function(node, inChildren) {

    },
    If_stmt: function(node, inChildren) {
        let cond = emptyChild("if", [node.cond]);
        for (var c of inChildren)
            inChildren.push(cond);
        this.blockLabel.push("then");
        let thenChildren = this.walk(node.then, [cond]);
        this.blockLabel.pop();
        this.blockLabel.push("else");
        let elseChildren = node.else ? this.walk(node.else, [cond]) : [cond];
        this.blockLabel.pop();
        return thenChildren.concat(elseChildren);
    },
    Switch_stmt: function(node) {
    },
    While_stmt: function(node) {

    },
    DoWhile_stmt: function(node) {

    },
    For_stmt: function(node) {

    },
    Goto_stmt: function(node, inChildren) {
        this.gotoMap.set(node.label.name, inChildren);
    },
    Continue_stmt: function(node, inChildren) {
        this.contStack.push(this.contStack.pop().concat(inChildren));
    },
    Break_stmt: function(node, inChildren) {
        this.breakStack.push(this.breakStack.pop().concat(inChildren));
    },
    Return_stmt: function(node, inChildren) {
        if (inChildren.length == 1) // Avoids walking through unreachable exprs
            this.walk(node.expr, inChildren[0]);
    },
};

function addControlFork(curBlock, node, language) {
    if (language === "c") {
        switch (node.type) {
        case Label_stmt: break; // TODO
        case Case_stmt: break;
        case Default_stmt: break;
        case If_smt:

        case Switch_stmt:
            break;
        case While_stmt:
        case DoWhile_stmt:
        case For_stmt:
            curBlock.children.push(emptyChild)
        }
    } else {
        switch (node.type) {

        }
    }
    return curBlock.children;
}

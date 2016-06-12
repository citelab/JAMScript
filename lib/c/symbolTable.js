var symbolTable = function() {
    this.table = [new Map()];
}

symbolTable.prototype.enterScope = function() {
    this.table.push(new Map());
}

symbolTable.prototype.exitScope = function() {
    this.table.pop();
}

symbolTable.prototype.add = function(name, value) {
    this.table[this.table.length - 1].set(name, value);
}

symbolTable.prototype.get = function(name) {
    for (var i = this.table.length - 1; i >= 0; i--) {
        if(this.table.has(name)) {
            return this.table.get(name);
        }
    }
    return undefined;
}

symbolTable.prototype.has = function(name) {
    for (var i = this.table.length - 1; i >= 0; i--) {
        if(this.table.has(name)) {
            return true;
        }
    }
    return false;
}

module.exports = symbolTable;
module.exports = {
    table: [new Map()],
    enterScope: function() {
       this.table.push(new Map());
    },
    exitScope: function() {
       this.table.pop();
    },
    has: function(name) {
      for (var i = this.table.length - 1; i >= 0; i--) {
        if(this.table[i].has(name)) {
          return true;
        }
      }
      return false;
    },
    get: function(name) {
      for (var i = this.table.length - 1; i >= 0; i--) {
        var entry = this.table[i].get(name);
        if(entry !== undefined) {
          return entry;
        }
      }
      return undefined; 
    },
    set: function(name, value) {
      this.table[this.table.length - 1].set(name, value);
    },
    getGlobals: function() {
      return this.table[0];
    }
};

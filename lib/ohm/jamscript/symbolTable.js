// NOTE: The Symbol table below is a stack of tables.
// table[0] is the one holding all the global definitions.
// we can have higher level tables created as we enter scope

module.exports = {
    table: [new Map()],
    tasks: {
        c: new Map(),
        js: new Map(),
    },
    functions: {
        c: new Set(),
        js: new Set(),
    },
    jcond: {
        c: new Map(),
        js: new Map(),
    },
    jreuse: {
        c: new Map(),
        js: new Map(),
    },
    jdata: new Map(),
    isScoped: function () {
        return this.table.length > 1;
    },
    enterScope: function () {
        this.table.push(new Map());
    },
    exitScope: function () {
        if (this.table.length == 1)
            throw "ERROR: Cannot exit global scope";
        this.table.pop();
    },
    has: function (name) {
        for (var i = this.table.length; i-- > 0;)
            if (this.table[i].has(name))
                return true;
        return false;
    },
    get: function (name) {
        for (var i = this.table.length; i-- > 0;) {
            var entry = this.table[i].get(name);
            if (entry !== undefined)
                return entry;
        }
        return undefined;
    },
    set: function (name, value) {
        if (this.table[this.table.length - 1].has(name))
            throw `ERROR: identifier ${name} already defined in this scope`;
        this.table[this.table.length - 1].set(name, value);
    },
    getGlobals: function () {
        return this.table[0];
    },
    // TODO -- necessary??
    addFunction: function (name, language) {
        this.functions[language].add(name);
        this.table[0].set(name, {type: "function"});
    },
    addTask: function (name, values) {
        this.tasks[values.language].set(name, values);
        this.table[0].set(name, values);
    },
    getTask: function (taskName, language = "") {
        if (language)
            return this.tasks[language].get(taskName);
        return this.getTask(taskName, "c") || this.getTask(taskName, "js")
    },
    addJdata: function(name, value) {
        this.jdata.set(name, value);
        this.table[0].set(name, value);
    },
};

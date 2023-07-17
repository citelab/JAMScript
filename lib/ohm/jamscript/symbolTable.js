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
	enterScope: function () {
		this.table.push(new Map());
	},
	exitScope: function () {
        if (table.length == 1)
            throw "Cannot exit outside of global scope";
		this.table.pop();
	},
	has: function (name) {
		for (var i = this.table.length - 1; i >= 0; i--) {
			if (this.table[i].has(name)) {
				return true;
			}
		}
		return false;
	},
	get: function (name) {
		for (var i = this.table.length - 1; i >= 0; i--) {
			var entry = this.table[i].get(name);
			if (entry !== undefined) {
				return entry;
			}
		}
		return undefined;
	},
	set: function (name, value) {
		console.log("setting.... ", name, "  to value = ", value);

		this.table[this.table.length - 1].set(name, value);
	},
	getGlobals: function () {
		return this.table[0];
	},
	addFunction: function (name, language) {
		this.functions[language].add(name);
		this.table[0].set(name, "function");
	},
	addTask: function (name, values) {
		this.tasks[values.language].set(name, values);
		values.type = "task";
        this.table[0].set(name, values);
	},
	getTask: function (functionName, language = "") {
		if (language)
            return this.tasks[language].get(taskName);
		return this.getTask(functionName, "c") || this.getTask(functionName, "js")
	},
};

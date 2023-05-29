// NOTE: The Symbol table below is a stack of tables. 
// table[0] is the one holding all the global definitions.
// we can have higher level tables created as we enter scope

module.exports = {
	table: [new Map()],
	activities: {
		c: new Map(),
		js: new Map(),
	},
	functions: {
		c: new Set(),
		js: new Set(),
	},
	tasks: new Map(),
	enterScope: function () {
		this.table.push(new Map());
	},
	exitScope: function () {
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
	addActivity: function (name, values) {
		this.activities[values.language].set(name, values);
		values.type = "activity";
		if (this.table.length > 0) this.table[0].set(name, values);
	},
	addTask: function (functionName, language, prop) {
		this.tasks.set(functionName, {
			language: language,
			property: prop,
		});
	},
	getTask: function (functionName, language = "") {
		if (language === "") {
			return (
				this.getTask(functionName, "c") || this.getTask(functionName, "js")
			);
		}

		let result;
		const keys = Array.from(this.activities[language].keys());
		for (let i = 0; i < keys.length; i++) {
			const taskName = keys[i];
			if (taskName === functionName) {
				result = this.activities[language].get(taskName);
				break;
			}
		}
		return result;
	},
};
class VarTable {
	constructor(parent) {
		this.parent = parent;
		this.varList = [];
		this.pointers = [];
	}

	addVar(varName) {
		this.varList.push(varName);
	}

	addVar(varName, isPointer) {
		this.varList.push(varName);
		if (isPointer) {
			this.pointers.push(varName);
		}
	}

	isVarGlobalOrPointer(varName) {
		var isVarGlobalOrPointer = false;

		var currentTable = this;
		while (currentTable != null) {
			if (currentTable.varList.includes(varName)) {
				// Check if the variable is a pointer or if we are in global scope
				if (currentTable.pointers.includes(varName) || currentTable.parent == null) {
					isVarGlobalOrPointer = true;
				}
				break;
			} else {
				currentTable = currentTable.parent;
			}
		}

		return isVarGlobalOrPointer;
	}

}

class TableManager {
	constructor(table){
		this.currentTable = table;
		this.checkSideEffect = false;
		this.inTask = false;
		this.currentAct = "";
		this.sideEffectTable = {};
		this.jDataReads = {};
	}

	enterScope() {
		let table = new VarTable(this.currentTable);
		this.currentTable = table;
	}

	exitScope() {
		this.currentTable = this.currentTable.parent;
	}

	getCurrentTable() {
		return this.currentTable;
	}

	setCheckSideEffect(checkFlag) {
		this.checkSideEffect = checkFlag;
	}

	getCheckSideEffect() {
		return this.checkSideEffect;
	}

	setInTask(taskFlag, taskName) {
		this.inTask = taskFlag;
		if (taskFlag) {
			this.currentAct = taskName;
		}
	}

	setInTask(taskFlag) {
		this.inTask = taskFlag;
	}

	setTaskName(funcName) {
		this.currentAct = funcName;
	}

	getSideEffectResult() {
		return this.sideEffectTable;
	}

	getJDataReads() {
		return this.jDataReads;
	}

	setJDataReads(varName) {
		if (this.inTask) {
			if (this.jDataReads.hasOwnProperty(this.currentAct)) {
				this.jDataReads[this.currentAct].push(varName);
			} else {
				this.jDataReads[this.currentAct] = [varName];
			}
		}
	}

	setHasSideEffect(varName) {
		if (this.checkSideEffect && this.inTask) {
			if (this.currentTable.isVarGlobalOrPointer(varName)) {
				if (this.sideEffectTable.hasOwnProperty(this.currentAct)) {
					this.sideEffectTable[this.currentAct].push(varName);
				} else {
					this.sideEffectTable[this.currentAct] = [varName];
				}
			}
		}
	}

	addVar(varName) {
		this.currentTable.addVar(varName);
	}

}

module.exports = {
	VarTable: VarTable,
	TableManager: TableManager
};

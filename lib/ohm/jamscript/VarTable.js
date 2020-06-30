class VarTable {
	constructor(parent) {
		this.parent = parent;
		this.varList = [];
	}

	addVar(varName) {
		this.varList.push(varName);
	}

	isVarGlobal(varName) {
		var isGlobal = false;

		var currentTable = this;
		while (currentTable != null) {
			if (currentTable.varList.includes(varName)) {
				// Check if we are in global scope
				if (currentTable.parent == null) {
					isGlobal = true;
				} 
				break;
			} else {
				currentTable = currentTable.parent;
			}
		}

		return isGlobal;
	}

}

class TableManager {
	constructor(table){
		this.currentTable = table;
		this.checkSideEffect = false;
		this.inActivity = false;
		this.hasSideEffect = false;
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

	setInActivity(activityFlag) {
		this.inActivity = activityFlag;
	}

	getHasSideEffect() {
		return this.hasSideEffect;
	}

	setHasSideEffect(varName) {
		if (this.checkSideEffect && this.inActivity) {
			if (!this.hasSideEffect) {
				this.hasSideEffect = this.currentTable.isVarGlobal(varName);
			}
			return this.hasSideEffect;
		} else {
			return false;
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
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
				if (this.currentTable)
				this.hasSideEffect = this.currentTable.isVarGlobalOrPointer(varName);
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
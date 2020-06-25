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

module.exports = VarTable; 
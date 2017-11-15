import React from "react";

export default class Button extends React.Component {

    _buttonAct() {
        console.log("HELLO");
    }

    render() {
    	// connector
        return (
            <a className={'btn '+(item.className||'')} key={idx}
               disabled={item.disabled}
               title={item.title}
               onClick={(e)=>this._buttonAct(e,item)}>
                {displayLabel}
            </a>
        )
    }
}
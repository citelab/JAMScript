import React from "react";

export default class Button extends React.Component {

    _buttonAct() {
        console.log("HELLO");
    }

    render() {
    	// connector

        console.log(this.props);

        return (
            <a className={'btn '+(this.props.className||'')} key={this.props.id}
               disabled={this.props.disabled}
               title={this.props.title}
               onClick={(e)=>this._buttonAct(e,item)}>
                {this.props.dispLabel}
            </a>
        )
    }
}
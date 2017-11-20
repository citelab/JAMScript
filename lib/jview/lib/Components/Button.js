import React from "react";

export default class Button extends React.Component {

    _buttonAct() {
        if (!this.props.disabled) {
            this.props.trigger(this.props.id, !this.props.value);
            this.props.changeValue(!this.props.value, this.props.valueName);
        }
    }

    render() {
    	// connector
        return (
            <a className={'btn '+(this.props.className||'')} key={this.props.id}
               disabled={this.props.disabled}
               title={this.props.title}
               onClick={(e)=>this._buttonAct(e)}>
                {this.props.dispLabel}
            </a>
        )
    }
}
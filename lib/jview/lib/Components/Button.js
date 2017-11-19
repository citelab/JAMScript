import React from "react";

export default class Button extends React.Component {

    _buttonAct() {
        this.props.trigger(this.props.id, !this.props.value);
        this.props.changeValue(!this.props.value, this.props.valueName);
        console.log(this.props.value)
        console.log(this.props.valueName)
    }

    render() {
    	// connector

        console.log(this.props);

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
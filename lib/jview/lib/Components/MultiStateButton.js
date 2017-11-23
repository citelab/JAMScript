import React from "react";

export default class Button extends React.Component {

    constructor(props) {
        super(props)
    }

    _buttonAct(e) {
        let result = this.props.states.filter((state) => state.state === this.props.state)
        let state = result.length > 0 ? result[0] : { state: "unknown", value: null }
        this.props.trigger(this.props.id, state.value)
    }

    render() {
    	// connector

        let className = 'btn ' + (this.props.className||'')

        if (this.props.value == true) {
            className += ' active'
        }

        return (
            <div>
                <div>{this.props.dispLabel}</div>
                <a className={className} key={this.props.id}
                   disabled={this.props.disabled}
                   title={this.props.title}
                   onClick={(e)=>this._buttonAct(e)}>
                    {this.props.dispLabel}
                </a>
            </div>
        )
    }
}
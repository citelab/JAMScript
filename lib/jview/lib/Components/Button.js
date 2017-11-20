import React from "react";
import io from 'socket.io-client';

export default class Button extends React.Component {

    constructor(props) {
        super(props);
        this.socket = io('http://localhost:3000')
    }

    _buttonAct() {
        if (!this.props.disabled) {
            this.props.trigger(this.props.id, !this.props.value);
            this.props.changeValue(!this.props.value, this.props.valueName);
        }
    }

    componentDidMount() {
        this.socket.on('disable', body => {
            if (body.id == this.props.id) {
                this.props.changeValue(body.value, body.name)
            }
        })
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
import React from "react";

export default class Button extends React.Component {

    _buttonAct() {
        if (this.props.mode == 0) {
            if (!this.props.disabled) {
                this.props.trigger(this.props.id, !this.props.value);
                this.props.changeValue(!this.props.value, this.props.valueName);
            }
        } else if (this.props.mode == 1) {
            this.props.changeValue(!this.props.value, this.props.valueName);
        }
    }

    poll() {
        this.props.trigger(this.props.id, this.props.value);
    }

    componentDidMount() {
        if (this.props.mode == 1) {
            this._timer = setInterval(this.poll.bind(this), this.props.interval);
        }
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
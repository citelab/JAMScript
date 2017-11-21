import React from "react";

export default class Slider extends React.Component {

	_valueChange(e) {
        this.props.trigger(this.props.id, e.target.value);
        this.props.changeValue(e.target.value, this.props.valueName);
	}

    componentDidMount() {
        this.startPolling();
    }

    startPolling() {        
        if (this.props.mode == 1) {
            this._timer = setInterval(this.poll.bind(this), 1000);
        }
    }

    poll() {
        this.props.trigger(this.props.id, this.props.value);
    }

    render() {
    	// connector
        return (
            <div>
                <div>{this.props.dispLabel}</div>
                <input 
                	type="range" 
                	min={this.props.min} 
                	max={this.props.max}
                	step={this.props.step}
                    value={this.props.value}
                	onChange={(e) => this._valueChange(e)}
            	/>
            </div>
        )
    }
}
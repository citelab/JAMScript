import React from "react";

export default class Slider extends React.Component {

	_valueChange(e) {
        this.props.emitValue(e.target.value);
        this.props.changeValue(e.target.value, this.props.valueName);
	}

    render() {
    	// connector
        return (
            <input 
            	type="range" 
            	min={this.props.min} 
            	max={this.props.max}
            	step={this.props.step}
                value={this.props.value}
            	onChange={(e) => this._valueChange(e)}
        	/>
        )
    }
}
import React from "react";

export default class Slider extends React.Component {

	_valueChange(e) {
		console.log(e.target.value);
        this.props.emit(e.target.value);
	}

    render() {
    	// connector
        console.log(this.props);
        return (
            <input 
            	type="range" 
            	min={this.props.min} 
            	max={this.props.max}
            	step={this.props.step}
            	onChange={(e) => this._valueChange(e)}
        	/>
        )
    }
}
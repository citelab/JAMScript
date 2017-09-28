import React from "react";

export default class Slider extends React.Component {
    render() {
        return (
            <input type="range" min="0" max="100" step="10" />
        )
    }
}
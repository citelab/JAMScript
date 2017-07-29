import React, { Component } from 'react'

class Text extends Component {
    state = {
        value: ''
    };

    componentWillMount() {
        let props = this.props
        if (typeof props.value != 'undefined') {
            if (props.value === null) {
                this.state.value = ''
            }
            else {
                this.state.value = props.value + ''
            }
            this.setState(this.state)
        }
    }

    componentWillReceiveProps(nextProps) {
        if (typeof nextProps.value != 'undefined') {
            if (nextProps.value === null) {
                this.state.value = ''
            }
            else {
                this.state.value = nextProps.value + ''
            }
            this.setState(this.state)
        }
    }

    limitInput(propLimit) {
        let val = this.state.value
        let limit = this.props.limit
        if (!limit && propLimit) {
            limit = propLimit
        }
        else if (!limit) return

        let length = 0
        let left = 0
        for (let i = 0; i < val.length; i++) {
            if (val.charCodeAt(i) > 255) {
                length += 2
            } else {
                length++
            }
        }
        left = Math.floor(limit - length / 2)
        if (left < 0) {
            let byteLen = limit * 2
            let len = 0
            for (let j = 0; j < val.length; j++) {
                if (val.charCodeAt(j) > 255) {
                    byteLen -= 2
                } else {
                    byteLen--
                }

                if (byteLen < 0) break
                len++
            }
            this.state.value = val.substr(0, len)
        }
    }

    _valueChange(e) {
        this.state.value = e.target.value
        this.limitInput.call(this)
        this.setState(this.state)
    }

    _changeAct(e) {
        let param = (typeof this.props.param == 'undefined' ? {} : this.props.param)
        this.props.trigger(this.state.value, param)
    }

    render() {
        return (
            <span className={this.props.className}>
        {(this.props.dispLabel ? <label>{this.props.dispLabel}</label> : null)}
        <input
            className={ (this.props.inputClassName || '') + ' form-control'} type="text" ref="obj"
            disabled={this.props.disabled}
            onChange={(e) => this._valueChange(e)}
            onBlur={(e) => this._changeAct(e, this.props)}
            onFocus={this.props.onFocus}
            value={this.state.value}
            placeholder={this.props.placeholder}
            defaultValue={this.props.value}
        />
      </span>
        )
    }
}

export default Text
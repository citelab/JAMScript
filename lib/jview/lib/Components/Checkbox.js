import React, { Component } from 'react'

class Checkbox extends Component {
    state = {
        value: ''
    };

    componentWillMount() {
        let props = this.props
        if (typeof props.value != 'undefined') {
            this.state.value = props.value
            this.setState(this.state)
        }
    }

    componentDidMount() {
        this.updateIndeterminate()
    }

    componentWillReceiveProps(nextProps) {
        if (typeof nextProps.value != 'undefined') {
            this.state.value = nextProps.value
            this.setState(this.state)
        }
    }

    componentDidUpdate() {
        this.updateIndeterminate()
    }


    _changeAct(e) {
        this.state.value = e.target.checked
        this.setState(this.state)
        let param = (typeof this.props.param == 'undefined' ? {} : this.props.param)
        this.props.trigger(this.state.value, param)
    }

    render() {
        return (
            <span className={this.props.className}>
        {(this.props.dispLabel ? <label>{this.props.dispLabel}</label> : null)}
        <input type="checkbox"
               ref="$checkbox"
               disabled={this.props.disabled}
               onChange={(e) => this._changeAct(e)}
               checked={this.state.value}
               defaultChecked={this.props.value} />
                {(this.props.valueLabel ? <span>{this.props.valueLabel}</span> : null)}
      </span>
        )
    }

    updateIndeterminate(nextProps) {
        const { indeterminate } = nextProps || this.props
        this.refs.$checkbox.indeterminate = !!indeterminate
    }
}

export default Checkbox
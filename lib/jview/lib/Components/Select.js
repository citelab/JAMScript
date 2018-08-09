import React, { Component } from 'react'

class Select extends Component {
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

    componentWillReceiveProps(nextProps) {
        if (typeof nextProps.value != 'undefined') {
            this.state.value = nextProps.value
            this.setState(this.state)
        }
    }

    _changeAct(e) {
        let oldValue = this.state.value?this.state.value:0
        this.state.value = e.target.value
        this.setState(this.state)
        let param = (typeof this.props.param == 'undefined' ? {} : this.props.param)
        this.props.trigger(this.state.value, param, this.props.list[+this.state.value], this.props.list[+oldValue])
    }

    render() {
        return (
            <span className={this.props.className} >
        {(this.props.dispLabel ? <label>{this.props.dispLabel}</label> : null)}
        <select className={this.props.selectClassName ? this.props.selectClassName + ' form-control' : 'form-control'}
                disabled={this.props.disabled}
                onChange={(e) => this._changeAct(e)}
                value={this.state.value}
                defaultValue={this.props.value}>
          {this.props.list.map((item, idx) => {
              return (
                  <option
                      key={idx}
                      value={idx}
                      disabled={item.disabled}>
                      {item.dispLabel}
                  </option>
              )
          })}
        </select>
      </span>
        )
    }
}

export default Select
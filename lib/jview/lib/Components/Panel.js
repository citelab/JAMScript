import React, { Component, PropTypes } from 'react'

import FormItem from './FormItem'

class Panel extends Component {

    state = {
        hideBody: false
    };

    toggleBody() {
        this.state.hideBody = !this.state.hideBody
        this.setState(this.state)
    }

    componentWillMount() {
        if (typeof this.props.hideBody != 'undefined') {
            this.state.hideBody = this.props.hideBody
        }
    }

    componentWillReceiveProps(nextProps) {
        if (typeof nextProps.hideBody != 'undefined') {
            this.state.hideBody = nextProps.hideBody
            this.setState(this.state)
        }
    }

    render() {

        const { title, actions, hideBody, className, ...props } = this.props

        return (
            <div className = {(className || '') + " panel"}
                 style={this.props.margin ? {margin: this.props.margin} : null}>
                {title ?
                    <div className = "panel-heading">
                        <div className = "panel-title">
                            {typeof title == 'string' ? title :
                                <FormItem item={title} {...props} />}
                        </div>
                        {actions ? (Array.isArray(actions)? <div className="panel-btns">{actions.map((item, i)=>(<FormItem key={i} item={item} {...props}/>))}</div>
                            : <FormItem
                            className={"panel-actions" + (this.state.hideBody ? ' down' : ' up')}
                            item={actions} {...props}
                            toggleBody={this.toggleBody.bind(this)} />)
                            : null}
                    </div>
                    : null}
                <div className = {"panel-body" + (this.state.hideBody ? ' hide' : '')}
                     style={{padding: this.props.padding || '15px'}}>
                    {this.props.children}
                </div>
            </div>
        )
    }
}

export default Panel
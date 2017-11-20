import React, {Component, PropTypes} from 'react'
import Slider from 'Components/Slider'
import Button from 'Components/Button'

class ControllerItem extends Component {
    state = {
        Input: '',
        Checked: false,
        shouldUpdate: true
    };

    componentWillMount(){
        let item = this.props.item
        if (typeof item.value !== 'undefined'){
            this.state.Input = item.value
            this.state.Checked = item.value
        }
    }

    componentWillReceiveProps(nextProps) {
        let item = nextProps.item
        if (item.length) {
            this.setState(this.state)
        }
        if (typeof item.value !== 'undefined') {
            this.state.uInput = item.value
            this.state.uCheck = item.value
            this.setState(this.state)
        }
        else if (item.valueLabel === this.props.valueLabel
            && item.dispLabel === this.props.dispLabel
            && item.disabled === this.props.disabled) {
            this.state.shouldUpdate = false
        }
    }

    render(){
        const { item, className, ...props } = this.props

        // console.log(item)
        // console.log(props)

        const ControllerItem = function(item,idx) {
            let trigger = typeof item.trigger === 'function' ? item.trigger : props[item.trigger]
            let displayLabel = typeof item.dispLabel === 'function' ? item.dispLabel() : item.dispLabel
            let valueLabel = typeof item.valueLabel === 'function' ? item.valueLabel() : item.valueLabel

            if (displayLabel !== 0 && !displayLabel){
                displayLabel = ''
            }
            if (valueLabel !== 0 && !valueLabel){
                valueLabel = ''
            }
            switch (item.type){
                case 'slider':
                    return (
                        <Slider { ...item } trigger={trigger} key={idx} changeValue={props.changeValue}/>
                    )
                    break
                case 'button':
                    return (
                        <Button { ...item } trigger={trigger} changeValue={props.changeValue} displayLabel={displayLabel} key={idx}/>
                    )
            }
        }
        let classname = className ? className + ' form-group':'form-group'
        classname = classname +' form-group-'+(item.type||'plain')
        if(item.list&&item.type=='form'){
            classname = item.className ? item.classNameOverride ? item.className : item.className + ' form-group ' : classname
            return (
                <div className={classname}>
                    {item.list.map((i, index) => innerItem.call(this, i, index))}
                </div>
            )
        }
        return (
            <div className={classname}>
                {(item.length ?
                    item.map((i, index) => {
                        return ControllerItem.call(this, i, index)
                    })
                    : ControllerItem.call(this, item, 0))}
                {(item.errorInfo ?
                    <span className="form-control-info error" title={item.errorInfo}>{item.errorInfo}</span>
                    : null)}
                {(!item.errorInfo && item.info ?
                    <span className="form-control-info" title={item.info}>{item.info}</span>
                    : null)}
                {(!item.errorInfo && item.hint ?
                    <span className="form-control-info hint" title={item.hint}>{item.hint}</span>
                    : null)}
            </div>
        )
    }
}

export default ControllerItem
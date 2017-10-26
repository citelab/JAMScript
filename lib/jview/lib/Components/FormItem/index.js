import React, {Component, PropTypes} from 'react'
import Text from 'Components/Text'
import Select from 'Components/Select'
import Checkbox from 'Components/Checkbox'
import Calendar from 'Components/Calendar'

class FormItem extends Component {
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

    _buttonAct(e, item) {
        let value = item.value
        let param = (typeof item.param == 'undefined' ? {} : item.param)
        if (typeof item.trigger == 'string') {
            this.props[item.trigger](value, param)
        } else if (typeof item.trigger == 'function') {
            item.trigger(value, param)
        }
    }

    render(){
        const { item, className, ...props } = this.props

        console.log(item);
        console.log(props);

        const formItem = function(item,idx) {
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
                case 'button':
                    return (
                        <a className={'btn '+(item.className||'')} key={idx}
                           disabled={item.disabled}
                           title={item.title}
                           onClick={(e)=>this._buttonAct(e,item)}>
                            {displayLabel}
                            </a>
                    )
                case 'img':
                    return (
                        <img className ={(item.className ||'')} src={item.imgSrc} key={idx}
                             onClick={(e)=>this._buttonAct(e,item)} alt={item.dispLabel}>
                            </img>
                    )
                case 'badge':
                    return (
                        <span className={(item.className || '')} key={idx}>
                            {displayLabel ? <label>{displayLabel}</label> : null}
                            <a className="icon" title={item.title} onClick={(e) => this._buttonAct(e, item)}></a>
                        </span>
                    )
                    break
                case 'text':
                    return (
                        <Text { ...item } trigger={trigger} key={idx}/>
                    )
                    break
                case 'select':
                    return (
                        <Select { ...item } trigger={trigger} key={idx}/>
                    )
                    break
                case 'date':
                    return (
                        <Calendar { ...item } trigger={trigger} key={idx}/>
                    )
                    break
                case 'checkbox':
                    return (
                        <Checkbox { ...item } trigger={trigger} key={idx}/>
                    )
                    break
                case 'plain':
                default:
                    let title =  item.title? item.title: null
                    return (
                        <span key={idx} className={(item.className || '')} title={title}>
                            {displayLabel ? <label>{displayLabel}</label> : null}
                            <span className="formField" title={item.valueLabel}>{valueLabel}</span>
                        </span>
                    )
                    break
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
                        return formItem.call(this, i, index)
                    })
                    : formItem.call(this, item, 0))}
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

export default FormItem
import React from "react";
import {observer} from 'mobx-react';

@observer
export default class Terminal extends React.Component {

    static defaultProps = {
        // command lists
        commands: []
    }

    state = {
        value: '',
        commands: []
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

	_buttonAct(e) {
        let command = {
            command: document.getElementById('command').value,
            date: new Date()
        }
        
        this.props.buttonTrigger(this.state.value, this.props.commandsListName)
        this.props.trigger(this.props.id, this.state.value)

        this.state.value = '';
        this.state.commands.push(command);
        this.setState(this.state);
    }

    render() {
    	// connector
        return (
            <div>
                <ul id="commands">
                    {
                        this.state.commands.map(
                            (command, idx) => <li key={idx}>{command.date.toString()}: {command.command}</li>
                        )
                    }
                </ul>
                <input id="command" 
                    autoComplete="off" 
                    onChange={(e) => this._valueChange(e)}
                    value={this.state.value}
                />
                <a className={'btn '+(this.props.className||'')} key={1}
                    // disabled={item.disabled}
                    // title={item.title}
                    onClick={(e)=>this._buttonAct(e)}>
                    {this.props.buttonLabel}
                </a>
            </div>
        )
    }
}
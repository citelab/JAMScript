import React, { Component, PropTypes } from 'react'

import ControllerItem from 'Components/ControllerItem'

class Controller extends Component {
    static defaultProps = {
        // number of columns
        columns: 3,

        // form control - upper form
        controlList: [],

        // form action - lower form
        actionList: [],

        // custome css
        className: '',
    }

    render() {

        const { controlList, actionList, className, ...props } = this.props

        let blockList = []
        let lineList = []

        let tempList = controlList ? [...controlList] : []

        while (tempList.length) {
            lineList = tempList.splice(0, +this.props.columns)
            blockList.push(lineList)
        }

        return (
            <div className={(className || '') + " controller"}>
                {blockList.map((block, index) => {
                    let innerList = block.map((line, index) => {
                        if (!line.length && !line.hidden ){
                            return (
                                <ControllerItem className={line.className || ''} item={line} key={index} {...props} />
                            )
                        } else if ((line.length && !line[0].hidden)) {
                            return (
                                <ControllerItem className={line[0].className || ''} item={line} key={index} {...props} />
                            )
                        }

                    })

                    return (
                        <div key={index}>
                            {innerList}
                        </div>
                    )
                })}
            </div>
        )
    }
}

export default Controller
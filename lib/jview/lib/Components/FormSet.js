import React, { Component, PropTypes } from 'react'

import FormItem from 'Components/FormItem'

class FormSet extends Component {
    static defaultProps = {
        // number of columns
        columns: 3,

        // form control - upper form
        formList: [],

        // form action - lower form
        actionList: [],

        // custome css
        className: '',
    }

    render() {

        const { formList, actionList, className, ...props } = this.props

        let blockList = []
        let lineList = []

        let tempList = formList ? [...formList] : []



        while (tempList.length) {
            lineList = tempList.splice(0, +this.props.columns)
            blockList.push(lineList)
        }

        return (
            <div className={(className || '') + " formset"}>
                {blockList.map((block, index) => {
                    let innerList = block.map((line, index) => {
                        if (!line.length && !line.hidden ){
                            return (
                                <FormItem className={line.className || ''} item={line} key={index} {...props} />
                            )
                        } else if ((line.length && !line[0].hidden)) {
                            return (
                                <FormItem className={line[0].className || ''} item={line} key={index} {...props} />
                            )
                        }

                    })

                    return (
                        <div key={index}>
                            {innerList}
                        </div>
                    )
                })}
                {(actionList && actionList.length ?
                        <div className="center">
                            <FormItem item={actionList}
                                {...props} />
                        </div> : null
                )}
            </div>
        )
    }
}

export default FormSet
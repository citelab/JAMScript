import React, { Component, PropTypes } from 'react'

import FormItem from 'Components/FormItem'
import FormSet from 'Components/FormSet'

import './table-plain.less'

class PlainTable extends Component {
    static defaultProps = {
        className: '',
        tableList: {
            header: null,
            body: null  // null 为未初始化， []为空数据表
        },
        isLoading: false,
        hasError: false
    }

    render() {
        const { tableList, className, isLoading, ...props } = this.props

        return (
            <div className={'table table-plain ' + (className || '')}
                 style={props.needScroll ? {overflowX: 'scroll', width: '100%'} : null}
            >
                {/* @todo: remove inner 'plaintable' and customer className */}
                <table className={(className || '') + ' plaintable'} style={{width: '100%'}}>
                    {this.renderHeader()}
                    {this.renderBody()}
                </table>
                {this.renderEmpty()}
            </div>
        )
    }

    renderBody() {
        const { tableList, className, isLoading, ...props } = this.props
        const { body } = tableList

        if (isLoading || !(body && body.length)) {
            return null
        }

        return (
            <tbody>{body.map((item, index) => {
                if (item instanceof Array) {
                    return (
                        <tr key={index}>
                            {item.map((it, idx) => {
                                return (
                                    <td colSpan={it.colspan ? it.colspan : 1} key={idx} className={typeof it.content === 'function' && it.className || ''}>
                                        {this.renderCell(it, index)}
                                    </td>
                                )
                            })}
                        </tr>
                    )
                }
                else {
                    const {list, className, colspan } = item
                    return (
                        <tr className={className} key={index}>
                            {list.map((it, idx) => {
                                return (
                                    <td colSpan={it.colspan ? it.colspan : colspan?colspan:1 } className={typeof it.content === 'function' && it.className || ''} key={idx}>
                                        {this.renderCell(it, idx)}
                                    </td>
                                )
                            })}
                        </tr>
                    )
                }
            })}</tbody>
        )
    }

    renderCell(item, index) {
        const { tableList, className, isLoading, ...props } = this.props

        if (item.formset) {
            return <FormSet {...item.formset}  {...props}  />
        }
        else if (item.table){
            return <PlainTable tableList = {item.table}  {...props} />
        }
        else {
            return (typeof item.content === 'function' ?
                    item.content(item, index) :
                    <FormItem item={item} {...props} />
            )
        }
    }

    renderHeader() {
        const { header } = this.props.tableList
        let headerRows = header
        if (!(header && header.length)) {
            return null
        }
        else if (!(header[0] instanceof Array)) {
            headerRows = [header]
        }

        return <thead>{headerRows.map((row, index) => this.renderHeaderRow(row,index))}</thead>
    }

    renderHeaderRow(row, rowIndex) {
        const { tableList, className, isLoading, ...props } = this.props
        return (
            <tr key={'thead_' + rowIndex}>
                {row && row.map((item, index) => {
                    const { rowspan, colspan } = item

                    return typeof item.content === 'function' ? (
                        <th key={index} rowSpan={rowspan || 1} colSpan={colspan || 1} className={item.className || ''}>
                            {item.content(item, index)}
                        </th>
                    ) : (
                        <th key={index} rowSpan={rowspan || 1} colSpan={colspan || 1} className={item.thClassName || ''}>
                            <FormItem item={item} {...props} />
                        </th>
                    )
                })}
            </tr>
        )
    }

    renderEmpty() {
        const { tableList, className, isLoading, hasError, ...props } = this.props
        const { body } = tableList
        const intialized = !!body

        let emptyType = ''
        if (hasError) {
            emptyType = 'error'
        }
        else if (isLoading) {
            emptyType = 'loading'
        }
        else if (intialized) {
            emptyType = body.length ? 'not-empty' : 'none'
        }

        return <div className={'empty-wrap ' + emptyType}></div>
    }
}

export default PlainTable
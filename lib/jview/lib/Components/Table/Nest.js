import React, { Component } from 'react'

import PlainTable from './Plain'
import FormSet from 'Component/FormSet'
import FormItem from 'Component/FormItem'

import './table-nest.less'

class InnerLine extends Component {

    toggleDetail() {
        this.state.showDetail = !this.state.showDetail
        this.setState(this.state)
    }

    state = {
        showDetail: false
    };

    componentWillMount() {
        if (typeof this.props.showDetail != 'undefined') {
            this.state.showDetail = this.props.showDetail
        }
    }

    componentWillReceiveProps(nextProps) {
        if (typeof nextProps.showDetail != 'undefined') {
            this.state.showDetail = nextProps.showDetail
            this.setState(this.state)
        }
    }

    render() {

        const { list=[], showDetail, innerType, innerList=[], ...props } = this.props

        const getInner = (type, innerList) => {
            switch (type) {
                case 'table':
                    return (
                        <PlainTable tableList={innerList} {...props} />
                    )
                case 'formset':
                    return (
                        <FormSet {...innerList} {...props} />
                    )
            }
        }

        const cell = (item)=>{
            if (item.formset) {
                return <FormSet {...item.formset}  {...props}  />
            }
            else if (item.table){
                return <PlainTable tableList = {item.table}  {...props} />
            }
            else {
                return <FormItem item={item} {...props} toggleDetail = {this.toggleDetail.bind(this)} />
            }
        }
        return (
            <tbody>
            <tr className={'outerList' + (this.state.showDetail ? ' up' : ' down')}>
                {list.map((item, index) => {
                    return (
                        <td key={index} colSpan={item.colspan ? item.colspan : 1}>
                            {cell(item)}
                        </td>
                    )
                })}
            </tr>
            {innerList.length || innerList.body ?
                <tr className={'innerList' + (this.state.showDetail ? '' : ' hide')}>
                    <td colSpan={list.length}>
                        {innerType && innerType == 'formset' ?
                            <FormSet formList={innerList.formList}
                                     actionList={innerList.actionList} columns={innerList.columns} {...props} /> :
                            <PlainTable tableList={innerList} {...props} />
                        }
                    </td>
                </tr> : null}
            </tbody>
        )
    }
}

class NestTable extends Component {
    render() {
        const { tableList, innerType, className, ...props } = this.props
        const table = tableList || {}
        const { body, header } = table
        return table ? (
            <div className={'table table-nest ' + (className || '')} style={props.needScroll ? {overfowX: 'scroll', width: '100%'} : null}>
                {/* @todo: remove inner 'plaintable' and customer className */}
                <table
                    className={(className || '') + ' nesttable'}
                    style={{width: '100%'}}>
                    <thead><tr>
                        {header && header.map((item, index) => {
                            return (
                                <th key={index} colSpan={item.colspan ? item.colspan : 1}>
                                    <FormItem  item={item} {...props} />
                                </th>
                            )
                        })}
                    </tr></thead>
                    {body && body.map((item, index) => {
                        return (
                            <InnerLine { ...props } key = {index}
                                                    showDetail = {item.showDetail}
                                                    list = {item.list}
                                                    innerType = {innerType || item.innerType}
                                                    innerList = {item.innerList} />
                        )
                    })}
                </table>
                {this.renderEmpty()}
            </div>
        ) : null
    }

    renderEmpty() {
        const { tableList, className, isLoading, hasError, ...props } = this.props
        const { body } = tableList || {}
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

export default NestTable
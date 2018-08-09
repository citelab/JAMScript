import React, { Component, PropTypes } from 'react'
import ReactDOM from 'react-dom'
import FormItem from 'Components/FormItem'

import './table-fixed.less'

class LeftHead extends Component {
    render() {
        const { list, ...props } = this.props

        if (!(list && list.length)) return null

        let style = {
            position: 'absolute',
            top: '0',
            left: '0',
            zIndex: '5',
            width: props.width + 'px',
            height: props.height + 'px'
        }

        return (
            // @todo: remove 'leftHead' className
            <div style={style} className="left-head leftHead">
                <table style={{width: '100%'}}>
                    <thead><tr>
                        {list.map((item, index) => {
                            return typeof item.content === 'function' ? (
                                <th key={index} className={item.className || ''}>
                                    {item.content(item)}
                                </th>
                            ) : (
                                <th key={index}>
                                    <FormItem item={item} {...props} />
                                </th>
                            )
                        })}
                    </tr></thead>
                </table>
            </div>
        )
    }
}

class RightHead extends Component {
    render() {
        const { list, ...props } = this.props

        if (!(list && list.length)) return null

        let style = {
            position: 'absolute',
            top: '0',
            right: '0',
            zIndex: '5',
            width: props.width + 'px',
            height: props.height + 'px'
        }

        return list ? (
            // @todo: remove 'rightHead' className
            <div style={style} className="right-head rightHead">
                <table style={{width: '100%'}}>
                    <thead><tr>
                        {list.map((item, index) => {
                            return typeof item.content === 'function' ? (
                                <th key={index} className={item.className || ''}>
                                    {item.content(item)}
                                </th>
                            ) : (
                                <th key={index}>
                                    <FormItem item={item} {...props} />
                                </th>
                            )
                        })}
                    </tr></thead>
                </table>
            </div>
        ) : null
    }
}

class CenterHead extends Component {

    render() {
        const { list, ...props } = this.props

        if (!(list && list.length)) return null

        let style = {
            position: 'absolute',
            top: '0',
            zIndex: '4',
            display: 'none',
            marginRight: props.mgRight + 'px',
            marginLeft: props.mgLeft - props.left + 'px',
            overflow: 'hidden',
            cursor: props.popHead ? 'pointer' : 'cursor'
        }

        return (
            // @todo: remove 'centerHead' className
            <div style={style} className="center-head centerHead"
                 onClick={props.showPop ? props.showPop : null}>
                <table>
                    <thead><tr>
                        {list.map((item, index) => {
                            return typeof item.content === 'function' ? (
                                <th key={index} className={item.className || ''}>
                                    {item.content(item)}
                                </th>
                            ) : (
                                <th key={index}>
                                    <FormItem item={item} {...props} />
                                </th>
                            )
                        })}
                    </tr></thead>
                </table>
            </div>
        )
    }
}

class LeftBody extends Component {
    render() {
        const { head, list, ...props } = this.props

        if (!(list && list.length)) return null

        let style = {
            position: 'absolute',
            top: '0',
            left: '0',
            zIndex: '3',
            width: props.width + 'px',
            marginTop: -props.top + 'px'
        }

        return head ? (
            // @todo: remove 'leftHead' className
            <div style={style} className="left-body leftBody" onWheel={props.scrollVerti}>
                <table style={{width: '100%'}}>
                    <thead><tr>
                        {head.map((item, index) => {
                            return typeof item.content === 'function' ? (
                                <th key={index} className={item.className || ''}>
                                    {item.content(item)}
                                </th>
                            ) : (
                                <th key={index}>
                                    <FormItem item={item} {...props} />
                                </th>
                            )
                        })}
                    </tr></thead>
                    <tbody>
                    {list.map((item, index) => {
                        if (item instanceof Array) {
                            return (
                                <tr key={index}>
                                    {item.map((it, idx) => {
                                        return typeof it.content === 'function' ? (
                                            <td  key={idx} className={it.className || ''}>
                                                { it.content(it, index) }
                                            </td>
                                        ) : (
                                            <td  key={idx}>
                                                <FormItem item={it} {...props} />
                                            </td>
                                        )
                                    })}
                                </tr>
                            )
                        }
                        else {
                            const { list, className } = item
                            return (
                                <tr className={className} key={index}>
                                    {list.map((it, idx) => {
                                        return typeof it.content === 'function' ? (
                                            <td  key={idx} className={it.className || ''}>
                                                { it.content(it, index) }
                                            </td>
                                        ) : (
                                            <td  key={idx}>
                                                <FormItem item={it} {...props} />
                                            </td>
                                        )
                                    })}
                                </tr>
                            )
                        }
                    })}
                    </tbody>
                </table>
            </div>
        ) : null
    }
}

class RightBody extends Component {
    render() {
        const { head, list, ...props } = this.props

        if (!(list && list.length)) return null

        let style = {
            position: 'absolute',
            right: '0',
            top: '0',
            zIndex: '3',
            width: props.width + 'px',
            marginTop: -props.top + 'px'
        }
        return head ? (
            // @todo: remove 'rightBody' className
            <div style={style} className="right-body rightBody" onWheel={props.scrollVerti}>
                <table style={{width: '100%'}} >
                    <thead><tr>
                        {head.map((item, index) => {
                            return typeof item.content === 'function' ? (
                                <th key={index} className={item.className || ''}>
                                    {item.content(item)}
                                </th>
                            ) : (
                                <th key={index}>
                                    <FormItem item={item} {...props} />
                                </th>
                            )
                        })}
                    </tr></thead>
                    <tbody>
                    {list.map((item, index) => {
                        if (item instanceof Array) {
                            return (
                                <tr key={index}>
                                    {item.map((it, idx) => {
                                        return typeof it.content === 'function' ? (
                                            <td key={idx} className={it.className || ''}>
                                                { it.content(it, index) }
                                            </td>
                                        ) : (
                                            <td key={idx}>
                                                <FormItem item={it} {...props} />
                                            </td>
                                        )
                                    })}
                                </tr>
                            )
                        }
                        else {
                            const { list, className } = item
                            return (
                                <tr className={className} key={index}>
                                    {list.map((it, idx) => {
                                        return typeof it.content === 'function' ? (
                                            <td key={idx} className={it.className || ''}>
                                                {it.content(it, index)}
                                            </td>
                                        ) : (
                                            <td key={idx}>
                                                <FormItem item={it} {...props} />
                                            </td>
                                        )
                                    })}
                                </tr>
                            )
                        }
                    })}
                    </tbody>
                </table>
            </div>
        ) : null
    }
}

class CenterBody extends Component {
    render() {
        const { head, list, ...props } = this.props

        let style = {
            marginRight: props.mgRight + 'px',
            marginLeft: props.mgLeft - props.left + 'px',
            marginTop: -props.top + 'px',
            overflow: 'hidden'
        }

        return head ? (
            // @todo: remove 'centerBody' className
            <div style={style} className="center-body centerBody" onWheel={props.scrollVerti}>
                <table style={{minWidth: '100%'}}>
                    <thead style={props.showPop ? {cursor: 'pointer'} : {cursor: 'default'}}
                           onClick={props.showPop ? props.showPop : null}><tr>
                        {head.map((item, index) => {
                            return typeof item.content === 'function' ? (
                                <th key={index} className={item.className || ''}>
                                    {item.content(item)}
                                </th>
                            ) : (
                                <th key={index}>
                                    <FormItem item={item} {...props} />
                                </th>
                            )
                        })}
                    </tr></thead>
                    {(list && list.length ?
                        <tbody>
                        {list.map((item, index) => {
                            if (item instanceof Array) {
                                return (
                                    <tr key={index}>
                                        {item.map((it, idx) => {
                                            return typeof it.content === 'function' ?
                                                <td key={idx} className={it.className || ''} title={it.titleTip || ''}>
                                                    {it.content(it, index)}
                                                </td>
                                                :
                                                <td key={idx} title={it.titleTip || ''}>
                                                    <FormItem item={it} {...props} />
                                                </td>
                                        })}
                                    </tr>
                                )
                            }
                            else {
                                const { list, className } = item
                                return (
                                    <tr className={className} key={index}>
                                        {list.map((it, idx) => {
                                            return typeof it.content === 'function' ? (
                                                <td key={idx} className={it.className || ''} title={it.titleTip || ''}>
                                                    {it.content(it, index)}
                                                </td>
                                            ) : (
                                                <td key={idx} title={it.titleTip || ''}>
                                                    <FormItem item={it} {...props} />
                                                </td>
                                            )
                                        })}
                                    </tr>
                                )
                            }
                        })}
                        </tbody>
                        : null)}

                </table>
            </div>
        ) : null
    }
}

class ScrollHori extends Component {
    componentWillReceiveProps(nextProps) {
        if (!nextProps.left && this.refs.obj) {
            this.refs.obj.scrollLeft = 0
        }
    }
    render() {
        if (this.props.innerW <= this.props.width) return null
        let style = {
            width: this.props.width,
            marginLeft: this.props.mgLeft - 10 + 'px',
            height: '10px',
            position: 'absolute',
            left: '10px',
            bottom: '0px',
            overflowX: 'auto',
            overflowY: 'hidden'
        }
        return (
            <div style={style} onScroll={this.props.scrollHori} ref="obj">
                <div style={{width: this.props.innerW, height: '1px'}}></div>
            </div>
        )
    }
}

class ScrollVerti extends Component {
    componentWillReceiveProps(nextProps) {
        if (!nextProps.top && this.refs.obj) {
            this.refs.obj.scrollTop = 0
        }
    }
    render() {
        if (this.props.innerH <= this.props.height) return null
        let style = {
            width: '10px',
            height: this.props.height - this.props.topWidth,
            position: 'absolute',
            top: '0',
            marginTop: this.props.topWidth,
            right: '-5px',
            zIndex: '7',
            overflowY: 'auto'
        }
        return (
            <div style={style} onScroll={this.props.scrollVerti} ref="obj">
                <div style={{height: this.props.innerH, width: '1px'}}></div>
            </div>
        )
    }
}

class TableFixed extends Component {

    state = {
        shouldReCal: true,
        left: 0,
        top: 0,
        offsetTop: 0,
        scrollTop: 0,
        width: 0,
        height: 0,
        innerWidth: 0,
        innerHeight: 0
    };

    _calculateBoundings() {
        let wrapNode = ReactDOM.findDOMNode(this.refs.wrap)
        if (wrapNode) {
            let bodyNode = ReactDOM.findDOMNode(this.refs.centerBody)
            let wid = wrapNode.getBoundingClientRect().width - this.props.left - this.props.right

            let hgh = wrapNode.getBoundingClientRect().height

            let tableNode = bodyNode ? bodyNode.getElementsByTagName('table')[0] : null
            let innerW = tableNode ? tableNode.getBoundingClientRect().width : wid
            let innerH = tableNode ? tableNode.getBoundingClientRect().height : (+this.props.top) + 3
            if (this.props.height && innerH > this.props.height) {
                hgh = this.props.height
            }
            else {
                hgh = innerH
            }

            let headNode = ReactDOM.findDOMNode(this.refs.centerHead).getElementsByTagName('table')[0]
            if (tableNode) {
                let w = window.getComputedStyle(tableNode, null)['width'] || tableNode.currentStyle['width']
                headNode.style['width'] = parseInt(w, 10) + 'px'

                let headList = headNode.getElementsByTagName('th')
                let bodyList = bodyNode.getElementsByTagName('th')
                let l = headList.length

                for (let i = 0; i < l; i++) {
                    headList[i].style['width'] = window.getComputedStyle(bodyList[i], null)['width'] || bodyList[i].currentStyle['width']
                }
            }
            else {
                headNode.style['minWidth'] = (+wid) + 1 + 'px'
                innerW = window.getComputedStyle(headNode, null)['width'] || headNode.currentStyle['width']
                innerW = parseInt(innerW, 10) - 1
                // headNode.style['width'] = innerW + 'px'
            }

            if (this.state.top >= (+hgh)-(+this.props.top)) {
                this.state.top = 0
            }

            this.state.width = wid
            this.state.height = hgh
            this.state.left = 0
            this.state.scrollTop = 0
            this.state.innerWidth = innerW
            this.state.innerHeight = innerH
            this.state.offsetTop = wrapNode.offsetTop
            this.setState(this.state)
        }
    }

    _calculateScroll() {
        this.state.offsetTop = document.body.scrollTop
        this.setState(this.state)
    }

    componentDidMount() {
        this._calculateBoundings.call(this)
        window.addEventListener('resize', this._calculateBoundings.bind(this))
    }

    componentWillReceiveProps() {
        this.state.shouldReCal = true
    }

    componentDidUpdate() {
        if (this.state.shouldReCal) {
            this.state.shouldReCal = false
            this._calculateBoundings.call(this)
        }
    }

    scrollHori(detail) {
        let left = detail.target.scrollLeft

        if (this.state.innerWidth - this.state.width < left) {
            left = this.state.innerWidth - this.state.width
        }

        this.state.left = left
        this.setState(this.state)

    }
    scrollVerti(detail) {
        let top = 0
        let minus = this.state.innerHeight - this.state.height

        if (detail.deltaY) {
            if (detail.deltaY > 0) {
                top = (this.state.top + 100 > minus ? minus : this.state.top + 100)
            }
            else {
                top = (this.state.top - 100 > 0 ? this.state.top - 100 : 0)
            }

            let scrVerti = ReactDOM.findDOMNode(this.refs.scrVerti)
            if (scrVerti) {
                scrVerti.scrollTop = top
            }
        }
        else {
            top = (detail.target.scrollTop > minus ? minus : detail.target.scrollTop)
        }



        this.state.top = top
        this.setState(this.state)

    }

    _deepClone(obj) {
        if (!obj || typeof obj !== 'object') {
            return obj
        }
        else if (Object.prototype.toString.call(obj) != '[object Array]') {
            return Object.assign({}, obj)
        }
        else {
            let arr = []
            obj.forEach((item) => {
                arr.push(this._deepClone.call(this, item))
            })
            return arr
        }
    }

    render() {
        const { tableList, leftCol, rightCol, left, right, top, className, ...props } = this.props
        const table = tableList || {}
        let {
            leftHeader, rightHeader, centerHeader,
            leftBody, centerBody, rightBody
        } = table

        leftHeader = this._deepClone.call(this, leftHeader)
        rightHeader = this._deepClone.call(this, rightHeader)
        centerHeader = this._deepClone.call(this, centerHeader)

        leftBody = this._deepClone.call(this, leftBody)
        centerBody = this._deepClone.call(this, centerBody)
        rightBody = this._deepClone.call(this, rightBody)

        let leftWidth = left || (leftCol ? 50 : 0)
        let rightWidth = right || (rightCol ? 100 : 0)
        let topWidth = top || 32

        let style = {
            position: 'relative',
            // height: (this.props.height ?
            //   (this.state.innerHeight > this.props.height ? this.props.height + 10 + 'px' : this.state.innerHeight + 10) :
            //   this.state.height + 10 + 'px')
            height: (this.props.height ?
                (this.state.innerHeight > this.props.height ? this.props.height : this.state.innerHeight) :
                this.state.height) + 'px'
        }
        let bodyStyle = {
            overflow:'hidden'
        }

        // reset wrap height for emtpy-wrap
        if (!centerBody || !centerBody.length) {
            style.height = 'initial'
        }

        return tableList ? (
            <div className={'table table-fixed fixTable ' + (className || '')}
                 style={style} ref="wrap">
                {props.popHead ? props.popHead : null}
                {(+leftCol && leftHeader ?
                        <LeftHead { ...props } list={leftHeader}
                                               height={topWidth} width={leftWidth} /> : null
                )}
                {(+rightCol && rightHeader ?
                        <RightHead { ...props } list={rightHeader}
                                                height={topWidth} width={rightWidth} /> : null
                )}
                <CenterHead { ...props } list={centerHeader}
                                         mgLeft={leftWidth} mgRight={rightWidth} left={this.state.left}
                                         ref="centerHead" />

                <div style={bodyStyle}>
                    {(+leftCol && leftBody && leftBody.length ?
                            <LeftBody { ...props } list={leftBody} head={leftHeader}
                                                   width={leftWidth} top={this.state.top}
                                                   scrollVerti={this.scrollVerti.bind(this)} /> : null
                    )}

                    <CenterBody { ...props } list={centerBody} head={centerHeader}
                                             mgLeft={leftWidth} mgRight={rightWidth}
                                             top={this.state.top} left={this.state.left}
                                             scrollVerti={this.scrollVerti.bind(this)}
                                             ref="centerBody" />
                </div>

                {(+rightCol && rightBody && rightBody.length ?
                        <RightBody { ...props } list={rightBody} head={rightHeader}
                                                top={this.state.top}  width={rightWidth}
                                                scrollVerti={this.scrollVerti.bind(this)}
                        /> : null
                )}

                <ScrollHori mgLeft={leftWidth} width={this.state.width} left={this.state.left}
                            innerW={this.state.innerWidth} scrollHori={this.scrollHori.bind(this)}
                />




                {/*<ScrollVerti ref="scrVerti"
                 height={this.state.height} top={this.state.top} topWidth={topWidth}
                 innerH={this.state.innerHeight} scrollVerti={this.scrollVerti.bind(this)} />*/}
                {this.renderEmpty()}
            </div>
        ) : null
    }

    renderEmpty() {
        const { tableList, className, isLoading, hasError, ...props } = this.props
        const { centerBody } = tableList || {}
        const intialized = !!centerBody

        let emptyType = ''
        if (hasError) {
            emptyType = 'error'
        }
        else if (isLoading) {
            emptyType = 'loading'
        }
        else if (intialized) {
            emptyType = centerBody.length ? 'not-empty' : 'none'
        }

        return <div className={'empty-wrap ' + emptyType}></div>
    }
}

export default TableFixed
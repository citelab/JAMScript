require('./Style/calendar.less')
import React, { Component } from 'react'
import ReactDOM from 'react-dom'

class InnerItem extends Component {

    render() {
        return (
            <li className={(this.props.selected ? 'datepicker-selected' :
        (this.props.disabled ? 'datepicker-disabled' : ''))}
                data-type={(this.props.type ? this.props.type : '')}
                id={(this.props.dataId && !this.props.disabled ? 'd' + this.props.dataId : '')}
                data-text={this.props.dataId}
                key={Calendar.itemIdx++}>
                {this.props.text}
            </li>
        )
    }
}

class Calendar extends Component {
    static defaultProps = {
        monthsShort: ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'],
        monthsShortEn: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
        // shows in the week part
        daysMin: ['日', '一', '二', '三', '四', '五', '六'],
        daysMinEn: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
        // 0 for Sunday, 1 for Monday, 2 for Tuesday, 3 for Wednesday, 4 for Thursday, 5 for Friday, 6 for Saturday
        yearSuffix: '',
        placeholder: '',
        isEn: false,
        dateFormat: 'yyyy-mm-dd',
        valueFormat: 'yyyy-mm-dd',
        isDisabled: function(date) {
            return false
        }
    };

    static getNowadays() {
        let date = new Date()
        return [
            date.getFullYear(),
            date.getMonth() + 1,
            date.getDate()
        ]
    }

    static getDaysInMonth(year, month) {
        let isLeapYear = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
        return [31, (isLeapYear ? 29 : 28), 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month]
    };

    state = {
        dates: [],
        isEn: false,
        selMonth: false,
        showCal: false,
        value: '',
        valueLabel: ''
    };

    componentWillMount() {
        this.state.value = this.props.value || ''
        let str = this.parseDate.call(this, this.props.value, 'label')
        this.state.valueLabel = str
        this.state.dates = this.state.value.split('-')
        let now = Calendar.getNowadays()
        if (!this.state.dates[0]) {
            this.state.dates = now
        }

        this.state.isEn = this.props.isEn || false
    }

    componentDidMount() {
        document.addEventListener('click', this.removeCal.bind(this))
    }

    componentWillReceiveProps(nextProps) {
        if (this.state.selMonth) {
            this.state.selMonth = false
        }

        this.state.value = nextProps.value
        let str = this.parseDate.call(this, nextProps.value, 'label')
        this.state.valueLabel = str
        this.state.showCal = nextProps.showCal || false

        this.state.dates = nextProps.value.split('-')
        let now = Calendar.getNowadays()
        if (!this.state.dates[0]) {
            this.state.dates = now
        }
        this.state.isEn = nextProps.isEn || false
        this.setState(this.state)

    }

    componentWillUnmount() {
        document.removeEventListener('click', this.removeCal)
    }

    _fillweek() {
        let items = []
        let options = (this.props.isEn ? this.props.daysMinEn : this.props.daysMin)
        for (let i = 0; i < 7; i++) {
            items.push({
                text: options[i]
            })
        }
        return items
    }

    _filldays() {
        let now = Calendar.getNowadays()
        let prevItems = []
        let currentItems = []
        let nextItems = []
        let suffix = this.props.yearSuffix || ''
        let valueList = this.state.value.split('-')
        let year = +valueList[0] || now[0]
        let viewYear = +this.state.dates[0] || now[0]
        let month = +valueList[1] || now[1]
        let viewMonth = +this.state.dates[1] || now[1]
        let day = +valueList[2] || now[2]
        let viewDay = +this.state.dates[2] || now[2]
        let isCurrent
        let isDisabled
        let length
        let date
        let i
        let n

        // Days of prev month
        length = viewMonth === 1 ?
            Calendar.getDaysInMonth(viewYear - 1, 11) : Calendar.getDaysInMonth(viewYear, viewMonth - 2)
        for (i = 1; i <= length; i++) {
            prevItems.push({
                text: i,
                type: 'day prev',
                disabled: false,
                dataId: i
            })
        }

        date = new Date(viewYear, viewMonth - 1, 1, 0, 0, 0, 0)
        // The first day of current month
        n = (7 + (date.getDay())) % 7
        n = n > 0 ? n : 7
        prevItems = prevItems.slice((length - n))

        // Days of prev month next
        length = viewMonth === 12 ?
            Calendar.getDaysInMonth(viewYear + 1, 0) : Calendar.getDaysInMonth(viewYear, viewMonth - 1)
        for (i = 1; i <= length; i++) {
            nextItems.push({
                text: i,
                type: 'day next',
                disabled: false,
                dataId: i
            })
        }

        length = Calendar.getDaysInMonth(viewYear, viewMonth - 1)
        date = new Date(viewYear, viewMonth - 1, length, 0, 0, 0, 0)
        // The last day of current month
        n = (7 - (date.getDay() + 1)) % 7
        n = n >= (7 * 5 - (prevItems.length + length)) ? n : n + 7
        // 7 * 5 : 7 columns & 5 rows, 35 items
        nextItems = nextItems.slice(0, n)

        // Days of current month
        for (i = 1; i <= length; i++) {
            isCurrent = (viewYear === year && viewMonth === month && i === day)
            isDisabled = this.props.isDisabled(new Date(viewYear, viewMonth - 1, i))
            currentItems.push({
                text: i,
                type: (isDisabled ? 'day disabled' : (isCurrent ? 'day selected' : 'day')),
                selected: isCurrent,
                disabled: isDisabled,
                dataId: i
            })
        }

        // Merge all the days
        let items = [ ...prevItems, ...currentItems, ...nextItems ]

        return items
    }

    dateClick(e) {
        let target = e.target
        let yearRegex = /^\d{2,4}$/
        let isYear = false
        let now = Calendar.getNowadays()
        let viewYear = +this.state.dates[0] || now[0]
        let viewMonth = +this.state.dates[1] || now[1]
        let viewDay = +this.state.dates[2] || now[1]
        let type = target.getAttribute('data-type')
        let items

        if (target.length === 0 || type === 'month current') {
            return
        }

        switch (type) {
            case 'month prev':
            case 'month next':
                viewMonth = (type === 'month prev' ?
                viewMonth - 1 :
                    (type === 'month next' ? viewMonth + 1 : viewMonth))
                if (viewMonth === 0) {
                    viewMonth = 12
                    viewYear -=1
                }
                if (viewMonth === 13) {
                    viewMonth = 1
                    viewYear += 1
                }
                this.state.dates = [viewYear, viewMonth, Math.min(viewDay, 28)]
                this.state.selMonth = true
                this.setState(this.state)
                break
            case 'day prev':
            case 'day next':
            case 'day':
                viewMonth = (type === 'day prev' ?
                viewMonth - 1 :
                    (type === 'day next' ? viewMonth + 1 : viewMonth))
                viewDay = parseInt(target.getAttribute('data-text'), 10)
                this.state.dates = [viewYear, viewMonth, viewDay]
                items = this.state.dates.map((item) => {
                    if (+item < 10) {
                        return '0' + item
                    }
                    return '' + item
                })
                this.state.value = items.join('-')
                this.props.trigger(this.state.value, this.props.param)
                break
            case 'day selected':
                items = this.state.dates.map((item) => {
                    if (+item < 10) {
                        return '0' + item
                    }
                    return '' + item
                })
                this.state.value = items.join('-')
                this.props.trigger(this.state.value, this.props.param)
                break
        }
    }

    parseFormat(format) {
        let separator = format.match(/[.\/\-\s].*?/) || '/'
        let parts = format.split(/\W+/)

        if (!parts || parts.length === 0) {
            throw new Error('Invalid date format.')
        }

        let formats = {
            separator: separator[0],
            parts: parts
        }

        for (let i = 0, length = parts.length; i < length; i++) {
            switch (parts[i]) {
                case 'dd':
                case 'd':
                    formats.day = true
                    break
                case 'mmm':
                case 'mm':
                case 'm':
                    formats.month = true
                    break
                case 'yyyy':
                case 'yy':
                    formats.year = true
                    break
            }
        }
        return formats
    }

    formatDate(year, month, day, type) {
        let format
        if (type && type === 'label') {
            format = this.parseFormat(this.props.dateFormat)
        }
        else {
            format = this.parseFormat(this.props.valueFormat)
        }
        let monOptions = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        let val = {
            d: day,
            m: month,
            yy: year.toString().substring(2),
            yyyy: year
        }
        let parts = []
        let length = format.parts.length

        val.dd = (val.d < 10 ? '0' : '') + val.d
        val.mm = (val.m < 10 ? '0' : '') + val.m
        val.mmm = monOptions[val.m - 1]
        for (let i = 0; i < length; i++) {
            parts.push(val[format.parts[i]])
        }

        return parts.join(format.separator) || '';
    }

    parseDate(dateString, type) {
        if (!dateString) return ''
        let format = this.parseFormat(this.props.dateFormat)
        let parts = (typeof dateString === 'string' && dateString.length > 0 ?
            dateString.split(format.separator) : [])
        let length = format.parts.length
        let monOptions = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        let year = 0
        let day = 1
        let month = 1
        let val = ''
        for (let i = 0; i < parts.length; i++) {
            val = parseInt(parts[i], 10)
            switch (format.parts[i]) {
                case 'dd':
                case 'd':
                    if (typeof val === 'number' && val > 0 && val <= 31) {
                        day = val
                    }
                    break
                case 'mm':
                case 'm':
                    if (typeof val === 'number' && val > 0 && val < 13) {
                        month = val
                    }
                    break
                case 'mmm':
                    if (typeof val === 'number' && val > 0 && val < 13) {
                        month = val
                    } else if (parts[i]) {
                        for (var j = 0; j < monOptions.length; j++) {
                            if (parts[i].toLowerCase() === monOptions[j].toLowerCase()) {
                                month = j
                            }
                        }
                    }
                    break
                case 'yy':
                    if (typeof val === 'number' && val >= 0 && val < 100) {
                        year = 2000 + val
                    }
                    break
                case 'yyyy':
                    if (typeof val === 'number' && val >= 1000 && val < 10000) {
                        year = val
                    }
                    break
            }
        }
        if (year === 0) {
            return ''
        } else {
            return this.formatDate.call(this, year, month, day, type)
        }
    }

    _valueChange(e) {
        let value = this.parseDate.call(this, e.target.value)
        this.state.valueLabel = e.target.value

        this.state.value = value

        this.setState(this.state)
        // 清空后触发事件
        if (!this.state.value) {
            this.props.trigger(this.state.value, this.props.param)
        }
    }

    showCalendar(e) {
        this.state.showCal = true
        this.setState(this.state)
        e.stopPropagation()
    }

    removeCal(e) {
        const datepickerDom = ReactDOM.findDOMNode(this.refs.datepicker)
        if (this.state.showCal && datepickerDom && !datepickerDom.contains(e.target)) {
            let value = this.parseDate.call(this, this.state.valueLabel)
            if (value !== this.state.valueLabel) {
                this.state.value = value
                this.state.valueLabel = this.parseDate.call(this, value, 'label')
            }
            // this.props.trigger(value, this.props.param)
            this.state.showCal = false
            this.setState(this.state)
        }
    }

    render() {
        let title = this.state.dates[0] + this.props.yearSuffix + '/' + this.props.monthsShort[this.state.dates[1] - 1]

        let weekList = this._fillweek.call(this)

        let dayList = this._filldays.call(this)

        return (
            <span ref="datepicker" style={{position: 'relative'}}>
        {(this.props.dispLabel ? <label>{this.props.dispLabel}</label> : null)}
        <input className={'form-control ' + this.props.className} type="text" ref="obj"
               disabled={this.props.disabled}
               onChange={this._valueChange.bind(this)}
               onClick={this.showCalendar.bind(this)}
               value={this.state.valueLabel} />
        <span className="date-pop-trigger" onClick={this.showCalendar.bind(this)}></span>
                {(this.state.showCal ?
                    <div className="datepicker-container" data-type="datepicker" onClick={this.dateClick.bind(this)}>
                        <span className="datepicker-arrow"></span>
                        <div className="datepicker-content">
                            <ul className="datepicker-title">
                                <li className="datepicker-prev" data-type="month prev">&lsaquo;</li>
                                <li className="col-5" data-type="month current">{title}</li>
                                <li className="datepicker-next" data-type="month next">&rsaquo;</li>
                            </ul>
                            <div className="content-days" data-type="days picker">
                                <ul className="datepicker-week" data-type="week">
                                    {weekList.map((item, index) => {
                                        return(
                                            <InnerItem { ...item } key={index} />
                                        )
                                    })}
                                </ul>
                                <span className="weekLine"></span>
                                <ul className="datepicker-days" data-type="days">
                                    {dayList.map((item, index) => {
                                        return(
                                            <InnerItem { ...item } key={index} />
                                        )
                                    })}
                                </ul>
                            </div>
                        </div>
                    </div>
                    : null )}
      </span>
        )
    }
}

export default Calendar
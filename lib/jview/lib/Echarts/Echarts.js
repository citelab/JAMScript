'use strict';

import React, { PropTypes } from 'react'
import echarts from 'echarts'
import resize from 'element-resize-event'

export default class Echarts extends React.Component {

    constructor(props) {
        super(props)
    }

    componentDidMount() {
        const chart = this.renderChart();
        resize(this.refs.chart, function(){
            chart.resize()
        });
        const { onReady } = this.props;
        if (typeof onReady === 'function') onReady(chart, echarts)
    }

    componentWillUnmount() {
        echarts.dispose(this.refs.chart)
    }

    componentDidUpdate(old) {
        if (old.option !== this.props.option) {
            this.renderChart()
        }
    }

    renderChart() {
        const chartDom = this.refs.chart;
        const chart = echarts.getInstanceByDom(chartDom) || echarts.init(chartDom);
        const { option, onClick } = this.props;
        if (onClick) {
            chart.off('click');
            chart.on('click', onClick)
        }
        chart.setOption(option, true);
        return chart
    }

    render() {
        const { height = 365 } = this.props;
        return (
            <div ref="chart" style={{height}}></div>
    )
    }
}

Echarts.propTypes = {
    height: PropTypes.number,
    option: PropTypes.object.isRequired,
    onClick: PropTypes.func,
    onReady: PropTypes.func
};
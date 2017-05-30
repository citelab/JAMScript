export function format_scatter(dataPoints) {
    var option = {
        title: {
            text: 'Linear Regression',
            subtext: 'JView Sample',
            left: 'center'
        },
        tooltip: {
            trigger: 'axis',
            axisPointer:{
                type: 'cross'
            }
        },
        xAxis:{
            type: 'value',
            splitLine:{
                lineStyle:{
                    type: 'dashed'
                }
            },
        },
        yAxis:{
            type:'value',
            min:1.5,
            splitLine:{
                lineStyle:{
                    type:'dashed'
                }
            },
        },
        series: [
            {
                name: 'scatter',
                type: 'scatter',
                label: {
                    emphasis:{
                        show: true,
                        position: 'left',
                        textStyle:{
                            color: 'blue',
                            fontSize: 16
                        }
                    }
                },
                data:dataPoints
            }
        ]
    };
    return option;
}

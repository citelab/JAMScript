// dataPoints/logger is supposed to be a [[][]] : array of 2d vectors

module.exports = {
    pie: function(){
        var devices = this.array.toJSON().map(device => (device.toJSON()));
        var data = [];
        devices.forEach(function (e) {
            data.push(e.map(dataPoints => dataPoints.toJSON()))
        });

        var option = {
            tooltip:{
                trigger: 'item',
                formatter: "{a} <br/>{b}:{c}({d}%)"
            },
            legend:{
                orient: 'vertical',
                x:'left',
                data:data.map((e,idx)=>{return 'Device-'+idx})
            },
            series:[
                {
                    name:'Device Distribution',
                    type:'pie',
                    radius:['50%','70%'],
                    avoidLabelOverlap:false,
                    label:{
                        normal:{
                            show:false,
                            position:'center'
                        },
                        emphasis:{
                            show:true,
                            textStyle:{
                                fontSize:'30',
                                fontWeight:'bold'
                            }
                        }
                    },
                    labelLine:{
                        normal:{
                            show:false
                        }
                    },
                    data: data.map((e,idx)=>{
                        var obj = {};
                        obj.value = e.length;
                        obj.name = 'Device-'+idx;
                        return obj;
                    })
                }
            ]
        };
        return option;
    },
    graph: function(){
        var devices = this.array.toJSON().map(device => (device.toJSON()));
        var data = [];
        devices.forEach(function (e) {
            data.push(e.map(dataPoints => dataPoints.toJSON()))
        });
        var option={
            title:{
                text: 'Graph Chart'
            },
            tooltip: {
                trigger: 'none',
                axisPointer:{
                    type:'cross'
                }
            },
            legend:{
                data: data.map((e,idx)=>{return 'Device-'+idx;})
            },
            grid:{
                left: '3%',
                right: '4%',
                bottom: '3%',
                containLabel:true
            },
            xAxis:{
                type: 'value',
                splitLine: {
                    lineStyle: {
                        type: 'dashed'
                    }
                }
            },
            yAxis:[
                {
                    type:'value'
                }
            ],
            series: data.map((e,idx)=>{
                var obj = {};
                obj.name = 'device-'+idx;
                obj.type = 'line';
                obj.smooth = true;
                obj.data = e;
                return obj;
            })
        };
        return option;
    },
    scatter: function () {
        const color = (idx) => {
            if(idx==0){
                return 'black';
            } else if (idx==1){
                return ' red';
            } else if (idx==2){
                return 'green';
            } else {
                return 'yellow';
            }
        }
        var devices = this.array.toJSON().map(device => (device.toJSON()));
        var data = [];
        devices.forEach(function (e) {
            data.push(e.map(dataPoints => dataPoints.toJSON()))
        });

        var option = {
        title: {
            text: 'Linear Regression',
            subtext: '',
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
        series: data.map((e,idx)=>{
            var obj = {};
            obj.name = 'device-'+idx;
            obj.type = 'scatter';
            obj.label = {
                emphasis:{
                show: true,
                    position: 'left',
                    textStyle:{
                    color: color(idx),
                        fontSize: 16
                    }
                }
            }
            obj.data = e;
            return obj;})
        };
        return option;
    }
};
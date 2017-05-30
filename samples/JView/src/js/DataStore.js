import { autorun, observable, computed} from "mobx"

import React, { PropTypes } from 'react'
import echarts from 'echarts'
import resize from 'element-resize-event'
import Echarts from '../tools/Echarts'


class DataStore {
    @observable dataPoints  = [[1,2],[2,3],[4,3],[3,4],[30,2],[3,4]]
    
    createDataPoint(result){
        console.log(result)
        this.dataPoints.push([parseInt(result[0]),parseInt(result[1])])
    }
}

var store = window.store = new DataStore

export default store

autorun(() => {
    console.log(store.dataPoints)
})
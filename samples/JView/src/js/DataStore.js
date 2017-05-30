import { autorun, observable, computed} from "mobx"

import React, { PropTypes } from 'react'
import echarts from 'echarts'
import resize from 'element-resize-event'
import Echarts from '../tools/Echarts'


class DataStore {
    @observable dataPoints  = [[1,2],[2,3],[4,3]]
    // @computed get filteredTodos() {
    //     var matchesFilter = new RegExp(this.filter, "i")
    //     return this.todos.filter(todo => !this.filter || matchesFilter.test(todo))
    // }
    // createTodo(value){
    //     this.todos.push(new Todo(value))
    // }
}

var store = window.store = new DataStore

export default store

autorun(() => {
    console.log(store.dataPoints)
})
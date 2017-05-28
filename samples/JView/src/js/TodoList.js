import React from "react"
import { observer } from "mobx-react"

@observer
export default class TodoList extends React.Component{
  toggleComplete(todo){
    todo.complete = !todo.complete
  }
  createNew(e) {
    if(e.which === 13){
      this.props.store.createTodo(e.target.value)
      e.target.value = ""
    }
  }
  filter(e) {
    this.props.store.filter = e.target.value
  }

  render(){
    const { todos, filter, filteredTodos } = this.props.store

    const todoLis = filteredTodos.map(todo => (
        <li key={todo.id}>{todo.value}
        <input type="checkbox" value={todo.complete} checked={todo.complete} onChange = {this.toggleComplete.bind(this, todo)}/></li>
    ))
    return <div>
      <h1>todos</h1>
      <input className="create" onKeyPress = {this.createNew.bind(this)} />
      <input classname="filter" value={filter} onChange = {this.filter.bind(this)} />
      <ul>{todoLis}</ul>
      
    </div>
  }

}
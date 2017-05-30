import "../css/main.css"
import React from "react"
import ReactDOM from "react-dom"
import TodoStore from "./TodoStore"
import DataStore from "./DataStore"
import TodoList from "./TodoList"

const app = document.getElementById("app")

ReactDOM.render(<TodoList store={TodoStore} dataStore = {DataStore}/>, app)


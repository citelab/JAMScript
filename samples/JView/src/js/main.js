import "../css/main.css"
import React from "react"
import ReactDOM from "react-dom"
import TodoStore from "./TodoStore"
import DataStore from "./DataStore"
import DataPanel from "./DataPanel"

const app = document.getElementById("app")

ReactDOM.render(<DataPanel store={TodoStore} dataStore = {DataStore}/>, app)


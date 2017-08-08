var React = require('react');
import {Link, NavLink} from 'react-router-dom';
import './Nav.css'

export default class NavBar extends React.Component {

    componentWillMount() {
    }

    componentWillReceiveProps(nextProps) {
    }

    render() {

        const { title, routes, className, ...props } = this.props

        return (
            <ul className = {className ? className : ''}>
                {
                    title ? <li><span>{title}</span></li> : null}
                {
                    routes.map(e=>{
                    return <li>
                    <NavLink exact={e.exact ? true : false} activeClassName = 'active' to={e.route}>
                    {
                        e.dispLabel ? e.dispLabel : 'option'
                    }
                    </NavLink>
                    </li>
                    })
                }
            </ul>
        )
    }
}
import React, { Component } from 'react'
import { subscribeToDrawings } from './api'


export default class DrawingList extends Component {
    constructor(props) {
        super(props)

        //Se inscrevendo para receber as mudanças
        subscribeToDrawings((drawing) => {
            this.setState(prevState => ({
                drawings: prevState.drawings.concat([drawing])
            }))
        })
    }

    state = {
        drawings: [],
    }

    render() {
        const drawings = this.state.drawings.map(drawing => (
            <li
                className="DrawingList-item"
                key={drawing.id}
                onClick={e=> this.props.selectDrawing(drawing)}
            >
                {drawing.name}
            </li>
        ))

        return (
            <ul
                className="DrawingList"
            >
                {drawings}
            </ul>
        )
    }
}

import React, { Component } from 'react'
import { createDrawing } from './api'

export default class DrawingForm extends Component {
    state = {
        drawingName: ""
    }

    handleSubmit = (e) => {
        e.preventDefault()
        createDrawing(this.state.drawingName)
        this.setState({ drawingName: '' })
    }

    render() {
        return (
            <div className="Form">
                <form onSubmit={this.handleSubmit}>
                    <input type="text"
                        value={this.state.drawingName}
                        onChange={e => this.setState({ drawingName: e.target.value })}
                        className="Form-drawingInput"
                    />
                    <button type="submit" className="Form-drawingInput">
                        Create
                </button>
                </form>
            </div>
        )
    }
}

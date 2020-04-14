const r = require('rethinkdb')
const io = require('socket.io')()

function createDrawing({ connection, name }) {
    return r.table('drawings')
        .insert({
            name,
            timestamp: new Date(),
        })
        .run(connection)
        .then(() => console.log('created a new drawing with name ', name))
}

function subscribeToDrawings({ client, connection }) {
    //Escutando mudanças na tabela e disparando o evento para os ouvintes
    r.table('drawings')
        .changes({ include_initial: true })
        .run(connection)
        .then((cursor) => {
            cursor.each((err, drawingRow) => client.emit('drawing', drawingRow.new_val))
        })
}

function handleLinePublish({ connection, line, cb }) {
    r.table('lines')
        .insert(Object.assign(line, { timestamp: new Date() }))
        .run(connection)
        .then(cb)
}

function subscribeToDrawingLines({ client, connection, drawingId, from }) {
    //Buscar as linhas iguais ao id
    let query = r.row('drawingId').eq(drawingId)
    //Apartir do periodo - from
    if (from) {
        query = query.and(r.row('timestamp').ge(new Date(from)))
    }
    return r.table('lines')
        .filter(query) //Filtrando o evento
        .changes({ include_initial: true, include_types: true })
        .run(connection)
        .then((cursor) => {
            //Para emitir o evento somente para o desenho especificio
            cursor.each((err, lineRow) => client.emit(`drawingLine:${drawingId}`, lineRow.new_val))
        })
}


r.connect({
    host: '192.168.99.100',
    port: 32769,
    db: 'awesome_whiteboard'
}).then((connection) => {
    io.on('connection', (client) => {
        client.on('createDrawing', ({ name }) => {
            createDrawing({ connection, name })
        })
        client.on('subscribeToDrawings', () => subscribeToDrawings({ client, connection }))
        client.on('publishLine', (line, cb) => handleLinePublish({ line, connection, cb }))
        client.on('subscribeToDrawingLines', ({ drawingId, from }) => {
            console.log('subscribeToDrawingLines from - ', from)
            subscribeToDrawingLines({ client, connection, drawingId })
        })
    })
})

//WARINING!!!!!!
//SOMENTE para facilitar os testes de desconexão e reconexão
const port = parseInt(process.argv[2], 10) || 8000

io.listen(port)

console.log(`Server running o port ${port}`)

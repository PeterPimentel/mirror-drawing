import openSocket from 'socket.io-client'
//Foi utilizado o Rxjs para otimizar a aplicação
import Rx from 'rxjs/Rx'
//Politica de retry
import createSync from 'rxsync'

/*
    Um desenho de 6400 linhas demorava muito para ser renderizado porque o componente
    era atualizado 6401 vezes(render 1 com as linhas vazias)
    Com o Rxjs ele armazena o stream de mudanças  por 100ms
    e cospe o array reduzindo a quantidade de renders para 1 a cada 100ms
    Logo se chegasse 10 000 linhas em 100ms o componente seria atualizado 2 vezes somente
*/

//WARINING!!!!!!
//SOMENTE para facilitar os testes de desconexão e reconexão
const port = parseInt(window.location.search.replace('?', ''), 10) || 8000
const socket = openSocket(`http://localhost:${port}`)

export function subscribeToDrawings(cb) {
    socket.on('drawing', cb)
    socket.emit('subscribeToDrawings')
}

const sync = createSync({
    maxRetries: 10,
    delayBetweenRetries: 1000, //Tempo de espera entre cada tentativa
    syncAction: line => new Promise((resolve, reject) => {
        let sent = false

        //Terceiro parametro, funçãode callback quando o socket recebe a mensagem
        socket.emit('publishLine', line, () => {
            sent = true
            resolve()
        })

        setTimeout(() => {
            if (!sent) {
                //Quando a promise é rejeitada ele tenta refazer a conexão
                reject()
            }
        }, 2000)
    })
})

sync.failedItems.subscribe(x => console.error('failed line sync: ', x))
sync.syncedItems.subscribe(x => console.log('successful line sync: ', x))

export function publishLine({ drawingId, line }) {
    //Enviando diretamente
    //Sem passar pelo sync queue o espelhamento ocorre muito mais rápido
    // socket.emit('publishLine', { drawingId, ...line })
    
    //Enviando com politica de retry
    sync.queue({ drawingId, ...line })
}

export function createDrawing(name) {
    socket.emit('createDrawing', { name })
}

export function subscribeToDrawingLines(drawingId, cb) {
    //Para evitar conflito entre sockets - drawingLine:${drawingId}
    //Poderia ter sido resolvido usando o conceito de room

    // Ativando o observable para escutar determinada ação
    const lineStream = Rx.Observable.fromEventPattern(
        h => socket.on(`drawingLine:${drawingId}`, h),
        h => socket.off(`drawingLine:${drawingId}`, h)
    )

    const bufferedTimeStream = lineStream
        .bufferTime(100) //Acumulador -  ele vai escutar as ações por 100 mil
        .map(lines => ({ lines })) //depois dispara o arr de resultado

    //Quando se reconectar
    const reconnectStream = Rx.Observable.fromEventPattern(
        h => socket.on('connect', h),
        h => socket.off('connect', h)
    )

    //Filtrando o resultado recebido
    //Ultimo recebido pelo lineStream
    const maxStream = lineStream.map(l => new Date(l.timestamp).getTime()) //coletando a data
        .scan((a, b) => ((a > b) ? a : b), 0) //Funciona como um reducer

    //Reconectando e requisitando somente os dados apartir do horario passado
    reconnectStream
        .withLatestFrom(maxStream)
        .subscribe((joined) => {
            const lastReceivedTimestamp = joined[1] //0 - Evento 1- dados
            socket.emit('subscribeToDrawingLines', { drawingId, from: lastReceivedTimestamp })
        })

    //Disparando o resultado
    bufferedTimeStream.subscribe(linesEvent => cb(linesEvent))

    //Ativa a função do rethinkDb para ficar escutando determinada linha
    socket.emit('subscribeToDrawingLines', { drawingId })
}

export function subscribeToConnectionEvent(cb) {
    socket.on('connect', () => cb({ state: 'connected', port }))
    socket.on('disconnect', () => cb({ state: 'disconnected', port }))
    socket.on('connect_error', () => cb({ state: 'disconnected', port }))
}

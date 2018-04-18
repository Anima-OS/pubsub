import { EventEmitter } from 'fbemitter'

export default class PubSubClient {

  constructor (url, options = {connect: true, reconnect: true}) {

    // status of client connection
    this.emitter = new EventEmitter()
    this._connected = false
    this._ws = null
    this._queue = []
    this._id = null

    this._listeners = []

    // store settings

    this._url = url
    this._options = options

    if (this._options && this._options.connect) {
      // auto connect
      this.connect()
    }

  }

  /**
   * Subscribe client to a topic
   * @param topic
   * @param cb
   */
  subscribe (topic, cb) {

    const listener = this.emitter.addListener(`subscribe_topic_${topic}`, cb)
    // add listener to array
    this._listeners.push(listener)

    // send server with message

    this.send({
      action: 'subscribe',
      payload: {
        topic: topic,
      },
    })
  }

  /**
   * Publish a message to topic, send to everyone and me
   * @param topic
   * @param message
   */
  publish (topic, message) {

    this.send({
      action: 'publish',
      payload: {
        topic: topic,
        message: message,
      },
    })

  }

  /**
   * Publish a message to the topic and send to everyone, not me
   * @param topic
   * @param message
   */
  broadcast (topic, message) {

    this.send({
      action: 'broadcast',
      payload: {
        topic: topic,
        message: message,
      },
    })
  }

  /**
   * Return client conneciton ID
   */
  id () {
    return this._id
  }

  /**
   * Convert string to JSON
   * @param message
   * @returns {*}
   */
  stringToJson (message) {

    try {
      message = JSON.parse(message)
    }
    catch (e) {
      console.log(e)
    }

    return message
  }

  /**
   * Send a message to the server
   * @param message
   */
  send (message) {
    if (this._connected === true) {
      message = JSON.stringify(message)
      this._ws.send(message)
    } else {
      // let keep it in queue
      this._queue.push({
        type: 'message',
        payload: message,
      })
    }

  }

  /**
   * Run Queue after connecting successful
   */
  runQueue () {
    if (this._queue.length) {
      this._queue.forEach((q, index) => {
        switch (q.type) {

          case 'message':
            this.send(q.payload)

            break

          default:

            break
        }

        // remove queue

        delete this._queue[index]

      })
    }
  }

  /**
   * Begin connect to the server
   * @param cb
   */
  connect () {

    const ws = new WebSocket(this._url)
    this._ws = ws

    ws.onopen = () => {

      // change status of connected
      this._connected = true
      console.log('Connected to the server')
      this.send({action: 'me'})
      // run queue
      this.runQueue()

    }
    // listen a message from the server
    ws.onmessage = (message) => {

      const jsonMessage = this.stringToJson(message.data)

      const action = jsonMessage.action
      const payload = jsonMessage.payload

      switch (action) {

        case 'me':

          this._id = payload.id

          break

        case 'publish':

          this.emitter.emit(`subscribe_topic_${payload.topic}`, payload.message)
          // let emit this to subscribers
          break

        default:

          break
      }

    }
    ws.onerror = (err) => {

      console.log('unable connect to the server', err)

      this._connected = false

      //@todo add auto re-connect later

    }
    ws.onclose = () => {

      console.log('Connection is closed')

      this._connected = false

      //@todo add auto re-connect later
    }

  }

  /**
   * Disconnect client
   */
  disconnect () {

    if (this._listeners.length) {
      this._listeners.forEach((listener) => {

        listener.remove()
      })
    }
  }
}

window.onload = () => {

  const pubSub = new PubSubClient('ws://localhost:3001', {
    connect: true,
    reconnect: true,
  })

  const topicName = 'abc'

  pubSub.subscribe(topicName, (message) => {
    console.log(`Got message from topic ${topicName}`, message)
  })

  //publish a message to topic
  pubSub.publish(topicName,
    {title: 'Hello subscribers in the topic abc', body: 'How are you ?'})

  // Broadcast send message to subscribers but not me
  pubSub.broadcast(topicName, {body: 'this is broadcast message'})

  // Make global for console access
  window.ps = pubSub

}
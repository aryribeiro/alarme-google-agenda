// Web Worker para contagem regressiva resiliente a suspensão no mobile
let intervalId = null

self.addEventListener('message', (event) => {
  if (event.data === 'START') {
    if (intervalId) clearInterval(intervalId)
    intervalId = setInterval(() => {
      self.postMessage({ type: 'TICK', time: Date.now() })
    }, 1000)
  } else if (event.data === 'STOP') {
    if (intervalId) {
      clearInterval(intervalId)
      intervalId = null
    }
  }
})

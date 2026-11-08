import { useEffect, useRef, useState } from 'react'

export default function Typewriter({ text, speed = 'normal', instant = false, onComplete }) {
  const [visible, setVisible] = useState(instant ? text : '')
  const [done, setDone] = useState(instant)
  const completeRef = useRef(onComplete)
  const timerRef = useRef(null)
  const doneRef = useRef(instant)

  useEffect(() => {
    completeRef.current = onComplete
  }, [onComplete])

  useEffect(() => {
    if (instant) {
      const timer = window.setTimeout(() => completeRef.current?.(), 0)
      return () => window.clearTimeout(timer)
    }
    const delay = speed === 'fast' ? 12 : speed === 'slow' ? 55 : 28
    let index = 0
    const timer = window.setInterval(() => {
      index += 1
      setVisible(text.slice(0, index))
      if (index >= text.length) {
        window.clearInterval(timer)
        timerRef.current = null
        doneRef.current = true
        setDone(true)
        completeRef.current?.()
      }
    }, delay)
    timerRef.current = timer
    return () => window.clearInterval(timer)
  }, [text, speed, instant])

  const reveal = () => {
    if (!doneRef.current) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
      doneRef.current = true
      setVisible(text)
      setDone(true)
      completeRef.current?.()
    }
  }

  return <span className="typewriter" onClick={reveal}>{visible}{!done && <i className="type-caret" />}</span>
}

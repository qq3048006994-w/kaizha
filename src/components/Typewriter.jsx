import { useEffect, useRef, useState } from 'react'

export default function Typewriter({ text, speed = 'normal', instant = false, onComplete }) {
  const [visible, setVisible] = useState(instant ? text : '')
  const [done, setDone] = useState(instant)
  const completeRef = useRef(onComplete)

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
        setDone(true)
        completeRef.current?.()
      }
    }, delay)
    return () => window.clearInterval(timer)
  }, [text, speed, instant])

  const reveal = () => {
    if (!done) {
      setVisible(text)
      setDone(true)
      completeRef.current?.()
    }
  }

  return <span className="typewriter" onClick={reveal}>{visible}{!done && <i className="type-caret" />}</span>
}

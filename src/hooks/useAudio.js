import { useEffect, useRef } from 'react'

export default function useAudio(settings) {
  const contextRef = useRef(null)
  const ambientRef = useRef(null)

  useEffect(() => {
    if (!settings.music) {
      if (ambientRef.current) {
        ambientRef.current.nodes.forEach((node) => { try { node.stop() } catch {
        // 已停止的振荡器无需处理。
      } })
        ambientRef.current = null
      }
      return
    }
    const AudioContext = window.AudioContext || window.webkitAudioContext
    if (!AudioContext) return
    if (!contextRef.current) contextRef.current = new AudioContext()
    const context = contextRef.current
    context.resume()
    const master = context.createGain()
    master.gain.value = 0.025
    master.connect(context.destination)
    const nodes = [55, 82.41, 110].map((frequency, index) => {
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      oscillator.type = index === 1 ? 'triangle' : 'sine'
      oscillator.frequency.value = frequency
      gain.gain.value = index === 0 ? 0.45 : 0.16
      oscillator.connect(gain)
      gain.connect(master)
      oscillator.start()
      return oscillator
    })
    ambientRef.current = { nodes, master }
    return () => {
      nodes.forEach((node) => { try { node.stop() } catch {
        // 已停止的振荡器无需处理。
      } })
      master.disconnect()
      ambientRef.current = null
    }
  }, [settings.music])

  return (kind = 'paper') => {
    if (!settings.sound) return
    const AudioContext = window.AudioContext || window.webkitAudioContext
    if (!AudioContext) return
    if (!contextRef.current) contextRef.current = new AudioContext()
    const context = contextRef.current
    context.resume()
    const now = context.currentTime
    if (kind === 'gavel') {
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      oscillator.type = 'triangle'
      oscillator.frequency.setValueAtTime(150, now)
      oscillator.frequency.exponentialRampToValueAtTime(45, now + 0.14)
      gain.gain.setValueAtTime(0.24, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2)
      oscillator.connect(gain)
      gain.connect(context.destination)
      oscillator.start(now)
      oscillator.stop(now + 0.21)
    } else {
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      oscillator.type = 'sine'
      oscillator.frequency.value = kind === 'success' ? 520 : 320
      gain.gain.setValueAtTime(0.05, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1)
      oscillator.connect(gain)
      gain.connect(context.destination)
      oscillator.start(now)
      oscillator.stop(now + 0.11)
    }
  }
}

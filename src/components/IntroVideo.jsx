import { useEffect, useRef, useState } from 'react'

// 片头影像：全屏播放，播完自动进入第一堂；右上角可跳过直接断案。
export default function IntroVideo({ onDone, onSkip }) {
  const videoRef = useRef(null)
  const [blocked, setBlocked] = useState(false)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const attempt = video.play()
    if (attempt?.catch) {
      attempt.catch(() => setBlocked(true))
    }
  }, [])

  const finish = () => {
    const video = videoRef.current
    if (video) {
      video.pause()
      video.currentTime = 0
    }
    onDone?.()
  }

  const skip = () => {
    const video = videoRef.current
    if (video) {
      video.pause()
      video.currentTime = 0
    }
    onSkip?.()
  }

  return (
    <div className="intro-video-layer" role="dialog" aria-label="片头影像">
      <video
        ref={videoRef}
        className="intro-video"
        src="/assets/video/intro.mp4"
        autoPlay
        playsInline
        onEnded={finish}
        onCanPlay={() => setBlocked(false)}
      />
      <div className="intro-video-shade" />
      <button className="intro-skip" onClick={skip} aria-label="跳过片头，直接进入第一堂审案">
        <b>跳过片头</b>
        <small>直接断案</small>
      </button>
      <div className="intro-caption">
        <span>开封府 · 秦香莲案</span>
        <p>一纸诉状，四堂审判</p>
      </div>
      {blocked && (
        <div className="intro-play-gate">
          <button onClick={() => {
            videoRef.current?.play().then(() => { setBlocked(false) }).catch(() => {})
          }}>
            <span>▶</span> 点击播放片头
          </button>
          <small>若不想观看，可点击右上角「跳过片头」</small>
        </div>
      )}
    </div>
  )
}

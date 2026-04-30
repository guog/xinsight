/**
 * 流式音频播放器
 * 收到 PCM 音频帧即刻入队播放，支持中断
 */
export class StreamingAudioPlayer {
  private audioContext: AudioContext | null = null
  private queue: AudioBuffer[] = []
  private currentSource: AudioBufferSourceNode | null = null
  private playing = false
  private nextStartTime = 0
  private sampleRate: number

  onPlaybackEnd: (() => void) | null = null

  constructor(sampleRate = 22050) {
    this.sampleRate = sampleRate
  }

  /** 确保 AudioContext 已创建 */
  private ensureContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = new AudioContext({ sampleRate: this.sampleRate })
    }
    return this.audioContext
  }

  /** PCM Int16 转 Float32 */
  private pcmToFloat32(pcmData: ArrayBuffer): Float32Array {
    const int16 = new Int16Array(pcmData)
    const float32 = new Float32Array(int16.length)
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / 32768
    }
    return float32
  }

  /** 入队 PCM 音频数据 (Int16Array or ArrayBuffer) */
  enqueue(pcmData: ArrayBuffer): void {
    const ctx = this.ensureContext()
    const float32 = this.pcmToFloat32(pcmData)
    const audioBuffer = ctx.createBuffer(1, float32.length, this.sampleRate)
    audioBuffer.getChannelData(0).set(float32)
    this.queue.push(audioBuffer)

    if (!this.playing) {
      this.playing = true
      this.nextStartTime = ctx.currentTime
      this.playNext()
    }
  }

  /** 播放队列中下一个 buffer */
  private playNext(): void {
    if (this.queue.length === 0) {
      this.playing = false
      this.currentSource = null
      this.onPlaybackEnd?.()
      return
    }

    const ctx = this.ensureContext()
    const buffer = this.queue.shift()!
    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.connect(ctx.destination)

    source.onended = () => {
      if (this.playing) {
        this.playNext()
      }
    }

    // 确保无缝衔接
    const startTime = Math.max(this.nextStartTime, ctx.currentTime)
    source.start(startTime)
    this.nextStartTime = startTime + buffer.duration
    this.currentSource = source
  }

  /** 停止播放并清空队列 */
  interrupt(): void {
    this.queue = []
    this.playing = false
    if (this.currentSource) {
      try {
        this.currentSource.stop()
      } catch {
        // 忽略已停止的 source
      }
      this.currentSource = null
    }
  }

  /** 当前是否正在播放 */
  get isPlaying(): boolean {
    return this.playing
  }

  /** 释放资源 */
  dispose(): void {
    this.interrupt()
    if (this.audioContext) {
      this.audioContext.close()
      this.audioContext = null
    }
  }
}

import { useState } from 'react'
import { Typography, Card, Button, Input, Space, message, Spin, Alert } from 'antd'
import { RobotOutlined, PlayCircleOutlined, ThunderboltOutlined } from '@ant-design/icons'
import { useAuth } from '../../hooks/useAuth'
import { generateVideo, enhanceVideoPrompt } from '../../services/gemini'

const { Title, Paragraph } = Typography
const { TextArea } = Input

function VideoEditor() {
  const { user } = useAuth()
  const [prompt, setPrompt] = useState('')
  const [enhancedPrompt, setEnhancedPrompt] = useState('')
  const [videoUrl, setVideoUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [enhancing, setEnhancing] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')

  const handleEnhancePrompt = async () => {
    if (!prompt.trim()) {
      message.warning('Please enter a video concept first')
      return
    }

    setEnhancing(true)
    setError('')
    try {
      const enhanced = await enhanceVideoPrompt(prompt)
      setEnhancedPrompt(enhanced)
      message.success('Prompt enhanced!')
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to enhance prompt'
      setError(errorMessage)
      message.error(errorMessage)
    } finally {
      setEnhancing(false)
    }
  }

  const handleGenerateVideo = async () => {
    const finalPrompt = enhancedPrompt || prompt
    if (!finalPrompt.trim()) {
      message.warning('Please enter a video concept first')
      return
    }

    setLoading(true)
    setError('')
    setVideoUrl('')
    setStatus('Starting...')

    try {
      const url = await generateVideo(finalPrompt, setStatus)
      setVideoUrl(url)
      message.success('Video generated successfully!')
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate video'
      setError(errorMessage)
      message.error(errorMessage)
    } finally {
      setLoading(false)
      setStatus('')
    }
  }

  if (!user) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 0' }}>
        <Title level={3}>Video Editor</Title>
        <Paragraph style={{ color: '#999' }}>
          Please sign in to create videos.
        </Paragraph>
      </div>
    )
  }

  return (
    <div>
      <Title level={3}>Video Editor</Title>
      <Paragraph style={{ color: '#666' }}>
        Create short sci-fi videos with AI assistance powered by Google Veo.
      </Paragraph>

      {error && (
        <Alert
          message="Error"
          description={error}
          type="error"
          showIcon
          closable
          onClose={() => setError('')}
          style={{ marginBottom: 16 }}
        />
      )}

      <Card style={{ marginTop: 24 }}>
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <div>
            <label style={{ fontWeight: 500 }}>Video Concept</label>
            <TextArea
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe your video concept... (e.g., 'A cinematic scene of a spaceship entering hyperspace')"
              style={{ marginTop: 8 }}
              disabled={loading}
            />
          </div>

          <Button
            icon={<ThunderboltOutlined />}
            onClick={handleEnhancePrompt}
            loading={enhancing}
            disabled={loading || !prompt.trim()}
          >
            Enhance Prompt with AI
          </Button>

          {enhancedPrompt && (
            <div>
              <label style={{ fontWeight: 500, color: '#6366f1' }}>Enhanced Prompt</label>
              <TextArea
                rows={4}
                value={enhancedPrompt}
                onChange={(e) => setEnhancedPrompt(e.target.value)}
                style={{ marginTop: 8 }}
                disabled={loading}
              />
            </div>
          )}

          <Button
            type="primary"
            icon={<RobotOutlined />}
            onClick={handleGenerateVideo}
            loading={loading}
            disabled={!prompt.trim() && !enhancedPrompt.trim()}
            size="large"
          >
            Generate Video
          </Button>

          {status && (
            <div style={{ textAlign: 'center' }}>
              <Spin /> <span style={{ marginLeft: 8 }}>{status}</span>
            </div>
          )}
        </Space>
      </Card>

      <Card title="Video Preview" style={{ marginTop: 24 }}>
        <div
          style={{
            minHeight: 300,
            background: '#000',
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          {videoUrl ? (
            <video
              src={videoUrl}
              controls
              autoPlay
              loop
              style={{ maxWidth: '100%', maxHeight: 400 }}
            />
          ) : (
            <PlayCircleOutlined style={{ fontSize: 64, color: '#fff', opacity: 0.5 }} />
          )}
        </div>
        {!videoUrl && (
          <Paragraph style={{ color: '#999', marginTop: 16, textAlign: 'center' }}>
            Your generated video will appear here...
          </Paragraph>
        )}
      </Card>
    </div>
  )
}

export default VideoEditor

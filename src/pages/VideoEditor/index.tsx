import { Typography, Card, Button, Input, Space } from 'antd'
import { RobotOutlined, PlayCircleOutlined } from '@ant-design/icons'
import { useAuth } from '../../hooks/useAuth'

const { Title, Paragraph } = Typography
const { TextArea } = Input

function VideoEditor() {
  const { user } = useAuth()

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
        Create short sci-fi videos with AI assistance.
      </Paragraph>

      <Card style={{ marginTop: 24 }}>
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <div>
            <label style={{ fontWeight: 500 }}>Video Concept</label>
            <TextArea
              rows={4}
              placeholder="Describe your video concept... (e.g., 'A cinematic scene of a spaceship entering hyperspace')"
              style={{ marginTop: 8 }}
            />
          </div>
          <Button type="primary" icon={<RobotOutlined />}>
            Generate Video Script
          </Button>
        </Space>
      </Card>

      <Card title="Video Preview" style={{ marginTop: 24 }}>
        <div
          style={{
            height: 300,
            background: '#000',
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <PlayCircleOutlined style={{ fontSize: 64, color: '#fff', opacity: 0.5 }} />
        </div>
        <Paragraph style={{ color: '#999', marginTop: 16, textAlign: 'center' }}>
          Your video preview will appear here...
        </Paragraph>
      </Card>
    </div>
  )
}

export default VideoEditor

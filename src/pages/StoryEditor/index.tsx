import { Typography, Card, Button, Input, Space } from 'antd'
import { RobotOutlined } from '@ant-design/icons'
import { useAuth } from '../../hooks/useAuth'

const { Title, Paragraph } = Typography
const { TextArea } = Input

function StoryEditor() {
  const { user } = useAuth()

  if (!user) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 0' }}>
        <Title level={3}>Story Editor</Title>
        <Paragraph style={{ color: '#999' }}>
          Please sign in to create stories.
        </Paragraph>
      </div>
    )
  }

  return (
    <div>
      <Title level={3}>Story Editor</Title>
      <Paragraph style={{ color: '#666' }}>
        Create your sci-fi story with AI assistance.
      </Paragraph>

      <Card style={{ marginTop: 24 }}>
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <div>
            <label style={{ fontWeight: 500 }}>Story Prompt</label>
            <TextArea
              rows={4}
              placeholder="Describe your sci-fi story idea... (e.g., 'A lone astronaut discovers an ancient alien artifact on Europa')"
              style={{ marginTop: 8 }}
            />
          </div>
          <Button type="primary" icon={<RobotOutlined />}>
            Generate Story with AI
          </Button>
        </Space>
      </Card>

      <Card title="Generated Story" style={{ marginTop: 24 }}>
        <Paragraph style={{ color: '#999' }}>
          Your AI-generated story will appear here...
        </Paragraph>
      </Card>
    </div>
  )
}

export default StoryEditor

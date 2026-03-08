import { useNavigate } from 'react-router-dom'
import { Typography, Button, Empty } from 'antd'
import { PlusOutlined, BookOutlined, VideoCameraOutlined } from '@ant-design/icons'
import { useAuth } from '../../hooks/useAuth'

const { Title, Paragraph } = Typography

function Home() {
  const navigate = useNavigate()
  const { user } = useAuth()

  if (!user) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 0' }}>
        <Title level={2}>Welcome to Sci-Fi Studio</Title>
        <Paragraph style={{ fontSize: 16, color: '#666' }}>
          Create amazing sci-fi storybooks and short videos using GenAI.
        </Paragraph>
        <Paragraph style={{ color: '#999' }}>
          Sign in with Google to get started.
        </Paragraph>
      </div>
    )
  }

  return (
    <div>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={3} style={{ margin: 0 }}>My Projects</Title>
        <div style={{ display: 'flex', gap: 12 }}>
          <Button
            type="primary"
            icon={<BookOutlined />}
            onClick={() => navigate('/story')}
          >
            New Story
          </Button>
          <Button
            icon={<VideoCameraOutlined />}
            onClick={() => navigate('/video')}
          >
            New Video
          </Button>
        </div>
      </div>

      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description="No projects yet"
      >
        <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/story')}>
          Create Your First Story
        </Button>
      </Empty>
    </div>
  )
}

export default Home

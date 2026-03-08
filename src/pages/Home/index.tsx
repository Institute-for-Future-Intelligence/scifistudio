import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Typography, Button, Empty, Card, List, Spin, Popconfirm } from 'antd'
import { PlusOutlined, BookOutlined, VideoCameraOutlined, DeleteOutlined } from '@ant-design/icons'
import { useAuth } from '../../hooks/useAuth'
import { getStorybooks, deleteStorybook, Storybook } from '../../services/firestore'

const { Title, Paragraph } = Typography

function Home() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [storybooks, setStorybooks] = useState<Storybook[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (user) {
      loadStorybooks()
    }
  }, [user])

  const loadStorybooks = async () => {
    if (!user) return
    setLoading(true)
    try {
      const data = await getStorybooks(user.uid)
      setStorybooks(data)
    } catch (err) {
      console.error('Failed to load storybooks:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteStorybook(id)
      setStorybooks((prev) => prev.filter((s) => s.id !== id))
    } catch (err) {
      console.error('Failed to delete:', err)
    }
  }

  const handleOpenStorybook = (id: string) => {
    navigate(`/story/${id}`)
  }

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

      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px 0' }}>
          <Spin size="large" />
        </div>
      ) : storybooks.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="No projects yet"
        >
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/story')}>
            Create Your First Story
          </Button>
        </Empty>
      ) : (
        <List
          grid={{ gutter: 16, xs: 1, sm: 2, md: 3, lg: 4 }}
          dataSource={storybooks}
          renderItem={(storybook) => (
            <List.Item>
              <Card
                hoverable
                onClick={() => handleOpenStorybook(storybook.id!)}
                cover={
                  storybook.frames[0]?.imageUrl ? (
                    <div style={{ height: 150, overflow: 'hidden' }}>
                      <img
                        src={storybook.frames[0].imageUrl}
                        alt={storybook.title}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    </div>
                  ) : (
                    <div
                      style={{
                        height: 150,
                        background: '#f5f5f5',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <BookOutlined style={{ fontSize: 48, color: '#ddd' }} />
                    </div>
                  )
                }
                actions={[
                  <Popconfirm
                    title="Delete this storybook?"
                    onConfirm={(e) => {
                      e?.stopPropagation()
                      handleDelete(storybook.id!)
                    }}
                    onCancel={(e) => e?.stopPropagation()}
                    okText="Delete"
                    cancelText="Cancel"
                  >
                    <DeleteOutlined
                      key="delete"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </Popconfirm>,
                ]}
              >
                <Card.Meta
                  title={storybook.title}
                  description={`${storybook.frames.length} pages • ${storybook.createdAt.toDate().toLocaleDateString()}`}
                />
              </Card>
            </List.Item>
          )}
        />
      )}
    </div>
  )
}

export default Home

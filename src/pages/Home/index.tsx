import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Typography, Button, Empty, Card, List, Spin, Popconfirm, Tag } from 'antd'
import { PlusOutlined, BookOutlined, VideoCameraOutlined, DeleteOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../hooks/useAuth'
import { getStorybooks, deleteStorybook, Storybook } from '../../services/firestore'

const { Title, Paragraph } = Typography

function Home() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { t } = useTranslation()
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
        <Title level={2}>{t('home.title')}</Title>
        <Paragraph style={{ fontSize: 16, color: '#666' }}>
          {t('home.subtitle')}
        </Paragraph>
        <Paragraph style={{ color: '#999' }}>
          {t('home.signInPrompt')}
        </Paragraph>
      </div>
    )
  }

  return (
    <div>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={3} style={{ margin: 0 }}>{t('home.myProjects')}</Title>
        <div style={{ display: 'flex', gap: 12 }}>
          <Button
            type="primary"
            icon={<BookOutlined />}
            onClick={() => navigate('/story')}
          >
            {t('home.newStory')}
          </Button>
          <Button
            icon={<VideoCameraOutlined />}
            onClick={() => navigate('/video')}
          >
            {t('home.newVideo')}
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
          description={t('home.noProjectsYet')}
        >
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/story')}>
            {t('home.createFirstStory')}
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
                    title={t('home.deleteStorybook')}
                    onConfirm={(e) => {
                      e?.stopPropagation()
                      handleDelete(storybook.id!)
                    }}
                    onCancel={(e) => e?.stopPropagation()}
                    okText={t('home.delete')}
                    cancelText={t('home.cancel')}
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
                  description={
                    <div>
                      <div>{storybook.frames.length} {t('home.pages')} • {storybook.createdAt.toDate().toLocaleDateString()}</div>
                      {storybook.tags && storybook.tags.length > 0 && (
                        <div style={{ marginTop: 8, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {storybook.tags.slice(0, 3).map(tag => (
                            <Tag key={tag} color="blue" style={{ margin: 0, fontSize: 11 }}>{tag}</Tag>
                          ))}
                          {storybook.tags.length > 3 && (
                            <Tag style={{ margin: 0, fontSize: 11 }}>+{storybook.tags.length - 3}</Tag>
                          )}
                        </div>
                      )}
                    </div>
                  }
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

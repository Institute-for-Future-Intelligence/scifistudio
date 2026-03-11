/*
 * Copyright 2026 Institute for Future Intelligence, Inc.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Typography, Button, Empty, Card, List, Spin, Popconfirm, Tag, Tabs, Select, Rate, Input } from 'antd'
import { PlusOutlined, BookOutlined, VideoCameraOutlined, DeleteOutlined, PlayCircleOutlined, EyeOutlined, SearchOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../hooks/useAuth'
import { getStorybooks, deleteStorybook, Storybook, getVideos, deleteVideo, Video, getPublicStorybooks, getPublicVideos } from '../../services/firestore'

const { Title, Paragraph } = Typography

function Home() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { t } = useTranslation()
  const [storybooks, setStorybooks] = useState<Storybook[]>([])
  const [videos, setVideos] = useState<Video[]>([])
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('all')
  const [sortBy, setSortBy] = useState<'updatedAt' | 'createdAt' | 'averageRating'>('updatedAt')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    if (user) {
      loadProjects()
    } else {
      loadPublicProjects()
    }
  }, [user])

  const loadProjects = async () => {
    if (!user) return
    setLoading(true)
    try {
      const [storybooksData, videosData] = await Promise.all([
        getStorybooks(user.uid),
        getVideos(user.uid)
      ])
      setStorybooks(storybooksData)
      setVideos(videosData)
    } catch (err) {
      console.error('Failed to load projects:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadPublicProjects = async () => {
    setLoading(true)
    try {
      const [storybooksData, videosData] = await Promise.all([
        getPublicStorybooks(5),
        getPublicVideos(5)
      ])
      setStorybooks(storybooksData)
      setVideos(videosData)
    } catch (err) {
      console.error('Failed to load public projects:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteStorybook = async (id: string) => {
    try {
      await deleteStorybook(id)
      setStorybooks((prev) => prev.filter((s) => s.id !== id))
    } catch (err) {
      console.error('Failed to delete storybook:', err)
    }
  }

  const handleDeleteVideo = async (id: string) => {
    try {
      await deleteVideo(id)
      setVideos((prev) => prev.filter((v) => v.id !== id))
    } catch (err) {
      console.error('Failed to delete video:', err)
    }
  }

  const handleOpenStorybook = (id: string) => {
    navigate(`/story/${id}`)
  }

  const handleOpenVideo = (id: string) => {
    navigate(`/video?id=${id}`)
  }

  const renderStorybookCard = (storybook: Storybook) => (
    <List.Item key={storybook.id}>
      <Card
        hoverable
        onClick={() => handleOpenStorybook(storybook.id!)}
        cover={
          storybook.frames[0]?.imageUrl ? (
            <div style={{ height: 150, overflow: 'hidden', position: 'relative' }}>
              <img
                src={storybook.frames[0].imageUrl}
                alt={storybook.title}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
              <BookOutlined style={{ position: 'absolute', top: 8, left: 8, fontSize: 16, color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }} />
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
          <EyeOutlined
            key="view"
            onClick={(e) => {
              e.stopPropagation()
              window.open(`${import.meta.env.BASE_URL}view/${storybook.id}`, '_blank')
            }}
          />,
          <Popconfirm
            title={t('home.deleteStorybook')}
            onConfirm={(e) => {
              e?.stopPropagation()
              handleDeleteStorybook(storybook.id!)
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
              <div>
                {storybook.frames.length} {t('home.pages')} • {
                  storybook.updatedAt.toMillis() === storybook.createdAt.toMillis()
                    ? `${t('home.created')} ${storybook.createdAt.toDate().toLocaleDateString()}`
                    : `${t('home.updated')} ${storybook.updatedAt.toDate().toLocaleDateString()}`
                }
              </div>
              <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                <Rate disabled value={storybook.averageRating || 0} allowHalf style={{ fontSize: 12 }} />
                {storybook.averageRating != null && storybook.averageRating > 0 && (
                  <span style={{ fontSize: 11, color: '#999' }}>{storybook.averageRating.toFixed(1)} ({storybook.ratingCount})</span>
                )}
              </div>
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
  )

  const renderVideoCard = (video: Video) => (
    <List.Item key={video.id}>
      <Card
        hoverable
        onClick={() => handleOpenVideo(video.id!)}
        cover={
          video.thumbnailUrl || video.videoUrl ? (
            <div style={{ height: 150, overflow: 'hidden', position: 'relative' }}>
              <img
                src={video.thumbnailUrl || video.videoUrl}
                alt={video.title}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
              <PlayCircleOutlined style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontSize: 40, color: '#fff', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }} />
              <VideoCameraOutlined style={{ position: 'absolute', top: 8, left: 8, fontSize: 16, color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }} />
            </div>
          ) : (
            <div
              style={{
                height: 150,
                background: '#f0f5ff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <VideoCameraOutlined style={{ fontSize: 48, color: '#d6e4ff' }} />
            </div>
          )
        }
        actions={[
          <EyeOutlined
            key="view"
            onClick={(e) => {
              e.stopPropagation()
              window.open(`${import.meta.env.BASE_URL}watch/${video.id}`, '_blank')
            }}
          />,
          <Popconfirm
            title={t('home.deleteVideo')}
            onConfirm={(e) => {
              e?.stopPropagation()
              handleDeleteVideo(video.id!)
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
          title={video.title}
          description={
            <div>
              <div>
                {video.durationSeconds}s • {
                  video.updatedAt.toMillis() === video.createdAt.toMillis()
                    ? `${t('home.created')} ${video.createdAt.toDate().toLocaleDateString()}`
                    : `${t('home.updated')} ${video.updatedAt.toDate().toLocaleDateString()}`
                }
              </div>
              <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                <Rate disabled value={video.averageRating || 0} allowHalf style={{ fontSize: 12 }} />
                {video.averageRating != null && video.averageRating > 0 && (
                  <span style={{ fontSize: 11, color: '#999' }}>{video.averageRating.toFixed(1)} ({video.ratingCount})</span>
                )}
              </div>
              {video.tags && video.tags.length > 0 && (
                <div style={{ marginTop: 8, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {video.tags.slice(0, 3).map(tag => (
                    <Tag key={tag} color="purple" style={{ margin: 0, fontSize: 11 }}>{tag}</Tag>
                  ))}
                  {video.tags.length > 3 && (
                    <Tag style={{ margin: 0, fontSize: 11 }}>+{video.tags.length - 3}</Tag>
                  )}
                </div>
              )}
            </div>
          }
        />
      </Card>
    </List.Item>
  )

  const renderStorybooks = () => {
    if (storybooks.length === 0) {
      return (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={t('home.noProjectsYet')}
        >
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/story')}>
            {t('home.createFirstStory')}
          </Button>
        </Empty>
      )
    }
    return (
      <List
        grid={{ gutter: 16, xs: 1, sm: 2, md: 3, lg: 4 }}
        dataSource={sortedStorybooks}
        renderItem={renderStorybookCard}
      />
    )
  }

  const renderVideos = () => {
    if (videos.length === 0) {
      return (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={t('home.noProjectsYet')}
        >
          <Button icon={<VideoCameraOutlined />} onClick={() => navigate('/video')}>
            {t('home.newVideo')}
          </Button>
        </Empty>
      )
    }
    return (
      <List
        grid={{ gutter: 16, xs: 1, sm: 2, md: 3, lg: 4 }}
        dataSource={sortedVideos}
        renderItem={renderVideoCard}
      />
    )
  }

  const sortItems = <T extends { updatedAt: { toDate: () => Date }; createdAt: { toDate: () => Date }; averageRating?: number }>(items: T[]) => {
    if (sortBy === 'averageRating') {
      return [...items].sort((a, b) => (b.averageRating || 0) - (a.averageRating || 0))
    }
    return [...items].sort((a, b) => b[sortBy].toDate().getTime() - a[sortBy].toDate().getTime())
  }

  const filterBySearch = <T extends { title: string; prompt: string; tags?: string[] }>(items: T[]): T[] => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return items
    const keywords = q.split(/\s+/)
    return items.filter(item => {
      const text = `${item.title} ${item.prompt} ${(item.tags || []).join(' ')}`.toLowerCase()
      return keywords.every(kw => text.includes(kw))
    })
  }

  const sortedStorybooks = sortItems(filterBySearch(storybooks))
  const sortedVideos = sortItems(filterBySearch(videos))

  const renderAllProjects = () => {
    const allProjects = [
      ...sortedStorybooks.map(s => ({ type: 'storybook' as const, item: s, sortVal: sortBy === 'averageRating' ? (s.averageRating || 0) : s[sortBy].toDate().getTime() })),
      ...sortedVideos.map(v => ({ type: 'video' as const, item: v, sortVal: sortBy === 'averageRating' ? (v.averageRating || 0) : v[sortBy].toDate().getTime() }))
    ].sort((a, b) => b.sortVal - a.sortVal)

    return (
      <List
        grid={{ gutter: 16, xs: 1, sm: 2, md: 3, lg: 4 }}
        dataSource={allProjects}
        renderItem={(project) =>
          project.type === 'storybook'
            ? renderStorybookCard(project.item as Storybook)
            : renderVideoCard(project.item as Video)
        }
      />
    )
  }

  if (!user) {
    return (
      <div>
        <div style={{ textAlign: 'center', padding: '48px 0 24px' }}>
          <Title level={2}>{t('home.title')}</Title>
          <Paragraph style={{ fontSize: 16, color: '#666' }}>
            {t('home.subtitle')}
          </Paragraph>
          <Paragraph style={{ color: '#999' }}>
            {t('home.signInPrompt')}
          </Paragraph>
        </div>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <Spin size="large" />
          </div>
        ) : (storybooks.length > 0 || videos.length > 0) && (
          <div>
            {storybooks.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <Title level={4}>{t('home.tabStories')}</Title>
                <List
                  grid={{ gutter: 16, xs: 1, sm: 2, md: 3, lg: 5 }}
                  dataSource={storybooks}
                  renderItem={(storybook) => (
                    <List.Item key={storybook.id}>
                      <Card
                        hoverable
                        onClick={() => window.open(`${import.meta.env.BASE_URL}view/${storybook.id}`, '_blank')}
                        cover={
                          storybook.frames[0]?.imageUrl ? (
                            <div style={{ height: 150, overflow: 'hidden', position: 'relative' }}>
                              <img src={storybook.frames[0].imageUrl} alt={storybook.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              <BookOutlined style={{ position: 'absolute', top: 8, left: 8, fontSize: 16, color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }} />
                            </div>
                          ) : (
                            <div style={{ height: 150, background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <BookOutlined style={{ fontSize: 48, color: '#ddd' }} />
                            </div>
                          )
                        }
                      >
                        <Card.Meta
                          title={storybook.title}
                          description={
                            <div>
                              <div>{storybook.authorName}</div>
                              <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                                <Rate disabled value={storybook.averageRating || 0} allowHalf style={{ fontSize: 12 }} />
                                {storybook.averageRating != null && storybook.averageRating > 0 && (
                                  <span style={{ fontSize: 11, color: '#999' }}>{storybook.averageRating.toFixed(1)}</span>
                                )}
                              </div>
                            </div>
                          }
                        />
                      </Card>
                    </List.Item>
                  )}
                />
              </div>
            )}
            {videos.length > 0 && (
              <div>
                <Title level={4}>{t('home.tabVideos')}</Title>
                <List
                  grid={{ gutter: 16, xs: 1, sm: 2, md: 3, lg: 5 }}
                  dataSource={videos}
                  renderItem={(video) => (
                    <List.Item key={video.id}>
                      <Card
                        hoverable
                        onClick={() => window.open(`${import.meta.env.BASE_URL}watch/${video.id}`, '_blank')}
                        cover={
                          video.thumbnailUrl || video.videoUrl ? (
                            <div style={{ height: 150, overflow: 'hidden', position: 'relative' }}>
                              <img src={video.thumbnailUrl || video.videoUrl} alt={video.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              <PlayCircleOutlined style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontSize: 40, color: '#fff', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }} />
                            </div>
                          ) : (
                            <div style={{ height: 150, background: '#f0f5ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <VideoCameraOutlined style={{ fontSize: 48, color: '#d6e4ff' }} />
                            </div>
                          )
                        }
                      >
                        <Card.Meta
                          title={video.title}
                          description={
                            <div>
                              <div>{video.authorName}</div>
                              <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                                <Rate disabled value={video.averageRating || 0} allowHalf style={{ fontSize: 12 }} />
                                {video.averageRating != null && video.averageRating > 0 && (
                                  <span style={{ fontSize: 11, color: '#999' }}>{video.averageRating.toFixed(1)}</span>
                                )}
                              </div>
                            </div>
                          }
                        />
                      </Card>
                    </List.Item>
                  )}
                />
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Title level={3} style={{ margin: 0 }}>{t('home.myProjects')}</Title>
          <Input
            placeholder={t('home.searchPlaceholder')}
            prefix={<SearchOutlined style={{ color: '#bbb' }} />}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            allowClear
            style={{ width: 240 }}
          />
          <Select
            value={sortBy}
            onChange={setSortBy}
            style={{ width: 180 }}
            options={[
              { value: 'updatedAt', label: t('home.sortByUpdated') },
              { value: 'createdAt', label: t('home.sortByCreated') },
              { value: 'averageRating', label: t('home.sortByRating') },
            ]}
          />
        </div>
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
      ) : storybooks.length === 0 && videos.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={t('home.noProjectsYet')}
        >
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/story')}>
            {t('home.createFirstStory')}
          </Button>
        </Empty>
      ) : (
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'all',
              label: `${t('home.tabAll')} (${storybooks.length + videos.length})`,
              children: renderAllProjects()
            },
            {
              key: 'stories',
              label: `${t('home.tabStories')} (${storybooks.length})`,
              children: renderStorybooks()
            },
            {
              key: 'videos',
              label: `${t('home.tabVideos')} (${videos.length})`,
              children: renderVideos()
            }
          ]}
        />
      )}
    </div>
  )
}

export default Home

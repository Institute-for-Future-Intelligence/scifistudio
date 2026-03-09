import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Typography, Card, Button, Spin, Image, Rate, message, Space, Tag } from 'antd'
import { LeftOutlined, RightOutlined, BookOutlined, HomeOutlined, UserOutlined, ShareAltOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import { getStorybook, rateStorybook, Storybook } from '../../services/firestore'
import { StoryFrame } from '../../services/gemini'
import LanguageSelector from '../../components/common/LanguageSelector'

const { Title, Paragraph, Text } = Typography

function StorybookView() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [storybook, setStorybook] = useState<Storybook | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(0)
  const [error, setError] = useState('')
  const [userRating, setUserRating] = useState(0)
  const [submittingRating, setSubmittingRating] = useState(false)

  // Generate a unique viewer ID for anonymous rating
  const getViewerId = () => {
    let viewerId = localStorage.getItem('viewer-id')
    if (!viewerId) {
      viewerId = 'viewer-' + Math.random().toString(36).substring(2, 15)
      localStorage.setItem('viewer-id', viewerId)
    }
    return viewerId
  }

  useEffect(() => {
    if (id) {
      loadStorybook(id)
    }
  }, [id])

  const loadStorybook = async (storybookId: string) => {
    setLoading(true)
    try {
      const data = await getStorybook(storybookId)
      if (data) {
        setStorybook(data)
        // Check if user already rated
        const viewerId = getViewerId()
        const existingRating = data.ratings?.find(r => r.oderId === viewerId)
        if (existingRating) {
          setUserRating(existingRating.rating)
        }
      } else {
        setError(t('storybookView.notFound'))
      }
    } catch (err) {
      console.error('Failed to load storybook:', err)
      setError(t('storyEditor.failedToLoad'))
    } finally {
      setLoading(false)
    }
  }

  const handleRating = async (value: number) => {
    if (!id || submittingRating) return

    setSubmittingRating(true)
    try {
      const viewerId = getViewerId()
      const result = await rateStorybook(id, viewerId, value)
      setUserRating(value)
      setStorybook(prev => prev ? {
        ...prev,
        averageRating: result.averageRating,
        ratingCount: result.ratingCount,
      } : null)
      message.success(t('storybookView.thankYouForRating'))
    } catch (err) {
      console.error('Failed to submit rating:', err)
      message.error(t('storybookView.failedToSubmitRating'))
    } finally {
      setSubmittingRating(false)
    }
  }

  const handlePrevPage = () => {
    setCurrentPage((prev) => Math.max(0, prev - 1))
  }

  const handleNextPage = () => {
    if (storybook) {
      setCurrentPage((prev) => Math.min(storybook.frames.length - 1, prev + 1))
    }
  }

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f5f5f5'
      }}>
        <Spin size="large" />
      </div>
    )
  }

  if (error || !storybook) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f5f5f5',
        padding: 24
      }}>
        <BookOutlined style={{ fontSize: 64, color: '#ddd', marginBottom: 24 }} />
        <Title level={3}>{error || t('storybookView.notFound')}</Title>
        <Button type="primary" icon={<HomeOutlined />} onClick={() => navigate('/')}>
          {t('common.home')}
        </Button>
      </div>
    )
  }

  const frames: StoryFrame[] = storybook.frames

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', padding: 24 }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <Title level={2} style={{ margin: 0 }}>{storybook.title}</Title>
            <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 16 }}>
              <Text type="secondary">
                <UserOutlined style={{ marginRight: 4 }} />
                {storybook.authorName || t('storybookView.unknownAuthor')}
              </Text>
              {storybook.ratingCount && storybook.ratingCount > 0 && (
                <Text type="secondary">
                  <Rate disabled value={storybook.averageRating} allowHalf style={{ fontSize: 14 }} />
                  <span style={{ marginLeft: 8 }}>
                    {storybook.averageRating?.toFixed(1)} ({storybook.ratingCount} {storybook.ratingCount === 1 ? t('storybookView.rating') : t('storybookView.ratings')})
                  </span>
                </Text>
              )}
            </div>
            {storybook.tags && storybook.tags.length > 0 && (
              <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {storybook.tags.map(tag => (
                  <Tag key={tag} color="blue">{tag}</Tag>
                ))}
              </div>
            )}
          </div>
          <Space>
            <LanguageSelector />
            <Button
              icon={<ShareAltOutlined />}
              onClick={() => {
                const shareUrl = window.location.href
                navigator.clipboard.writeText(shareUrl)
                message.success(t('storybookView.shareLinkCopied'))
              }}
            >
              {t('storybookView.share')}
            </Button>
            <Button icon={<HomeOutlined />} onClick={() => navigate('/')}>
              {t('common.home')}
            </Button>
          </Space>
        </div>

        <Card>
          {frames.length > 0 ? (
            <div>
              <div
                style={{
                  display: 'flex',
                  gap: 24,
                  alignItems: 'flex-start',
                  minHeight: 400,
                }}
              >
                <div
                  style={{
                    flex: 1,
                    background: '#f5f5f5',
                    borderRadius: 8,
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: 350,
                  }}
                >
                  {frames[currentPage]?.imageUrl ? (
                    <Image
                      src={frames[currentPage].imageUrl}
                      alt={`Page ${currentPage + 1}`}
                      style={{ maxWidth: '100%', maxHeight: 400 }}
                      preview={true}
                    />
                  ) : (
                    <div style={{ color: '#999', padding: 24, textAlign: 'center' }}>
                      <BookOutlined style={{ fontSize: 48, marginBottom: 16 }} />
                      <div>{t('storybookView.noImageAvailable')}</div>
                    </div>
                  )}
                </div>

                <div
                  style={{
                    flex: 1,
                    padding: 24,
                    background: '#fafafa',
                    borderRadius: 8,
                    minHeight: 350,
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  <div
                    style={{
                      fontSize: 14,
                      color: '#6366f1',
                      fontWeight: 600,
                      marginBottom: 16,
                    }}
                  >
                    {t('storyEditor.page')} {currentPage + 1} {t('storyEditor.of')} {frames.length}
                  </div>
                  <Paragraph
                    style={{
                      fontSize: 18,
                      lineHeight: 1.8,
                      flex: 1,
                    }}
                  >
                    {frames[currentPage]?.caption}
                  </Paragraph>
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: 24,
                  marginTop: 24,
                }}
              >
                <Button
                  icon={<LeftOutlined />}
                  onClick={handlePrevPage}
                  disabled={currentPage === 0}
                >
                  {t('storyEditor.previous')}
                </Button>
                <span style={{ color: '#666' }}>
                  {currentPage + 1} / {frames.length}
                </span>
                <Button
                  icon={<RightOutlined />}
                  onClick={handleNextPage}
                  disabled={currentPage === frames.length - 1}
                >
                  {t('storyEditor.next')}
                </Button>
              </div>

              <div
                style={{
                  marginTop: 24,
                  display: 'flex',
                  gap: 8,
                  overflowX: 'auto',
                  padding: '8px 0',
                }}
              >
                {frames.map((frame, index) => (
                  <div
                    key={index}
                    onClick={() => setCurrentPage(index)}
                    style={{
                      cursor: 'pointer',
                      border: currentPage === index ? '3px solid #6366f1' : '3px solid transparent',
                      borderRadius: 8,
                      overflow: 'hidden',
                      flexShrink: 0,
                      position: 'relative',
                    }}
                  >
                    {frame.imageUrl ? (
                      <img
                        src={frame.imageUrl}
                        alt={`Thumbnail ${index + 1}`}
                        style={{ width: 80, height: 60, objectFit: 'cover' }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 80,
                          height: 60,
                          background: '#eee',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#999',
                          fontSize: 12,
                        }}
                      >
                        {t('storyEditor.noImage')}
                      </div>
                    )}
                    <div
                      style={{
                        position: 'absolute',
                        bottom: 2,
                        right: 4,
                        background: 'rgba(0,0,0,0.6)',
                        color: '#fff',
                        fontSize: 10,
                        padding: '1px 4px',
                        borderRadius: 4,
                      }}
                    >
                      {index + 1}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '48px 0' }}>
              <BookOutlined style={{ fontSize: 64, color: '#ddd', marginBottom: 16 }} />
              <Paragraph style={{ color: '#999' }}>
                {t('storybookView.noPages')}
              </Paragraph>
            </div>
          )}
        </Card>

        {/* Rating Section */}
        <Card style={{ marginTop: 24 }}>
          <div style={{ textAlign: 'center' }}>
            <Title level={4} style={{ marginBottom: 16 }}>{t('storybookView.rateStorybook')}</Title>
            <Rate
              value={userRating}
              onChange={handleRating}
              disabled={submittingRating}
              style={{ fontSize: 32 }}
            />
            {userRating > 0 && (
              <Paragraph style={{ marginTop: 8, color: '#666' }}>
                {t('storybookView.youRated', { count: userRating })}
              </Paragraph>
            )}
          </div>
        </Card>

        <div style={{ textAlign: 'center', marginTop: 24, color: '#999', fontSize: 12 }}>
          &copy; {new Date().getFullYear()} {t('app.copyright')}
        </div>
      </div>
    </div>
  )
}

export default StorybookView

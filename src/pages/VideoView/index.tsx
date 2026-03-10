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
import { useParams, useNavigate } from 'react-router-dom'
import { Typography, Card, Button, Spin, Rate, message, Space, Tag } from 'antd'
import { PlayCircleOutlined, HomeOutlined, UserOutlined, ShareAltOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import { getVideo, rateVideo, Video } from '../../services/firestore'
import LanguageSelector from '../../components/common/LanguageSelector'

const { Title, Paragraph, Text } = Typography

function VideoView() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [video, setVideo] = useState<Video | null>(null)
  const [loading, setLoading] = useState(true)
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
      loadVideo(id)
    }
  }, [id])

  const loadVideo = async (videoId: string) => {
    setLoading(true)
    try {
      const data = await getVideo(videoId)
      if (data) {
        setVideo(data)
        // Check if user already rated
        const viewerId = getViewerId()
        const existingRating = data.ratings?.find(r => r.oderId === viewerId)
        if (existingRating) {
          setUserRating(existingRating.rating)
        }
      } else {
        setError(t('videoView.notFound'))
      }
    } catch (err) {
      console.error('Failed to load video:', err)
      setError(t('videoEditor.failedToLoad'))
    } finally {
      setLoading(false)
    }
  }

  const handleRating = async (value: number) => {
    if (!id || submittingRating) return

    setSubmittingRating(true)
    try {
      const viewerId = getViewerId()
      const result = await rateVideo(id, viewerId, value)
      setUserRating(value)
      setVideo(prev => prev ? {
        ...prev,
        averageRating: result.averageRating,
        ratingCount: result.ratingCount,
      } : null)
      message.success(t('videoView.thankYouForRating'))
    } catch (err) {
      console.error('Failed to submit rating:', err)
      message.error(t('videoView.failedToSubmitRating'))
    } finally {
      setSubmittingRating(false)
    }
  }

  const handleShare = () => {
    const shareUrl = window.location.href
    navigator.clipboard.writeText(shareUrl)
    message.success(t('videoView.shareLinkCopied'))
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

  if (error || !video) {
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
        <PlayCircleOutlined style={{ fontSize: 64, color: '#ddd', marginBottom: 24 }} />
        <Title level={3}>{error || t('videoView.notFound')}</Title>
        <Button type="primary" icon={<HomeOutlined />} onClick={() => navigate('/')}>
          {t('common.home')}
        </Button>
      </div>
    )
  }

  // Check if it's an image (fallback from video generation)
  const isImage = video.videoUrl?.startsWith('data:image/') || video.videoUrl?.includes('.png')

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', padding: 24 }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <Title level={2} style={{ margin: 0 }}>{video.title}</Title>
            <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 16 }}>
              <Text type="secondary">
                <UserOutlined style={{ marginRight: 4 }} />
                {video.authorName || t('videoView.unknownAuthor')}
              </Text>
              {video.ratingCount && video.ratingCount > 0 && (
                <Text type="secondary">
                  <Rate disabled value={video.averageRating} allowHalf style={{ fontSize: 14 }} />
                  <span style={{ marginLeft: 8 }}>
                    {video.averageRating?.toFixed(1)} ({video.ratingCount} {video.ratingCount === 1 ? t('videoView.rating') : t('videoView.ratings')})
                  </span>
                </Text>
              )}
            </div>
            {video.tags && video.tags.length > 0 && (
              <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {video.tags.map(tag => (
                  <Tag key={tag} color="blue">{tag}</Tag>
                ))}
              </div>
            )}
            {video.createdAt && (
              <div style={{ marginTop: 8 }}>
                <Text type="secondary" style={{ fontSize: 13 }}>
                  {t('home.created')}: {video.createdAt.toDate().toLocaleString()}
                  {video.updatedAt && video.updatedAt.toMillis() !== video.createdAt.toMillis() && (
                    <span style={{ marginLeft: 16 }}>
                      {t('home.updated')}: {video.updatedAt.toDate().toLocaleString()}
                    </span>
                  )}
                </Text>
              </div>
            )}
          </div>
          <Space>
            <LanguageSelector />
            <Button
              icon={<ShareAltOutlined />}
              onClick={handleShare}
            >
              {t('videoView.share')}
            </Button>
            <Button icon={<HomeOutlined />} onClick={() => navigate('/')}>
              {t('common.home')}
            </Button>
          </Space>
        </div>

        <Card>
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: 400,
            background: '#000',
            borderRadius: 8,
          }}>
            {video.videoUrl ? (
              isImage ? (
                <img
                  src={video.videoUrl}
                  alt={video.title}
                  style={{
                    maxWidth: '100%',
                    maxHeight: 500,
                    borderRadius: 8,
                  }}
                />
              ) : (
                <video
                  src={video.videoUrl}
                  controls
                  autoPlay
                  loop
                  style={{
                    maxWidth: '100%',
                    maxHeight: 500,
                    borderRadius: 8,
                  }}
                />
              )
            ) : (
              <div style={{ color: '#999', textAlign: 'center' }}>
                <PlayCircleOutlined style={{ fontSize: 64, marginBottom: 16 }} />
                <div>{t('videoView.noVideoAvailable')}</div>
              </div>
            )}
          </div>

          {video.prompt && (
            <div style={{ marginTop: 16, padding: 16, background: '#fafafa', borderRadius: 8 }}>
              <Text strong>{t('videoView.concept')}</Text>
              <Paragraph style={{ margin: '8px 0 0 0' }}>{video.prompt}</Paragraph>
            </div>
          )}
        </Card>

        {/* Rating Section */}
        <Card style={{ marginTop: 24 }}>
          <div style={{ textAlign: 'center' }}>
            <Title level={4} style={{ marginBottom: 16 }}>{t('videoView.rateVideo')}</Title>
            <Rate
              value={userRating}
              onChange={handleRating}
              disabled={submittingRating}
              style={{ fontSize: 32 }}
            />
            {userRating > 0 && (
              <Paragraph style={{ marginTop: 8, color: '#666' }}>
                {t('videoView.youRated', { count: userRating })}
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

export default VideoView

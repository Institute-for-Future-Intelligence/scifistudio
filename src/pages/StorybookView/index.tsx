import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Typography, Card, Button, Spin, Image } from 'antd'
import { LeftOutlined, RightOutlined, BookOutlined, HomeOutlined } from '@ant-design/icons'
import { getStorybook, Storybook } from '../../services/firestore'
import { StoryFrame } from '../../services/gemini'

const { Title, Paragraph } = Typography

function StorybookView() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [storybook, setStorybook] = useState<Storybook | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(0)
  const [error, setError] = useState('')

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
      } else {
        setError('Storybook not found')
      }
    } catch (err) {
      console.error('Failed to load storybook:', err)
      setError('Failed to load storybook')
    } finally {
      setLoading(false)
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
        <Title level={3}>{error || 'Storybook not found'}</Title>
        <Button type="primary" icon={<HomeOutlined />} onClick={() => navigate('/')}>
          Go Home
        </Button>
      </div>
    )
  }

  const frames: StoryFrame[] = storybook.frames

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', padding: 24 }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <Title level={2} style={{ margin: 0 }}>{storybook.title}</Title>
          <Button icon={<HomeOutlined />} onClick={() => navigate('/')}>
            Home
          </Button>
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
                      <div>No image available</div>
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
                    Page {currentPage + 1} of {frames.length}
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
                  Previous
                </Button>
                <span style={{ color: '#666' }}>
                  {currentPage + 1} / {frames.length}
                </span>
                <Button
                  icon={<RightOutlined />}
                  onClick={handleNextPage}
                  disabled={currentPage === frames.length - 1}
                >
                  Next
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
                        No image
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
                This storybook has no pages.
              </Paragraph>
            </div>
          )}
        </Card>

        <div style={{ textAlign: 'center', marginTop: 24, color: '#999', fontSize: 12 }}>
          &copy; {new Date().getFullYear()} Institute for Future Intelligence, Inc. All rights reserved.
        </div>
      </div>
    </div>
  )
}

export default StorybookView

import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Typography, Card, Button, Input, Space, message, Spin, Alert, Image, Modal, List } from 'antd'
import { RobotOutlined, ThunderboltOutlined, LeftOutlined, RightOutlined, BookOutlined, SaveOutlined, FolderOpenOutlined, DeleteOutlined, HomeOutlined, PlusOutlined } from '@ant-design/icons'
import { useAuth } from '../../hooks/useAuth'
import { generateStorybook, enhanceStoryPrompt, StoryFrame } from '../../services/gemini'
import { createStorybook, getStorybooks, getStorybook, updateStorybook, deleteStorybook, Storybook } from '../../services/firestore'

const { Title, Paragraph } = Typography
const { TextArea } = Input

function StoryEditor() {
  const { id } = useParams<{ id?: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [storybookId, setStorybookId] = useState<string | null>(null)
  const [prompt, setPrompt] = useState('')
  const [enhancedPrompt, setEnhancedPrompt] = useState('')
  const [storyTitle, setStoryTitle] = useState('')
  const [frames, setFrames] = useState<StoryFrame[]>([])
  const [currentPage, setCurrentPage] = useState(0)
  const [loading, setLoading] = useState(false)
  const [loadingStorybook, setLoadingStorybook] = useState(false)
  const [enhancing, setEnhancing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [savedStorybooks, setSavedStorybooks] = useState<Storybook[]>([])
  const [showLoadModal, setShowLoadModal] = useState(false)
  const [loadingStorybooks, setLoadingStorybooks] = useState(false)

  useEffect(() => {
    if (user) {
      loadSavedStorybooks()
    }
  }, [user])

  useEffect(() => {
    if (id && user) {
      loadStorybookById(id)
    }
  }, [id, user])

  const loadStorybookById = async (storybookId: string) => {
    setLoadingStorybook(true)
    try {
      const storybook = await getStorybook(storybookId)
      if (storybook) {
        setStorybookId(storybook.id!)
        setPrompt(storybook.prompt)
        setStoryTitle(storybook.title)
        setFrames(storybook.frames)
        setCurrentPage(0)
      } else {
        message.error('Storybook not found')
        navigate('/story')
      }
    } catch (err) {
      console.error('Failed to load storybook:', err)
      message.error('Failed to load storybook')
    } finally {
      setLoadingStorybook(false)
    }
  }

  const loadSavedStorybooks = async () => {
    if (!user) return
    setLoadingStorybooks(true)
    try {
      const storybooks = await getStorybooks(user.uid)
      setSavedStorybooks(storybooks)
    } catch (err) {
      console.error('Failed to load storybooks:', err)
    } finally {
      setLoadingStorybooks(false)
    }
  }

  const handleEnhancePrompt = async () => {
    if (!prompt.trim()) {
      message.warning('Please enter a story idea first')
      return
    }

    setEnhancing(true)
    setError('')
    try {
      const enhanced = await enhanceStoryPrompt(prompt)
      setEnhancedPrompt(enhanced)
      message.success('Story concept enhanced!')
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to enhance prompt'
      setError(errorMessage)
      message.error(errorMessage)
    } finally {
      setEnhancing(false)
    }
  }

  const handleGenerateStorybook = async () => {
    const finalPrompt = enhancedPrompt || prompt
    if (!finalPrompt.trim()) {
      message.warning('Please enter a story idea first')
      return
    }

    setLoading(true)
    setError('')
    setFrames([])
    setCurrentPage(0)

    try {
      const generatedFrames = await generateStorybook(
        finalPrompt,
        2,
        (statusMsg, frameNum) => {
          setStatus(statusMsg)
          if (frameNum > 0) setCurrentPage(frameNum - 1)
        }
      )
      setFrames(generatedFrames)
      setCurrentPage(0)
      if (!storyTitle) {
        setStoryTitle(prompt.slice(0, 50) + (prompt.length > 50 ? '...' : ''))
      }
      message.success('Storybook generated successfully!')
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate storybook'
      setError(errorMessage)
      message.error(errorMessage)
    } finally {
      setLoading(false)
      setStatus('')
    }
  }

  const handleSaveStorybook = async () => {
    if (!user) {
      message.error('Please sign in to save')
      return
    }
    if (frames.length === 0) {
      message.warning('Generate a storybook first')
      return
    }

    const title = storyTitle.trim() || 'Untitled Storybook'

    setSaving(true)
    try {
      if (storybookId) {
        // Update existing
        await updateStorybook(storybookId, {
          title,
          prompt: enhancedPrompt || prompt,
          frames,
        }, user.uid)
        message.success('Storybook updated!')
      } else {
        // Create new
        const newId = await createStorybook({
          userId: user.uid,
          title,
          prompt: enhancedPrompt || prompt,
          frames,
        })
        setStorybookId(newId)
        navigate(`/story/${newId}`, { replace: true })
        message.success('Storybook saved!')
      }
      await loadSavedStorybooks()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save storybook'
      message.error(errorMessage)
    } finally {
      setSaving(false)
    }
  }

  const handleNewStorybook = () => {
    setStorybookId(null)
    setPrompt('')
    setEnhancedPrompt('')
    setStoryTitle('')
    setFrames([])
    setCurrentPage(0)
    setError('')
    navigate('/story')
  }

  const handleLoadStorybook = (storybook: Storybook) => {
    setStorybookId(storybook.id!)
    setPrompt(storybook.prompt)
    setEnhancedPrompt('')
    setStoryTitle(storybook.title)
    setFrames(storybook.frames)
    setCurrentPage(0)
    setShowLoadModal(false)
    navigate(`/story/${storybook.id}`, { replace: true })
    message.success('Storybook loaded!')
  }

  const handleDeleteStorybook = async (id: string) => {
    try {
      await deleteStorybook(id)
      message.success('Storybook deleted')
      await loadSavedStorybooks()
      if (id === storybookId) {
        handleNewStorybook()
      }
    } catch (err) {
      message.error('Failed to delete storybook')
    }
  }

  const handlePrevPage = () => {
    setCurrentPage((prev) => Math.max(0, prev - 1))
  }

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(frames.length - 1, prev + 1))
  }

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

  if (loadingStorybook) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 0' }}>
        <Spin size="large" />
        <Paragraph style={{ marginTop: 16, color: '#999' }}>Loading storybook...</Paragraph>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={3}>{storybookId ? 'Edit Storybook' : 'Story Editor'}</Title>
        <Space>
          <Button
            icon={<HomeOutlined />}
            onClick={() => navigate('/')}
          >
            Home
          </Button>
          <Button
            icon={<PlusOutlined />}
            onClick={handleNewStorybook}
          >
            New
          </Button>
          <Button
            icon={<FolderOpenOutlined />}
            onClick={() => {
              setShowLoadModal(true)
              loadSavedStorybooks()
            }}
          >
            Load
          </Button>
          <Button
            icon={<SaveOutlined />}
            onClick={handleSaveStorybook}
            loading={saving}
            disabled={frames.length === 0}
          >
            {storybookId ? 'Update' : 'Save'}
          </Button>
        </Space>
      </div>
      <Paragraph style={{ color: '#666' }}>
        Create a 2-page illustrated sci-fi storybook with AI.
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
            <label style={{ fontWeight: 500 }}>Story Idea <span style={{ color: '#ff4d4f' }}>*</span></label>
            <TextArea
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe your sci-fi story idea... (e.g., 'A lone astronaut discovers an ancient alien artifact on Europa')"
              style={{ marginTop: 8 }}
              disabled={loading}
            />
          </div>

          <div>
            <label style={{ fontWeight: 500 }}>Story Title <span style={{ color: '#999', fontWeight: 400 }}>(optional)</span></label>
            <Input
              value={storyTitle}
              onChange={(e) => setStoryTitle(e.target.value)}
              placeholder="Enter a title for your storybook..."
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
            Enhance Story Concept
          </Button>

          {enhancedPrompt && (
            <div>
              <label style={{ fontWeight: 500, color: '#6366f1' }}>Enhanced Concept</label>
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
            icon={<BookOutlined />}
            onClick={handleGenerateStorybook}
            loading={loading}
            disabled={!prompt.trim() && !enhancedPrompt.trim()}
            size="large"
          >
            Generate 2-Page Storybook
          </Button>

          {status && (
            <div style={{ textAlign: 'center' }}>
              <Spin /> <span style={{ marginLeft: 8 }}>{status}</span>
            </div>
          )}
        </Space>
      </Card>

      <Card title="Storybook Preview" style={{ marginTop: 24 }}>
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
                    <RobotOutlined style={{ fontSize: 48, marginBottom: 16 }} />
                    <div>Image failed to generate</div>
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
              Your AI-generated storybook will appear here...
            </Paragraph>
          </div>
        )}
      </Card>

      <Modal
        title="Load Storybook"
        open={showLoadModal}
        onCancel={() => setShowLoadModal(false)}
        footer={null}
        width={600}
      >
        <List
          loading={loadingStorybooks}
          dataSource={savedStorybooks}
          renderItem={(storybook) => (
            <List.Item
              actions={[
                <Button
                  type="link"
                  onClick={() => handleLoadStorybook(storybook)}
                >
                  Load
                </Button>,
                <Button
                  type="link"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => handleDeleteStorybook(storybook.id!)}
                />,
              ]}
            >
              <List.Item.Meta
                title={storybook.title}
                description={`${storybook.frames.length} pages • ${storybook.createdAt.toDate().toLocaleDateString()}`}
              />
            </List.Item>
          )}
          locale={{ emptyText: 'No saved storybooks' }}
        />
      </Modal>
    </div>
  )
}

export default StoryEditor

import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Typography, Card, Button, Input, Space, message, Spin, Alert, Image, Modal, List, Select, Progress } from 'antd'
import { RobotOutlined, ThunderboltOutlined, LeftOutlined, RightOutlined, BookOutlined, SaveOutlined, FolderOpenOutlined, DeleteOutlined, HomeOutlined, PlusOutlined, ShareAltOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../hooks/useAuth'
import { generateStorybook, enhanceStoryPrompt, generateStoryTags, StoryFrame } from '../../services/gemini'
import { createStorybook, getStorybooks, getStorybook, updateStorybook, deleteStorybook, Storybook } from '../../services/firestore'
import TagEditor from '../../components/common/TagEditor'

const { Title, Paragraph } = Typography
const { TextArea } = Input

function StoryEditor() {
  const { id } = useParams<{ id?: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { t } = useTranslation()
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
  const [frameCount, setFrameCount] = useState(5)
  const [generationProgress, setGenerationProgress] = useState(0)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [tags, setTags] = useState<string[]>([])
  const [generatingTags, setGeneratingTags] = useState(false)
  const storybookIdRef = useRef<string | null>(null)
  const pendingTagsRef = useRef<string[] | null>(null)

  // Keep ref in sync with state
  useEffect(() => {
    console.log('storybookId changed to:', storybookId)
    console.log('pendingTagsRef.current:', pendingTagsRef.current)
    storybookIdRef.current = storybookId
    // If we have pending tags and now have a storybookId, save them
    if (storybookId && pendingTagsRef.current && pendingTagsRef.current.length > 0) {
      const tagsToSave = pendingTagsRef.current
      pendingTagsRef.current = null
      console.log('Saving pending tags:', tagsToSave)
      updateStorybook(storybookId, { tags: tagsToSave })
        .then(() => console.log('Pending tags saved to Firestore'))
        .catch((err) => console.error('Failed to save pending tags:', err))
    }
  }, [storybookId])

  // Warn user before leaving page with unsaved changes (browser navigation)
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault()
        e.returnValue = ''
        return ''
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasUnsavedChanges])

  // Helper to confirm navigation when there are unsaved changes
  const confirmNavigation = (callback: () => void) => {
    if (hasUnsavedChanges) {
      if (window.confirm(t('storyEditor.unsavedChangesMessage'))) {
        callback()
      }
    } else {
      callback()
    }
  }

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
        setTags(storybook.tags || [])
        setCurrentPage(0)
        setHasUnsavedChanges(false)
      } else {
        message.error(t('storyEditor.storybookNotFound'))
        navigate('/story')
      }
    } catch (err) {
      console.error('Failed to load storybook:', err)
      message.error(t('storyEditor.failedToLoad'))
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
      message.warning(t('storyEditor.enterIdeaFirst'))
      return
    }

    setEnhancing(true)
    setError('')
    try {
      const enhanced = await enhanceStoryPrompt(prompt)
      setEnhancedPrompt(enhanced)
      message.success(t('storyEditor.storyConceptEnhanced'))
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : t('storyEditor.failedToEnhance')
      setError(errorMessage)
      message.error(errorMessage)
    } finally {
      setEnhancing(false)
    }
  }

  const handleGenerateStorybook = async () => {
    if (!storyTitle.trim()) {
      message.warning(t('storyEditor.enterTitleFirst'))
      return
    }
    const finalPrompt = enhancedPrompt || prompt
    if (!finalPrompt.trim()) {
      message.warning(t('storyEditor.enterIdeaFirst'))
      return
    }

    setLoading(true)
    setError('')
    setFrames([])
    setTags([])
    setCurrentPage(0)
    setGenerationProgress(0)

    try {
      const generatedFrames = await generateStorybook(
        finalPrompt,
        frameCount,
        (statusMsg, frameNum) => {
          setStatus(statusMsg)
          setGenerationProgress(frameNum)
          if (frameNum > 0) setCurrentPage(frameNum - 1)
        }
      )
      setFrames(generatedFrames)
      setCurrentPage(0)
      setHasUnsavedChanges(true)
      message.success(t('storyEditor.storybookGenerated'))
      // Remind user to save if this is a new storybook
      if (!storybookId) {
        setTimeout(() => {
          message.warning(t('storyEditor.rememberToSave'), 5)
        }, 1500)
      }
      // Generate tags (non-blocking)
      setGeneratingTags(true)
      generateStoryTags(finalPrompt, storyTitle)
        .then(async (generatedTags) => {
          console.log('Generated tags:', generatedTags)
          setTags(generatedTags)
          // Auto-save tags if storybook is already saved, otherwise mark as pending
          const currentId = storybookIdRef.current
          console.log('Current storybookId for auto-save:', currentId)
          if (currentId && generatedTags.length > 0) {
            try {
              await updateStorybook(currentId, { tags: generatedTags })
              console.log('Tags auto-saved to Firestore')
            } catch (err) {
              console.error('Failed to auto-save tags:', err)
            }
          } else if (generatedTags.length > 0) {
            // Store pending tags to be saved when storybookId becomes available
            console.log('Storing pending tags:', generatedTags)
            pendingTagsRef.current = generatedTags
          }
        })
        .catch((err) => {
          console.error('Failed to generate tags:', err)
        })
        .finally(() => {
          setGeneratingTags(false)
        })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : t('storyEditor.failedToGenerate')
      setError(errorMessage)
      message.error(errorMessage)
    } finally {
      setLoading(false)
      setStatus('')
      setGenerationProgress(0)
    }
  }

  const handleSaveStorybook = async () => {
    if (!user) {
      message.error(t('storyEditor.pleaseSignIn'))
      return
    }
    if (frames.length === 0) {
      message.warning(t('storyEditor.generateFirst'))
      return
    }

    const title = storyTitle.trim() || 'Untitled Storybook'

    setSaving(true)
    console.log('Saving storybook with tags:', tags)
    try {
      if (storybookId) {
        // Update existing (also set authorName if missing)
        await updateStorybook(storybookId, {
          authorName: user.displayName || (user.isAnonymous ? 'Anonymous' : 'Unknown'),
          title,
          prompt: enhancedPrompt || prompt,
          frames,
          tags: tags || [],
        }, user.uid)
        setHasUnsavedChanges(false)
        message.success(t('storyEditor.storybookUpdated'))
      } else {
        // Create new
        const newId = await createStorybook({
          userId: user.uid,
          authorName: user.displayName || (user.isAnonymous ? 'Anonymous' : 'Unknown'),
          title,
          prompt: enhancedPrompt || prompt,
          frames,
          tags: tags || [],
        })
        setStorybookId(newId)
        setHasUnsavedChanges(false)
        navigate(`/story/${newId}`, { replace: true })
        message.success(t('storyEditor.storybookSaved'))
      }
      await loadSavedStorybooks()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : t('storyEditor.failedToSave')
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
    setTags([])
    setCurrentPage(0)
    setError('')
    setHasUnsavedChanges(false)
    navigate('/story')
  }

  const handleLoadStorybook = (storybook: Storybook) => {
    const doLoad = () => {
      setStorybookId(storybook.id!)
      setPrompt(storybook.prompt)
      setEnhancedPrompt('')
      setStoryTitle(storybook.title)
      setFrames(storybook.frames)
      setTags(storybook.tags || [])
      setCurrentPage(0)
      setHasUnsavedChanges(false)
      setShowLoadModal(false)
      navigate(`/story/${storybook.id}`, { replace: true })
      message.success(t('storyEditor.storybookLoaded'))
    }
    confirmNavigation(doLoad)
  }

  const handleDeleteStorybook = async (id: string) => {
    try {
      await deleteStorybook(id)
      message.success(t('storyEditor.storybookDeleted'))
      await loadSavedStorybooks()
      if (id === storybookId) {
        handleNewStorybook()
      }
    } catch (err) {
      message.error(t('storyEditor.failedToDelete'))
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
        <Title level={3}>{t('storyEditor.title')}</Title>
        <Paragraph style={{ color: '#999' }}>
          {t('storyEditor.pleaseSignIn')}
        </Paragraph>
      </div>
    )
  }

  if (loadingStorybook) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 0' }}>
        <Spin size="large" />
        <Paragraph style={{ marginTop: 16, color: '#999' }}>{t('storyEditor.loadingStorybook')}</Paragraph>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={3}>{storybookId ? t('storyEditor.editStorybook') : t('storyEditor.title')}</Title>
        <Space>
          <Button
            icon={<HomeOutlined />}
            onClick={() => confirmNavigation(() => navigate('/'))}
          >
            {t('common.home')}
          </Button>
          <Button
            icon={<PlusOutlined />}
            onClick={() => confirmNavigation(handleNewStorybook)}
          >
            {t('storyEditor.new')}
          </Button>
          <Button
            icon={<FolderOpenOutlined />}
            onClick={() => {
              setShowLoadModal(true)
              loadSavedStorybooks()
            }}
          >
            {t('storyEditor.load')}
          </Button>
          <Button
            icon={<SaveOutlined />}
            onClick={handleSaveStorybook}
            loading={saving}
            disabled={frames.length === 0}
          >
            {storybookId ? t('storyEditor.update') : t('storyEditor.save')}
          </Button>
          <Button
            icon={<ShareAltOutlined />}
            onClick={() => {
              if (storybookId) {
                const publishUrl = `${window.location.origin}/view/${storybookId}`
                window.open(publishUrl, '_blank')
              } else {
                message.warning(t('storyEditor.saveFirst'))
              }
            }}
            disabled={!storybookId}
          >
            {t('storyEditor.publish')}
          </Button>
        </Space>
      </div>
      <Paragraph style={{ color: '#666' }}>
        {t('storyEditor.description')}
      </Paragraph>

      {error && (
        <Alert
          message={t('common.error')}
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
            <label style={{ fontWeight: 500 }}>{t('storyEditor.storyTitle')} <span style={{ color: '#ff4d4f' }}>*</span></label>
            <Input
              value={storyTitle}
              onChange={(e) => setStoryTitle(e.target.value)}
              placeholder={t('storyEditor.storyTitlePlaceholder')}
              style={{ marginTop: 8 }}
              disabled={loading}
            />
          </div>

          <div>
            <label style={{ fontWeight: 500 }}>{t('storyEditor.storyIdea')} <span style={{ color: '#ff4d4f' }}>*</span></label>
            <TextArea
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={t('storyEditor.storyIdeaPlaceholder')}
              style={{ marginTop: 8 }}
              disabled={loading}
            />
          </div>

          <div>
            <label style={{ fontWeight: 500 }}>{t('storyEditor.numberOfPages')}</label>
            <Select
              value={frameCount}
              onChange={(value) => setFrameCount(value)}
              style={{ width: 120, marginLeft: 12 }}
              disabled={loading}
              options={[
                { value: 2, label: `2 ${t('storyEditor.pages')}` },
                { value: 3, label: `3 ${t('storyEditor.pages')}` },
                { value: 4, label: `4 ${t('storyEditor.pages')}` },
                { value: 5, label: `5 ${t('storyEditor.pages')}` },
                { value: 6, label: `6 ${t('storyEditor.pages')}` },
                { value: 7, label: `7 ${t('storyEditor.pages')}` },
                { value: 8, label: `8 ${t('storyEditor.pages')}` },
                { value: 9, label: `9 ${t('storyEditor.pages')}` },
                { value: 10, label: `10 ${t('storyEditor.pages')}` },
              ]}
            />
          </div>

          <Button
            icon={<ThunderboltOutlined />}
            onClick={handleEnhancePrompt}
            loading={enhancing}
            disabled={loading || !prompt.trim()}
          >
            {t('storyEditor.enhanceStoryConcept')}
          </Button>

          {enhancedPrompt && (
            <div>
              <label style={{ fontWeight: 500, color: '#6366f1' }}>{t('storyEditor.enhancedConcept')}</label>
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
            disabled={!storyTitle.trim() || (!prompt.trim() && !enhancedPrompt.trim())}
            size="large"
          >
            {t('storyEditor.generateStorybook', { count: frameCount })}
          </Button>

          {status && (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <Progress
                percent={Math.round((generationProgress / frameCount) * 100)}
                status="active"
                format={() => `${generationProgress} / ${frameCount}`}
                style={{ maxWidth: 300, margin: '0 auto 12px' }}
              />
              <div>
                <Spin size="small" /> <span style={{ marginLeft: 8 }}>{status}</span>
              </div>
            </div>
          )}
        </Space>
      </Card>

      <Card title={t('storyEditor.storybookPreview')} style={{ marginTop: 24 }}>
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
                    alt={`${t('storyEditor.page')} ${currentPage + 1}`}
                    style={{ maxWidth: '100%', maxHeight: 400 }}
                    preview={true}
                  />
                ) : (
                  <div style={{ color: '#999', padding: 24, textAlign: 'center' }}>
                    <RobotOutlined style={{ fontSize: 48, marginBottom: 16 }} />
                    <div>{t('storyEditor.imageFailed')}</div>
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

            {/* Tags Section */}
            <div style={{ marginTop: 24 }}>
              <label style={{ fontWeight: 500, marginBottom: 8, display: 'block' }}>{t('tags.title')}</label>
              <TagEditor
                tags={tags}
                onChange={(newTags) => {
                  setTags(newTags)
                  setHasUnsavedChanges(true)
                  message.info(t('tags.rememberToSave'), 3)
                }}
                loading={generatingTags}
                editable={true}
              />
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <BookOutlined style={{ fontSize: 64, color: '#ddd', marginBottom: 16 }} />
            <Paragraph style={{ color: '#999' }}>
              {t('storyEditor.previewPlaceholder')}
            </Paragraph>
          </div>
        )}
      </Card>

      <Modal
        title={t('storyEditor.loadStorybook')}
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
                  {t('storyEditor.load')}
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
                description={`${storybook.frames.length} ${t('storyEditor.pages')} • ${storybook.createdAt.toDate().toLocaleDateString()}`}
              />
            </List.Item>
          )}
          locale={{ emptyText: t('storyEditor.noSavedStorybooks') }}
        />
      </Modal>

          </div>
  )
}

export default StoryEditor

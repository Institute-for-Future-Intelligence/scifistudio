import { useState, useEffect, useRef, useCallback } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import {
  Typography,
  Card,
  Input,
  Button,
  Slider,
  Space,
  message,
  Modal,
  List,
  Spin,
} from 'antd'
import {
  PlayCircleOutlined,
  PlusOutlined,
  SaveOutlined,
  UploadOutlined,
  HomeOutlined,
  DeleteOutlined,
  BulbOutlined,
} from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../hooks/useAuth'
import {
  generateVideo,
  enhanceVideoPrompt,
  generateVideoTags,
  VideoResult,
} from '../../services/gemini'
import {
  getVideos,
  getVideo,
  createVideo,
  updateVideo,
  deleteVideo,
  Video,
} from '../../services/firestore'
import TagEditor from '../../components/common/TagEditor'

const { Title, Paragraph, Text } = Typography
const { TextArea } = Input

function VideoEditor() {
  const { user } = useAuth()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  // Form state
  const [title, setTitle] = useState('')
  const [prompt, setPrompt] = useState('')
  const [duration, setDuration] = useState(8)
  const [enhancedPrompt, setEnhancedPrompt] = useState('')

  // Video state
  const [videoUrl, setVideoUrl] = useState('')
  const [tags, setTags] = useState<string[]>([])

  // UI state
  const [generating, setGenerating] = useState(false)
  const [generatingTags, setGeneratingTags] = useState(false)
  const [enhancing, setEnhancing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loadModalOpen, setLoadModalOpen] = useState(false)
  const [savedVideos, setSavedVideos] = useState<Video[]>([])
  const [loadingVideos, setLoadingVideos] = useState(false)
  const [videoId, setVideoId] = useState<string | null>(null)
  const [generationStatus, setGenerationStatus] = useState('')
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  // Refs for async operations
  const videoIdRef = useRef<string | null>(null)
  const pendingTagsRef = useRef<string[] | null>(null)

  // Track unsaved changes
  useEffect(() => {
    if (videoUrl && !videoId) {
      setHasUnsavedChanges(true)
    }
  }, [videoUrl, videoId])

  // Confirm navigation helper
  const confirmNavigation = (callback: () => void) => {
    if (hasUnsavedChanges) {
      if (window.confirm(t('videoEditor.unsavedChangesMessage'))) {
        callback()
      }
    } else {
      callback()
    }
  }

  // Load video from URL parameter
  useEffect(() => {
    const id = searchParams.get('id')
    if (id && user) {
      loadVideoById(id)
    }
  }, [searchParams, user])

  const loadVideoById = async (id: string) => {
    try {
      const video = await getVideo(id)
      if (video) {
        setTitle(video.title)
        setPrompt(video.prompt)
        setVideoUrl(video.videoUrl)
        setTags(video.tags || [])
        setVideoId(id)
        videoIdRef.current = id
        setHasUnsavedChanges(false)
        message.success(t('videoEditor.videoLoaded'))
      } else {
        message.error(t('videoEditor.videoNotFound'))
      }
    } catch (error) {
      console.error('Failed to load video:', error)
      message.error(t('videoEditor.failedToLoad'))
    }
  }

  const handleEnhancePrompt = async () => {
    if (!prompt.trim()) {
      message.warning(t('videoEditor.enterIdeaFirst'))
      return
    }

    setEnhancing(true)
    try {
      const enhanced = await enhanceVideoPrompt(prompt)
      setEnhancedPrompt(enhanced)
      message.success(t('videoEditor.conceptEnhanced'))
    } catch (error) {
      console.error('Failed to enhance prompt:', error)
      message.error(t('videoEditor.failedToEnhance'))
    } finally {
      setEnhancing(false)
    }
  }

  const handleGenerateVideo = async () => {
    if (!title.trim()) {
      message.warning(t('videoEditor.enterTitleFirst'))
      return
    }
    if (!prompt.trim()) {
      message.warning(t('videoEditor.enterIdeaFirst'))
      return
    }

    setGenerating(true)
    setVideoUrl('')
    setTags([])
    setVideoId(null)
    videoIdRef.current = null

    try {
      const finalPrompt = enhancedPrompt || prompt
      const result: VideoResult = await generateVideo(finalPrompt, setGenerationStatus)

      setVideoUrl(result.videoUrl)
      setHasUnsavedChanges(true)
      message.success(t('videoEditor.videoGenerated'))

      // Generate tags (non-blocking)
      setGeneratingTags(true)
      generateVideoTags(finalPrompt, title)
        .then((generatedTags) => {
          setTags(generatedTags)
          pendingTagsRef.current = generatedTags

          // Auto-save tags if video already saved
          if (videoIdRef.current) {
            updateVideo(videoIdRef.current, { tags: generatedTags })
          }
        })
        .catch((err) => console.error('Failed to generate tags:', err))
        .finally(() => setGeneratingTags(false))
    } catch (error) {
      console.error('Failed to generate video:', error)
      message.error(t('videoEditor.failedToGenerate'))
    } finally {
      setGenerating(false)
      setGenerationStatus('')
    }
  }

  const handleSave = async () => {
    if (!user) return
    if (!videoUrl) {
      message.warning(t('videoEditor.generateFirst'))
      return
    }
    if (!title.trim()) {
      message.warning(t('videoEditor.enterTitleFirst'))
      return
    }

    setSaving(true)
    try {
      const tagsToSave = pendingTagsRef.current || tags

      if (videoId) {
        await updateVideo(videoId, {
          title,
          prompt: enhancedPrompt || prompt,
          videoUrl,
          tags: tagsToSave,
        })
        message.success(t('videoEditor.videoUpdated'))
      } else {
        const newId = await createVideo({
          userId: user.uid,
          authorName: user.displayName || t('auth.guest'),
          title,
          prompt: enhancedPrompt || prompt,
          videoUrl,
          tags: tagsToSave,
          status: 'completed',
        })
        setVideoId(newId)
        videoIdRef.current = newId
        pendingTagsRef.current = null
        message.success(t('videoEditor.videoSaved'))
      }
      setHasUnsavedChanges(false)
    } catch (error) {
      console.error('Failed to save video:', error)
      message.error(t('videoEditor.failedToSave'))
    } finally {
      setSaving(false)
    }
  }

  const handleNew = () => {
    confirmNavigation(() => {
      setTitle('')
      setPrompt('')
      setEnhancedPrompt('')
      setVideoUrl('')
      setTags([])
      setVideoId(null)
      videoIdRef.current = null
      setHasUnsavedChanges(false)
      navigate('/video-editor')
    })
  }

  const handleLoadClick = async () => {
    if (!user) return
    setLoadModalOpen(true)
    setLoadingVideos(true)
    try {
      const videos = await getVideos(user.uid)
      setSavedVideos(videos)
    } catch (error) {
      console.error('Failed to load videos:', error)
      message.error(t('videoEditor.failedToLoad'))
    } finally {
      setLoadingVideos(false)
    }
  }

  const handleLoadVideo = (video: Video) => {
    confirmNavigation(() => {
      setTitle(video.title)
      setPrompt(video.prompt)
      setVideoUrl(video.videoUrl)
      setTags(video.tags || [])
      setVideoId(video.id || null)
      videoIdRef.current = video.id || null
      setHasUnsavedChanges(false)
      setLoadModalOpen(false)
      message.success(t('videoEditor.videoLoaded'))
    })
  }

  const handleDeleteVideo = async (video: Video) => {
    if (!video.id) return
    try {
      await deleteVideo(video.id)
      setSavedVideos((prev) => prev.filter((v) => v.id !== video.id))
      message.success(t('videoEditor.videoDeleted'))
    } catch (error) {
      console.error('Failed to delete video:', error)
      message.error(t('videoEditor.failedToDelete'))
    }
  }

  const handleTagsChange = useCallback((newTags: string[]) => {
    setTags(newTags)
    setHasUnsavedChanges(true)
    message.info(t('tags.rememberToSave'))
  }, [t])

  const handleHomeClick = () => {
    confirmNavigation(() => navigate('/'))
  }

  if (!user) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 0' }}>
        <Title level={3}>{t('videoEditor.title')}</Title>
        <Paragraph style={{ color: '#999' }}>
          {t('storyEditor.pleaseSignIn')}
        </Paragraph>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>
            {videoId ? t('videoEditor.editVideo') : t('videoEditor.title')}
          </Title>
          <Paragraph style={{ color: '#666', margin: 0 }}>
            {t('videoEditor.description')}
          </Paragraph>
        </div>
        <Space>
          <Button icon={<HomeOutlined />} onClick={handleHomeClick}>
            {t('common.home')}
          </Button>
          <Button icon={<PlusOutlined />} onClick={handleNew}>
            {t('storyEditor.new')}
          </Button>
          <Button icon={<UploadOutlined />} onClick={handleLoadClick}>
            {t('storyEditor.load')}
          </Button>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            onClick={handleSave}
            loading={saving}
            disabled={!videoUrl}
          >
            {videoId ? t('storyEditor.update') : t('storyEditor.save')}
          </Button>
        </Space>
      </div>

      <div style={{ display: 'flex', gap: 24 }}>
        {/* Left column - Form */}
        <div style={{ flex: 1 }}>
          <Card>
            <Space direction="vertical" style={{ width: '100%' }} size="large">
              {/* Title */}
              <div>
                <Text strong>{t('videoEditor.videoTitle')}</Text>
                <Input
                  placeholder={t('videoEditor.videoTitlePlaceholder')}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  style={{ marginTop: 8 }}
                  disabled={generating}
                />
              </div>

              {/* Prompt */}
              <div>
                <Text strong>{t('videoEditor.videoIdea')}</Text>
                <TextArea
                  placeholder={t('videoEditor.videoIdeaPlaceholder')}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={4}
                  style={{ marginTop: 8 }}
                  disabled={generating}
                />
                <Button
                  type="link"
                  icon={<BulbOutlined />}
                  onClick={handleEnhancePrompt}
                  loading={enhancing}
                  style={{ padding: 0, marginTop: 8 }}
                >
                  {t('videoEditor.enhanceConcept')}
                </Button>
              </div>

              {/* Enhanced Prompt */}
              {enhancedPrompt && (
                <div>
                  <Text strong>{t('videoEditor.enhancedConcept')}</Text>
                  <div
                    style={{
                      marginTop: 8,
                      padding: 12,
                      background: '#f5f5f5',
                      borderRadius: 4,
                      fontSize: 13,
                    }}
                  >
                    {enhancedPrompt}
                  </div>
                </div>
              )}

              {/* Duration */}
              <div>
                <Text strong>{t('videoEditor.duration')}</Text>
                <div style={{ padding: '8px 0' }}>
                  <Slider
                    min={4}
                    max={16}
                    step={4}
                    value={duration}
                    onChange={setDuration}
                    marks={{ 4: '4s', 8: '8s', 12: '12s', 16: '16s' }}
                    disabled={generating}
                  />
                </div>
              </div>

              {/* Generate Button */}
              <Button
                type="primary"
                size="large"
                icon={<PlayCircleOutlined />}
                onClick={handleGenerateVideo}
                loading={generating}
                block
              >
                {generating
                  ? generationStatus || t('videoEditor.generating')
                  : t('videoEditor.generateVideo')}
              </Button>
            </Space>
          </Card>
        </div>

        {/* Right column - Preview */}
        <div style={{ flex: 1 }}>
          <Card title={t('videoEditor.videoPreview')}>
            {generating ? (
              <div
                style={{
                  minHeight: 300,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Spin size="large" />
                <Text style={{ marginTop: 16, color: '#666' }}>
                  {generationStatus || t('videoEditor.generating')}
                </Text>
              </div>
            ) : videoUrl ? (
              <div>
                <video
                  src={videoUrl}
                  controls
                  autoPlay
                  loop
                  style={{
                    width: '100%',
                    borderRadius: 8,
                    background: '#000',
                  }}
                />
                <div style={{ marginTop: 16 }}>
                  <TagEditor
                    tags={tags}
                    onChange={handleTagsChange}
                    editable={true}
                    loading={generatingTags}
                  />
                </div>
              </div>
            ) : (
              <div
                style={{
                  minHeight: 300,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <PlayCircleOutlined
                  style={{ fontSize: 64, color: '#ddd', marginBottom: 16 }}
                />
                <Text style={{ color: '#999' }}>
                  {t('videoEditor.previewPlaceholder')}
                </Text>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Load Modal */}
      <Modal
        title={t('videoEditor.loadVideo')}
        open={loadModalOpen}
        onCancel={() => setLoadModalOpen(false)}
        footer={null}
        width={600}
      >
        {loadingVideos ? (
          <div style={{ textAlign: 'center', padding: 48 }}>
            <Spin />
          </div>
        ) : savedVideos.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 48, color: '#999' }}>
            {t('videoEditor.noSavedVideos')}
          </div>
        ) : (
          <List
            dataSource={savedVideos}
            renderItem={(video) => (
              <List.Item
                actions={[
                  <Button
                    key="load"
                    type="link"
                    onClick={() => handleLoadVideo(video)}
                  >
                    {t('storyEditor.load')}
                  </Button>,
                  <Button
                    key="delete"
                    type="link"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => handleDeleteVideo(video)}
                  />,
                ]}
              >
                <List.Item.Meta
                  title={video.title}
                  description={
                    video.prompt.length > 100
                      ? video.prompt.substring(0, 100) + '...'
                      : video.prompt
                  }
                />
              </List.Item>
            )}
          />
        )}
      </Modal>
    </div>
  )
}

export default VideoEditor
